// 운영 로그에 DB 쿼리 파라미터(세션 토큰, OAuth 토큰, 이메일 등)가 남지 않도록 가린다.
// Drizzle 쿼리 오류는 message에 "params: ..." 줄을 포함하고 params 속성도 가진다.

const REDACTED = "[redacted]";
const MAX_DEPTH = 8;
const PARAMS_LINE = /params:[^\n]*/g;

function redactString(text: string): string {
  return text.replace(PARAMS_LINE, `params: ${REDACTED}`);
}

function redactError(
  error: Error,
  depth: number,
  seen: WeakSet<object>,
): Error {
  const copy = Object.create(Object.getPrototypeOf(error)) as Error;
  seen.add(error);

  for (const key of Object.getOwnPropertyNames(error)) {
    const descriptor = Object.getOwnPropertyDescriptor(error, key);
    if (!descriptor) continue;
    // stack 등은 런타임에 따라 접근자일 수 있으므로 값으로 읽어 데이터 속성으로 복사한다.
    let value: unknown = (error as unknown as Record<string, unknown>)[key];
    if (key === "params") {
      value = REDACTED;
    } else if (key === "message" || key === "stack") {
      value = typeof value === "string" ? redactString(value) : value;
    } else if (key === "cause") {
      value = redact(value, depth + 1, seen);
    }
    Object.defineProperty(copy, key, {
      value,
      writable: true,
      configurable: true,
      enumerable: descriptor.enumerable,
    });
  }
  return copy;
}

function redact(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return redactString(value);
  if (typeof value !== "object" || value === null) return value;
  if (depth > MAX_DEPTH) return "[truncated]";
  if (seen.has(value)) return "[circular]";

  if (value instanceof Error) return redactError(value, depth, seen);

  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1, seen));
  }
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] =
      key === "params" ? REDACTED : redact(item, depth + 1, seen);
  }
  return result;
}

export function redactLogValue(value: unknown): unknown {
  return redact(value, 0, new WeakSet());
}
