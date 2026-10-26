import Link from "next/link";
import { EntityForm } from "@/components/form";
import { Badge, Card, PageHeader, Table } from "@/components/ui";
import { tx } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { MODULES, ROLES, type Role } from "@/lib/permissions";
import { createUser } from "./actions";
import { userFields } from "./fields";
import { PermissionsForm } from "./permissions-form";

export const metadata = { title: "Usuários" };

export default async function UsersPage() {
  const { users, perms, user } = await tx(async (db, user) => ({
    user,
    users: await db.many<{ id: string; name: string; email: string; role: Role; active: boolean; created_at: Date }>("select id, name, email, role, active, created_at from users order by active desc, name"),
    perms: await db.many<{ role: string; module: string; can_read: boolean; can_write: boolean }>("select * from role_permissions"),
  }), "usuarios");
  const owner = user.role === "owner";
  return (
    <>
      <PageHeader title="Usuários e permissões" description={owner ? "Somente o proprietário pode criar usuários e alterar permissões." : "Visualização. Apenas o proprietário pode fazer alterações."} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table head={["Nome", "E-mail", "Perfil", "Situação", "Desde"]}>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="td">{owner ? <Link className="link" href={`/usuarios/${u.id}`}>{u.name}</Link> : u.name}</td>
                <td className="td">{u.email}</td>
                <td className="td"><Badge tone={u.role === "owner" ? "dark" : "neutral"}>{ROLES[u.role]}</Badge></td>
                <td className="td">{u.active ? <Badge tone="success">Ativo</Badge> : <Badge>Inativo</Badge>}</td>
                <td className="td text-xs">{fmtDateTime(u.created_at)}</td>
              </tr>
            ))}
          </Table>
        </div>
        {owner && (
          <Card title="Novo usuário">
            <EntityForm action={createUser} compact submitLabel="Criar usuário" defaults={{ role: "comercial", active: true }}
              fields={[...userFields, { name: "password", label: "Senha inicial (mín. 8 caracteres)", type: "password", required: true }]} />
          </Card>
        )}
      </div>
      <div className="mt-6">
        <Card title="Permissões por perfil" padded={false}>
          <PermissionsForm owner={owner} modules={MODULES.map((m) => ({ key: m.key, label: m.label }))} perms={perms} />
        </Card>
      </div>
    </>
  );
}
