import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { MANUAL_CONSTRAINTS } from "@/db/manual-constraints";
import type { Db } from "@/db";
import { createTestDb } from "./helpers/db";

let db: Db;
let close: () => Promise<void>;
let constraints: Array<{ conname: string; contype: string; tbl: string; def: string }>;

// 명세에 정의된 이름 있는 제약 (scripts/check-constraints.mjs와 같은 목록을 유지한다).
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

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  const res = await db.execute(sql`
    select conname, contype, conrelid::regclass::text as tbl, pg_get_constraintdef(oid) as def
    from pg_constraint
    where connamespace = 'public'::regnamespace
  `);
  constraints = (res as unknown as { rows: typeof constraints }).rows;
});

afterAll(async () => {
  await close();
});

describe("manual constraints", () => {
  it("every registered manual constraint exists with the expected definition", () => {
    for (const m of MANUAL_CONSTRAINTS) {
      const found = constraints.find((c) => c.conname === m.name && c.tbl === m.table);
      expect(found, `${m.name} on ${m.table}`).toBeDefined();
      expect(found!.def).toContain(m.definitionIncludes);
    }
  });

  it("the number of mfk_ constraints equals the registered list length", async () => {
    const res = await db.execute(
      sql`select count(*)::int as n from pg_constraint where conname like 'mfk\_%'`,
    );
    const n = (res as unknown as { rows: Array<{ n: number }> }).rows[0].n;
    expect(n).toBe(MANUAL_CONSTRAINTS.length);
  });
});

describe("named constraints from the v2 spec", () => {
  it.each(NAMED_FKS)("foreign key %s exists", (name) => {
    expect(constraints.find((c) => c.conname === name && c.contype === "f")).toBeDefined();
  });

  it.each(NAMED_CHECKS)("check %s exists", (name) => {
    expect(constraints.find((c) => c.conname === name && c.contype === "c")).toBeDefined();
  });

  it("self-referential parent FK is composite and cascades", () => {
    const c = constraints.find((x) => x.conname === "activities_parent_fk")!;
    expect(c.def).toContain("FOREIGN KEY (parent_activity_id, user_id, connected_repository_id, parent_kind)");
    expect(c.def).toContain("ON DELETE CASCADE");
  });
});

describe("identifier length", () => {
  it("every constraint and index name in 0001 is at most 63 chars (no truncation)", () => {
    const file = path.resolve(import.meta.dirname, "../../drizzle/0001_v2_github_integration.sql");
    const sqlText = fs.readFileSync(file, "utf8");
    const names = [
      ...[...sqlText.matchAll(/CONSTRAINT "([^"]+)"/g)].map((m) => m[1]),
      ...[...sqlText.matchAll(/CREATE (?:UNIQUE )?INDEX "([^"]+)"/g)].map((m) => m[1]),
    ];
    expect(names.length).toBeGreaterThan(30);
    expect(names.filter((n) => n.length > 63)).toEqual([]);
  });
});
