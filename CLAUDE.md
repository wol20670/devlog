@AGENTS.md

# DevLog — 프로젝트 지침

개발 활동 기록 및 주간 회고 웹 서비스. 대학 수업 결과물이자 개인 포트폴리오.
**개인 개발 기록 관리 서비스**이며 SNS 기능(친구·팔로우·피드·채팅)은 만들지 않는다.

## 기술 스택

Next.js 16 (App Router, `src/`) · TypeScript · Tailwind CSS 4 · PostgreSQL(Neon) · Drizzle ORM (`neon-serverless` Pool) · Better Auth (GitHub OAuth) · zod · Vitest · Vercel 배포.
개발 환경: Windows + VS Code + Git Bash, npm.

## 모델 역할 분담 (필수 정책)

| 역할 | 모델 | 담당 |
|---|---|---|
| 메인 에이전트 | Opus 5.5 (`claude-opus-5-5`) | 요구사항 분석, 아키텍처·DB·API 설계, 작업 분배, 코드 리뷰, 보안·성능 검토, 근본 원인 분석, Git/PR/릴리즈, 배포 운영, 문서화 |
| 구현 서브에이전트 | Sonnet 5.5 (`claude-sonnet-5-5`) — `.claude/agents/devlog-implementer.md` | React/Next.js·TypeScript 소스, Drizzle 스키마·데이터 접근, Better Auth·GitHub API 연동, UI, 테스트 코드, 빌드·테스트 실패 수정, 리팩터링 |

- **기능 코드 작성·수정은 반드시 `devlog-implementer`에 위임한다.** 메인 에이전트는 초기 스캐폴딩 명령, 문서, `.claude/` 설정, Git, 배포 운영만 직접 수행한다.
- 기능별 처리 흐름: Opus 요구사항 분석 → 범위·수정 파일·인터페이스·완료 조건 정의 → implementer 호출 → implementer가 구현·테스트 후 변경 파일과 검증 결과 반환 → Opus가 diff 리뷰 및 검증 재실행 → 문제 시 구체적 수정 지시로 재호출 → 통과 시 Opus가 커밋·PR.
- 같은 파일/DB 스키마를 수정하는 작업은 순차 처리. 독립 작업만 병렬.
- 한 번에 전체 구현을 지시하지 않고 기능 단위로 나눈다. 메인 모델을 Sonnet으로 바꾸지 않는다.

## 릴리즈 범위

- **v1.0 (현재 우선순위, 계획 기준일 2026-10-15)**: A 인증 / B 프로젝트 CRUD / C 일별 개발 기록 CRUD / D GitHub 공개 활동 조회 / E 주간 통계·회고 / F 대시보드.
- **v2.0 (기말고사 목표, 백로그만)**: 태그, 검색·필터, GitHub 활동 분석·시각화, 회고 템플릿·Markdown 내보내기, UI/UX·모바일 개선, 품질 개선. **사용자 지시 전에는 구현하지 않는다.**
- 상세: `docs/RELEASE_PLAN.md`. 계획일과 실제 완료일을 구분해 기록한다.

### v1.0 완료 조건 (DoD)
실데이터 연동 동작 · 사용자별 접근 검증 · typecheck/lint 통과 · 프로덕션 빌드 · 핵심 CRUD·주간 통계 테스트 · GitHub 인증·활동 조회 확인 · GitHub 업로드 · Vercel 프로덕션 배포 · 배포 URL에서 핵심 흐름 검증 · README/배포 문서.

## 아키텍처·보안 규칙

- DB 접근은 `src/server/*`에만. 함수는 `(db, userId, ...)`를 받고 모든 쿼리를 `userId`로 스코프.
- 서버 액션: `requireUser()` + zod 검증. 개발 기록의 `projectId`는 같은 사용자 소유인지 검증.
- OAuth 토큰: `account.encryptOAuthTokens: true`, 서버에서만 사용(`server-only`). GitHub 요청 `cache: 'no-store'`.
- `getAccessToken`에는 Better Auth 내부 `account.id`, GitHub `/user`.id 비교에는 `account.accountId`.
- GitHub Events API: 공개 이벤트, 최근 30일·최대 300건(per_page 100 × 3페이지). 전체 커밋/기여 통계로 표현하지 않는다.
- DB 라우트는 Node.js 런타임. 타임스탬프 UTC 저장 / KST 표시.
- 스키마 변경은 Drizzle 마이그레이션 파일로. 프로덕션 DB의 파괴적 변경은 사용자 확인 후.
- 비밀값 하드코딩·커밋 금지. `.env.example`에 이름·용도만.

## DB 환경

Neon 브랜치 분리: `main` = Vercel Production 전용, `dev` = 로컬 개발·테스트·Preview. Preview 배포에서는 인증 기능을 검증하지 않는다(OAuth callback 1개 제약).

## Git

- 브랜치: `main`(릴리즈) / `feature/*` / `fix/*` / `docs/*`. 기능 브랜치 → 검증 → PR → `main` 병합.
- Conventional Commits. 커밋 날짜·이력 조작 금지.
- `v1.0.0` 태그는 프로덕션에 배포·검증된 커밋에만.

## 명령어

```bash
npm run dev            # 개발 서버
npm run typecheck      # tsc --noEmit
npm run lint
npm run test           # unit + integration
npm run test:unit
npm run test:integration
npm run build
npm run db:generate    # 마이그레이션 생성
npm run db:migrate     # 마이그레이션 적용 (메인 에이전트만)
```

## 문서 (실제 수행 결과 기준으로 갱신)

`README.md`, `CHANGELOG.md`, `docs/RELEASE_PLAN.md`, `docs/PROGRESS.md`, `docs/ARCHITECTURE.md`, `docs/TEST_REPORT.md`, `docs/DEPLOYMENT.md`.
실제 확인한 결과와 계획·예상·미완료를 구분한다. 기술적 문제·해결·설계 변경 이유를 기록한다.
