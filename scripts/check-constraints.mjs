// DATABASE_URL이 가리키는 DB의 v2 스키마/제약 상태를 읽기 전용으로 확인한다.
// 사용: node scripts/check-constraints.mjs   (비밀값은 출력하지 않고 엔드포인트 ID만 출력)
import nextEnv from "@next/env";
import { Pool } from "@neondatabase/serverless";
import { MANUAL_CONSTRAINTS } from "../src/db/manual-constraints.ts";

nextEnv.loadEnvConfig(process.cwd());

const V2_TABLES = [
  "github_app_user_credentials",
  "github_installations",
  "connected_repositories",
  "project_repositories",
  "github_activities",
  "github_pr_commits",
  "github_pr_sync",
  "github_sync_state",
  "webhook_deliveries",
];

const NAMED_FKS = [
  "project_repos_project_fk",
  "project_repos_repo_fk",
  "connected_repos_installation_fk",
  "activities_repo_fk",
  "activities_parent_fk",
  "pr_commits_pr_fk",
  "pr_commits_commit_fk",
  "pr_sync_pr_fk",
  "sync_state_repo_fk",
];
const NAMED_UNIQUES = [
  "projects_id_user_id_unique",
  "dev_logs_id_user_id_unique",
  "credentials_user_app_unique",
  "installations_app_installation_unique",
  "connected_repos_user_repo_unique",
  "connected_repos_id_user_id_unique",
  "activities_user_repo_kind_external_unique",
  "activities_id_user_id_unique",
  "activities_id_user_repo_kind_unique",
  "sync_state_repo_resource_unique",
];
const NAMED_CHECKS = [
  "credentials_app_check",
  "credentials_status_check",
  "installations_app_check",
  "installations_selection_check",
  "connected_repos_access_state_check",
  "activities_kind_check",
  "act_parent_shape",
  "activities_body_excerpt_len_check",
  "pr_commits_pr_kind_check",
  "pr_commits_commit_kind_check",
  "pr_sync_pr_kind_check",
  "pr_sync_detail_status_check",
  "pr_sync_generation_check",
  "sync_state_resource_check",
  "sync_state_status_check",
  "sync_state_phase_check",
  "sync_state_targeted_resource_check",
  "sync_state_targeted_max_check",
  "webhook_deliveries_app_check",
];

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const host = new URL(url).hostname;
const endpoint = host.split(".")[0].replace(/-pooler$/, "");
console.log(`endpoint: ${endpoint}`);

let failed = false;
const report = (ok, label) => {
  console.log(`${ok ? "OK     " : "MISSING"} ${label}`);
  if (!ok) failed = true;
};

const pool = new Pool({ connectionString: url });
try {
  const mig = await pool.query('select count(*)::int as n from drizzle."__drizzle_migrations"');
  console.log(`applied migrations: ${mig.rows[0].n}`);

  const tables = await pool.query(
    "select table_name from information_schema.tables where table_schema = 'public'",
  );
  const tableSet = new Set(tables.rows.map((r) => r.table_name));
  for (const t of V2_TABLES) report(tableSet.has(t), `table ${t}`);

  const cons = await pool.query(
    `select conname, contype, conrelid::regclass::text as tbl, pg_get_constraintdef(oid) as def
     from pg_constraint where connamespace = 'public'::regnamespace`,
  );
  const byName = new Map(cons.rows.map((r) => [r.conname, r]));
  for (const n of NAMED_FKS) report(byName.get(n)?.contype === "f", `fk ${n}`);
  for (const n of NAMED_UNIQUES) report(byName.get(n)?.contype === "u", `unique ${n}`);
  for (const n of NAMED_CHECKS) report(byName.get(n)?.contype === "c", `check ${n}`);

  for (const m of MANUAL_CONSTRAINTS) {
    const found = cons.rows.find((r) => r.conname === m.name && r.tbl === m.table);
    report(
      Boolean(found) && found.def.includes(m.definitionIncludes),
      `manual ${m.name} on ${m.table}`,
    );
  }
  const mfk = cons.rows.filter((r) => r.conname.startsWith("mfk_")).length;
  report(mfk === MANUAL_CONSTRAINTS.length, `mfk_ constraints: ${mfk} (expected ${MANUAL_CONSTRAINTS.length})`);
} finally {
  await pool.end();
}

console.log(failed ? "RESULT: FAILED" : "RESULT: OK");
process.exit(failed ? 1 : 0);
