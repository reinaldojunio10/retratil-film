"use server";

import { runButton, runForm, str, type FormState } from "@/lib/actions";
import { fileSchema, memberSchema, parse, projectSchema, ValidationError } from "@/lib/validation";

const cols = "title, client_id, service_id, status, location, shoot_date, delivery_date, budget, manager_id, notes";
const vals = (d: ReturnType<typeof projectSchema.parse>) => [d.title, d.client_id, d.service_id, d.status, d.location, d.shoot_date, d.delivery_date, d.budget, d.manager_id, d.notes];

export async function createProject(_: FormState, fd: FormData) {
  return runForm("projetos", async (db) => {
    const d = parse(projectSchema, fd);
    const r = await db.one<{ id: string }>(`insert into projects (${cols}) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`, vals(d));
    return { redirect: `/projetos/${r!.id}`, message: "Produção criada." };
  });
}

export async function updateProject(id: string, _: FormState, fd: FormData) {
  return runForm("projetos", async (db) => {
    const d = parse(projectSchema, fd);
    await db.exec(`update projects set (${cols}) = ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) where id = $11`, [...vals(d), id]);
    return { message: "Produção atualizada." };
  });
}

export async function setProjectStatus(fd: FormData) {
  await runButton("projetos", async (db) => {
    await db.exec("update projects set status = $1 where id = $2", [str(fd, "status"), str(fd, "id")]);
    return { message: "Etapa atualizada." };
  });
}

export async function addMember(projectId: string, _: FormState, fd: FormData) {
  return runForm("projetos", async (db) => {
    const d = parse(memberSchema, fd);
    let name = d.name;
    if (d.user_id && !name) name = (await db.one<{ name: string }>("select name from users where id = $1", [d.user_id]))?.name ?? null;
    if (!name) throw new ValidationError({ name: "Informe o nome ou selecione um usuário" });
    await db.exec("insert into project_members(project_id, user_id, name, role) values ($1,$2,$3,$4)", [projectId, d.user_id, name, d.role]);
    return { message: "Integrante adicionado." };
  });
}

export async function addFile(projectId: string, _: FormState, fd: FormData) {
  return runForm("projetos", async (db) => {
    const d = parse(fileSchema, fd);
    await db.exec("insert into project_files(project_id, name, url, notes) values ($1,$2,$3,$4)", [projectId, d.name, d.url, d.notes]);
    return { message: "Arquivo vinculado." };
  });
}

export async function removeChild(fd: FormData) {
  const table = str(fd, "table") === "files" ? "project_files" : "project_members";
  await runButton("projetos", async (db) => {
    await db.exec(`delete from ${table} where id = $1`, [str(fd, "id")]);
    return { message: "Removido." };
  });
}
