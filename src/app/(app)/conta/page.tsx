import { EntityForm } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ROLES } from "@/lib/permissions";
import { changePassword } from "./actions";
import { InstallApp } from "@/components/pwa";

export const metadata = { title: "Minha conta" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Minha conta" description={`${user.name} · ${user.email} · ${ROLES[user.role]}`} />
      <Card title="Alterar senha" className="max-w-xl">
        <EntityForm action={changePassword} compact resetOnSuccess submitLabel="Alterar senha" fields={[
          { name: "current", label: "Senha atual", type: "password", required: true },
          { name: "password", label: "Nova senha (mín. 8 caracteres)", type: "password", required: true },
          { name: "confirm", label: "Confirmar nova senha", type: "password", required: true },
        ]} />
      </Card>
      <Card title="Instalar o app na tela inicial" className="mt-6 max-w-xl">
        <InstallApp />
      </Card>
    </>
  );
}
