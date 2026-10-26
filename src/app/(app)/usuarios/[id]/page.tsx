import { notFound } from "next/navigation";
import { EntityForm } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { tx } from "@/lib/auth";
import { fmtPhone } from "@/lib/format";
import { resetPassword, updateUser } from "../actions";
import { userFields } from "../fields";

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const u = await tx((db) => db.one<Record<string, any>>("select id, name, email, phone, role, active from users where id = $1", [id]), "usuarios"); // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!u) notFound();
  return (
    <>
      <PageHeader title={u.name} back={{ href: "/usuarios", label: "Usuários" }} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Dados e perfil"><EntityForm action={updateUser.bind(null, id)} fields={userFields} defaults={{ ...u, phone: u.phone ? fmtPhone(u.phone) : "" }} compact /></Card>
        <Card title="Redefinir senha">
          <EntityForm action={resetPassword.bind(null, id)} compact resetOnSuccess submitLabel="Redefinir senha" fields={[
            { name: "password", label: "Nova senha (mín. 8 caracteres)", type: "password", required: true },
            { name: "confirm", label: "Confirmar senha", type: "password", required: true },
          ]} />
        </Card>
      </div>
    </>
  );
}
