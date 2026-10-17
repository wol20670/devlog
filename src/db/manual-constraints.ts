// drizzle-kit이 표현하지 못해 수동 SQL로 추가하는 제약 목록.
// 이름 규칙: mfk_<table>_<column>. Phase 2a에서 ON DELETE SET NULL (col) FK가 등록될 예정.
// .mjs 스크립트에서 Node type stripping으로 import하므로 erasable TS 문법만, 경로 alias 금지.
export const MANUAL_CONSTRAINTS: ReadonlyArray<{
  name: string;
  table: string;
  definitionIncludes: string;
}> = [];
