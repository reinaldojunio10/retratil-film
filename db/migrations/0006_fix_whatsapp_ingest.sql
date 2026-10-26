-- Corrige referência ambígua à coluna "phone" (BUG-001)
create or replace function app_whatsapp_ingest(p_payload jsonb, p_signature_valid boolean) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  ev_id bigint;
  change jsonb;
  m jsonb;
  st jsonb;
  inbound int := 0;
  updated int := 0;
  v_phone text;
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
      v_phone := normalize_phone(m->>'from');
      select id into cid from clients
       where archived_at is null and (normalize_phone(clients.whatsapp) = v_phone or normalize_phone(clients.phone) = v_phone)
       order by created_at limit 1;
      insert into whatsapp_messages(client_id, direction, phone, body, wa_message_id, status, source, created_by)
      values (cid, 'in', v_phone,
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
