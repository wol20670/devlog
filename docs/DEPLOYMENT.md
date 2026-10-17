# 배포

> 상태: **v1.0.0 프로덕션 배포 완료 (2026-10-15)** — https://devlog-psi-three.vercel.app

## 구성

| 항목 | 값 |
|---|---|
| 호스팅 | Vercel (Node.js 런타임) |
| Production Branch | `main` |
| DB | Neon (Vercel Marketplace, Free) — `main` 브랜치(운영), `dev` 브랜치(로컬·Preview) |
| 인증 | GitHub OAuth App 2개: 로컬용, 프로덕션용 |

## 환경변수

`.env.example` 참고. 실제 값은 `.env.local`(Git 미추적)과 Vercel 프로젝트 환경변수에만 둔다.

| 이름 | Production | Preview | Development(로컬) |
|---|---|---|---|
| `DATABASE_URL` | Neon `main` | Neon `dev` | Neon `dev` |
| `BETTER_AUTH_SECRET` | 운영 전용 값 | 별도 값 | 로컬 값 |
| `BETTER_AUTH_URL` | 프로덕션 도메인 | — | `http://localhost:3000` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | 프로덕션 OAuth App | — (Preview 인증 미지원) | 로컬 OAuth App |

## 배포 순서 (계획)

1. **Vercel 프로젝트·도메인 확정**: `npx vercel link`, GitHub 저장소 연동, 프로덕션 도메인(`*.vercel.app`) 확인.
2. **OAuth 설정**: 프로덕션 도메인으로 GitHub OAuth App 생성
   - Homepage URL: `https://<prod-domain>`
   - Authorization callback URL: `https://<prod-domain>/api/auth/callback/github`
   - Client ID/Secret은 사용자가 `npx vercel env add GITHUB_CLIENT_ID production` 등으로 직접 입력.
3. **운영 DB 마이그레이션**: `dev` 브랜치에서 검증된 마이그레이션을 Neon `main`에 `drizzle-kit migrate`로 적용. 파괴적 변경은 사용자 확인.
4. **프로덕션 배포**: `main` 푸시 → Vercel 빌드 로그 확인 → Ready 확인.
5. **검증**: 프로덕션 URL에서 핵심 흐름(→ TEST_REPORT.md).
6. **릴리즈 태그**: Vercel 프로덕션 배포의 커밋 SHA와 일치하는 커밋에 `v1.0.0`.

## 제약

- Preview 배포에서는 인증이 필요한 기능을 검증하지 않는다. Preview URL은 배포마다 바뀌며, GitHub OAuth App의 Redirect URI(최대 10개)에 와일드카드를 허용하면 제어하지 않는 하위 도메인으로 토큰이 전달될 위험이 있어 v1에서는 등록하지 않는다. Preview는 빌드 성공·비인증 화면 확인 용도로만 사용한다.

## 진행 기록

| 날짜 | 작업 | 결과 |
|---|---|---|
| 2026-10-15 | `vercel link --project devlog` | 프로젝트 `wol20670s-projects/devlog` 생성. GitHub 저장소 연결은 실패(Vercel GitHub App 미설치 추정) → 대시보드에서 연결 필요 |
| 2026-10-15 | `vercel integration add neon --plan free_v3 -e production` | Neon `devlog-db` (Free) 생성, **Production 환경에만** 연결. `vercel env ls`로 스코프 확인 |
| 2026-10-15 | GitHub OAuth App (로컬용) | 생성 완료 — Redirect URI `http://localhost:3000/api/auth/callback/github`, "Expire user access tokens" 사용(Better Auth GitHub provider의 refresh 지원 확인). 로컬 로그인 성공 |
| 2026-10-15 | Neon `dev` 브랜치 | `neonctl branches create --name dev` (부모: `main`). 엔드포인트 `ep-still-sea…`(dev) / `ep-lucky-hat…`(main) 분리 확인. `.env.local`에 dev pooled URL 기록(값 미출력) |
| 2026-10-15 | dev 마이그레이션 | 직접 연결로 `drizzle-kit migrate` → 7개 테이블 |
| 2026-10-15 | (a) 프로덕션 도메인 확정 | `devlog-psi-three.vercel.app` (Vercel 자동 할당) |
| 2026-10-15 | Vercel ↔ GitHub 연결 재시도 | `vercel git connect` 실패 — Vercel GitHub App 설치 필요(사용자 작업) |
| 2026-10-15 | 환경변수 | Production: `BETTER_AUTH_SECRET`(신규 랜덤, sensitive), `BETTER_AUTH_URL`. Preview: `BETTER_AUTH_SECRET`(별도), `DATABASE_URL`=Neon dev(sensitive). Production `DATABASE_URL`이 `main` 엔드포인트임을 확인 |
| 2026-10-15 | (c) 운영 DB 마이그레이션 | `main` 브랜치 빈 상태 확인 후 `drizzle-kit migrate` → 7개 테이블, 이력 1건. 파괴적 변경 없음 |
| 2026-10-15 | Vercel ↔ GitHub 연결 | 사용자가 Vercel GitHub App 설치 후 대시보드에서 연결. Production Branch `main` 확인 |
| 2026-10-15 | 프로덕션 OAuth 키 | 사용자가 Vercel 대시보드에서 Production에만 등록(값은 공유하지 않음) |
| 2026-10-15 | (d) 첫 프로덕션 배포 | PR #7 병합 → Git 자동 배포 `dpl_538riP9…`, 커밋 `c81eb84`, 빌드 42초, Ready. 배포 메타 `githubCommitSha` = main HEAD 확인 |
| 2026-10-15 | 프로덕션 로그인 실패 | `invalid_code` / 런타임 로그 `incorrect_client_credentials` → Client Secret 불일치. 사용자 재발급·교체 후 `vercel redeploy --target production`으로 해결 |
| 2026-10-15 | 로그 보안 수정 배포 | PR #8 병합 → `dpl_BX44JER…`, 커밋 `411cb8c`, Ready. 재검증 통과, 런타임 오류 0건 |
| 2026-10-17 | dev 마이그레이션 (v2 Phase 1a) | 적용 직전 `DATABASE_URL` 엔드포인트가 `ep-still-sea…`(dev, 운영 `ep-lucky-hat…`과 다름)인지 확인. 기존 이력 1건의 해시가 로컬 `0000`과 일치함을 확인 후 `drizzle-kit migrate` → `0001_v2_github_integration` 적용(이력 2건, 테이블 7 → 16). `node scripts/check-constraints.mjs` 48항목 OK, 기존 행(user 1, dev_logs 1) 유지. **운영 DB(`main`)에는 적용하지 않음** |

## 운영 확인 방법

```bash
npx vercel ls devlog --prod                       # 최근 프로덕션 배포
npx vercel inspect <deployment-url> --logs         # 빌드 로그
npx vercel logs runtime --environment production --since 30m   # 런타임 로그
npx vercel env ls                                  # 환경변수 이름·스코프 (값은 표시 안 함)
```

- 함수 리전: `iad1` (Neon `aws-us-east-1`과 같은 지역). 런타임 로그의 `icn1`은 요청이 들어온 엣지 리전.
- 환경변수 변경 후에는 재배포해야 반영된다.

## 롤백

Vercel 대시보드 Deployments에서 이전 Ready 배포를 "Promote to Production"하거나 `npx vercel rollback`을 사용한다. DB 마이그레이션은 v1.0 기준 초기 1건뿐이며, 이후 스키마 변경은 `dev` 브랜치에서 먼저 검증한다.
