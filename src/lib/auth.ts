import { createHash, randomBytes } from "crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { withSession, type Db } from "./db";
import { can, type Module, type Perms, type Role, type SessionUser } from "./permissions";

export const SESSION_COOKIE = "rf_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export const getSession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length < 32 || token.length > 128) return null;
  const tokenHash = hashToken(token);
  const row = await withSession(tokenHash, (db) =>
    db.one<{ id: string; name: string; email: string; role: Role; perms: Perms | null }>(
      `select u.id, u.name, u.email, u.role,
              (select json_object_agg(module, json_build_object('r', can_read, 'w', can_write))
                 from role_permissions where role = u.role) as perms
         from app_session_user($1) u`,
      [tokenHash],
    ),
  );
  if (!row) return null;
  return { ...row, perms: row.perms ?? {}, tokenHash };
});

/** Exige usuário autenticado (e, opcionalmente, permissão no módulo). */
export async function requireUser(module?: Module, write = false): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  if (module && !can(user, module, write)) redirect("/sem-permissao");
  return user;
}

/** Transação autenticada para leitura em páginas. */
export async function tx<T>(fn: (db: Db, user: SessionUser) => Promise<T>, module?: Module): Promise<T> {
  const user = await requireUser(module);
  return withSession(user.tokenHash, (db) => fn(db, user));
}

export async function login(email: string, password: string): Promise<"ok" | "invalid" | "locked"> {
  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const r = await withSession(null, (db) =>
    db.one<{ status: "ok" | "invalid" | "locked" }>("select * from app_login($1, $2, $3, $4, $5, $6)", [
      email,
      password,
      hashToken(token),
      SESSION_TTL_SECONDS,
      ip,
      h.get("user-agent"),
    ]),
  );
  if (r?.status === "ok") {
    (await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" && !process.env.APP_URL?.startsWith("http://"),
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
  }
  return r?.status ?? "invalid";
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await withSession(null, (db) => db.exec("select app_logout($1)", [hashToken(token)]));
  jar.delete(SESSION_COOKIE);
}
