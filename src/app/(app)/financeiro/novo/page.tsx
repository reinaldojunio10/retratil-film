import { EntityForm } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { tx } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { lookups } from "@/lib/lookups";
import { createTx } from "../actions";
import { txFields } from "../fields";

export default async function NewTx({ searchParams }: { searchParams: Promise<{ tipo?: string; projeto?: string }> }) {
  const sp = await searchParams;
  const o = await tx(async (db) => ({ clients: await lookups.clients(db), projects: await lookups.projects(db) }), "financeiro");
  const tipo = sp.tipo === "despesa" ? "despesa" : "receita";
  return (
    <>
      <PageHeader title={tipo === "receita" ? "Nova receita" : "Nova despesa"} back={{ href: "/financeiro", label: "Financeiro" }} />
      <Card><EntityForm action={createTx} fields={txFields(o)} cancelHref="/financeiro"
        defaults={{ type: tipo, status: "pendente", due_date: todayISO(), category: tipo === "receita" ? "servicos" : "outros", project_id: sp.projeto }} /></Card>
    </>
  );
}
