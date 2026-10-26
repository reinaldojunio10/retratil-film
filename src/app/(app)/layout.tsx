import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { getSession, logout } from "@/lib/auth";
import { can, MODULES, ROLES } from "@/lib/permissions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");
  const nav = MODULES.filter((m) => can(user, m.key)).map(({ key, label, href }) => ({ key, label, href }));
  let flash = null;
  const raw = (await cookies()).get("rf_flash")?.value;
  if (raw) {
    try { flash = JSON.parse(decodeURIComponent(raw)); } catch { flash = null; }
  }
  async function logoutAction() {
    "use server";
    await logout();
    redirect("/login");
  }
  return (
    <Shell nav={nav} user={{ name: user.name, email: user.email }} roleLabel={ROLES[user.role]} logoutAction={logoutAction} flash={flash}>
      {children}
    </Shell>
  );
}
