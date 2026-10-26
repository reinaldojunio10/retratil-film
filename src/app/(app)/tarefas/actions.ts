"use server";

import { runButton, runForm, str, type FormState } from "@/lib/actions";
import { parse, taskSchema } from "@/lib/validation";

const cols = "title, description, kind, priority, status, due_at, location, assignee_id, client_id, project_id";
const vals = (d: ReturnType<typeof taskSchema.parse>) => [d.title, d.description, d.kind, d.priority, d.status, d.due_at, d.location, d.assignee_id, d.client_id, d.project_id];

export async function createTask(_: FormState, fd: FormData) {
  return runForm("tarefas", async (db, user) => {
    const d = parse(taskSchema, fd);
    if (!d.assignee_id) d.assignee_id = user.id;
    await db.exec(`insert into tasks (${cols}) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, vals(d));
    return { redirect: d.project_id ? `/projetos/${d.project_id}` : "/tarefas", message: "Tarefa criada." };
  });
}

export async function updateTask(id: string, _: FormState, fd: FormData) {
  return runForm("tarefas", async (db) => {
    const d = parse(taskSchema, fd);
    const n = await db.exec(`update tasks set (${cols}) = ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) where id = $11`, [...vals(d), id]);
    if (!n) throw Object.assign(new Error("Tarefa não encontrada ou sem permissão."), { code: "P0001" });
    return { message: "Tarefa atualizada." };
  });
}

/** Concluir/reabrir: permitido também ao responsável (política tasks_update). */
export async function toggleTask(fd: FormData) {
  await runButton("tarefas", async (db) => {
    const done = str(fd, "done") === "1";
    const n = await db.exec("update tasks set status = $1 where id = $2", [done ? "concluida" : "pendente", str(fd, "id")]);
    if (!n) throw Object.assign(new Error("Sem permissão para alterar esta tarefa."), { code: "P0001" });
    return { message: done ? "Tarefa concluída." : "Tarefa reaberta." };
  }, false);
}

export async function deleteTask(fd: FormData) {
  await runButton("tarefas", async (db) => {
    await db.exec("delete from tasks where id = $1", [str(fd, "id")]);
    return { redirect: "/tarefas", message: "Tarefa excluída." };
  });
}
