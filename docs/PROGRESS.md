# 진행 기록

> 실제 수행한 작업만 기록한다. 계획은 [RELEASE_PLAN.md](RELEASE_PLAN.md) 참고.

## 2026-10-15

### 프로젝트 착수
- 작업 디렉터리 검사: 빈 디렉터리, Git 저장소 아님 → 신규 프로젝트로 판단.
- 환경 확인: Node 24.20, npm 11.19, git 2.55, gh 2.58(로그인됨), Claude Code 2.1.289. Vercel CLI 미설치 → `npx vercel` 사용.
- 최신 버전 확인: next 16.4.1, drizzle-orm 0.45.4, drizzle-kit 0.31.11, better-auth 1.7.8, zod 4.6.7, vitest 5.0.4.
- 설계 확정 및 사용자 리뷰 2회 반영:
  - 인증 라이브러리: Better Auth (Auth.js v5는 beta)
  - DB 드라이버: neon-http → neon-serverless(Pool) (트랜잭션 지원)
  - GitHub Events API 범위 정정: 최근 30일·최대 300건
  - Neon 개발/운영 브랜치 분리, OAuth 토큰 암호화, GitHub 요청 `no-store`
- 모델 역할 분담 도입: 메인 Opus 5.5(설계·리뷰·Git·배포), 구현 Sonnet 5.5 서브에이전트(`.claude/agents/devlog-implementer.md`).

### 스캐폴딩
- `create-next-app@latest`로 Next.js 16.4.1 + TypeScript + Tailwind 4 + ESLint 생성.
  - 문제: 디렉터리명 `Dev-log`의 대문자 때문에 npm 패키지명 제약으로 현재 폴더에 직접 생성 실패.
  - 해결: 임시 디렉터리에 `devlog`로 생성 후 프로젝트 폴더로 복사.
- `.gitignore`: `.env*` 무시 유지 + `!.env.example` 예외 추가.
- 문서 골격 작성: CLAUDE.md, README.md, CHANGELOG.md, docs/*.
