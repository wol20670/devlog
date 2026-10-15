import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/**
 * neon-serverless(운영)와 PGlite(테스트) 인스턴스를 모두 받는 공통 DB 타입.
 * src/server/* 함수는 이 타입을 받는다.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

type NeonDb = ReturnType<typeof createDb>;

// Node 22+ 는 전역 WebSocket이 있어 neonConfig.webSocketConstructor 설정이 필요 없다.
function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Set it in .env.local (local) or the Vercel project env (deployed).",
    );
  }
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  attachDatabasePool(pool);
  return drizzle(pool, { schema });
}

// dev HMR 중 모듈이 다시 평가되어도 Pool이 중복 생성되지 않도록 globalThis에 캐시한다.
const globalForDb = globalThis as unknown as { __devlogDb?: NeonDb };

function getDb(): NeonDb {
  return (globalForDb.__devlogDb ??= createDb());
}

// import 시점에는 연결/검증하지 않고, 첫 사용 시점에 lazy 생성한다.
export const db: NeonDb = new Proxy({} as NeonDb, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
