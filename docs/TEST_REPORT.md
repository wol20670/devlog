# 테스트 보고서

> 실제로 실행한 명령과 결과만 기록한다. 실행하지 않은 항목은 "미실행"으로 남긴다.

## 테스트 구성 (계획)

| 종류 | 도구 | 대상 |
|---|---|---|
| 정적 검사 | `tsc --noEmit`, ESLint | 전체 소스 |
| 단위 테스트 | Vitest (`tests/unit`) | KST 주간 계산, 주간 통계 집계, GitHub 이벤트 정규화·rate limit 파싱, 계정 식별자 처리, zod 스키마 |
| 통합 테스트 | Vitest + PGlite (`tests/integration`) | 실제 마이그레이션 적용 후 프로젝트·기록·회고 CRUD, 타 사용자 접근 차단, 타 사용자 프로젝트 연결 거부, 프로젝트 삭제 시 기록 project_id NULL, 회고 unique |
| 실DB 검증 | Neon `dev` 브랜치 + 로컬 앱 | 마이그레이션, 로그인, CRUD, 트랜잭션 |
| 빌드 | `next build` | 프로덕션 빌드 |
| 배포 후 E2E | Playwright (프로덕션 URL) | 로그인 → CRUD → 주간 회고 → GitHub 활동 → 로그아웃 후 접근 제어 |

## 실행 결과

(아직 없음)
