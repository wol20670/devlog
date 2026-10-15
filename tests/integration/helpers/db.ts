import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";
import type { Db } from "@/db";

/** 인메모리 PGlite에 실제 마이그레이션(./drizzle)을 적용한 테스트용 Db를 만든다. */
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, {
    migrationsFolder: path.resolve(import.meta.dirname, "../../../drizzle"),
  });
  return {
    db: db as Db,
    close: () => client.close(),
  };
}

let seq = 0;

export async function createTestUser(db: Db, overrides: Partial<typeof schema.user.$inferInsert> = {}) {
  seq += 1;
  const [row] = await db
    .insert(schema.user)
    .values({
      id: `test-user-${seq}-${crypto.randomUUID()}`,
      name: `Test User ${seq}`,
      email: `user${seq}-${crypto.randomUUID()}@example.com`,
      ...overrides,
    })
    .returning();
  return row;
}
