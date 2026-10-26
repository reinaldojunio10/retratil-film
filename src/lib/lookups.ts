import type { Db } from "./db";
import type { Option } from "@/components/form";

export const lookups = {
  clients: (db: Db) =>
    db.many<Option>("select id::text as value, name || coalesce(' — ' || company, '') as label from clients where archived_at is null order by lower(name) limit 2000"),
  users: (db: Db) => db.many<Option>("select id::text as value, name as label from users where active order by name"),
  services: (db: Db) => db.many<Option>("select id::text as value, name as label from services where active order by name"),
  projects: (db: Db) =>
    db.many<Option>("select id::text as value, title as label from projects where status not in ('entregue','cancelado') order by created_at desc limit 500"),
  deals: (db: Db) =>
    db.many<Option>("select id::text as value, title as label from deals where stage not in ('perdido') order by created_at desc limit 500"),
  equipment: (db: Db) =>
    db.many<Option>("select id::text as value, name || ' (' || quantity || ' un.)' as label from equipment where status = 'ativo' order by name"),
};
