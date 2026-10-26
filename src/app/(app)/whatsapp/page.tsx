import Link from "next/link";
import { ConfirmButton, EntityForm } from "@/components/form";
import { Badge, ButtonLink, Card, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { tx } from "@/lib/auth";
import { fmtDateTime, fmtPhone } from "@/lib/format";
import { MESSAGE_STATUS } from "@/lib/labels";
import { lookups } from "@/lib/lookups";
import { can } from "@/lib/permissions";
import { waConfig } from "@/lib/whatsapp";
import { composeMessage, discardDraft, runAutomations, sendDraft } from "./actions";

export const metadata = { title: "WhatsApp" };

type M = { id: string; direction: string; phone: string; body: string | null; status: string; error: string | null; source: string; created_at: Date; client_id: string | null; client_name: string | null; template_name: string | null };

export default async function WhatsAppPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const sp = await searchParams;
  const cliente = sp.cliente && /^[0-9a-f-]{36}$/.test(sp.cliente) ? sp.cliente : "";
  const cfg = waConfig();
  const data = await tx(async (db, user) => ({
    user,
    clients: await lookups.clients(db),
    templates: await db.many<{ value: string; label: string }>("select id::text value, name || case when approved then ' (aprovado)' else ' (não aprovado)' end || ' — ' || variables || ' var.' label from whatsapp_templates where active order by name"),
    drafts: await db.many<M>("select m.*, c.name client_name, t.name template_name from whatsapp_messages m left join clients c on c.id = m.client_id left join whatsapp_templates t on t.id = m.template_id where m.status in ('rascunho','falhou') order by m.created_at desc limit 50"),
    messages: await db.many<M>(
      `select m.*, c.name client_name, t.name template_name from whatsapp_messages m left join clients c on c.id = m.client_id left join whatsapp_templates t on t.id = m.template_id
        where m.status not in ('rascunho') and ($1 = '' or m.client_id::text = $1) order by m.created_at desc limit 100`, [cliente]),
    events: await db.one<{ total: number; invalid: number; last: Date | null }>("select count(*) total, count(*) filter (where not signature_valid) invalid, max(received_at) last from webhook_events"),
  }), "whatsapp");
  const w = can(data.user, "whatsapp", true);
  const appUrl = process.env.APP_URL ?? "";
  const modeInfo = {
    disabled: { tone: "neutral" as const, label: "Integração pendente", text: cfg.requested === "live" ? "Modo produção solicitado, mas faltam credenciais. Nenhuma mensagem será enviada." : "Nenhuma mensagem é enviada. Configure as credenciais da WhatsApp Business Platform." },
    test: { tone: "warning" as const, label: "Modo de teste", text: "Envios são apenas SIMULADOS e registrados no histórico. Nada sai para o WhatsApp." },
    live: { tone: "success" as const, label: "Produção (Cloud API)", text: "Envios reais pela API oficial. Automações continuam gerando apenas rascunhos." },
  }[cfg.mode];

  return (
    <>
      <PageHeader title="WhatsApp" description="Histórico por cliente, modelos, rascunhos e automações de acompanhamento."
        actions={<>{w && <ButtonLink variant="secondary" href="/whatsapp/modelos">Modelos de mensagem</ButtonLink>}
          {w && <form action={runAutomations}><button className="btn btn-primary">Executar automações</button></form>}</>} />
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card title="Status da integração" className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2"><Badge tone={modeInfo.tone}>{modeInfo.label}</Badge><span className="text-sm text-stone-600">{modeInfo.text}</span></div>
          {cfg.missing.length > 0 && <p className="mt-3 text-xs text-stone-500">Variáveis não configuradas: {cfg.missing.map((m) => <code key={m} className="mr-1 rounded bg-soft px-1">{m}</code>)}</p>}
          <p className="mt-3 text-xs text-stone-500">URL do webhook para cadastrar no app da Meta: <code className="rounded bg-soft px-1">{appUrl || "(defina APP_URL)"}/api/whatsapp/webhook</code></p>
          <p className="mt-1 text-xs text-stone-500">Eventos recebidos: {data.events?.total ?? 0} ({data.events?.invalid ?? 0} com assinatura inválida) · último: {fmtDateTime(data.events?.last)}</p>
        </Card>
        <Card title="Regras aplicadas">
          <ul className="list-disc space-y-1 pl-4 text-xs text-stone-600">
            <li>Mensagem livre só dentro de 24h após o cliente escrever.</li>
            <li>Fora da janela, apenas modelos aprovados pela Meta.</li>
            <li>Automações criam rascunhos e tarefas — o envio é sempre manual.</li>
            <li>Webhooks só são processados com assinatura válida.</li>
          </ul>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={`Rascunhos e falhas (${data.drafts.length})`} padded={false}>
            {data.drafts.length ? (
              <ul className="divide-y divide-line">
                {data.drafts.map((m) => (
                  <li key={m.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-stone-500">{m.client_name ?? fmtPhone(m.phone)} · {m.source === "automacao" ? "Automação" : "Manual"} {m.template_name && `· modelo ${m.template_name}`} · {fmtDateTime(m.created_at)}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{m.body}</p>
                      {m.error && <p className="mt-1 text-xs text-red-700">{m.error}</p>}
                    </div>
                    {w && (
                      <div className="flex shrink-0 gap-2">
                        <form action={sendDraft}><input type="hidden" name="id" value={m.id} /><ConfirmButton message={cfg.mode === "live" ? "Enviar esta mensagem de verdade pelo WhatsApp?" : "Processar esta mensagem? (sem envio real)"} className="btn btn-primary btn-sm">{cfg.mode === "test" ? "Simular envio" : "Enviar"}</ConfirmButton></form>
                        {m.status === "rascunho" && <form action={discardDraft}><input type="hidden" name="id" value={m.id} /><ConfirmButton message="Descartar rascunho?" className="btn btn-secondary btn-sm">Descartar</ConfirmButton></form>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : <Empty title="Nenhum rascunho pendente" />}
          </Card>
          <Card title="Histórico" actions={cliente && <Link className="text-xs link" href="/whatsapp">Ver todos</Link>} padded={false}>
            {data.messages.length ? (
              <ul className="divide-y divide-line">
                {data.messages.map((m) => (
                  <li key={m.id} className={`p-4 ${m.direction === "in" ? "bg-soft/50" : ""}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-stone-500">
                        {m.direction === "in" ? "Recebida de " : "Para "}
                        {m.client_id ? <Link className="link" href={`/clientes/${m.client_id}`}>{m.client_name}</Link> : fmtPhone(m.phone)} · {fmtDateTime(m.created_at)}
                      </p>
                      <StatusBadge map={MESSAGE_STATUS} value={m.status} />
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{m.body}</p>
                    {m.error && <p className="mt-1 text-xs text-red-700">{m.error}</p>}
                  </li>
                ))}
              </ul>
            ) : <Empty title="Nenhuma mensagem registrada" />}
          </Card>
        </div>
        {w && (
          <Card title="Nova mensagem">
            <EntityForm action={composeMessage} compact resetOnSuccess submitLabel="Salvar" defaults={{ client_id: cliente, send_now: false }} fields={[
              { name: "client_id", label: "Cliente", type: "select", options: data.clients },
              { name: "phone", label: "Ou número (com DDD)", type: "tel" },
              { name: "template_id", label: "Modelo (obrigatório fora da janela de 24h)", type: "select", options: data.templates },
              { name: "params", label: "Variáveis do modelo, separadas por |", placeholder: "Ex.: Maria|RF-2026-0001" },
              { name: "body", label: "Mensagem livre (se não usar modelo)", type: "textarea", rows: 4 },
              { name: "send_now", label: cfg.mode === "test" ? "Simular envio agora" : "Enviar agora", type: "checkbox" },
            ]} />
          </Card>
        )}
      </div>
    </>
  );
}
