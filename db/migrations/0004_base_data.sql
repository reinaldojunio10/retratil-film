-- Retrátil Film — dados de configuração iniciais (não são dados de clientes)

insert into company_settings(id) values (1) on conflict do nothing;

-- Matriz padrão de permissões (o proprietário tem acesso total e pode alterá-la em /usuarios)
insert into role_permissions(role, module, can_read, can_write)
select r, m,
  case
    when r = 'admin' then true
    when r = 'comercial' then m in ('dashboard','clientes','funil','servicos','propostas','contratos','projetos','tarefas','whatsapp','relatorios','equipamentos')
    when r = 'producao' then m in ('dashboard','clientes','servicos','projetos','tarefas','equipamentos')
    when r = 'financeiro' then m in ('dashboard','clientes','servicos','propostas','contratos','projetos','tarefas','financeiro','relatorios')
  end,
  case
    when r = 'admin' then m <> 'usuarios'
    when r = 'comercial' then m in ('clientes','funil','propostas','contratos','tarefas','whatsapp')
    when r = 'producao' then m in ('projetos','tarefas','equipamentos')
    when r = 'financeiro' then m in ('financeiro','tarefas')
  end
from unnest(array['admin','comercial','producao','financeiro']) r,
     unnest(array['dashboard','clientes','funil','servicos','propostas','contratos','projetos','tarefas','financeiro','equipamentos','whatsapp','relatorios','usuarios','configuracoes']) m
on conflict do nothing;

-- Catálogo de serviços (valores em 0 — configure em Serviços)
insert into services(name, category, unit, description) values
  ('Gravação de DVD musical', 'producao', 'projeto', 'Captação multicâmera, áudio e pós-produção de DVD/projeto audiovisual musical.'),
  ('Videoclipe', 'producao', 'projeto', 'Roteiro, direção, captação e edição de videoclipe.'),
  ('Captação de show', 'captacao', 'diaria', 'Filmagem de apresentação ao vivo.'),
  ('Conteúdo para artistas', 'producao', 'projeto', 'Pacote de conteúdo para redes sociais de artistas.'),
  ('Vídeo institucional para empresas', 'producao', 'projeto', 'Produção de vídeo institucional ou comercial.'),
  ('Filmagem de evento', 'captacao', 'diaria', 'Cobertura audiovisual de eventos.'),
  ('Edição de vídeo', 'edicao', 'projeto', 'Edição, color e finalização.'),
  ('Locação de equipamentos', 'locacao', 'diaria', 'Locação de câmeras, lentes, áudio e iluminação.')
on conflict do nothing;

insert into contract_templates(name, body) values (
'Prestação de serviços audiovisuais (modelo base — revisar com advogado)',
$t$CONTRATO DE PRESTAÇÃO DE SERVIÇOS AUDIOVISUAIS

CONTRATANTE: {{contratante_nome}}, inscrito(a) sob o documento {{contratante_documento}}, com endereço em {{contratante_endereco}}, {{contratante_cidade}}, e-mail {{contratante_email}}, telefone {{contratante_telefone}}.

CONTRATADA: {{contratada_nome}}, inscrita sob o documento {{contratada_documento}}, com endereço em {{contratada_endereco}}, {{contratada_cidade}}.

CLÁUSULA 1 — OBJETO
A CONTRATADA prestará ao CONTRATANTE os seguintes serviços, referentes ao projeto "{{projeto}}":
{{servicos}}

CLÁUSULA 2 — LOCAL E PRAZOS
Local de execução: {{local}}. Início: {{data_inicio}}. Término/entrega: {{data_fim}}.

CLÁUSULA 3 — VALOR E PAGAMENTO
Pelos serviços, o CONTRATANTE pagará o valor total de {{valor_total}}, nas seguintes condições: {{condicoes_pagamento}}.

CLÁUSULA 4 — OBRIGAÇÕES
A CONTRATADA se compromete a executar os serviços com qualidade técnica e dentro dos prazos acordados. O CONTRATANTE se compromete a fornecer as informações, acessos e autorizações necessárias à execução.

CLÁUSULA 5 — DIREITOS DE IMAGEM E USO
O material produzido poderá ser utilizado pela CONTRATADA em seu portfólio, salvo manifestação contrária por escrito do CONTRATANTE.

CLÁUSULA 6 — CANCELAMENTO
Em caso de cancelamento pelo CONTRATANTE, os valores referentes a custos já incorridos não serão reembolsados.

CLÁUSULA 7 — FORO
Fica eleito o foro da comarca de {{contratada_cidade}} para dirimir quaisquer dúvidas oriundas deste contrato.

{{contratada_cidade}}, {{data_atual}}.


_______________________________________
{{contratante_nome}} — CONTRATANTE


_______________________________________
{{contratada_nome}} — CONTRATADA
$t$);

-- Modelos de mensagem: precisam ser criados e APROVADOS no WhatsApp Manager antes do uso real
insert into whatsapp_templates(name, language, category, purpose, body_preview, variables, approved) values
  ('retratil_followup', 'pt_BR', 'utility', 'followup', 'Olá {{1}}, tudo bem? Aqui é da Retrátil Film. Passando para dar continuidade ao seu atendimento. Podemos conversar?', 1, false),
  ('retratil_proposta_validade', 'pt_BR', 'utility', 'proposta', 'Olá {{1}}! Lembrando que a proposta {{2}} da Retrátil Film está próxima do vencimento. Ficamos à disposição para dúvidas.', 2, false),
  ('retratil_lembrete_tarefa', 'pt_BR', 'utility', 'tarefa', 'Olá {{1}}, lembrete da Retrátil Film: {{2}}.', 2, false)
on conflict do nothing;
