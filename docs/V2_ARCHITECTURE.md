# v2 아키텍처

> 상태: **확정 설계 (rev.4 final, 2026-10-17 사용자 승인)**. v2.0 = GitHub 저장소 통합 + 글감 + 초안 + Development Galaxy, v2.1 = 블로그 발행.
> 릴리즈 범위·구현 순서·완료 조건은 [RELEASE_PLAN.md](RELEASE_PLAN.md), 실제 진행은 [PROGRESS.md](PROGRESS.md), v1 구조는 [ARCHITECTURE.md](ARCHITECTURE.md)를 본다.
> 섹션 번호(§3·§4·§6·§8·§9)는 확정 계획과 같게 유지해서 문서 간 참조(예: §3.4, §6.2 #41)가 그대로 통한다. 구현 순서(계획 §5)와 릴리즈 완료 조건(계획 §7)은 RELEASE_PLAN.md에 있다.
> 표기: **[검증]** 공식 문서·설치 코드·실행으로 확인한 사실 / **[가정]** 아직 확인하지 못한 전제(§9). 구현하면서 확인한 결과는 이 문서와 PROGRESS.md에 갱신한다.

## 배경과 원칙

v1.0.0은 개인 개발 일지다. v2는 부트캠프 참여자가 **개인·조직 저장소의 개발 활동을 다시 발견해 기술 블로그 글로 정리**하게 하는 것이 목표다(예시 블로그: `wol20670/my-blog`, Jekyll Chirpy). SNS 기능은 만들지 않는다.

**유지하는 결정**
- v1 기능과 데이터를 보존한다. 스키마 변경은 추가 마이그레이션으로만 한다. 기술 스택(Next 16, TS, Drizzle, Neon, Better Auth, Vitest)은 그대로 쓴다.
- 로그인은 기존 OAuth App을 유지한다.
- GitHub App을 Reader(v2.0, 읽기)와 Publisher(v2.1, 블로그 쓰기)로 나눈다. 사용자 접근 검증은 User Access Token, 서버 동기화는 Installation Token으로 한다.
- AI 기능과 자동 발행은 범위에서 뺀다. 초안은 근거가 있는 내용만 템플릿으로 조립하고 사실을 지어내지 않는다(BLOG_POLICY).

**사용자 결정 (2026-10-17)**
- 조직 저장소는 팀원 활동까지 수집한다.
- 권한을 잃으면 숨기고, 사용자가 연결을 해제하면 삭제한다.
- Vercel은 Hobby 플랜으로 가정한다(§9 #3).

## 3. 최종 기술 아키텍처

### 3.1 인증: 로그인 OAuth App과 Reader GitHub App 사용자 연결

**로그인**
- `src/lib/auth.ts`는 변경하지 않는다.

**Reader 사용자 연결 (자체 OAuth)**
- `GET /api/github/reader/authorize`
  - 세션이 필수다. state와 PKCE `code_verifier`(32B 랜덤)를 생성한다.
  - 쿠키에 `{ state, verifier, userId, returnTo, exp }`를 암호화해 넣는다(HttpOnly, SameSite=Lax, `Path=/`, `Domain` 없음, 10분).
    - **쿠키 이름은 환경별로 다르다.** https(Preview·Production)에서는 `__Host-devlog-gh-oauth`(Secure 필수)를 쓴다. 로컬 http에서는 `devlog-gh-oauth`(Secure 없음)를 쓴다. Chrome은 http://localhost의 `__Host-` 쿠키를 거부한다 **[검증: httpwg/http-extensions#2605]**. 판정 기준은 `BETTER_AUTH_URL`의 프로토콜이다.
    - 암호화: `better-auth/crypto`의 `symmetricEncrypt({ key, data })`(XChaCha20-Poly1305, 키=SHA-256(secret), nonce 자동) **[검증: 설치 코드]**.
    - `key`에는 문자열이 아니라 **`SecretConfig`**(`{ keys: Map([[1, GITHUB_TOKEN_ENCRYPTION_KEY]]), currentVersion: 1 }`)를 넘긴다. 그러면 `$ba$1$…` 봉투가 붙어 키를 교체할 수 있다.
    - 키 교체 절차: version 2를 추가하고 currentVersion=2로 바꾼다. 이전 키는 기존 데이터가 재암호화되거나 만료될 때까지 남겨둔다.
    - 복호화에 실패하면: 쿠키는 OAuth를 처음부터 다시 시작하고, 저장된 credential은 `reauth_required`로 처리한다.
  - `returnTo`는 내부 경로 allowlist(`/repos`, `/repos/connect`)만 허용한다.
- `GET /api/github/reader/callback`
  1. 세션을 확인한다.
  2. 쿠키를 복호화한다.
  3. `exp`, `state`(`constantTimeEqual`), `userId === session.user.id`를 확인한다.
  4. **쿠키를 즉시 삭제한다(1회용).**
  5. 코드를 교환한다. `redirect_uri`는 요청 Host가 아니라 `BETTER_AUTH_URL` 기준으로 고정하고, `code_verifier`를 함께 보낸다.
  6. `GET /user`를 호출해 `id === account.accountId`(provider `github`, 같은 userId)인지 확인한다. **여기까지 통과해야 저장한다.**
  - 실패하면 `/repos?error=<code>`로 보내고 토큰은 저장하지 않는다.
- **state 일회성의 보장 범위 (DB nonce를 쓰지 않는 근거)**

  | 보장 | 근거 |
  |---|---|
  | 성공한 callback 뒤에는 같은 callback URL을 다시 열어도 거부된다 | 응답에서 쿠키를 삭제하므로 이후 요청에는 state 쿠키가 없다(테스트 대상) |
  | 동시에 들어온 중복 callback은 최대 1개만 토큰을 얻는다 | 쿠키 삭제가 원자적이지는 않다. 대신 GitHub authorization code는 1회만 교환된다 **[가정: 1b에서 실제 앱으로 두 번 교환해 확인]**. credential 저장은 `(user_id, app)` upsert라서 같은 결과로 수렴한다 |
  | 공격자가 자기 GitHub 계정을 피해자 계정에 연결하는 것(login CSRF)은 불가능하다 | state가 세션 userId에 묶여 있고, GitHub user id가 피해자의 `account.accountId`와 같아야만 저장된다 |

  - DB nonce 테이블은 동시 callback까지 원자적으로 막아주지만, 위 세 가지로 실제 위험이 남지 않아 채택하지 않는다(구현 비용 > 위험).
- 토큰 저장: `github_app_user_credentials`에 access·refresh 토큰을 위의 `SecretConfig` 방식으로 암호화해 저장한다.
- 토큰 갱신: `getReaderUserToken(db, userId)`가 트랜잭션 안에서 `SELECT … FOR UPDATE`로 잠근다. 만료 5분 전이면 갱신한다. refresh token은 1회용이고 6개월간 유효하다 **[검증]**.
  - JSON에 `error`가 있거나 401이면 `reauth_required`로 바꾼다.
  - 5xx나 네트워크 오류는 상태를 바꾸지 않고 일시 오류로 처리한다.
  - SAML SSO 403(`X-GitHub-SSO` 헤더)은 `sso_required`로 분류한다.

### 3.2 설치 흐름 (조직 설치는 전역 객체)

1. "저장소 추가"를 누르면 `https://github.com/apps/<slug>/installations/new`로 이동한다. state는 붙이지 않는다.
2. **Setup URL은 `/repos/connect`**다.
   - proxy가 쿼리를 잃어도 상관없다. `installation_id`는 신뢰하지 않기 때문이다 **[검증: 위조 가능 경고]**.
   - 페이지는 항상 `GET /user/installations`를 user token으로 호출해 페이지네이션 전체를 확인한다.
3. 설치마다 JWT로 `GET /app/installations/{id}`를 호출해 전역 `github_installations`를 upsert한다(account, target_type, repository_selection, suspended_at).
   - 그다음 `GET /user/installations/{id}/repositories`(user token)로 **사용자가 접근 가능한 저장소와 `permissions`**를 표시한다.
4. 연결 액션 `connectRepositories(repoIds)`는 클라이언트가 보낸 값을 믿지 않는다. 서버에서 3번 목록을 다시 받아 교집합만 저장한다.

화면 상태 구분:

| 상태 | 안내 |
|---|---|
| 인증 필요 | user token이 없거나 reauth_required |
| 설치 없음 | "조직 저장소는 조직 소유자 승인 후 표시될 수 있음" 안내 포함 |
| 설치는 있으나 접근 가능한 저장소 없음 | — |
| SSO 필요 | — |
| GitHub 일시 오류 | — |

### 3.3 접근 권한 정책 (fail-closed)

`connected_repositories.access_state` 값:

| 상태 | 판정 근거 | 화면 | 동기화 |
|---|---|---|---|
| `ok` | user token 목록에 저장소가 포함됨 | 표시(TTL 이내일 때) | 허용 |
| `access_lost` | 목록 전체를 정상 조회했는데 저장소가 없음 | 숨김 | 차단 |
| `installation_removed` | JWT 조회 404, 설치 suspend, `installation`/`installation_repositories` 제거 webhook | 숨김 | 차단 |
| `reauth_required` / `sso_required` | 토큰 401, 갱신 실패, SSO 403 | private은 숨김 | 차단 |
| `unknown` | 5xx, 타임아웃, rate limit으로 확인 불가 | **숨김**(public도 TTL이 지나면 fail-closed) | 보류(재시도) |

- **표시 조건**(`getVisibleRepoIds(db, userId)`): `access_state='ok'`이면서 **public·private 구분 없이 `access_verified_at`이 10분 이내**.
  - **비용 평가**: 검증은 저장소 단위가 아니라 **설치 단위 1회**(`GET /user/installations/{id}/repositories`, 페이지당 100개)이고, 사용자가 페이지를 볼 때만 한다. 사용자가 설치 3개를 연결하고 1시간 내내 활동하면 최대 18회/h다. user token 한도 5,000/h의 0.4% 미만이고, 비활성 사용자는 0이다. 그래서 24h public TTL의 이득(호출 절감)이 노출 위험에 비해 미미하다고 판단했다.
  - 같은 응답에서 `private` 값도 갱신하므로, webhook이 누락돼도 public→private 전환은 최대 10분(다음 서버 요청 기준) 안에 반영된다.
  - 시간이 지났으면 요청 중에 재검증을 시도한다. 설치당 1회, 3초 제한, 결과는 DB에 저장한다.
  - 실패하면 상태는 `unknown`, 화면은 숨긴다. "일시 오류로 비공개 저장소 일부를 숨김" 배너를 띄운다.
- **항상 재검증하는 시점**: 동기화 배치 시작 전, 활동을 글감에 연결할 때, 원본 상세를 새로 불러올 때(`assertRepoAccess(…,{fresh:true})`).
- **Installation token 발급 순서**: `assertRepoAccess`를 통과한 뒤 `repository_ids=[github_repo_id]`와 read 권한으로 축소해 발급한다 **[검증: 축소 가능]**. 메모리에만 캐시한다.
- **webhook 반영(prod)**: 이벤트별 처리는 §3.8.1을 따른다.
  - **조직 멤버십 상실은 webhook으로 받을 수 없다**(Members 권한 필요 **[검증]**, Reader는 일부러 요청하지 않음). 그래서 TTL 재검증으로 반영된다. private은 다음 서버 요청 기준 최대 10분이다.
- **visibility 전환**
  - `repository.privatized` webhook을 받으면, 같은 트랜잭션에서 `is_private=true`, `access_verified_at=NULL`, `access_state='unknown'`으로 바꾼다. **재검증이 성공하기 전까지 즉시 숨긴다**(private 규칙 적용).
  - `repository.publicized`이면 `is_private=false`. 표시 여부는 여전히 `access_state='ok'`에 달려 있다.
  - **webhook이 누락될 때 대비**: 재검증할 때마다 user token 응답의 `private` 값으로 `is_private`를 갱신한다. TTL이 10분이므로 누락되더라도 다음 서버 요청 기준 10분 안에 반영된다.
  - **파생 데이터도 같은 판정을 쓴다**: 활동 목록, 글감 근거 표시, Galaxy 노드는 모두 `getVisibleRepoIds`(현재 저장소 상태)로 거른다. 활동 행의 `is_private`는 수집 당시 스냅샷일 뿐 판정에 쓰지 않는다.
- **글감 근거 snapshot 판정**: snapshot에 `github_repo_id`, `kind`, `title`, `url`, `is_private_at_capture`, `captured_at`을 저장한다. 판정 순서:
  1. 원본 활동이 남아 있으면 → 원본 저장소의 현재 판정(`getVisibleRepoIds`).
  2. 원본은 삭제됐지만 **같은 `github_repo_id`로 현재 연결된 저장소가 있으면**(예: 해제 후 재연결) → 그 저장소의 현재 판정을 따른다. `is_private_at_capture`는 쓰지 않는다.
  3. 현재 연결된 저장소가 없으면 → 현재 접근을 확인할 수 없다. 표시는 다음과 같다:
     - `is_private_at_capture=true`: 이미 연결 해제 때 redact돼 있다.
     - `false`: 제목만 보여주고 "연결 해제된 저장소 · 현재 공개 여부 미확인" 배지를 붙인다. **링크는 비활성화**한다.

  **`is_private_at_capture`만으로 판정하면 안 되는 경우**와 대응:

  | 경우 | 대응 |
  |---|---|
  | 수집 후 public→private 전환 | 1·2단계가 현재 상태를 우선 |
  | 수집 후 사용자가 권한 상실 | 1·2단계 |
  | 수집 후 저장소 삭제·이전 | 1단계(`access_lost`), 연결 해제 후에는 3단계 |
  | 연결 해제된 저장소 | 3단계에서 "미확인"으로 표시하고 링크 비활성 |

  - 남는 위험: 3단계의 제목 노출은 **본인에게만, 수집 당시 공개였던 제목**이다(§9 #13).
  - 이름 변경(`renamed`, `edited`)이면 `full_name`만 갱신한다. 식별은 ID로 한다.
  - 소유권 이전(`transferred`)이면 `unknown` 후 재검증한다. 다른 계정으로 옮겨져 설치 범위를 벗어나면 `installation_removed`가 된다.
  - 삭제(`deleted`)이면 `access_lost`(reason `repo_deleted`).
- **이미 열린 화면**: 서버는 이미 클라이언트로 보낸 데이터를 회수할 수 없다. 그래서 "모든 화면에서 N분 안에 사라진다"는 보장은 하지 않는다. 대신:
  - Galaxy와 활동 목록은 5분마다, 그리고 탭이 다시 보일 때(`visibilitychange`) 다시 조회한다. 응답에 없는 노드와 행은 제거한다.
  - 새 서버 요청(이동, 펼치기, 상세, 글감 연결)은 항상 현재 정책을 따른다.

### 3.4 동기화 (영속 상태 + 배치 실행)

**`github_sync_state`** (connected_repository_id, resource별 1행). 리소스는 `default_branch_commits`, `pull_requests`(목록 + 개별 PR 조회), **`pr_details`**(PR별 커밋·리뷰), `issues` 네 가지다.

| 컬럼 | 용도 |
|---|---|
| status | `idle`/`pending`/`running`/`blocked`/`error`/`complete` (의미는 아래 상태 표) |
| phase | `recent`(30일) → `backfill`(180일까지) → `incremental` |
| cursor jsonb | page/커밋 SHA/high-water mark. **페이지 fencing 트랜잭션에서만 전진**하고, pass가 `done`으로 끝날 때 다음 pass 시드로 바뀐다 |
| lease_owner, **lease_token** bigint, lease_expires_at | 중복 실행 방지 + fencing(세대 번호) |
| **change_generation**, **processed_generation** bigint | 변경 요청 버전. webhook·사용자 요청·PR 상세 요청이 `change_generation`을 올린다(markDirty). `processed_generation`은 **pass가 `done`으로 끝났을 때만** 그 pass의 `pass_generation`으로 기록한다 |
| **pass_generation** bigint NULL | 진행 중인 pass(작업 단위)가 시작될 때 캡처한 `change_generation`. NULL이면 진행 중인 pass가 없다. pass가 여러 배치에 걸쳐도 값이 유지된다 |
| **targeted_pr_numbers** integer[] (`pull_requests`만) | 목록 범위와 무관하게 개별 조회할 PR 번호(PR 행 없이 리뷰 webhook이 도착한 경우, §3.5). 최대 100 |
| next_run_after | rate limit·백오프 재시도 시각 |
| attempts, last_error_kind, last_error_at, last_success_at | 실패·성공 기록. `attempts`는 연속 일시 오류 횟수 |
| items_total, items_processed | 진행률 |
| requested_at | 사용자 요청 시각 |

**상태 의미**

| status | 의미 | 자동 실행 후보 | 다시 후보가 되는 경로 |
|---|---|---|---|
| `idle` | 행만 있고 요청이 없음(연결 직후의 `pr_details`) | X | markDirty |
| `pending` | 할 일이 있음 | O(`next_run_after` 경과 시) | — |
| `running` | lease 보유 중 | lease 만료 시 O(중단 복구) | — |
| `blocked` | rate limit·일시 오류로 대기. 커서와 pass 유지 | `next_run_after` 경과 시 O | — |
| `error` | 자동 재시도 중단: 일시 오류 연속 5회 또는 접근 확정 거부 | X | markDirty(webhook·사용자 동기화·PR 상세 요청), 접근 재검증 결과 `ok`(§4.3 "재검증 후 재개"), 일일 cron(일시 오류가 원인일 때만, `attempts=0`) |
| `complete` | 마지막 pass가 끝났고 그 뒤 요청이 없음 | X | markDirty |

**pass(작업 단위)와 `done` 조건**: pass는 여러 배치에 걸칠 수 있다. `done`은 pass 범위를 **전부** 처리했을 때만이다.

| 리소스 | pass 범위 | `done` 조건 | 다음 pass 시드 |
|---|---|---|---|
| `default_branch_commits` | 초기: recent → backfill(phase 전환은 같은 pass 안의 커서 변경). 증분: 시작 때 고정한 base..head Compare 작업(§3.5) | backfill 끝 / head 확정 | `{confirmed_head}`, phase=`incremental` |
| `pull_requests` | `targeted_pr_numbers` 비우기 → 목록을 high-water mark−2일까지 | 배열이 비고 목록 끝 | `{hwm: pass에서 본 최대 updated_at}` |
| `pr_details` | pending PR 비우기(§3.5) | pending PR(백오프 대기 중 포함) 0개 | `{}` |
| `issues` | 목록 `since` 끝까지 | 목록 끝 | `{since: hwm}` |

**배치 실행** `runSyncBatch(db, { userId?, repoId?, budgetMs: 45_000, maxRequests })`

0. **후보 선택**: `next_run_after`가 지난 `blocked`와 lease가 만료된 `running`도 여기서 다시 잡힌다. `complete`·`idle`·`error`는 후보가 아니다(markDirty 등 위 표의 경로로만 `pending`이 된다).
   ```sql
   SELECT s.id FROM github_sync_state s
     JOIN connected_repositories r ON r.id = s.connected_repository_id
    WHERE s.status IN ('pending','blocked','running')
      AND (s.lease_expires_at IS NULL OR s.lease_expires_at < now())
      AND (s.next_run_after IS NULL OR s.next_run_after <= now())
      AND r.access_state IN ('ok','unknown')   -- 확정 거부된 저장소는 호출하지 않음
      AND r.user_id = $userId                  -- 사용자 요청일 때(cron은 생략)
    ORDER BY s.next_run_after NULLS FIRST, s.id
   ```
1. **lease 획득(원자적, 세대 증가)**: 후보 조건을 다시 검사한다. 경합하면 0행이다.
   ```sql
   UPDATE github_sync_state
      SET lease_owner=$worker, lease_token=lease_token+1,
          lease_expires_at=now()+interval '90 seconds', status='running',
          pass_generation=COALESCE(pass_generation, change_generation)
    WHERE id=$id
      AND status IN ('pending','blocked','running')
      AND (lease_expires_at IS NULL OR lease_expires_at < now())
      AND (next_run_after IS NULL OR next_run_after <= now())
   RETURNING lease_token, pass_generation, cursor
   ```
   - 0행이면 건너뛴다. 만료된 lease는 이 조건으로 자연스럽게 회수된다.
   - `pass_generation`이 NULL이었으면 **새 pass**다. 지금의 `change_generation`을 캡처한다.
   - NULL이 아니면 예산 소진·blocked·중단 뒤에 **같은 pass를 이어서** 한다. 캡처 값은 그대로 둔다.
   - 세대를 배치마다 캡처하지 않는 이유: 그러면 여러 배치에 걸친 pass의 배치 사이에 들어온 webhook을 다음 배치가 캡처한 뒤 `complete`로 끝낼 수 있다(lost update).
2. `assertRepoAccess(fresh)`를 확인한다.
   - 확정 거부(`access_lost`·`installation_removed`·`reauth_required`·`sso_required`)이면 결과는 `access_denied`다.
   - 확인할 수 없으면(`unknown`) 결과는 `transient`다.
3. **페이지 단위 처리(fencing)**
   - GitHub 호출은 **트랜잭션 밖**에서 한다.
   - 요청을 시작하기 전에 남은 예산(시간·요청 수)을 확인한다. 모자라면 새 요청을 시작하지 않고 결과 `more`로 종료한다. 커서는 마지막으로 커밋한 페이지까지 이미 저장돼 있다.
   - 응답을 받으면 짧은 트랜잭션을 연다: 정규화 결과 upsert → 커서·진행률 갱신, heartbeat(`lease_expires_at=now()+90s`)를 다음 **fencing 조건**으로 실행한다:
     `WHERE id=$id AND lease_owner=$worker AND lease_token=$token AND lease_expires_at > now()`
     - `lease_expires_at > now()` 조건 때문에 **lease가 만료된 worker는 아직 아무도 재획득하지 않았더라도 쓸 수 없다.** 시각은 DB `now()` 하나만 기준으로 해서 서버 간 시계 차이가 없다.
   - **이 UPDATE가 0행이면 `LeaseLostError`로 트랜잭션 전체를 롤백**하고 즉시 종료한다. 오래된 실행이 최신 커서·상태를 덮어쓰지 못한다. upsert는 멱등이라 롤백돼도 손실이 없다.
   - 예산 45s는 heartbeat 간격(페이지당 수 초)보다 길고 lease 90s보다 짧아서, 정상 실행은 만료되지 않는다.
   - **잠금 순서 (교착 방지, worker·webhook 공통)**: `github_activities` → `github_pr_sync`(pr_activity_id 오름차순) → `github_sync_state`(id 오름차순).
     - fencing UPDATE도 이 순서 안에서 실행하고, 0행이면 전체를 롤백한다.
     - 그래도 교착(40P01)이 나면 트랜잭션을 처음부터 최대 3회 다시 한다. 모든 쓰기가 멱등이라 안전하다.
4. **종료 (결과별 상태 전이 단일 규칙)**: 코드가 결과를 하나로 정하고, 상태는 DB에서 원자적으로 결정한다(같은 fencing 조건).

   | 결과 `$outcome` | 조건 | status | processed_generation | pass_generation · cursor | next_run_after | attempts |
   |---|---|---|---|---|---|---|
   | `done` | pass 범위를 전부 처리(위 pass 표) | `change_generation > pass_generation`이면 `pending`, 아니면 `complete` | **`= pass_generation`** | NULL · 다음 pass 시드 | NULL | 0 |
   | `more` | 예산 소진, 또는 백오프 중인 PR만 남음(`pr_details`) | `pending` | 유지 | 유지 · 유지 | NULL 또는 대기 PR의 최소 `next_run_after` | 0 |
   | `rate_limited` | primary·secondary limit | `blocked` | 유지 | 유지 · 유지 | reset 또는 now+retry-after | 유지 |
   | `transient` | 5xx·네트워크·타임아웃·예기치 않은 예외, 접근 `unknown` | 연속 5회째면 `error`, 아니면 `blocked` | 유지 | 유지 · 유지 | 백오프 1m·5m·30m·2h | +1 |
   | `access_denied` | 접근 확정 거부 | `error` | 유지 | 유지 · 유지 | NULL | 유지 |
   | (LeaseLost) | fencing 0행 | **아무것도 쓰지 않는다** | — | — | — | — |

   ```sql
   UPDATE github_sync_state SET
     status = CASE $outcome
       WHEN 'done'          THEN CASE WHEN change_generation > pass_generation
                                      THEN 'pending' ELSE 'complete' END
       WHEN 'more'          THEN 'pending'
       WHEN 'rate_limited'  THEN 'blocked'
       WHEN 'transient'     THEN CASE WHEN attempts + 1 >= 5 THEN 'error' ELSE 'blocked' END
       WHEN 'access_denied' THEN 'error' END,
     processed_generation = CASE WHEN $outcome = 'done' THEN pass_generation ELSE processed_generation END,
     pass_generation      = CASE WHEN $outcome = 'done' THEN NULL ELSE pass_generation END,
     cursor               = CASE WHEN $outcome = 'done' THEN $nextSeed  ELSE cursor END,
     phase                = CASE WHEN $outcome = 'done' THEN $nextPhase ELSE phase END,
     next_run_after       = CASE WHEN $outcome IN ('more','rate_limited','transient')
                                 THEN $resumeAt ELSE NULL END,
     attempts             = CASE $outcome WHEN 'transient' THEN attempts + 1
                                          WHEN 'done' THEN 0 WHEN 'more' THEN 0
                                          ELSE attempts END,
     last_error_kind      = CASE WHEN $outcome IN ('done','more') THEN NULL ELSE $errorKind END,
     last_error_at        = CASE WHEN $outcome IN ('done','more') THEN last_error_at ELSE now() END,
     last_success_at      = CASE WHEN $outcome IN ('done','more') THEN now() ELSE last_success_at END,
     lease_owner = NULL, lease_expires_at = NULL
   WHERE id=$id AND lease_owner=$worker AND lease_token=$token AND lease_expires_at > now()
   ```
   - **`processed_generation`이 바뀌는 경로는 `done` 하나뿐이다.** `blocked`·`error`·`more`는 pass와 커서를 그대로 둔다. 그래서 미완료 작업이 유지되고, 다음 lease가 같은 pass를 이어서 한다.
   - pass 도중(배치 안이든 배치 사이든) 들어온 webhook은 `change_generation > pass_generation`을 만든다. 그래서 `done`이어도 `pending`으로 남고, 다음 lease가 새 pass를 시작한다.
   - `UPDATE … SET`의 모든 식은 갱신 전 행 값을 본다(`attempts + 1`, `pass_generation` 모두 이전 값).
   - 이 UPDATE가 0행이면(lease 만료·탈취) 상태를 쓰지 않는다. 행은 `running` + 만료 lease로 남고, 0단계에서 회수돼 같은 pass·커서로 재개된다.
   - 소유자만 해제할 수 있다.
5. 목표는 중복 실행을 완전히 막는 것이 아니다. **오래된 실행이 상태를 파괴하지 못하게 하는 것**이다. 중복으로 가져온 GitHub 데이터는 unique 제약과 upsert로 흡수된다.

**markDirty (webhook·사용자 요청·PR 상세 요청 공통)**

```sql
UPDATE github_sync_state
   SET change_generation = change_generation + 1,
       status   = CASE WHEN status IN ('idle','complete','error') THEN 'pending' ELSE status END,
       attempts = CASE WHEN status = 'error' THEN 0 ELSE attempts END
 WHERE connected_repository_id = $repo AND resource = $resource
```

- lease 컬럼, `pass_generation`, 커서는 **건드리지 않는다**. 그래서 fencing과 충돌하지 않는다.
- `running`·`blocked`는 상태를 유지한다. 실행 중인 pass는 종료 시 세대 비교로 `pending`이 된다.

**PR 상세 요청 ↔ `pr_details` 리소스 연결**

- **불변식 P**: pending PR(§3.5 판정)이 하나라도 있으면, 그 저장소의 `pr_details`는 `complete`나 `idle`로 남지 않는다.
  - 즉 다음 배치의 후보(`pending`·`blocked`·만료 `running`)이거나, 실행 중이면 종료 시 `pending`이 된다.
  - `error`는 자동 중단 상태이고, 위 상태 표의 경로로만 풀린다.
- PR을 pending으로 만드는 쓰기는 **`requestPrDetail(tx, repoId, prActivityIds)` 하나로만** 한다. 같은 트랜잭션에서 두 단계를 실행한다:
  ```sql
  -- ① PR별 요청 (pr_activity_id 오름차순)
  INSERT INTO github_pr_sync (pr_activity_id, user_id, connected_repository_id,
                              requested_generation, synced_generation, detail_status)
  VALUES ($pr, $user, $repo, 1, 0, 'pending')
  ON CONFLICT (pr_activity_id) DO UPDATE
     SET requested_generation = github_pr_sync.requested_generation + 1,
         detail_status = 'pending', attempts = 0, next_run_after = NULL;
  -- ② 상위 리소스 dirty: markDirty(resource = 'pr_details')
  ```
- 호출 경로: PR 목록·개별 PR 처리(새 PR 또는 변경 관측), `pull_request_review` webhook, 사용자의 "이 PR 다시 가져오기"(§3.5).
- **실행 중인 배치와의 관계**: ②는 lease·커서·`pass_generation`을 건드리지 않는다.
  - `pr_details`가 실행 중이면 이번 배치는 그대로 진행한다. 종료 시 `change_generation > pass_generation`이라 `pending`으로 남는다.
  - 실행 중이 아니면 `complete`/`idle`/`error`가 `pending`으로 바뀐다.
- **보장 근거**
  - (a) 요청과 dirty가 한 트랜잭션이라 둘 중 하나만 반영되는 경우가 없다.
  - (b) `pr_details`의 `done`은 pending PR이 0개일 때만이다.
  - (c) 종료 판정 뒤에 들어온 요청은 세대 비교(실행 중) 또는 markDirty(종료 후)로 잡힌다. 판정용 SELECT와 종료 UPDATE 사이의 요청도 여기에 해당한다.

**트리거** (Hobby에서 동작하는 최소 구조)

| 트리거 | 방식 |
|---|---|
| 사용자 "동기화" | `POST /api/sync` → markDirty로 `change_generation`을 올린 뒤 같은 요청 안에서 배치 1회 → 진행률 JSON. 배치 예산 45s는 **코드에서** 지킨다. `maxDuration` export에는 의존하지 않는다(Vercel Fluid 기본 300s **[검증]**). cacheComponents와 `maxDuration`의 호환성은 문서상 허용이지만 빌드 확인 전까지 [가정](§9 #19) |
| 자동 계속 | 화면이 열려 있는 동안 클라이언트가 다시 `POST /api/sync`를 호출한다. status `pending`이면 바로, `blocked`이면 `next_run_after` 이후에 호출하고 재개 예정 시각을 표시한다 |
| 상태 조회 | `GET /api/sync/status`. 부작용 없음 |
| 복구 | Vercel Cron(하루 1회, 정해진 시각 안의 임의 시점 **[검증]**) → `GET /api/cron/sync`, `Authorization: Bearer CRON_SECRET`. Vercel Cron이 GET만 호출하므로 예외로 둔다. 브라우저에서는 쓰지 않는다. 1회 총 예산 250s. 0단계 후보(중단된 `running`, 기한이 지난 `blocked` 포함)를 먼저 처리하고, 일시 오류로 `error`가 된 행을 `pending`(`attempts=0`)으로 되돌린다 |
| webhook | markDirty(위). 실행은 위 트리거가 한다 |

- **브라우저를 닫으면** 진행 중인 배치(최대 약 60s)까지만 처리된다. 나머지는 사용자가 `/repos`를 다시 열 때(자동 POST), "동기화"를 누를 때, 다음 일일 cron 때 재개된다.
  - **즉시 백그라운드 완료는 보장하지 않는다**고 UI와 문서에 명시한다.
  - 나중에 Vercel Queues나 Workflow로 바꿀 수 있게 실행 단위를 `runSyncBatch` 하나로 둔다.
- **Rate limit·일시 오류 처리** **[검증: 헤더 의미]** — 결과 분류는 위 4단계 표를 따른다.
  - primary(`x-ratelimit-remaining=0`) → `rate_limited`, `next_run_after = x-ratelimit-reset`
  - secondary(403/429 + `retry-after`) → `rate_limited`, `now + retry-after`. 헤더가 없으면 최소 60s부터 지수 백오프
  - 5xx·네트워크 → `transient`, 1m, 5m, 30m, 2h 백오프. 연속 5회째는 `error`
  - 어느 경우든 **즉시 종료**한다. 함수 안에서 기다리지 않는다. 커서와 `pass_generation`은 유지된다.
- **초기 비용 상한(v2.0)**: 저장소당 커밋 2,000, PR 500(PR당 커밋 250은 GitHub API 제한, 리뷰 300은 DevLog 상한), 이슈 500. 넘는 분은 "수집 상한 도달"로 UI에 표시한다. API 제한과 DevLog 상한의 구분은 §3.5 표를 따른다.

### 3.5 수집 범위와 정확성

| 대상 | 수집 경로 | 상한·페이지 |
|---|---|---|
| 기본 브랜치 커밋 | 초기: `GET /commits?sha=<default>&since=…`(최신순). 증분: **`GET /compare/{base}...{head}?per_page=100&page=N`** | 페이지 파라미터를 쓰면 250개를 넘어도 전체를 시간순으로 반환한다 **[검증]**. 저장소별 커밋 상한은 아래 규칙대로 적용한다 |
| PR 목록 | `GET /pulls?state=all&sort=updated&direction=desc`. high-water mark에서 2일 겹침을 뺀 시점까지 | per_page 100. 목록 upsert와 **같은 트랜잭션에서** 상세가 필요한 PR에 `requestPrDetail`(아래 needs_detail) |
| 개별 PR | `targeted_pr_numbers`의 번호마다 `GET /pulls/{n}`. `pull_requests` 배치에서 목록보다 먼저 | 배치당 최대 20개. **목록의 시간 범위와 무관**. 저장소 PR 상한 적용 |
| PR 커밋 (`pr_details`) | pending PR마다 `GET /pulls/{n}/commits` | **PR당 250 — GitHub API 제한 [검증]**. 완주 판정은 아래 체크포인트 3단계. 초과면 `commits_truncated`·`commits_total` |
| 리뷰 (`pr_details`) | pending PR마다 `GET /pulls/{n}/reviews` | per_page 100, **PR당 300(3페이지) — DevLog 자체 상한**. API는 개수 제한 없이 시간순으로 반환한다 **[검증: 공식 문서]**. 인라인 리뷰 코멘트는 v2.0에서 제외 |
| 이슈 | `GET /issues?state=all&since=…`. `pull_request` 키가 있는 항목 제외 | per_page 100 |

**수집 상한 구분**

| 항목 | 값 | 출처 | 넘을 때 |
|---|---|---|---|
| `GET /pulls/{n}/commits` | 250개/PR | **GitHub API 제한** ("Lists a maximum of 250 commits") [검증] | `commits_truncated`. 기존 링크 삭제 안 함 |
| Compare(페이지 파라미터 없을 때) | 250개 | GitHub API 제한. 페이지를 쓰면 없음 [검증] | 페이지네이션(아래 Compare 작업) |
| `per_page` | 100 | GitHub API 제한 | — |
| 리뷰 목록 | 300개/PR | **DevLog 상한**(API는 개수 제한 없음, 시간순) [검증] | `reviews_truncated`. 삭제 안 함 |
| 저장소당 커밋 2,000 · PR 500 · 이슈 500 | — | DevLog 상한 | 상한 도달 표시 |
| `targeted_pr_numbers` | 100개/저장소 | DevLog 상한 | 추가 안 함 + 경고 로그 |

**기본 브랜치 증분: Compare 작업**
1. **작업 시작 때 고정**
   - 기본 브랜치의 현재 head를 조회한다(`GET /repos/{o}/{r}/branches/{default}`).
   - `cursor = { base: confirmed_head, head: target_head, page: 1, total: null }`을 저장한다.
   - base == head이면 바로 완료한다.
2. **첫 페이지에서 상태를 분류**(`status`, `total_commits`, `merge_base_commit`)

   | 조건 | 분류 | 처리 |
   |---|---|---|
   | `ahead` 또는 `identical` | 정상 | 페이지 진행 |
   | `diverged` 또는 `behind` | `history_rewritten`(force-push) | 대체 경로 + 저장소에 `history_rewritten_at` 기록과 UI 안내 |
   | 404 | `base_unreachable`(base가 GC됐거나 브랜치가 사라짐) | 저장소 메타데이터를 다시 조회한다(기본 브랜치 변경 감지). 그다음 대체 경로 |
   | 409 | `empty_repository` | 완료(커밋 없음) |
   | 5xx·네트워크·rate limit | 일시 오류 | 커서를 유지하고 `next_run_after`, 같은 페이지부터 재개 |

3. **페이지 처리**: 페이지마다 커밋을 upsert(`on_default_branch=true`)하고 `page+1`을 fencing 트랜잭션에 저장한다. 중간에 실패하면 저장된 page부터 다시 한다.
4. **head 확정**: 처리량이 `total_commits` 이상이거나 빈 페이지가 오면, 그때 **한 번만** `confirmed_head=target_head`로 확정한다(fencing).
   - 처리 중에 브랜치 head가 바뀌어도 이번 작업은 고정된 head까지만 처리한다. 다음 증분이 `confirmed_head→새 head`를 이어서 처리한다.
5. **대체 경로**(`history_rewritten`·`base_unreachable`일 때만): `GET /commits?sha=<target_head>&since=<merge_base 날짜 또는 confirmed 시점 − 7일>`로 최신순 수집 후 head를 확정한다.
   - **250개를 넘었다는 이유만으로는 대체 경로를 쓰지 않는다.**
6. **상한과의 관계**: `total_commits`가 남은 저장소 상한보다 크면 compare 페이지를 끝까지 넘기지 않는다. 대신 최신순 목록 경로로 상한까지만 받고 head를 확정한 뒤 `capped=true`를 표시한다. compare는 시간순(오래된 것부터)이라 상한에 걸리면 최근 커밋이 빠지기 때문이다.

**PR 상세 체크포인트**
- `github_pr_sync`(PR당 1행): `connected_repository_id`, `pr_kind`(NOT NULL 상수), **`requested_generation`, `synced_generation`** bigint, `synced_for_updated_at`, `detail_status`(`pending`/`done`/`error`), `attempts`, `next_run_after`, `last_error_kind`.
  - **pending 판정**: `requested_generation > synced_generation AND detail_status <> 'error'`.
    - `detail_status='error'`는 PR 단위 자동 재시도 중단이다(404 또는 연속 5회 실패). 새 요청이 오면 `requestPrDetail`이 `pending`으로 되돌린다.
  - **`synced_for_updated_at`은 pending 판정에 쓰지 않는다.** 마지막 상세 수집이 반영한 PR `updated_at` 기록이고, 아래 needs_detail의 안전망에서만 쓴다. 그래서 NULL(아직 수집 전)이 최초 수집을 막지 않는다.
- **상세 요청 경로**: 모두 `requestPrDetail`(§3.4)을 쓰므로, 상위 `pr_details` dirty가 같은 트랜잭션에 포함된다.
  1. **PR 목록·개별 PR 처리**: 같은 트랜잭션에서 upsert 전 값(`old`)을 읽고, 행마다 판정한다.
     ```
     needs_detail =
          pr_sync 행 없음                                     -- 새 PR: requested=1, synced=0으로 생성
       OR new.gh_updated_at > old.gh_updated_at                -- 목록이 변경을 관측(상세 처리 중이어도)
       OR (requested_generation = synced_generation            -- 안전망: 처리 완료 상태인데
           AND (synced_for_updated_at IS NULL                  --   기준 시점이 없거나
                OR new.gh_updated_at > synced_for_updated_at)) --   더 새로운 변경이 있음
     ```
     - 같은 PR이 다음 목록 pass(2일 겹침)에 같은 `updated_at`으로 다시 보이면 세 조건이 모두 거짓이다. 재요청하지 않는다.
  2. **`pull_request_review` webhook**(submitted, edited, dismissed): payload의 `repository.id`와 `pull_request.number`/`id`(필수 필드 **[검증]**)로 PR 행을 찾는다.
     - **PR 행이 있으면** `requestPrDetail`. 증분 목록의 시간 범위 밖에 있는 오래된 PR이어도 행 기준으로 바로 예약된다. PR `updated_at` 변화에 의존하지 않는다.
     - **PR 행이 없으면** `pull_requests` 리소스의 `targeted_pr_numbers`에 번호를 추가하고(이미 있으면 그대로) markDirty한다.
       - 다음 `pull_requests` 배치가 **목록보다 먼저** `GET /pulls/{n}`으로 그 PR을 upsert한다. 새 PR이므로 1번 규칙으로 상세가 예약된다. high-water mark−2일·180일 범위와 무관하다.
       - 개별 조회 결과: 200 → upsert 후 번호 제거 / 404 → 번호 제거 / 저장소 PR 상한 도달 → 번호 제거 + 상한 표시 / rate limit·5xx·네트워크 → 번호 유지(§3.4 결과 분류).
       - worker는 **처리한 번호만** 배열에서 뺀다: `ARRAY(SELECT n FROM unnest(targeted_pr_numbers) n WHERE n <> ALL($done))`. 덮어쓰지 않으므로, 처리 중에 webhook이 추가한 번호를 잃지 않는다. webhook은 lease·커서를 건드리지 않는다.
       - 배열이 이미 100개면 더 추가하지 않고 경고 로그를 남긴다(§9 #22).
     - **review 본문은 webhook에서 저장하지 않는다.**
  3. 사용자의 "이 PR 다시 가져오기" 액션
- **`pr_details` 배치**는 pending PR 중 `next_run_after`가 지난 것을 오래된 것부터 **한 PR씩** 처리한다:
  1. 시작할 때 `requested_generation`을 `$capturedPr`로, PR 행의 `gh_updated_at`을 `$capturedUpdatedAt`으로 읽는다.
  2. 남은 예산이 PR 1개의 최대 요청 수(커밋 3 + 리뷰 3 + `GET /pulls/{n}` 1)보다 적으면, 시작하지 않고 `more`로 종료한다.
  3. 커밋·리뷰 페이지를 **메모리에 모두 받는다**(트랜잭션 밖). PR당 크기가 제한돼 있어 메모리 사용이 작다. 그리고 **완주 여부를 명시적으로 판정**한다.
     - 커밋: 받은 수가 250 미만이고 마지막 응답에 `Link rel="next"`가 없으면 `commits_complete`다. 정확히 250개면 `GET /pulls/{n}`의 `commits`를 확인한다. 250이면 complete, 더 크면 `commits_truncated=true`, `commits_total=commits`(GitHub API 제한).
     - 리뷰: 3페이지 안에서 `rel="next"`가 없는 페이지에 도달하면 `reviews_complete`다. 3페이지째에도 `next`가 있으면 `reviews_truncated=true`(DevLog 상한). 시간순이므로 **가장 오래된 300개**가 저장된다.
     - 상한 도달(truncated)은 실패가 아니다. 정해진 수집 범위를 다 처리했으므로 아래 4단계를 그대로 진행한다.
  4. 모두 성공하면 하나의 fencing 트랜잭션에서:
     - 커밋을 upsert한다(`seen_via_pr`).
     - **PR↔커밋 링크**: `commits_complete`이면 새 목록으로 원자적으로 교체한다. 빠진 링크는 삭제하고, 해당 커밋의 `is_detached`를 재계산한다.
       - **`commits_truncated`이면 받은 링크만 upsert한다. 기존 링크 삭제와 `is_detached` 재계산은 하지 않는다.** 250개 밖에 있을 수 있는 커밋을 부재만으로 지우지 않기 위해서다.
     - **리뷰는 upsert만 한다.** `state`(`APPROVED`/`CHANGES_REQUESTED`/`COMMENTED`/`DISMISSED`)와 본문 발췌를 갱신한다. `DISMISSED`는 상태 변경으로 반영된다.
       - **응답에 없다는 이유로 리뷰를 삭제하지 않는다**(complete·truncated 무관).
       - `PENDING` 상태 리뷰는 저장하지 않는다.
     - PR 행의 `commits_truncated`, `commits_total`, `reviews_truncated`를 갱신한다.
     - `github_pr_sync`: `synced_generation=$capturedPr`, `synced_for_updated_at=$capturedUpdatedAt`, `attempts=0`, `next_run_after=NULL`, `detail_status = CASE WHEN requested_generation > $capturedPr THEN 'pending' ELSE 'done' END`.
     - fencing UPDATE(진행률·heartbeat).
     - **처리 중에 webhook이 `requested_generation`을 올렸다면 `requested > synced`가 유지돼 다시 pending**이 된다.
  5. **중간에 실패하면 아무것도 쓰지 않는다**(페이지네이션 도중 실패 포함). 기존 링크와 리뷰는 그대로다.
     - 이 PR 요청의 404·5xx 같은 PR 단위 오류: 그 PR만 `attempts+1`, `next_run_after` 백오프(1m·5m·30m·2h)를 짧은 fencing 트랜잭션으로 기록하고 다음 PR로 간다. 404이거나 연속 5회째면 `detail_status='error'`.
     - rate limit·네트워크 오류: PR 행은 바꾸지 않고 배치를 끝낸다(`rate_limited`/`transient`, §3.4).
  6. **배치 결과**: pending PR이 0개면 `done`. 지금 처리할 수 있는 PR이 남으면 `more`. 백오프 중인 PR만 남으면 `more`이고, `$resumeAt`은 그 PR들의 최소 `next_run_after`다.
  - `requested == synced`인 PR은 다시 읽지 않는다.
  - 중복 webhook은 delivery dedupe로 걸러진다. 걸러지지 않아도 세대만 오를 뿐이고, 리뷰 행은 upsert(external_id unique)라 중복이 생기지 않는다.
- **리뷰 삭제 정책 결론**: 부재를 근거로 한 삭제는 하지 않는다.
  - 근거 1: 제출된 리뷰는 삭제할 수 없고("Submitted reviews cannot be deleted") dismiss로 상태만 바뀐다 **[검증: 공식 문서]**.
  - 근거 2: 동기화는 installation token으로 하므로 다른 사용자의 미제출(PENDING) 리뷰는 응답에 없다 **[가정: 1d-2에서 dev 앱으로 확인]**. 나오더라도 정규화에서 PENDING을 제외하므로 이미 방어돼 있다.
  - 그래서 "응답에 없음"은 대부분 상한이나 실패로 못 받은 경우이고, 삭제 근거가 되지 않는다.
  - 리뷰 행은 연결 해제 같은 cascade로만 지워진다. 상세 재수집은 리뷰 행을 지우지 않으므로 `idea_sources.activity_id`와 snapshot은 영향을 받지 않는다. 커밋 링크 교체도 링크 행만 지우고 커밋 활동 행은 남긴다.
- **truncated 표시**: UI에는 "PR 커밋 N개 중 250개만 수집(GitHub API 제한)", "리뷰 300개 초과 — 앞 300개만 수집(DevLog 상한)"으로 표시한다. Galaxy 상세 패널에도 같은 표시를 한다.

**모델과 처리 규칙**
- 커밋은 `(user_id, github_repo_id, kind='commit', external_id=sha)`로 **1행만** 저장한다. 여러 경로에서 발견돼도 upsert로 합친다.
- 커밋 플래그:
  - `on_default_branch`: 기본 브랜치 경로에서 본 경우
  - `seen_via_pr`
  - `is_detached`: PR 링크도 없고 기본 브랜치에도 없음. 기본 숨김
- PR↔커밋은 `github_pr_commits`(pr_activity_id, commit_activity_id, position)로 연결한다. 위의 PR 상세 체크포인트 규칙에 따라 **전체 목록을 받았고 `commits_complete`일 때만** 트랜잭션 안에서 교체한다. `commits_truncated`이면 추가·갱신만 한다.
  - PR force-push로 빠진 커밋은 교체 과정에서 링크가 사라진다. 그 결과 다른 연결이 하나도 없고 `on_default_branch=false`이면 `is_detached=true`가 된다.
- **squash/rebase merge**: PR의 `merge_commit_sha`를 저장한다. 기본 브랜치의 squash 커밋(`on_default_branch`)과 PR의 원래 커밋(`seen_via_pr`)을 PR 노드로 묶는다.
- **미병합 PR 커밋**: 저장하되 `on_default_branch=false`.
- **리뷰**: `parent_activity_id`로 PR 행을 참조한다. 4열 복합 FK로 **같은 사용자·같은 저장소·종류 `pull_request`**를 DB에서 강제한다(§4.4). PR 행은 목록 또는 개별 PR 조회 단계에서 이미 upsert돼 있다. 리뷰는 upsert만 하고 상세 재수집에서 삭제하지 않는다.
- **작성자**: `author_github_id`와 `author_login`은 nullable이다. GitHub 계정과 연결되지 않은 커밋은 `author_name`(git 이름)만 저장한다. **이메일은 저장하지 않는다.**
- **UI 범위 안내**: "기본 브랜치 커밋과 수집 기간 PR의 커밋. PR 없이 다른 브랜치에만 있는 커밋은 포함되지 않음. 저장소당 수집 상한 있음."
- **검증 방식(표본 대조)**: 기간(예: 14일)과 범위를 맞춘 표본으로 비교한다. (a) 기본 브랜치 커밋 SHA 집합, (b) 특정 PR 2~3개의 커밋·리뷰 ID, (c) 이슈 번호 집합을 GitHub API 응답과 DB 행으로 **집합 비교**한다. GitHub UI 전체 건수와 같아야 한다는 기준은 쓰지 않는다.

### 3.6 글감 → 초안(v2.0) → 발행(v2.1)

- **posts는 블로그와 독립이다**(v2.0). 블로그 연결 없이 쓸 수 있다.
  - Phase 4에서 `blogs`와 `publications`를 추가한다. posts는 수정하지 않는다.
  - 대안이었던 "최소 blogs 테이블을 먼저 만들기"는 빈 테이블과 미사용 FK가 생겨서 기각했다.
- **글감 하나로 여러 초안을 만들 수 있다**(예: 시리즈).
- **글감 상태**: `collected` / `planned` / `drafting` / `published`
  - v2.0: 사용자가 수동으로 지정한다. `published`는 "외부에서 발행 완료"를 뜻하는 수동 표시다.
  - v2.1: 연결된 publication의 `deploy_status=deployed`가 되면 자동으로 `published`. 발행에 실패하면 글감·초안 상태는 바꾸지 않고 publication에만 실패를 기록한다.
- **v2.1 배포 상태 명칭**: 내부 enum을 하나로 통일하고, GitHub 원본 값은 `deploy_status_raw` text에 보존한다.

  | 내부 `deploy_status` | GitHub 원본 |
  |---|---|
  | `not_started` | — |
  | `queued`, `building` | Actions run `queued` / `in_progress` |
  | `build_failed` | run `failure` |
  | `cancelled` | run `cancelled` |
  | `not_triggered` | run 없음(시간 초과) |
  | `deploying` | Pages deployment 진행 중 |
  | **`deployed`** | Pages `succeed` |
  | `deploy_failed` | `deployment_failed`, `deployment_lost` |
  | `superseded` | 이후 커밋의 배포에 포함됨 |

  - commit 결과는 `commit_status`(`pending`/`committed`/`conflict`/`failed`)로 따로 둔다.
  - DB enum, 정규화 함수 `mapPagesStatus()`, UI 라벨, E2E 기대값이 모두 이 표를 따른다.
- **초안 front matter**: 블로그가 없으면 **Chirpy 프리셋**으로 검증한다. 발행할 때 블로그 설정으로 다시 검증한다.
  - **`date`는 초안에 저장하지 않는다.** 발행 시점에 `publications.published_at`(KST)으로 정하고, 파일명 날짜와 front matter에 넣는다.
- **외부 수정 동기화**: v2.1에서 저장된 blob SHA와 현재 SHA가 다르면 충돌로 표시하고 덮어쓰지 않는다. 블로그 쪽 수정을 자동으로 가져오지는 않는다(백로그).
- **초안 생성** `buildDraft(idea, sources, preset)`
  - BLOG_POLICY 섹션 구조로 만들고, 근거가 없는 섹션에는 `<!-- 작성 필요 -->`만 넣는다. **수치나 사실은 만들지 않는다.**
  - 출처 링크는 "참고한 활동" 목록으로 사용자 문장과 분리한다.

### 3.7 Development Galaxy

**결정: B안.** 개발 기록은 노드로 만들지 않고, 글감 상세 패널에 "연결된 개발 기록"으로 표시한다. 시각 밀도를 낮추고 그래프 모델을 일관되게 하기 위해서다.

**계층**: hub → repo → (활동 클러스터 | 개별 활동) → idea

**프로젝트 처리**
- 프로젝트는 노드로 만들지 않는다.
- 같은 프로젝트에 매핑된 저장소들은 인접한 궤도 섹터에 놓고, 필터와 패널에서 프로젝트명을 표시한다.

**노드 ID** (안정 ID)

| 종류 | ID 형식 |
|---|---|
| hub | `hub` |
| repo | `repo:{githubRepoId}` |
| 클러스터 | `cluster:{githubRepoId}:{kind}:{isoWeek}` |
| 활동 | `act:{githubRepoId}:{kind}:{externalId}` |
| 글감 | `idea:{uuid}` |

**엣지**
- `structure`: hub–repo, repo–cluster
- `relation`: repo–activity, pr–commit, pr–review, activity–idea, repo–idea(집계, "근거 N개")
- 궤도·입자 같은 **장식 요소는 엣지가 아니다.** 별도 레이어로 그리고 `aria-hidden`을 준다.

**글감 배치**
- 근거 활동이 펼쳐져 있으면 activity–idea로 잇는다.
- 접혀 있으면 repo–idea 집계 엣지로 잇는다.
- 활동 근거가 없는 글감(개발 기록만 있거나 근거 없음)은 hub 주변 "글감 링"에 둔다.

**레이아웃 (결정적)**
- repo 각도는 `hash(githubRepoId)` 버킷으로 정하고, ID 정렬 순으로 충돌을 해소한다.
- 반경은 개인 저장소가 안쪽, 조직 저장소가 바깥쪽이다.
- 활동은 `hash(externalId)`로 종류별 셸 위에 놓는다. 클러스터는 주 단위 나선으로 놓는다.
- **필터는 보이기·숨기기만 바꾸고 위치는 다시 계산하지 않는다.**

**무결성과 권한**
- `validateGraph()`가 ID 중복이 없는지, 모든 엣지의 source/target이 실제로 존재하는지 확인한다. 단위 테스트 대상이다.
- 그래프는 `getVisibleRepoIds`(§3.3) 결과로만 만든다.

**데이터와 렌더 예산 분리**
- 서버 집계는 SQL `GROUP BY (repo, kind, week)`로 건수만 계산한다. 원본 데이터 양과 무관하다.
- 펼치기: 선택한 저장소의 최근 활동 200개와 PR 링크.
- **렌더 예산**: 초기 300 노드 이하(저장소 50 이하, 클러스터 약 200, 글감 50 이하). 펼친 뒤 **최대 1,500 노드(내부 상한)**.
- 벤치마크 시나리오(300 / 1,500)는 [RELEASE_PLAN.md](RELEASE_PLAN.md) v2.0 완료 조건 7에 정의한다.

**렌더링 방식**
- 노드 종류마다 InstancedMesh, 선은 병합한 LineSegments를 쓴다.
- **툴팁은 공유 `Html` 1개**만 두고 hover·선택된 노드에만 띄운다.
- 카메라는 drei의 `CameraControls`(부드러운 전환)를 쓴다. 상세 패널과 폼은 Canvas 밖의 일반 React UI로 만든다. 글감 노드를 클릭하면 `/ideas/[id]`로 이동한다.

**시각 기준 (첨부 레퍼런스)**
- 배경은 짙은 네이비·차콜, 중앙 hub는 blue glow, 개인 저장소 blue, 조직 저장소 teal, 커밋·PR·이슈·리뷰는 보조 색, 글감은 purple.
- 은은한 bloom, 절제된 입자, 깊이감.

**대체 화면과 성능 설정**
- WebGL이 없거나 `prefers-reduced-motion`이면 목록·트리 뷰로 대체하거나 애니메이션을 최소화한다. 목록 뷰는 탭으로 언제든 쓸 수 있다.
- DPR 상한은 데스크톱 1.5, 모바일 1.25다.

**의존성**: `three@0.186.1`, `@react-three/fiber@9.8.2`(peer `react >=19 <19.4` **[검증]**, 현재 React 19.3.0), `@react-three/drei@10.7.9`.
- package.json에 정확한 버전으로 고정하고, React도 `19.3.x`로 고정한다.

### 3.8 외부 텍스트·보안 정책

- **저장 최소화**
  - 종류별 zod allowlist로 metadata를 고른다(라벨, merged, additions/deletions, draft 등). 원본 응답 전체는 저장하지 않는다.
  - `body_excerpt`는 제어문자를 제거하고 500자까지만 저장한다.
- **렌더링**
  - GitHub 텍스트는 React 텍스트로만 출력한다. `dangerouslySetInnerHTML`은 금지한다.
  - 초안 미리보기는 `react-markdown` + `remark-gfm`을 쓰고 raw HTML은 꺼둔다.
  - 링크는 `rel="noopener noreferrer"`로 연다.
- **비밀값 검사**: 글감 연결과 초안 검증 때 경고한다(`gh[pousr]_`, `github_pat_`, PEM, AWS 키 패턴). **탐지는 보조 수단일 뿐 유출 방지를 보장하지 않는다**고 UI와 문서에 명시한다.
- **private 출처**: `idea_sources.snapshot`의 `is_private_at_capture`와 현재 판정(§3.3 snapshot 판정 순서)을 함께 쓴다. 초안 검증과 발행(v2.1) 전에 경고하고 확인을 받는다. private 저장소 링크는 본문에 넣지 않도록 경고한다.
- **로그**: `log-redaction.ts`에 GitHub 토큰 패턴과 PEM을 추가한다.
- **Webhook**: §3.8.1~3.8.2.

#### 3.8.1 Webhook 이벤트별 검증

**공통**
- **앱별 엔드포인트**를 둔다: `/api/github/webhook/reader`(v2.0), `/api/github/webhook/publisher`(v2.1).
- 각자의 webhook secret으로 `X-Hub-Signature-256`(raw body HMAC)을 `@octokit/webhooks-methods`로 검증한다. **실패하면 401을 반환하고 delivery는 기록하지 않는다.**
  - 서명이 앱별 secret에 묶여 있으므로 "어느 앱의 이벤트인가"는 이 단계에서 결정된다.
- 보조 확인: `X-GitHub-Hook-Installation-Target-Type`/`-ID`를 앱 ID와 비교한다. 문서에 GitHub App의 값이 명시돼 있지 않으므로 **[가정]**, 불일치해도 거부하지 않고 로그만 남긴다.
- payload 원문은 저장하지 않는다. **존재가 보장되지 않는 필드를 필수로 가정하지 않는다**(Octokit 공식 payload 스키마 기준 **[검증]**).

**이벤트별 처리**

| 이벤트 / action | 필수 식별자(스키마 required) | 대조 대상 | DB 처리 |
|---|---|---|---|
| `installation` created | `installation.id` | — | 전역 `github_installations` upsert. 사용자 연결은 만들지 않는다 |
| `installation` deleted | `installation.id` | 저장된 설치 | 설치 `deleted_at` 기록. 그 설치의 **모든 사용자** `connected_repositories` → `installation_removed` |
| `installation` suspend / unsuspend | `installation.id` | 저장된 설치 | suspend: `suspended_at` 기록, 연결 저장소 → `installation_removed`. unsuspend: `suspended_at=NULL`, 연결 저장소 → **`unknown`**(바로 `ok`로 돌리지 않고 재검증) |
| `installation` new_permissions_accepted | `installation.id` | 저장된 설치 | 권한 메타데이터 갱신 |
| `installation_repositories` added / removed | `installation.id`, `repositories_added[]`, `repositories_removed[]`(각 `id`·`node_id`·`full_name`·`private` 필수 **[검증]**) | 저장된 설치 + 각 `github_repo_id` | removed: (설치, repo id)가 같은 모든 사용자 연결 → `installation_removed`. added: 이전에 제거됐던 연결이면 → `unknown`(재검증). 새 저장소를 자동 연결하지 않는다. `repository_selection` 갱신 |
| `github_app_authorization` revoked | `sender.id`만(**installation·repository 없음 [검증]**) | `github_app_user_credentials`(app=reader, github_user_id=sender.id) | 토큰 값 삭제 + `status=reauth_required`. 그 사용자의 연결 저장소 → `reauth_required`(private 숨김). 복구: `/repos`의 "GitHub 다시 인증" 버튼 → §3.1 흐름 → 재검증 |
| `repository` privatized / publicized / renamed / edited / transferred / deleted / archived | `repository.id`(**`installation`은 선택 [검증]**) | `github_repo_id`가 같은 연결(설치가 있으면 설치도 일치해야 함) | §3.3의 visibility 규칙 |
| `push`, `pull_request`, `issues` | `repository.id`, `installation.id`(있을 때) | 연결 저장소 | 해당 리소스(push→`default_branch_commits`, pull_request→`pull_requests`, issues→`issues`)를 markDirty(§3.4). payload 내용은 신뢰하지 않고 정규 동기화가 다시 조회한다 |
| `pull_request_review` submitted / edited / dismissed | `repository.id`, `pull_request.id`·`number`(필수 **[검증]**), `installation`은 선택 | 연결 저장소 + PR 행 | PR 행이 있으면 `requestPrDetail`(PR 세대 증가 + `pr_details` markDirty, 한 트랜잭션). 없으면 `pull_requests` 리소스의 `targeted_pr_numbers`에 번호 추가 + markDirty(목록 범위 밖 PR도 개별 조회, §3.5). 잠금 순서는 §3.4를 따른다. **review 본문은 저장하지 않는다** |
| 그 외·연결되지 않은 설치·저장소 | — | — | 처리 없음(delivery는 기록해 재처리 방지) |

#### 3.8.2 Delivery 원자성 (A안)

하나의 DB 트랜잭션에서:
1. `INSERT INTO webhook_deliveries … ON CONFLICT (delivery_id) DO NOTHING RETURNING`
2. 0행이면 → 중복이다. 커밋하고 200을 반환한다.
3. 1행이면 → 위 표의 상태 변경을 수행한다. **외부 API 호출은 하지 않는다.**
4. 커밋 후 202를 반환한다.

- 도중에 예외가 나면 **전체 롤백**된다. delivery가 기록되지 않으므로 GitHub 재전송(수동 redeliver 또는 일일 reconciliation)이 다시 처리할 수 있다.
- 응답은 10초 안에 해야 한다 **[검증]**. 실제 데이터 수집은 동기화 엔진(§3.4)에 맡긴다.
- `webhook_deliveries`는 `delivery_id, app, event, action, installation_id, received_at`만 보관하고 30일 뒤 정리한다.

### 3.9 직접 구현 vs 라이브러리

| 항목 | 선택 | 근거 |
|---|---|---|
| 앱 JWT(RS256) | `universal-github-app-jwt` | Octokit 공식, 의존성 0. 키 형식(PKCS#1)·시계 오차를 처리한다. 직접 구현하면 실수 위험이 있다 |
| webhook 서명 | `@octokit/webhooks-methods` | 의존성 0, timing-safe 비교 |
| 토큰·쿠키 암호화 | `better-auth/crypto`의 `symmetricEncrypt`/`symmetricDecrypt`/`constantTimeEqual` 재사용(XChaCha20-Poly1305, `SecretConfig`로 버전 관리) | 이미 `encryptOAuthTokens`에 쓰이는 검증된 코드다. 직접 암호화 코드를 만들지 않는다. 별도 키 `GITHUB_TOKEN_ENCRYPTION_KEY`를 쓰므로 `BETTER_AUTH_SECRET`과 교체 주기가 독립적이다 |
| OAuth code 교환·PKCE | 자체 구현(fetch + `node:crypto` SHA-256) | 수십 줄. generic-oauth는 이메일 링크 제약 때문에 쓸 수 없다(사전 검증) |
| REST 클라이언트 | `src/lib/github/http.ts`를 확장 | 페이지네이션과 rate limit 분류는 어차피 직접 정의해야 한다. `@octokit/core`는 쓰지 않는다 |
| 작업 큐 | DB lease | Hobby에서 인프라가 필요 없다. 실행 단위가 `runSyncBatch`라서 나중에 Queues로 옮기기 쉽다 |
| 편집기 | textarea + 미리보기 | WYSIWYG는 백로그 |
| 칸반 | 버튼·메뉴로 상태 이동 | DnD 라이브러리를 쓰지 않는다. 키보드로도 쓸 수 있다 |
| 3D | three + R3F + drei | 카메라 전환은 drei `CameraControls`로 한다. Motion·GSAP은 쓰지 않는다 |

**MVP(v2.0)**: 위 전부. 단 webhook 수신기는 코드와 fixture 테스트까지만 하고, 실제 수신은 prod 앱 승인 후에 한다.
**장기**: Queues·Workflow 전환, 인라인 리뷰 코멘트, 블로그 수정 가져오기, AI 초안과 글감 추천, 조직 공동 워크스페이스, WYSIWYG.

---

## 4. 최종 데이터 관계 및 삭제 정책

### 4.1 테이블 (모두 추가 마이그레이션)

| 테이블 | 핵심 컬럼·제약 | Phase |
|---|---|---|
| `projects`, `dev_logs` (기존) | **`UNIQUE(id, user_id)` 추가**. id가 이미 PK라 기존 데이터와 항상 호환된다 | 1a |
| `github_app_user_credentials` | user_id FK cascade, app, github_user_id bigint, enc_access, enc_refresh, access_expires_at, refresh_expires_at, status. unique(user_id, app) | 1a |
| `github_installations` | 전역. app, installation_id bigint, account_id bigint, account_login, account_type, repository_selection, suspended_at, deleted_at. unique(app, installation_id) | 1a |
| `connected_repositories` | user_id FK cascade, installation_ref FK, github_repo_id bigint, node_id, owner_id bigint, full_name, is_private, default_branch, access_state, access_verified_at, access_checked_at, user_permission. **unique(user_id, github_repo_id), unique(id, user_id)** | 1a |
| `project_repositories` | (project_id, user_id) → projects(id, user_id) cascade, (connected_repository_id, user_id) → connected_repositories cascade. PK(project_id, connected_repository_id) | 1a |
| `github_activities` | user_id, (connected_repository_id, user_id) FK cascade, github_repo_id, kind(CHECK 4종), external_id text, node_id, number, **parent_activity_id + parent_kind**(4열 FK → 자기 자신 cascade + **NULL-safe CHECK `act_parent_shape`**, §4.4), title, body_excerpt, state, author_*, html_url, occurred_at, gh_created/updated/merged/closed, merge_commit_sha, on_default_branch, seen_via_pr, is_detached, commits_truncated, commits_total, **reviews_truncated**(PR 행만 의미), is_private, metadata. **unique(user_id, github_repo_id, kind, external_id), unique(id, user_id), unique(id, user_id, connected_repository_id, kind)**, index(user_id, connected_repository_id, occurred_at desc), (user_id, author_github_id) | 1a |
| `github_pr_commits` | **모든 FK 컬럼 NOT NULL**(user_id, connected_repository_id, pr_activity_id, commit_activity_id), `pr_kind text NOT NULL DEFAULT 'pull_request' CHECK (pr_kind='pull_request')`, `commit_kind text NOT NULL DEFAULT 'commit' CHECK (commit_kind='commit')`, position. **4열 FK 2개** → `github_activities(id, user_id, connected_repository_id, kind)` cascade. PK(pr_activity_id, commit_activity_id) | 1a |
| `github_pr_sync` | pr_activity_id PK, user_id, connected_repository_id, `pr_kind text NOT NULL DEFAULT 'pull_request' CHECK (pr_kind='pull_request')` — **4열 FK** `(pr_activity_id, user_id, connected_repository_id, pr_kind)` → github_activities cascade(PR 소유·종류 강제). requested_generation, synced_generation, synced_for_updated_at, detail_status(CHECK `pending`/`done`/`error`), attempts, next_run_after, last_error_kind (pending 판정·`error` 의미는 §3.5) | 1a |
| `github_sync_state` | §3.4(`lease_token`, `change_generation`, `processed_generation`, **`pass_generation` bigint NULL**, **`targeted_pr_numbers integer[] NOT NULL DEFAULT '{}'`** 포함). CHECK: status 6종, `resource = 'pull_requests' OR cardinality(targeted_pr_numbers) = 0`, `cardinality(targeted_pr_numbers) <= 100`. resource는 `default_branch_commits`, `pull_requests`, `pr_details`, `issues`. unique(connected_repository_id, resource), cascade. 저장소 단위 `confirmed_head`, `history_rewritten_at`, `capped`는 `connected_repositories`에 둔다 | 1a |
| `webhook_deliveries` | delivery_id PK, app, event, action, installation_id, received_at. 30일 지나면 cron으로 정리(§3.8.2) | 1a |
| `writing_ideas` | user_id, project_id → **수동 SQL**: `FOREIGN KEY (project_id, user_id) REFERENCES projects(id, user_id) ON DELETE SET NULL (project_id)`, title, description, type, status, position, tags text[](GIN), memo. unique(id, user_id) | 2a |
| `idea_sources` | (idea_id, user_id) → writing_ideas cascade(**idea_id·user_id NOT NULL**), **kind NOT NULL**(`activity`/`dev_log`, CHECK 식이 NULL이 되지 않게 함), activity_id·dev_log_id → **수동 SQL `ON DELETE SET NULL (activity_id)` / `(dev_log_id)`**, snapshot jsonb NOT NULL, unique(idea_id, activity_id), unique(idea_id, dev_log_id) | 2a |
| `posts` | user_id, idea_id → **수동 SQL `SET NULL (idea_id)`**, type, title, slug, description, tags, body_md, front_matter_extra, status(`draft`/`ready`/`archived`). unique(id, user_id) | 2a |
| `blogs`, `publications` | v2.1. publications: (post_id, user_id) cascade, blog_id, path, blob_sha, commit_sha, commit_status, deploy_status, published_at, url | 4 |

**idea_sources CHECK** (PGlite PG 18.6에서 동작 확인 **[검증]**):

```sql
CHECK (kind IN ('activity','dev_log'))
CHECK (NOT (activity_id IS NOT NULL AND dev_log_id IS NOT NULL))
CHECK ((kind='activity' AND dev_log_id IS NULL) OR (kind='dev_log' AND activity_id IS NULL))
-- 원본이 삭제된 뒤 둘 다 NULL인 "스냅샷 전용" 상태는 허용된다
```

**마이그레이션 방식**
- 컬럼 지정 SET NULL을 쓰는 **FK 4개**(writing_ideas.project_id, idea_sources.activity_id, idea_sources.dev_log_id, posts.idea_id)는 **Drizzle 스키마에 선언하지 않는다.**
- 대신 `drizzle-kit generate --custom --name=…` **[검증: 옵션 존재]**로 만든 SQL 파일에 넣는다.
  - drizzle-kit은 스냅샷 기준으로 비교하므로 이 제약을 지우지 않는다.
  - 통합 테스트(PGlite가 전체 마이그레이션을 적용)로 이 제약이 실제로 있는지 확인한다.
- 운영 DB(Neon)는 PG 18이다(프로젝트 `pg_version: 18`) **[검증]**. 컬럼 지정 SET NULL은 PG 15 이상에서 지원된다.

### 4.4 불변식: DB 강제 vs 서버 강제

| 불변식 | 보장 위치 | 방식 |
|---|---|---|
| 다른 사용자 행끼리 연결 불가 | **DB** | 모든 조인·참조에 `user_id`를 포함한 복합 FK |
| PR↔커밋이 같은 저장소 | **DB** | `github_pr_commits`의 4열 FK `(id, user_id, connected_repository_id, kind)` |
| 링크의 PR 쪽은 PR, 커밋 쪽은 커밋 | **DB** | 상수 kind 컬럼(CHECK) + 4열 FK |
| 리뷰의 부모는 같은 저장소의 PR | **DB** | 자기 참조 4열 FK + NULL-safe CHECK(아래) |
| **NULL로 FK 검사 우회 불가** | **DB** | 복합 FK는 기본이 MATCH SIMPLE이라 참조 컬럼 하나라도 NULL이면 검사하지 않는다. CHECK도 NULL 결과를 통과로 처리한다. 그래서 (a) 링크·동기화 테이블의 FK 컬럼은 전부 NOT NULL, (b) 리뷰 부모는 아래 CHECK로 "모두 NULL" 또는 "모두 값 있음"만 허용한다. 부모 FK는 비리뷰 행에서 NULL이어야 하므로 MATCH FULL은 쓸 수 없다(user_id가 NOT NULL이라 혼합 NULL이 된다) |
| PR 동기화 행은 같은 사용자의 PR에만 존재 | **DB** | `github_pr_sync` 4열 FK |
| 글감 근거는 활동·개발 기록 중 하나 또는 스냅샷 전용 | **DB** | §4.1의 CHECK 3종 |
| 원본 삭제 시 `user_id`는 유지되고 참조 ID만 NULL | **DB** | `ON DELETE SET NULL (col)`(수동 SQL) |
| 활동과 저장소의 GitHub ID 일치(`github_repo_id`가 연결 저장소의 값) | **서버** | 정규화 함수가 연결 저장소에서 값을 복사한다. 4열 FK로 이미 저장소가 고정되므로 별도 DB 제약은 두지 않는다(과도한 제약) |
| 사용자가 실제 GitHub 접근 권한을 가진 저장소만 표시·동기화 | **서버** | §3.3 `getVisibleRepoIds` / `assertRepoAccess` |
| 글감에 연결하는 활동이 현재 접근 가능 | **서버** | `assertRepoAccess(fresh)` |
| 저장소별 수집 상한 | **서버** | 동기화 엔진 |

PGlite(PG 18.6)에서 4열 FK와 CHECK가 실제로 차단되는 것을 확인했다 **[검증]**: 다른 저장소 커밋 링크, 이슈를 PR로 링크, 리뷰가 이슈나 다른 저장소 PR을 부모로 지정, 부모 없는 리뷰 → 모두 거부. PR을 삭제하면 리뷰와 링크가 cascade로 지워진다.

**리뷰 부모 CHECK (NULL-safe)**:

```sql
CONSTRAINT act_parent_shape CHECK (
  (kind = 'review' AND parent_activity_id IS NOT NULL
                   AND parent_kind IS NOT NULL AND parent_kind = 'pull_request')
  OR (kind <> 'review' AND parent_activity_id IS NULL AND parent_kind IS NULL))
```

- `kind`가 NOT NULL이고 각 항에 `IS NOT NULL`을 넣었기 때문에 식 전체가 NULL이 되지 않는다.
- 이전 설계 문구(`(kind='review') = (parent_activity_id IS NOT NULL)` + nullable `parent_kind`)로 만든 제약에서는 **`parent_kind=NULL`인 리뷰가 이슈를 부모로 삼는 것이 실제로 허용됐다**(FK 검사 생략). 수정한 제약에서는 다음이 모두 거부됐다 **[검증: PGlite]**: `pr_kind` NULL, `commit_kind` NULL, `parent_kind` NULL인 리뷰, 이슈를 부모로 둔 리뷰, 부모 없는 리뷰, 부모가 있는 비리뷰, 이슈를 대상으로 한 `pr_sync`, 다른 사용자의 `pr_sync`. 정상적인 PR·커밋·리뷰 연결은 성공했다.

### 4.5 수동 SQL 제약 관리 절차

1. **대상**: 컬럼 지정 `SET NULL (col)` **FK 4개**만 수동이다: ① `mfk_writing_ideas_project_id`, ② `mfk_idea_sources_activity_id`, ③ `mfk_idea_sources_dev_log_id`, ④ `mfk_posts_idea_id`. 4열 FK, CHECK, unique는 Drizzle 스키마에 선언한다(일반 cascade라 생성 가능).
2. 수동 제약은 **Drizzle 스키마에 선언하지 않는다.** 이름 규칙은 `mfk_<table>_<column>`이다.
3. `src/db/manual-constraints.ts`에 `{ name, table, definitionIncludes }` 목록을 둔다. 이 목록이 단일 출처다.
4. 생성: `npm run db:generate -- --custom --name=<설명>`으로 빈 SQL을 만들고 `ALTER TABLE … ADD CONSTRAINT mfk_… FOREIGN KEY … ON DELETE SET NULL (col)`을 작성한다.
5. **검증 테스트**(통합, 항상 실행): 전체 마이그레이션을 적용한 PGlite에서 `pg_constraint` + `pg_get_constraintdef()`로 확인한다.
   - 목록의 **4개 제약이 모두 있는지**(개수 정확히 4), 정의에 `ON DELETE SET NULL (col)`이 포함되는지.
   - Phase 1(1a)에서는 목록이 비어 있어 0개를 기대하고, Phase 2a에서 4개로 바뀐다.
6. **리뷰 규칙**: 이후 `db:generate` 결과 SQL에 `mfk_` 제약의 `DROP CONSTRAINT`가 나오거나, 관련 컬럼의 타입·이름 변경이 생기면 Opus 리뷰에서 반려한다. 컬럼 변경이 필요하면 수동 제약을 다시 만드는 custom 마이그레이션을 함께 작성한다.
7. 운영 적용 전에 dev 브랜치에서 같은 catalog 쿼리 스크립트(`scripts/check-constraints.mjs`)로 확인한다.

### 4.2 삭제 순서 (트랜잭션)

**연결 해제** `disconnectRepository(db, userId, repoId)`, 단일 트랜잭션:
1. 대상 저장소 활동을 참조하는 `idea_sources` 중 **현재 private인 저장소(또는 `is_private_at_capture=true`)의 snapshot을 redact**한다: `{kind, github_repo_id, is_private_at_capture:true, redacted:true}`. 제목·URL은 제거한다.
2. `connected_repositories`를 삭제한다.
   - cascade로 sync_state, project_repositories, github_activities가 지워지고, 그 아래 pr_commits와 리뷰도 함께 지워진다.
   - 활동이 지워지면 `idea_sources.activity_id`가 FK에 의해 NULL이 된다. `user_id`와 snapshot은 남는다.
3. 다른 사용자가 연결하지 않은 `github_installations`는 **삭제하지 않는다**. 전역 객체이고, 일일 cron이 정리한다.

### 4.3 이벤트별 데이터 처리

| 이벤트 | 활동 데이터 | 동기화 | 글감 source snapshot (GitHub 메타) | 사용자 메모·초안 |
|---|---|---|---|---|
| 사용자 연결 해제 | **삭제** | 중단 | public: 유지 / **private: 제목·URL redact** | 유지 |
| 권한 상실 (`access_lost`, 조직 탈퇴 등) | **숨김**(보존) | 차단 | private: 화면에서 제목·URL을 가리고 "접근 권한 없음"으로 표시(데이터 보존) | 유지 |
| 설치 해제·suspend (`installation_removed`) | 숨김 | 차단 | 권한 상실과 같음 | 유지 |
| 저장소 삭제·이전 (`repository` webhook) | 재검증. 접근 불가면 `access_lost` | 차단 | 권한 상실과 같음 | 유지 |
| public → private 전환 | webhook이면 즉시 `is_private=true`, 검증 시각 초기화로 **재검증 전까지 숨김**. webhook이 누락되면 다음 재검증에서 반영 | 재검증 후 계속 | 현재 저장소 상태로 판정(private 규칙) | 유지 |
| private → public 전환 | `is_private=false`(webhook 또는 재검증) | 계속 | public 규칙 | 유지 |
| user token 폐기 (`github_app_authorization` revoked, `sender.id`로 식별) | private 숨김, 토큰 삭제 | 차단(재인증 필요) | private 가림 | 유지 |
| 설치 복구 (`unsuspend`, 저장소 재추가) | `unknown` → 재검증 성공 시 다시 표시 | 재검증 후 재개 | 재검증 결과를 따름 | 유지 |
| 일시 오류 (`unknown`) | private 숨김(fail-closed), 상태 보존 | 백오프 재시도 | private 가림 | 유지 |
| DevLog 계정 삭제 | user FK cascade로 **전부 삭제** | — | 삭제 | 삭제 |

- 권한이 복구되면(재검증 `ok`) 숨김을 해제한다. 연결 해제 후 다시 연결하면 처음부터 동기화한다.
- **사용자가 직접 쓴 메모와 초안은 사용자 소유라서 권한 이벤트로 지우지 않는다.** 다만 초안 본문에 private 출처가 인용돼 있을 수 있어서, 발행 검증에서 경고한다.
- 다른 사용자 노출은 구조적으로 막는다. 모든 데이터가 사용자별 행이고, 조인 테이블에 복합 FK가 있기 때문이다.

---

## 6. 의존성·블로커와 테스트 전략

### 6.1 사용자가 설정해야 할 것

| 시점 | 항목 | 설정값 |
|---|---|---|
| Phase 1b 전 | **GitHub App `devlog-reader-dev`** (본인 계정 소유, "Any account") | 권한: Repository Metadata·Contents·Pull requests·Issues = **Read-only**, 조직 권한 없음. Callback URL: `http://localhost:3000/api/github/reader/callback`. "Expire user authorization tokens" ✅. "Request user authorization during installation" ❌. Setup URL: `http://localhost:3000/repos/connect`, "Redirect on update" ✅. Webhook: **비활성**(dev) |
| 〃 | `.env.local`에 직접 입력(값 공유 금지) | `GITHUB_READER_APP_ID`, `GITHUB_READER_APP_SLUG`, `GITHUB_READER_CLIENT_ID`, `GITHUB_READER_CLIENT_SECRET`, `GITHUB_READER_PRIVATE_KEY_B64`(PEM base64). `CRON_SECRET`은 Opus가 생성한다 |
| Phase 1 E2E 전 | **테스트 조직 + private·public 테스트 저장소** (무료 org) | 조직 설치, 권한 상실(멤버 제거·저장소 제외) 시나리오용. 가능하면 테스트용 두 번째 GitHub 계정도 |
| v2.0 릴리즈 승인 시 | `devlog-reader-prod` 앱 | 운영 URL callback·setup, webhook URL `https://devlog-psi-three.vercel.app/api/github/webhook/reader` + secret, 이벤트 push·pull_request·pull_request_review·issues·repository. installation·installation_repositories·github_app_authorization은 기본 수신이라 별도 구독이 없다 **[검증]** |
| v2.1 | `devlog-publisher-{dev,prod}` 앱, 테스트 블로그 저장소 | Contents RW, Metadata R, Pages R, Actions R. **Workflows 권한 없음** |

### 6.2 테스트 전략

**단위 (Vitest)**
- OAuth state·PKCE·쿠키 검증
- 토큰 갱신 오류 분류
- http 분류(primary·secondary·SSO·5xx)
- 정규화 allowlist와 이메일 미저장
- 비밀값 패턴
- 커밋 수집 경로 선택(compare, 대체 경로)
- `buildDraft`와 front matter 검증
- 레이아웃 결정성, `validateGraph`
- 접근 상태 전이 함수

**통합 (PGlite + 실제 마이그레이션, 수동 SQL 포함)**

필수 항목:
1. 서로 다른 사용자 데이터 연결 차단(project_repositories, github_pr_commits, idea_sources 활동·개발 기록, posts.idea_id)
2. 원본 활동·개발 기록 삭제 후 글감과 snapshot이 남고 `user_id`도 보존됨
3. 프로젝트 삭제 후 글감이 남고 `project_id`만 NULL이 됨
4. 허용되지 않은 원본 조합(둘 다 지정, kind 불일치)이 CHECK로 차단됨
5. 연결 해제 트랜잭션의 삭제 범위와 private snapshot redaction
6. 재연결 후 중복 0
7. sync lease 동시 획득 1건만 성공
8. 커서 재개
9. 다른 사용자 ID로 모든 서버 함수 호출 시 null·false

**무결성**

| # | 테스트 | 종류 |
|---|---|---|
| 9a | 같은 사용자의 **다른 저장소** 커밋을 PR에 링크 → 거부 | 통합 |
| 9b | 이슈를 PR 자리로 링크 → 거부 | 통합 |
| 9c | 리뷰 부모가 이슈이거나 다른 저장소 PR → 거부. 부모 없는 리뷰 → 거부 | 통합 |
| 9d | `manual-constraints.ts` 목록 제약이 catalog에 존재하고(Phase 2a 이후 **정확히 4개**) 정의에 `SET NULL (col)` 포함 | 통합 |
| 9e | `github_pr_commits.pr_kind = NULL` 삽입 → 거부 | 통합 |
| 9f | `commit_kind = NULL` 삽입 → 거부 | 통합 |
| 9g | `parent_activity_id`는 있고 `parent_kind = NULL`인 리뷰 → 거부. **이전 설계 문구의 우회 시나리오를 회귀 테스트로 고정** | 통합 |
| 9h | 리뷰 부모가 이슈·커밋(종류 위장 포함), 부모 없는 리뷰, 부모가 있는 비리뷰 → 거부 | 통합 |
| 9i | 정상적인 PR·커밋 링크, 리뷰→PR, PR의 `pr_sync` 생성 → 성공. 이슈 대상 `pr_sync`·다른 사용자 `pr_sync` → 거부 | 통합 |

**동기화 lease와 fencing**

| # | 테스트 | 종류 |
|---|---|---|
| 10 | 두 worker가 동시에 lease 획득 → 1개만 성공 | 통합 |
| 11 | lease 만료 후 다른 worker가 재획득 → `lease_token` 증가 | 통합 |
| 12 | 이전 worker의 늦은 커서·상태 쓰기 → 0행 → **롤백, 최신 커서 불변** | 통합 |
| 13 | 배치 도중 종료(예외 주입) → 다음 실행이 저장된 커서부터 재개, 중복 upsert 0 | 통합 |

**수집기 (가짜 fetch)**

| # | 테스트 | 종류 |
|---|---|---|
| 14 | Compare `total_commits=320`: 4페이지를 순서대로 처리, 마지막에만 head 확정, 대체 경로를 타지 않음 | 단위·통합 |
| 15 | 2페이지 처리 후 종료 → 재개 시 3페이지부터, 같은 커밋 중복 0 | 통합 |
| 16 | 처리 중 브랜치 head 변경 → 이번 작업은 고정 head로 완료, 다음 증분이 새 head까지 수집 | 통합 |
| 17 | `diverged`(force-push) → `history_rewritten` 분류와 대체 경로 | 단위 |
| 18 | 404(base 소실) → `base_unreachable` 분류와 메타데이터 재조회 / 409 → `empty_repository` | 단위 |
| 19 | 동일 커밋이 기본 브랜치와 PR 두 경로에서 수집됨 → 1행, 플래그 병합 | 통합 |
| 20 | PR 상세: 커밋 2페이지 중 2번째에서 429 → 기존 링크 유지, PR `pending`, `done`인 PR은 다시 읽지 않음 | 통합 |
| 21 | PR force-push 후 상세 재수집(받은 수 < 250, complete) → 링크 원자적 교체, 빠진 커밋 `is_detached`. 250개 반환 + `commits=300` → `commits_truncated`, **기존 링크 삭제 0·`is_detached` 변화 없음** | 통합 |

**webhook**

| # | 테스트 | 종류 |
|---|---|---|
| 22 | 서명 오류 → 401, delivery 미기록 | 통합 |
| 23 | 같은 delivery 2회 → 상태 변경 1회 | 통합 |
| 24 | 상태 변경 중 예외 주입 → 롤백, delivery 미기록 → 재전송 시 정상 처리 | 통합 |
| 25 | `github_app_authorization` revoked(`sender.id`만 있는 실제 스키마 형태) → credential `reauth_required`, private 숨김 | 통합 |
| 26 | `installation` deleted/suspend → 해당 설치를 연결한 **여러 사용자** 모두 `installation_removed`. unsuspend → `unknown` | 통합 |
| 27 | `installation_repositories` removed → 대상 저장소만 `installation_removed`. 연결되지 않은 설치·저장소 → 변경 없음 | 통합 |
| 28 | `repository` privatized(installation 필드 없음) → 즉시 숨김, 재검증 후 표시. publicized·renamed 처리 | 통합 |

- fixture는 Octokit 공식 payload 스키마의 required 필드만으로 만든다. 존재가 보장되지 않는 필드에 의존하지 않는다.

**OAuth와 v2.1**

| # | 테스트 | 종류 |
|---|---|---|
| 29 | 성공한 callback 뒤 같은 URL 재요청(쿠키 없음) → 거부. 쿠키 이름이 http에서는 접두사 없음, https에서는 `__Host-` | 단위 |
| 30 | (v2.1) `mapPagesStatus`: `succeed`→`deployed`, `deployment_failed`/`deployment_lost`→`deploy_failed`. UI 라벨과 E2E 기대값이 같은 enum을 사용 | 단위 |

**lost update와 만료 lease**

| # | 테스트 | 종류 |
|---|---|---|
| 31 | 배치 실행 중(lease 보유) webhook이 `change_generation`을 올림 → pass `done`으로 종료해도 상태가 **`pending`**(complete 아님), `processed_generation` = `pass_generation`(webhook 이전 값) | 통합 |
| 32 | 31 이후 다음 배치가 새 변경을 수집하고 `complete`가 됨(누락 없음) | 통합 |
| 33 | lease 만료 후 **아무도 재획득하지 않은 상태**에서 이전 worker의 커서·heartbeat 쓰기 → 0행 → 롤백 | 통합 |
| 34 | `done`이 아닌 종료(`more`·`blocked`·`error`)에서는 `processed_generation`이 올라가지 않음 | 통합 |

**리뷰 재동기화**

| # | 테스트 | 종류 |
|---|---|---|
| 35 | PR `updated_at`은 그대로인데 `pull_request_review` webhook 수신 → **해당 PR만** `requested > synced`가 됨. 다른 PR은 다시 읽지 않음 | 통합 |
| 36 | 상세 재수집에서 리뷰 추가·수정(`edited`)·`DISMISSED` 상태가 반영됨. 응답에 없는 리뷰는 **삭제하지 않음**(#45·#46) | 통합 |
| 37 | PR 상세 fetch 도중 webhook이 세대를 올림 → 커밋 후에도 pending 유지 → 다음 처리에서 반영 | 통합 |
| 38 | 같은 리뷰 webhook 중복(delivery 다름·같음 모두) → 리뷰 행 중복 0. PR 행이 없을 때 → `pull_requests` 리소스 `change_generation` 증가 + `targeted_pr_numbers`에 번호 1개(같은 번호 중복 추가 없음) | 통합 |

**표시 정책**

| # | 테스트 | 종류 |
|---|---|---|
| 39 | public 저장소도 `access_verified_at`이 10분을 넘고 재검증이 일시 오류로 실패 → 숨김(`unknown`) | 통합 |
| 40 | snapshot 판정 순서: 원본 활동 있음 → 현재 판정 / 원본 없음 + 같은 `github_repo_id` 연결 있음 → 그 연결의 현재 판정(`is_private_at_capture=false`여도 현재 private·권한 없음이면 숨김) / 연결 없음 → 제목만, "미확인" 배지, 링크 비활성 | 통합 |

**PR 상세 예약, 리뷰 상한, 종료 상태**

| # | 테스트 | 종류 |
|---|---|---|
| 41 | `pr_details`가 `complete`인 상태에서 `pull_request_review` webhook → 같은 트랜잭션에서 PR `requested > synced` + `pr_details` `pending` → 다음 배치가 **그 PR만** 재수집하고 `complete`. `pr_details`가 `running`일 때 도착하면 `lease_token`·커서 불변, 종료 시 `pending` | 통합 |
| 42 | PR 목록 페이지에서 새 PR 발견 → 같은 트랜잭션에서 `pr_sync`(requested=1, synced=0) 생성 + `pr_details` `idle`/`complete` → `pending`. 목록 트랜잭션이 롤백되면(fencing 실패 주입) 둘 다 남지 않음 | 통합 |
| 43 | `synced_for_updated_at=NULL`인 최초 PR → pending 판정되어 수집, 완료 후 `synced_for_updated_at` 기록·`done`. 다음 목록 pass에 같은 `updated_at`으로 다시 보이면 재요청 없음 | 통합 |
| 44 | 증분 목록 범위 밖 PR + 리뷰 webhook: (a) PR 행 있음(hwm−2일보다 오래됨) → 목록 pass 없이 상세 재수집. (b) PR 행 없음 → `targeted_pr_numbers` 추가 → 다음 `pull_requests` 배치가 목록보다 먼저 `GET /pulls/{n}` → PR·`pr_sync` 생성 → 상세에서 리뷰 저장, 번호 제거. 처리 중 webhook이 추가한 다른 번호는 남음. 404 번호는 제거 | 통합 |
| 45 | 리뷰 350개(가짜 fetch, 3페이지째에 `next` 있음) → 앞 300개 upsert, `reviews_truncated=true`, `synced` 갱신. 이전에 저장돼 있던 다른 리뷰 행 **삭제 0** | 통합 |
| 46 | 리뷰 전체 조회 성공(`next` 없음) → 새 리뷰 추가, `edited` 본문 갱신, `DISMISSED` 상태 반영, `reviews_truncated=false`. 응답에 없는 기존 리뷰도 삭제하지 않고, 그 리뷰에 연결된 `idea_sources`의 `activity_id`·snapshot 불변. `PENDING` 리뷰는 저장 안 됨 | 통합 |
| 47 | 리뷰 2페이지째에서 5xx → 아무것도 쓰지 않음(기존 리뷰·링크 보존), 그 PR만 `attempts+1`·백오프, 다음 PR 처리 계속. 같은 지점에서 429 → PR 행 불변, 배치 `blocked` | 통합 |
| 48 | pass 도중 429 → `blocked`, `next_run_after`=reset, `processed_generation`·`pass_generation`·커서 불변. 5xx 연속 5회 → `error`, `processed_generation` 불변 | 통합 |
| 49 | 배치 예산 소진 → `more`(`pending`), 커서 저장 → 다음 배치가 **같은 `pass_generation`**으로 다음 페이지부터 재개, 중복 0. 두 배치 **사이**에 webhook → pass `done` 시 `processed_generation`=처음 캡처 값, 상태 `pending` → 다음 pass가 새 변경을 수집하고 `complete` | 통합 |
| 50 | `blocked` + `next_run_after` 과거 → 후보 선택·lease 획득 성공, 같은 pass·커서로 재개. `next_run_after`가 미래면 0행. lease가 만료된 `running`은 회수. `complete`·`error`·`idle`은 후보가 아님 | 통합 |

**E2E (Playwright, 로컬 실제 OAuth와 dev 앱)**
- Reader 연결, 다른 GitHub 계정이면 거부
- 개인·조직 설치와 승인 대기 상태
- 동기화 진행률, 브라우저를 닫았다가 다시 열 때 재개
- 표본 대조(§3.5)
- 권한 상실 시나리오: 저장소 제외 → 10분 TTL 이내 숨김
- 글감 저장 → 칸반 → 초안 → 미리보기
- Galaxy 10개 인터랙션
- 375px 화면, WebGL 비활성 대체 화면

**보안**
- 빌드 산출물(`.next/static`)에 비밀값·키 패턴이 없는지 grep
- 로그 redaction
- webhook 위조 서명 거부
- setup `installation_id` 위조 무시
- 다른 사용자 리소스 접근 시 404

**성능**: [RELEASE_PLAN.md](RELEASE_PLAN.md) v2.0 완료 조건 7의 벤치마크.

### 6.3 환경 분리 확인 절차
- `scripts/check-env.mjs`는 비밀값 없이 각 환경의 DB 엔드포인트 ID, 앱 ID, `BETTER_AUTH_URL` 호스트만 출력한다.
  - 확인 대상: `.env.local`, 그리고 `vercel env pull --environment=preview/production`으로 받은 임시 파일. 출력 후 파일은 삭제한다.
- 런타임 가드: `VERCEL_ENV !== 'production'`인데 `DATABASE_URL` 엔드포인트가 `DEVLOG_PROD_DB_ENDPOINT`(비밀값 아님)와 같으면 시작을 거부한다.
- dev 앱과 prod 앱은 App ID와 키가 서로 다르다. prod 키는 Vercel Production 범위에만 둔다.

### 6.4 Preview·외부 연동 검증
- **실제 OAuth E2E는 로컬(localhost:3000)이 기본이다.** 기존 "DevLog (local)" 로그인 앱, dev Reader 앱, dev DB를 쓴다.
- **Preview는 선택 사항이다.**
  - `release/v2` 브랜치 별칭 URL은 고정돼 있다. 이 URL을 로그인용 dev OAuth App(Redirect URI 최대 10개)과 dev Reader 앱의 callback에 추가한다.
  - Preview 환경 변수는 해당 브랜치 범위로만 둔다: `BETTER_AUTH_URL`=별칭, dev 앱 자격증명, dev DB.
  - Vercel Authentication 보호 때문에 접속하려면 Vercel 로그인이 필요하다.
  - **설정하지 않으면 Preview 결과는 "빌드·비인증 화면만 확인"으로 기록하고, 테스트 통과로 표시하지 않는다.**
- **Webhook**: dev에서는 공개 URL이 없어 비활성화한다. 서명된 fixture(§6.2 #22~#28)를 로컬 라우트에 재전송하는 통합 테스트로 대체하고, 실제 수신은 prod 앱 승인 후 검증한다. v2.0 릴리즈 체크리스트에 포함한다.

---

## 8. 재사용할 기존 코드

| 파일 | 재사용 내용 |
|---|---|
| `src/lib/session.ts` | `requireUser` |
| `src/db/index.ts` | `Db` |
| `src/server/projects.ts` | `projectBelongsToUser(…,{lock})` |
| `src/server/dev-logs.ts` | 개발 기록 조회 |
| `src/lib/github/http.ts` | `classifyGithubError`, `parseRateLimit`, `hasNextPage` 확장 |
| `src/lib/github/events.ts`, `activity.ts` | 정규화 패턴, v1 요약 유지 |
| `src/lib/log-redaction.ts` | 토큰 패턴 추가 |
| `src/lib/date.ts`, `src/lib/format.ts` | KST 처리 |
| `src/lib/auth-errors.ts` | 오류 문구 패턴 |
| `src/components/ui/*` | `PageSkeleton` 포함 |
| `src/actions/*` | FormState 패턴 |
| `tests/integration/helpers/db.ts` | 테스트 DB |
| 앱 페이지 전반 | 페이지 단위 Suspense 패턴 |
| `src/proxy.ts` | `PROTECTED`·`matcher`에 `/repos`, `/activity`, `/ideas`, `/drafts`, `/galaxy` 추가 |

## 9. 남은 위험과 미검증 가정

| # | 가정·위험 | 상태 | 대응 |
|---|---|---|---|
| 1 | GitHub 토큰 갱신 실패가 HTTP 200 + error JSON인지 4xx인지 | [가정] | 둘 다 처리. 1b에서 테스트 앱으로 실제 응답 확인 |
| 2 | SAML SSO 조직에서 user token 동작 | [가정] | `X-GitHub-SSO` 403 → `sso_required`. 테스트 조직에는 SSO가 없어 실제 검증 불가 → 문서에 제약으로 기록 |
| 3 | Vercel 플랜이 Hobby인지 | [가정] (API 조회 실패) | 설계가 양쪽 모두에서 동작. 대시보드에서 확인 요청 |
| 4 | 기본 브랜치 force-push로 사라진 커밋 탐지 | 보류 | 대체 경로로 새 이력만 수집. 사라진 커밋은 남을 수 있음 → UI 범위 안내. v2.x에서 주기적 전체 재검증 검토 |
| 5 | 조직 멤버십 상실 반영 지연 | 설계상 한계 | 다음 서버 요청 기준 최대 10분(모든 저장소). Members 권한을 추가하면 저장소 관리자 설치가 막혀서 채택하지 않음 |
| 6 | 일일 cron만으로 대량 백필 | 설계상 한계 | 큰 저장소는 여러 날에 걸쳐 수집될 수 있음. 화면이 열려 있으면 연속 진행. 진행률과 상한을 표시 |
| 7 | R3F peer `react <19.4` | [검증] | React 19.3.x 고정. React·Next 업그레이드는 R3F 지원 확인 후 |
| 8 | Neon Free 저장 용량 | [가정] | 발췌 500자, 상한 적용, 저장소별 행 수 모니터링 쿼리 |
| 9 | `setup_action` 값 | 미사용 | 로직에서 쓰지 않음 |
| 10 | 비밀값 탐지 누락 | 본질적 한계 | 경고만 하고 보장하지 않음. private 출처 확인 단계 추가 |
| 11 | 리뷰 수집의 N+1 호출 | 비용 | 변경된 PR만 조회, 상한 적용. GraphQL은 v2.x 검토 |
| 12 | 공개 앱이라 외부인이 설치할 수 있음 | 위험 낮음 | DevLog 사용자와 연결되지 않은 설치는 무시하고 cron으로 정리 |
| 13 | public→private 전환 후 노출 | 축소됨 | TTL을 10분으로 통일해 연결된 저장소의 노출 창은 다음 서버 요청 기준 10분 이내로 줄었다. **남는 위험**: (a) 이미 열린 화면(최대 5분 재조회 주기), (b) **연결 해제된 저장소의 snapshot 제목**(본인에게만 보이고, 수집 당시 공개였던 제목. 링크 비활성, "미확인" 배지). (b)를 완전히 없애려면 해제할 때 public snapshot의 제목까지 지워야 하는데, 글감의 근거 가치가 떨어져 채택하지 않음 |
| 14 | GitHub authorization code 1회 교환 | [가정] | 1b에서 dev 앱으로 같은 code를 두 번 교환해 두 번째가 실패하는지 확인. 실패하지 않으면 DB nonce 방식으로 전환(§3.1 표) |
| 15 | GitHub App webhook의 `X-GitHub-Hook-Installation-Target-Type/ID` 값 | [가정] | 보조 확인으로만 쓰고 앱별 secret 서명을 주 판정으로 한다. 첫 prod 수신 때 값을 기록한다 |
| 16 | Compare `total_commits`가 매우 큰 경우(장기 미동기화) | 비용 | 남은 상한보다 크면 최신순 목록 경로로 상한까지만 수집하고 `capped`를 표시한다(§3.5-6). 누락 범위를 UI에 안내한다 |
| 17 | 이미 열린 화면의 데이터 회수 | 본질적 한계 | 서버가 회수할 수 없다. 5분 재조회, 탭 복귀 시 재조회, 새 요청은 현재 정책을 따른다. 절대 보장은 하지 않는다 |
| 18 | `__Host-` 쿠키의 브라우저별 localhost 동작 | [검증: Chrome 거부] | http에서는 접두사 없는 쿠키를 쓴다. Firefox·Safari 차이는 E2E가 Chromium이라 영향 없음 |
| 19 | cacheComponents + `maxDuration` 빌드 호환 | [검증: 문서] / [가정: 빌드] | 문서는 허용(제거 목록은 dynamic·revalidate·fetchCache·dynamicParams뿐). 다만 문서에 없던 `runtime`이 v1 빌드에서 거부된 전례가 있다. **설계가 의존하지 않으므로**(기본 300s, 코드 예산 45s) Phase 1을 막지 않는다. 1d-1 첫 작업에서 빌드로 확인·기록 |
| 20 | 세대 카운터 증가 경합·교착 | 낮음 | 단일 행 `UPDATE … SET x = x + 1`은 행 잠금으로 직렬화된다.부터 한 트랜잭션이 `github_pr_sync`와 `github_sync_state` 여러 행을 잠그므로 잠금 순서를 고정했다(§3.4 3단계). 교착이 나도 PG가 감지해 한쪽을 롤백하고, 멱등 재시도(최대 3회)로 회복한다. webhook이 3회 모두 실패하면 500을 반환하고 delivery가 기록되지 않으므로 재전송으로 회복한다. 1d-1에서 동시성 통합 테스트로 확인 |
| 21 | 리뷰 삭제 반영 |에서 해소 | 부재를 근거로 한 삭제를 없앴다(§3.5). 제출 리뷰는 삭제할 수 없다 **[검증]**. GitHub 쪽에서 리뷰가 사라지는 드문 경우(스팸·계정 처리 등)에는 DB에 남을 수 있다. 본인 화면에만 보이는 과거 기록이라 수용한다 |
| 22 | `targeted_pr_numbers` 상한 100 | 낮음 | PR 행 없이 리뷰가 달린 PR이 drain 전에 100개를 넘을 때만 생긴다. 넘친 번호는 그 PR의 `updated_at`이 바뀌어 다음 목록 pass에 나타나면 회복된다. 경고 로그로 관측한다 |
| 23 | installation token의 리뷰 목록에 다른 사용자의 PENDING 리뷰가 없는지, 실제 `state` 값 목록 | [가정] | 1d-2에서 dev 앱으로 확인한다. 나와도 정규화가 PENDING을 저장하지 않으므로 설계에는 영향이 없다 |
| 24 | 리뷰 300개 초과 PR | 설계상 한계 | 시간순이라 가장 오래된 300개만 수집되고 이후 리뷰는 빠진다. `reviews_truncated`로 표시한다. 부트캠프 규모에서는 드물다 |
