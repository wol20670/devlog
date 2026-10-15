# DevLog

개발 활동 기록 및 주간 회고 웹 서비스.

프로젝트별 작업 내역, 일별 개발·학습 기록, GitHub 공개 활동, 주간 통계와 회고를 한곳에서 관리한다. SNS가 아닌 **개인 개발 기록 관리 서비스**다.

- **서비스**: https://devlog-psi-three.vercel.app (GitHub 계정으로 로그인)
- **버전**: v1.0.0 (2026-10-15) — [변경 이력](CHANGELOG.md)

## 기능 (v1.0)

- **GitHub OAuth 로그인** — 사용자별 데이터 분리, 서버 측 권한 검증
- **프로젝트 관리** — 생성·조회·수정·삭제, 진행 상태, 프로젝트별 기록
- **일별 개발 기록** — 날짜·프로젝트 연결, 진행한 작업·학습·문제·해결
- **GitHub 활동** — 최근 공개 이벤트(최근 30일·최대 300건) 조회, 유형 구분
- **주간 통계·회고** — 기록 수·작성일 수·프로젝트별 집계, 회고 작성
- **대시보드** — 프로젝트, 최근 기록·GitHub 활동, 이번 주 통계, 최근 회고

v2.0 계획은 [docs/RELEASE_PLAN.md](docs/RELEASE_PLAN.md) 참고.

## 기술 스택

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL (Neon) · Drizzle ORM · Better Auth · zod · Vitest · Vercel

## 로컬 실행

요구 사항: Node.js 22 이상 (개발 환경 Node 24), npm

```bash
npm install
cp .env.example .env.local   # 값 채우기 (아래 참고)
npm run db:migrate           # 개발 DB에 마이그레이션 적용
npm run dev                  # http://localhost:3000
```

`.env.local`:
- `DATABASE_URL` — Neon 개발(`dev`) 브랜치 연결 문자열
- `BETTER_AUTH_SECRET` — 랜덤 문자열 (`openssl rand -base64 32`)
- `BETTER_AUTH_URL` — `http://localhost:3000`
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — GitHub OAuth App (callback: `http://localhost:3000/api/auth/callback/github`)

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm start` | 프로덕션 빌드 / 실행 |
| `npm run typecheck` | TypeScript 검사 |
| `npm run lint` | ESLint |
| `npm run test` | 단위 + 통합 테스트 |
| `npm run db:generate` / `npm run db:migrate` | 마이그레이션 생성 / 적용 |

## 아키텍처 요약

- Next.js 서버 컴포넌트·서버 액션으로 별도 API 서버 없이 구성. DB 접근은 `src/server/*`에서만, 모든 쿼리를 사용자 ID로 스코프
- Neon PostgreSQL을 `drizzle-orm/neon-serverless`(WebSocket Pool, 트랜잭션 지원)로 연결. 운영(`main`)·개발(`dev`) 브랜치 분리
- 날짜는 KST 기준(기록일·주 시작일은 `date`, 타임스탬프는 UTC 저장 후 KST 표시)

자세한 내용은 [ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 개발 방식

메인 에이전트(Claude Opus 5.5)가 설계·리뷰·Git·배포를, 구현 서브에이전트(Claude Sonnet 5.5, [`.claude/agents/devlog-implementer.md`](.claude/agents/devlog-implementer.md))가 기능 코드 작성을 맡는 구조로 개발했다. 과정은 [PROGRESS.md](docs/PROGRESS.md)에 기록되어 있다.

## 문서

- [릴리즈 계획](docs/RELEASE_PLAN.md) · [진행 기록](docs/PROGRESS.md) · [아키텍처](docs/ARCHITECTURE.md)
- [테스트 보고서](docs/TEST_REPORT.md) · [배포](docs/DEPLOYMENT.md) · [변경 이력](CHANGELOG.md)
