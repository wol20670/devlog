# DevLog

개발 활동 기록 및 주간 회고 웹 서비스.

프로젝트별 작업 내역, 일별 개발·학습 기록, GitHub 공개 활동, 주간 통계와 회고를 한곳에서 관리한다. SNS가 아닌 **개인 개발 기록 관리 서비스**다.

> 상태: v1.0 개발 중. 배포 URL은 배포 검증 후 기재한다.

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

## 문서

- [릴리즈 계획](docs/RELEASE_PLAN.md) · [진행 기록](docs/PROGRESS.md) · [아키텍처](docs/ARCHITECTURE.md)
- [테스트 보고서](docs/TEST_REPORT.md) · [배포](docs/DEPLOYMENT.md) · [변경 이력](CHANGELOG.md)
