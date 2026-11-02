import { writeFile } from "node:fs/promises";
import { createTestDatabase } from "../tests/helpers/database";

const db = await createTestDatabase(false);
try {
  const { rows } = await db.query<{
    table_name: string; column_name: string; data_type: string; udt_name: string;
    is_nullable: string; column_default: string | null; is_generated: string;
  }>(`select table_name,column_name,data_type,udt_name,is_nullable,column_default,is_generated
      from information_schema.columns where table_schema='public' order by table_name,ordinal_position`);
  const typeOf = (type: string, udt: string) => {
    if (type === "jsonb" || type === "json") return "Json";
    if (type === "ARRAY") return udt === "_text" ? "string[]" : "Json[]";
    if (["integer","smallint","bigint","numeric","real","double precision"].includes(type)) return "number";
    if (type === "boolean") return "boolean";
    return "string";
  };
  let out = '// Generated from SQL migrations by npm run db:types:local. Do not edit.\n';
  out += 'export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\n';
  out += 'export type Database = { public: { Tables: {\n';
  for (const table of [...new Set(rows.map(r => r.table_name))]) {
    out += `  ${table}: {\n`;
    for (const kind of ["Row","Insert","Update"]) {
      out += `    ${kind}: {\n`;
      for (const c of rows.filter(r => r.table_name === table)) {
        const optional = kind !== "Row" && (kind === "Update" || c.column_default !== null || c.is_nullable === "YES" || c.is_generated !== "NEVER");
        const type = kind !== "Row" && c.is_generated !== "NEVER" ? "never" : typeOf(c.data_type,c.udt_name) + (c.is_nullable === "YES" ? " | null" : "");
        out += `      ${c.column_name}${optional ? "?" : ""}: ${type};\n`;
      }
      out += '    };\n';
    }
    out += '    Relationships: [];\n  };\n';
  }
  out += '}; Views: { [_ in never]: never }; Functions: {\n';
  const functions = await db.query<{name:string; names:string[]; types:string[]; result:string}>(`select p.proname as name,p.proargnames as names,
    array(select format_type(t,null) from unnest(p.proargtypes) t) as types,format_type(p.prorettype,null) as result
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'lc_%' and p.prorettype<>'trigger'::regtype order by p.proname`);
  for (const f of functions.rows) {
    if(!f.names?.length){out += `  ${f.name}: { Args: Record<string, never>; Returns: ${typeOf(f.result,f.result)}; };\n`;continue;}
    out += `  ${f.name}: { Args: {\n`;
    for (let i=0;i<(f.names?.length??0);i++) out += `    ${f.names[i]}: ${typeOf(f.types[i],f.types[i])} | null;\n`;
    out += `  }; Returns: ${f.result === 'void' ? 'undefined' : typeOf(f.result,f.result)}; };\n`;
  }
  out += '}; Enums: { [_ in never]: never }; CompositeTypes: { [_ in never]: never } } };\n';
  await writeFile('src/lib/db.types.ts',out);
  console.log('Generated src/lib/db.types.ts from migrated tables and functions.');
} finally { await db.close(); }
