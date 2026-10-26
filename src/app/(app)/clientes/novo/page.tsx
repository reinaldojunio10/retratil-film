import { EntityForm } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { tx } from "@/lib/auth";
import { lookups } from "@/lib/lookups";
import { createClient } from "../actions";
import { clientFields } from "../fields";

export default async function NewClient() {
  const users = await tx((db) => lookups.users(db), "clientes");
  return (
    <>
      <PageHeader title="Novo cliente" back={{ href: "/clientes", label: "Clientes" }} />
      <Card><EntityForm action={createClient} fields={clientFields(users)} defaults={{ source: "whatsapp" }} cancelHref="/clientes" /></Card>
    </>
  );
}
