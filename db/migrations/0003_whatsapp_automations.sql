-- Retrátil Film — processamento de webhook do WhatsApp e automações comerciais
-- As automações NUNCA enviam mensagens: criam rascunhos e tarefas para revisão humana.

create or replace function app_whatsapp_ingest(p_payload jsonb, p_signature_valid boolean) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  ev_id bigint;
  change jsonb;
  m jsonb;
  st jsonb;
  inbound int := 0;
  updated int := 0;
  phone text;
  cid uuid;
  new_status text;
begin
  insert into webhook_events(provider, signature_valid, payload) values ('whatsapp', p_signature_valid, p_payload) returning id into ev_id;
  if not p_signature_valid then
    update webhook_events set error = 'assinatura inválida' where id = ev_id;
    return jsonb_build_object('ok', false, 'error', 'invalid_signature');
  end if;
  for change in select c from jsonb_array_elements(coalesce(p_payload->'entry', '[]'::jsonb)) e,
                       jsonb_array_elements(coalesce(e->'changes', '[]'::jsonb)) c
  loop
    for m in select * from jsonb_array_elements(coalesce(change->'value'->'messages', '[]'::jsonb)) loop
      phone := normalize_phone(m->>'from');
      select id into cid from clients
       where archived_at is null and (normalize_phone(whatsapp) = phone or normalize_phone(phone) = phone)
       order by created_at limit 1;
      insert into whatsapp_messages(client_id, direction, phone, body, wa_message_id, status, source, created_by)
      values (cid, 'in', phone,
              coalesce(m->'text'->>'body', m->'button'->>'text', m->'interactive'->'button_reply'->>'title', '[' || coalesce(m->>'type', 'mensagem') || ']'),
              m->>'id', 'recebido', 'webhook', null)
      on conflict (wa_message_id) do nothing;
      inbound := inbound + 1;
    end loop;
    for st in select * from jsonb_array_elements(coalesce(change->'value'->'statuses', '[]'::jsonb)) loop
      new_status := case st->>'status' when 'sent' then 'enviado' when 'delivered' then 'entregue' when 'read' then 'lido' when 'failed' then 'falhou' end;
      if new_status is not null then
        update whatsapp_messages set status = new_status,
               error = case when new_status = 'falhou' then coalesce(st->'errors'->0->>'title', 'falha informada pela Meta') else error end
         where wa_message_id = st->>'id'
           -- não regride status (ex.: "entregue" chegando depois de "lido")
           and array_position(array['enviando','enviado','entregue','lido'], status) is not null
           and (new_status = 'falhou' or array_position(array['enviando','enviado','entregue','lido'], new_status) > array_position(array['enviando','enviado','entregue','lido'], status));
        updated := updated + 1;
      end if;
    end loop;
  end loop;
  update webhook_events set processed = true where id = ev_id;
  return jsonb_build_object('ok', true, 'inbound', inbound, 'statuses', updated);
end $$;

create or replace function app_run_automations() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r record;
  tpl record;
  drafts int := 0;
  new_tasks int := 0;
  n int;
