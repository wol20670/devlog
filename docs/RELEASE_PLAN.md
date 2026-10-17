# 릴리즈 계획

| 릴리즈 | 계획 기준 | 실제 완료 | 상태 |
|---|---|---|---|
| v1.0 (MVP) | 2026-10-15 | 2026-10-15 | 릴리즈 (`v1.0.0`) |
| v2.0 | 대학 기말고사 기간 (날짜 미정) | — | 구현 중 (Phase 0·1a 승인, 2026-10-17) |
| v2.1 | v2.0 이후 (날짜 미정) | — | 계획 확정, 구현은 별도 승인 |
| v2.x | — | — | 백로그 |

> 실제 완료일은 프로덕션 배포와 배포 URL 검증이 끝난 날짜로만 기록한다.

## v1.0 — MVP

### 필수 기능

| ID | 영역 | 내용 | 상태 |
|---|---|---|---|
| A | 사용자 인증 | GitHub OAuth 로그인·로그아웃, 세션 유지, 로그인 상태 기반 접근 제어, 사용자별 데이터 분리, 서버 측 권한 검증 | 완료 |
| B | 프로젝트 관리 | 생성·목록·상세·수정·삭제, 프로젝트별 기록 조회 (이름·설명·생성일·진행 상태) | 완료 |
| C | 일별 개발 기록 | 생성·목록·상세·수정·삭제, 날짜·프로젝트 연결, 진행한 작업·학습·문제·해결 | 완료 |
| D | GitHub 활동 | 계정 확인, 최근 공개 이벤트(최근 30일·최대 300건) 조회, 커밋(Push)/PR/Issue 등 구분, 날짜·저장소·링크, API 실패·rate limit 처리 | 완료 |
| E | 주간 통계·회고 | 주간 기록 조회, 기록 수·작성일 수·프로젝트별 집계, 회고 CRUD, 기록 기반 기본 템플릿 | 완료 |
| F | 대시보드 | 프로젝트, 최근 기록, 최근 GitHub 활동, 이번 주 통계, 최근 회고 | 완료 |

### 완료 조건 (Definition of Done)

1. 필수 기능이 실제 데이터와 연결되어 정상 동작
2. 사용자별 데이터 접근 권한 검증
3. TypeScript 검사 및 린트 통과
4. 프로덕션 빌드 성공
5. 핵심 CRUD 및 주간 통계 로직 테스트
6. GitHub 인증과 활동 조회 동작 확인
7. GitHub 저장소에 소스코드 업로드
8. Vercel 프로덕션 배포 성공
9. 배포 URL에서 핵심 사용 흐름 검증
10. README 및 배포 문서 작성

### 완료 조건 충족 근거

