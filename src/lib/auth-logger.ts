import type { BetterAuthOptions } from "better-auth";
import { redactLogValue } from "./log-redaction";

type AuthLog = NonNullable<NonNullable<BetterAuthOptions["logger"]>["log"]>;

// Better Auth 기본 로거는 DB 오류 객체를 그대로 출력해 쿼리 파라미터(세션 토큰 등)가 노출된다.
// 출력 전에 message와 args를 redactLogValue로 처리한다. 로그 레벨은 Better Auth 기본값을 따른다.
export const authLog: AuthLog = (level, message, ...args) => {
  const safeMessage = redactLogValue(message);
  const safeArgs = args.map(redactLogValue);
  const prefix = "[Better Auth]:";
  switch (level) {
    case "error":
      console.error(prefix, safeMessage, ...safeArgs);
      break;
    case "warn":
      console.warn(prefix, safeMessage, ...safeArgs);
      break;
    case "debug":
      console.debug(prefix, safeMessage, ...safeArgs);
      break;
    default:
      console.info(prefix, safeMessage, ...safeArgs);
  }
};
