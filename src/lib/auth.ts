import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      // 최소 권한. Better Auth 기본값과 동일하지만 명시한다.
      scope: ["read:user", "user:email"],
    },
  },
  account: { encryptOAuthTokens: true },
  // nextCookies()는 항상 마지막 플러그인이어야 한다.
  plugins: [nextCookies()],
});
