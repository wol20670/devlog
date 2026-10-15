import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { authLog } from "./auth-logger";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema, transaction: true }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      // scope는 지정하지 않는다. 기본값(read:user, user:email)이 최소 권한이다.
    },
  },
  account: { encryptOAuthTokens: true },
  logger: { log: authLog },
  // nextCookies()는 항상 마지막 플러그인이어야 한다.
  plugins: [nextCookies()],
});