begin
  if app_user_id() is not null and not app_can('whatsapp', true) then
    raise exception 'Sem permissão para executar automações.' using errcode = '42501';
  end if;

  -- 1) Follow-up comercial: próximos contatos vencidos
  select * into tpl from whatsapp_templates where purpose = 'followup' and active order by approved desc, created_at limit 1;
  for r in select d.*, c.name client_name, c.whatsapp, c.phone client_phone from deals d join clients c on c.id = d.client_id
            where d.stage not in ('fechado','perdido') and d.next_contact_at <= now() and c.archived_at is null loop
    if coalesce(r.whatsapp, r.client_phone) is not null then
      insert into whatsapp_messages(client_id, direction, phone, body, template_id, template_params, status, source, related_type, related_id, created_by)
      values (r.client_id, 'out', normalize_phone(coalesce(r.whatsapp, r.client_phone)),
              coalesce(replace(tpl.body_preview, '{{1}}', split_part(r.client_name, ' ', 1)), 'Olá ' || split_part(r.client_name, ' ', 1) || ', tudo bem? Passando para dar continuidade à nossa conversa sobre ' || r.title || '.'),
              tpl.id, case when tpl.id is not null then jsonb_build_array(split_part(r.client_name, ' ', 1)) end,
              'rascunho', 'automacao', 'deal', r.id, null)
      on conflict do nothing;
      get diagnostics n = row_count; drafts := drafts + n;
    end if;
    if not exists (select 1 from tasks where deal_id = r.id and status in ('pendente','em_andamento') and title like 'Follow-up:%') then
      insert into tasks(title, kind, priority, due_at, assignee_id, client_id, deal_id, created_by)
      values ('Follow-up: ' || r.title, 'tarefa', 'alta', now(), coalesce(r.owner_id, r.created_by), r.client_id, r.id, null);
      new_tasks := new_tasks + 1;
    end if;
  end loop;

  -- 2) Propostas enviadas vencendo em até 3 dias
  select * into tpl from whatsapp_templates where purpose = 'proposta' and active order by approved desc, created_at limit 1;
  for r in select p.*, c.name client_name, c.whatsapp, c.phone client_phone from proposals p join clients c on c.id = p.client_id
            where p.status = 'enviada' and p.valid_until between current_date and current_date + 3 loop
    if coalesce(r.whatsapp, r.client_phone) is not null then
      insert into whatsapp_messages(client_id, direction, phone, body, template_id, template_params, status, source, related_type, related_id, created_by)
      values (r.client_id, 'out', normalize_phone(coalesce(r.whatsapp, r.client_phone)),
              coalesce(replace(replace(tpl.body_preview, '{{1}}', split_part(r.client_name, ' ', 1)), '{{2}}', r.code),
                       'Olá ' || split_part(r.client_name, ' ', 1) || ', a proposta ' || r.code || ' é válida até ' || to_char(r.valid_until, 'DD/MM/YYYY') || '. Posso ajudar com alguma dúvida?'),
              tpl.id, case when tpl.id is not null then jsonb_build_array(split_part(r.client_name, ' ', 1), r.code) end,
              'rascunho', 'automacao', 'proposal', r.id, null)
      on conflict do nothing;
      get diagnostics n = row_count; drafts := drafts + n;
    end if;
    if not exists (select 1 from tasks where client_id = r.client_id and status in ('pendente','em_andamento') and title = 'Proposta vencendo: ' || r.code) then
      insert into tasks(title, kind, priority, due_at, assignee_id, client_id, created_by)
      values ('Proposta vencendo: ' || r.code, 'tarefa', 'alta', r.valid_until::timestamptz, r.created_by, r.client_id, null);
      new_tasks := new_tasks + 1;
    end if;
  end loop;

  -- 3) Lembrete de tarefas das próximas 24h para o responsável (telefone do usuário)
  select * into tpl from whatsapp_templates where purpose = 'tarefa' and active order by approved desc, created_at limit 1;
  for r in select t.*, u.name user_name, u.phone user_phone from tasks t join users u on u.id = t.assignee_id
            where t.status in ('pendente','em_andamento') and t.due_at between now() and now() + interval '24 hours'
              and u.phone is not null and u.active loop
    insert into whatsapp_messages(client_id, direction, phone, body, template_id, template_params, status, source, related_type, related_id, created_by)
    values (null, 'out', normalize_phone(r.user_phone),
            coalesce(replace(replace(tpl.body_preview, '{{1}}', split_part(r.user_name, ' ', 1)), '{{2}}', r.title),
                     'Lembrete: "' || r.title || '" vence em ' || to_char(r.due_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') || '.'),
            tpl.id, case when tpl.id is not null then jsonb_build_array(split_part(r.user_name, ' ', 1), r.title) end,
            'rascunho', 'automacao', 'task', r.id, null)
    on conflict do nothing;
    get diagnostics n = row_count; drafts := drafts + n;
  end loop;

  return jsonb_build_object('rascunhos', drafts, 'tarefas', new_tasks, 'executado_em', now());
end $$;

revoke execute on function app_whatsapp_ingest(jsonb, boolean) from public;
revoke execute on function app_run_automations() from public;
grant execute on function app_whatsapp_ingest(jsonb, boolean) to app_runtime;
grant execute on function app_run_automations() to app_runtime;
