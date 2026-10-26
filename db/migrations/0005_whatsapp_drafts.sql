-- Permite descartar rascunhos de mensagens (somente rascunhos; histórico enviado/recebido é preservado)
grant delete on whatsapp_messages to app_runtime;
drop policy if exists whatsapp_messages_delete on whatsapp_messages;
create policy whatsapp_messages_delete on whatsapp_messages for delete using ((select app_can('whatsapp', true)) and status = 'rascunho');
