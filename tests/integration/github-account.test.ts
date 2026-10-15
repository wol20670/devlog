import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { account } from "@/db/auth-schema";
import { getGithubAccount } from "@/server/github";
import { createTestDb, createTestUser } from "./helpers/db";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  const t = await createTestDb();
  db = t.db;
  close = async () => {
    await t.close();
  };
});
afterAll(async () => {
  await close();
});

async function addAccount(userId: string, providerId: string, accountId: string) {
  const id = crypto.randomUUID();
  await db.insert(account).values({ id, accountId, providerId, userId, updatedAt: new Date() });
  return id;
}

describe("getGithubAccount", () => {
  it("본인의 github 계정만 반환(id=내부 PK, accountId=GitHub ID)", async () => {
    const u = await createTestUser(db);
    const internal = await addAccount(u.id, "github", "12345");
    expect(await getGithubAccount(db, u.id)).toEqual({ id: internal, accountId: "12345" });
  });

  it("다른 사용자의 계정은 반환하지 않음", async () => {
    const a = await createTestUser(db);
    const b = await createTestUser(db);
    await addAccount(a.id, "github", "111");
    expect(await getGithubAccount(db, b.id)).toBeNull();
  });

  it("다른 provider 계정은 반환하지 않음", async () => {
    const u = await createTestUser(db);
    await addAccount(u.id, "credential", "x");
    expect(await getGithubAccount(db, u.id)).toBeNull();
  });
});