| # | 조건 | 근거 |
|---|---|---|
| 1 | 실데이터 연동 | 프로덕션 Neon `main`에 생성·조회 확인 (TEST_REPORT 프로덕션 E2E #5~#7) |
| 2 | 사용자별 접근 검증 | 통합 테스트(타 사용자 조회·수정·삭제 차단, 타인 프로젝트 연결 거부), 로그아웃 후 보호 페이지 차단 |
| 3 | 타입·린트 | `npm run typecheck`, `npm run lint` 통과 |
| 4 | 프로덕션 빌드 | 로컬 `next build` 및 Vercel 빌드 성공 |
| 5 | CRUD·주간 통계 테스트 | 17 files / 105 tests |
| 6 | GitHub 인증·활동 | 프로덕션 로그인, 300건 공개 이벤트 조회 |
| 7 | GitHub 업로드 | https://github.com/wol20670/devlog (PR #1~) |
| 8 | Vercel 프로덕션 배포 | https://devlog-psi-three.vercel.app |
| 9 | 배포 URL 핵심 흐름 | TEST_REPORT 프로덕션 E2E |
| 10 | 문서 | README, DEPLOYMENT, 본 문서 등 |

### 구현 순서 (브랜치)

1. `feature/auth-db` — DB 연결, 스키마, Better Auth, 접근 제어
2. `feature/projects` — 프로젝트 CRUD
3. `feature/dev-logs` — 개발 기록 CRUD (프로젝트 소유권 검증)
4. `feature/weekly-review` — 주간 통계, 회고 CRUD, 기본 템플릿
5. `feature/github-activity` — GitHub 공개 이벤트 조회
6. `feature/dashboard` — 대시보드, 빈/오류 상태, 기본 모바일 레이아웃
7. 배포 → 검증 → `docs/release-v1` → `v1.0.0` 태그

### v1.0 알려진 제약 (계획)

- Preview 배포에서는 인증이 필요한 기능을 검증하지 않는다 (GitHub OAuth App callback URL 1개 제약).
- GitHub 활동은 공개 이벤트만, API 보존 범위(최근 30일·최대 300건) 내에서만 표시한다. 전체 커밋 이력·기여 통계가 아니다.

## v2 공통 규칙

- 설계: [V2_ARCHITECTURE.md](V2_ARCHITECTURE.md) (확정 설계 rev.4 final, 2026-10-17 사용자 승인). 이 섹션의 `§` 번호는 V2_ARCHITECTURE.md의 섹션을 가리킨다.
- 브랜치: `main`에서 만든 `release/v2`가 통합 브랜치다. 작업 단위마다 `feature/*`·`docs/*` 브랜치 → Opus 리뷰와 typecheck·lint·test·build 재실행 → `release/v2`로 PR 병합.
- **사용자 승인이 필요한 것**: `main` 병합, 운영 DB 마이그레이션, 운영 GitHub App 등록, 프로덕션 배포, 각 Phase 착수.
- 스키마 변경은 추가 마이그레이션으로만 하고 순차로 진행한다. dev DB(Neon `dev` 브랜치)에는 엔드포인트가 `ep-still-sea`인지 확인한 뒤 migrate한다.

### 승인 기록

| 날짜 | 승인 범위 |
|---|---|
| 2026-10-17 | 실행 계획 rev.4 final 확정. **Phase 0, Phase 1a** 진행과 dev DB 마이그레이션 승인. Phase 1b 이후는 진행 보고 후 별도 착수. 운영 DB 마이그레이션·운영 GitHub App 등록·`main` 병합·프로덕션 배포는 미승인 |

## v2.0 — GitHub 통합 · 글감 · 초안 · Development Galaxy

### 범위

- **GitHub 저장소 통합**: Reader GitHub App 설치·사용자 연결, 개인·조직 저장소 연결, 접근 권한 fail-closed 판정(§3.3), 기본 브랜치 커밋·PR(커밋·리뷰)·이슈 동기화(§3.4~3.5), webhook 상태 반영(§3.8)
- **글감**: 활동·개발 기록에서 글감 생성, 근거 snapshot, 칸반·목록, 상태 이동
- **초안**: BLOG_POLICY 구조의 템플릿 초안, 편집기·미리보기, Chirpy 프리셋 front matter 검증. 블로그와 독립된 posts
- **Development Galaxy**: 저장소·활동·글감 3D 그래프, 목록·트리 대체 화면(§3.7)
- 제외: AI 기능, 자동 발행, 블로그 발행(→ v2.1)

### 구현 순서

**Phase 0 (Opus, 문서)**: V2_ARCHITECTURE.md 작성, BLOG_PUBLISHING_DESIGN.md를 v2.1 기준으로 갱신, 이 문서에 v2.0·v2.1 범위와 완료 조건 정리(기존 v2 항목은 v2.x로 이동), CLAUDE.md에 v2 원칙 추가, `release/v2` 생성.

**Phase 1 — GitHub 통합**

| 단위 | 내용 | 완료 기준 |
|---|---|---|
| 1a 스키마 | §4.1의 Phase 1 테이블(4열 FK, NOT NULL 상수 kind 컬럼, `act_parent_shape`, `github_pr_sync` 4열 FK·세대 컬럼, sync_state `lease_token`·세대 컬럼·`pass_generation`·`targeted_pr_numbers`+CHECK, 활동 `reviews_truncated`), projects·dev_logs `UNIQUE(id,user_id)`, `manual-constraints.ts`(Phase 1은 빈 목록) + catalog 검증 테스트 틀 | 통합: 교차 사용자 차단, 교차 저장소·잘못된 kind 링크 차단, 리뷰 부모 규칙, NULL 우회 차단(§6.2 #9e~#9i), cascade, 재연결 후 중복 0, `targeted_pr_numbers` CHECK |
| 1b 인증 기반 | JWT·installation token(저장소 축소, 메모리 캐시), credential 암호화(`SecretConfig`)·갱신(FOR UPDATE), OAuth state 쿠키(환경별 이름), PKCE, `http.ts` 확장(SSO·primary·secondary limit 분류) | 단위: state 위조·만료·userId 불일치 거부, 성공 후 같은 callback 재사용 거부, 키 버전 교체 후 복호화, 갱신 에러 바디 처리. 통합: 동시 갱신 1회만 실행 |
| 1c 연결·설치 | authorize/callback 라우트, `/repos/connect`, 설치 upsert, 저장소 선택(서버 재조회 교집합), `assertRepoAccess`·`getVisibleRepoIds`(visibility 갱신 포함), 연결 해제 트랜잭션 | 통합: 접근 상태 5종 전이, fail-closed, privatized 즉시 숨김, 해제 시 삭제 범위 |
| 1d-1 동기화 코어 | 후보 선택(기한 지난 `blocked` 재실행, 만료 `running` 회수), lease 획득·fencing(만료 시각 포함)·heartbeat·소유자만 해제, pass 세대와 결과 5종 종료 SQL(§3.4), markDirty·`requestPrDetail`과 잠금 순서·40P01 재시도, 배치 예산(코드), rate limit → blocked 후 즉시 종료, `POST /api/sync`, `GET /api/sync/status`, `GET /api/cron/sync`. 첫 작업으로 `maxDuration` 시험 export + `next build` 호환성 확인·기록(설계는 의존하지 않음) | 통합: §6.2 #10~#13, #31~#34, #48~#50 |
| 1d-2 수집기 | 정규화(allowlist, PENDING 리뷰 제외), 기본 브랜치 Compare 페이지네이션 작업(§3.5), 대체 경로 분류, PR 목록(needs_detail → `requestPrDetail`)·개별 PR 조회(`targeted_pr_numbers`)와 `pr_details` 체크포인트(커밋·리뷰 완주 판정, truncated 시 링크 삭제 금지, 리뷰 upsert 전용), 이슈(PR 제외). 구현 검증: §9 #23 | 가짜 fetch: §6.2 #14~#21, #35~#37, #42, #43, #45~#47 |
| 1e UI | `/repos`(상태·진행률·오류·해제·다시 인증), `/repos/[id]`, `/activity`(필터, 범위·상한·truncated 안내), 프로젝트 상세에 저장소 매핑, 사이드바·proxy 경로, 5분 재조회 | Playwright 로컬 E2E |
| 1f webhook | `/api/github/webhook/reader`(서명 → 이벤트별 검증 → 단일 트랜잭션 상태 변경·markDirty, `pull_request_review` → `requestPrDetail` 또는 `targeted_pr_numbers`), 일일 reconciliation | §6.2 #22~#28, #38, #41, #44 |

**Phase 2 — 글감·초안**

| 단위 | 내용 | 완료 기준 |
|---|---|---|
| 2a 스키마 | writing_ideas, idea_sources, posts + 수동 SQL FK 4개(§4.5 절차, `manual-constraints.ts`에 4개 등록) | §6.2 삭제 정책 통합 테스트 + catalog 검증(정확히 4개) |
| 2b 글감 | CRUD, 활동·개발 기록에서 생성(`assertRepoAccess(fresh)`), 소스 연결·해제, 칸반·목록, 상태 이동, 연결 해제 시 redaction 연동, 대시보드 섹션 | 통합 + E2E |
| 2c 초안 | `buildDraft`, 편집기, 미리보기, Chirpy 프리셋 검증(category·tags·Liquid·비밀값·private 경고), 한 글감에 여러 초안 | 단위 + E2E |

**Phase 3 — Galaxy**

| 단위 | 내용 | 완료 기준 |
|---|---|---|
| 3a 그래프 | `getGalaxyGraph`(집계 SQL, 펼치기 server action), 결정적 레이아웃, `validateGraph` | 단위: 같은 입력이면 같은 좌표, 필터 변경에도 좌표 불변, 엣지 무결성, 권한 필터 반영 |
| 3b 장면 | Canvas(dynamic, ssr:false), instanced 노드, 선, 궤도·입자 레이어, 카메라 | 시각 검토(스크린샷) |
| 3c 인터랙션 | hover 공유 툴팁, 포커스·펼치기, 상세 패널(GitHub 링크·글감 지정), 글감 이동, 초기화 | E2E 10개 인터랙션 |
| 3d 품질 | WebGL 없음·reduced-motion 대체 화면, 목록 뷰, 모바일 DPR, 벤치마크 하네스 | 아래 완료 조건 7의 측정 기록 |

**Phase 5a**: v2.0 릴리즈 검증(아래 완료 조건).

### 완료 조건 (Definition of Done)

1. v1 회귀 없음: 기존 105개 테스트와 v1 E2E 핵심 흐름 통과.
2. 수용 흐름을 로컬 실제 OAuth로 확인한다. 로그인 → 개인 저장소와 테스트 조직 저장소 연결 → 동기화 완료 → Galaxy에서 저장소 선택 → PR·이슈·커밋 상세 → 글감 저장 → 글감 목록 → 초안 작성·미리보기.
3. §6.2의 통합·단위 테스트 1~29와 9a~9i, 31~50 통과(30은 v2.1). 표본 대조 일치(불일치는 원인을 기록).
4. 권한 시나리오(실제 테스트 조직):
   - 저장소 제외 또는 멤버 제거 후, 다음 서버 요청 기준 10분 안에 private 데이터가 새 응답에서 빠짐. 열린 화면은 5분 재조회로 정리됨.
   - 연결 해제 시 삭제됨.
   - 테스트 저장소를 public→private으로 전환하면, webhook 없이도 다음 서버 요청 기준 10분 안에 재검증으로 숨겨짐(로컬 확인).
   - 리뷰를 dismiss해도 PR `updated_at`이 바뀌지 않는 상황에서, 수동 재요청(로컬) 또는 webhook(prod)으로 반영됨.
5. 동기화 안정성: 300개 이상 커밋을 가진 표본 저장소에서 Compare 페이지네이션 증분이 완료됨. 배치를 강제로 중단한 뒤 재개해도 중복이 0.
6. 보안 점검(§6.2) 통과.
7. 성능 기록(목표, 실측은 그대로 기록):

   | 항목 | 조건 | 목표 |
   |---|---|---|
   | 장비 | 사용자 Windows PC(CPU·GPU 모델 기록), Chrome stable(버전 기록) | — |
   | 데스크톱 | 1440×900, DPR 상한 1.5, 시나리오 300·1,500 노드(명시된 합성 fixture) | 1,500 노드에서 p95 프레임 ≤ 20ms |
   | 모바일 에뮬레이션 | Playwright 390×844, DPR 1.25, CPU 4배 throttle, 300 노드 | p95 ≤ 33ms |
   | 측정 방법 | 10초 자동 궤도 회전 중 `requestAnimationFrame` 간격 샘플링(테스트 훅), 초기 Canvas 첫 프레임 시간 | — |

8. 운영 반영(승인 후):
   - prod Reader 앱, prod 마이그레이션(dev와 같은 파일, 적용 후 `scripts/check-constraints.mjs`로 catalog 확인), `main` 병합.
   - 프로덕션에서 수용 흐름과 실제 webhook 수신(installation_repositories removed, repository privatized 각 1회)을 확인한다.
   - `v2.0.0` 태그를 배포 커밋에 붙인다.
9. 문서: v1.0 대비 개선 내역(CHANGELOG), 최종 보고서용 기술적 근거(설계 변경 기록, TEST_REPORT)를 정리한다.

## v2.1 — 블로그 발행 (구현은 별도 승인)

### 범위

- **Phase 4**: Publisher 앱(webhook `/api/github/webhook/publisher`), 블로그 연결·구조 감지, `blogs`·`publications`, 발행(로컬 blob SHA 계산, 생성 전용, sha 기반 수정, 409이면 충돌), 2단계 배포 추적(`actions/runs?head_sha` → `pages/deployments/{sha}`, `mapPagesStatus()`로 내부 enum 변환, §3.6), 테스트 블로그 저장소 검증. 상세: [BLOG_PUBLISHING_DESIGN.md](BLOG_PUBLISHING_DESIGN.md)
- **Phase 5b**: v2.1 발행 검증(아래 완료 조건)

### 완료 조건

1. 테스트 블로그 저장소에 새 글 발행 → `commit_status=committed` → `deploy_status=deployed`(GitHub 원본 `succeed`) → 공개 URL 200.
2. 수정 발행(sha 일치) 성공. 외부 수정 후 발행 시 409 → 충돌 표시 후 덮어쓰지 않음.
3. htmlproofer 실패, 실행 취소, 실행되지 않은 경우를 각각 구분해 표시.
4. 글감 상태 `published` 자동 전이. 실패하면 상태 유지.
5. 실제 `my-blog` 발행은 사용자 승인 후 1회.
6. §6.2 #30 통과.

## v2.x — 백로그 (사용자 지시 전 구현 금지)

v2.1 이후 후보. v1.0 시점의 v2 백로그 항목을 여기로 옮겼다.

- AI 글감 추천·초안, 조직 공동 워크스페이스, 블로그 수정 가져오기, 인라인 리뷰 코멘트, Vercel Queues·Workflow 전환, WYSIWYG 편집기
- **기록 관리 고도화**: 태그, 제목·내용 키워드 검색, 날짜 범위 필터, 프로젝트별 필터, 조건 조합 검색
- **GitHub 활동 분석 확장**: 유형별 구분 강화, 기간별 통계, 커밋·PR 추이 시각화, 프로젝트별 분석, 조회 범위·제한 표시
- **회고 개선**: 템플릿 선택, 주간 활동 기반 초안, Markdown 내보내기, 이전 회고 조회 편의성
- **UI/UX**: 모바일 완성도, 로딩·오류 상태, 검색·필터 사용성, 빈 상태, 접근성·반응형
- 후보: GitHub API 응답 캐싱(사용자 격리 설계 선행), Preview 환경 인증 지원
- v1.0 검증 중 발견한 후보:
  - 운영 DB 일시적 연결 시간 초과(1건) 원인 조사 및 재시도 정책 검토
  - 모바일 상단 내비 가로 스크롤바 노출(Windows) 정리
  - 고정 PageHeader를 Suspense 밖으로 분리해 페이지 전환 시 즉시 표시되는 영역 확대
  - 대시보드 프로젝트 조회에 limit 적용
  - 두 번째 계정을 이용한 운영 환경 교차 사용자 접근 E2E
