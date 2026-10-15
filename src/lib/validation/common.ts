import { z } from "zod";

export const uuidSchema = z.uuid("올바르지 않은 ID입니다");

export function isUuid(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}
