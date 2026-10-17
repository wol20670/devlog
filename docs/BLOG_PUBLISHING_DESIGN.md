# 설계: 저장소 활동 → 기술 블로그 발행 연동

> 상태: **v2.1 설계 (2026-10-17 확정 계획 반영)**. 초안은 2026-10-15에 작성했다. 글감·초안은 v2.0, 블로그 발행은 v2.1 범위이며 v2.1 구현은 별도 승인 후 시작한다.
> 전체 v2 설계는 [V2_ARCHITECTURE.md](V2_ARCHITECTURE.md), 결정 사항은 §9에 있다.

## 1. 배경과 목표

부트캠프 참여자는 각자 GitHub Pages 기술 블로그를 운영한다. 학습·토이 프로젝트·팀 프로젝트는 GitHub 저장소에 쌓이는데, 그 경험을 블로그 글로 옮기는 과정은 수작업이다. 커밋과 PR, 메모를 다시 찾아 읽고, front matter를 맞춰 쓰고, 블로그 저장소에 커밋해야 한다.

**목표**: DevLog에서 내 저장소 활동과 개발 기록을 골라 **블로그 글 초안**을 만들고, 편집한 뒤 내 **GitHub Pages 블로그 저장소에 바로 발행**한다.

결정된 방향 (2026-10-15 사용자 확인):
- 발행 대상: **GitHub Pages 블로그** (예: [`wol20670/my-blog`](https://github.com/wol20670/my-blog), Jekyll Chirpy)
- 연동 방식: **활동 선택 → 초안 생성 → DevLog에서 편집 → 발행**. 자동 발행은 하지 않는다.
- 진행 방식: **설계 먼저**. 릴리즈 배치는 2026-10-17에 확정했다(§9)

비목표: 티스토리·Velog·Medium 자동 발행(아래 §2), 댓글·팔로우 등 소셜 기능, 다른 사람 블로그 모아보기.

## 2. 외부 플랫폼 조사 (2026-10-15)

| 플랫폼 | 자동 발행 | 근거 | DevLog 대응 |
|---|---|---|---|
| GitHub Pages (Jekyll 등) | ✅ 가능 | GitHub REST API로 저장소에 Markdown 커밋 → Actions가 빌드·배포 | **1차 지원 대상** |
| 티스토리 | ❌ | Open API 종료 | Markdown/HTML 복사 내보내기 |
| Velog | ❌ (공식) | 공식 API 없음. 쿠키 기반 비공식 도구만 존재 → 서비스에 사용하지 않음 | Markdown 복사 내보내기 |
| Medium | ❌ | 2025-01-01부터 신규 integration token 미발급 | 대상 아님 |

## 3. 대상 블로그 구조 (`wol20670/my-blog` 분석)

| 항목 | 값 |
|---|---|
| 엔진/테마 | Jekyll + `jekyll-theme-chirpy`, `lang: ko-KR`, `timezone: Asia/Seoul` |
| 글 위치·파일명 | `_posts/YYYY-MM-DD-<slug>.md` |
| 배포 | `main` 푸시 → `.github/workflows/pages-deploy.yml` → `https://wol20670.github.io/my-blog/` |
| 글 URL | `/posts/:title/` (category 변경과 무관) |
| Front matter | `title`, `date: YYYY-MM-DD HH:MM:SS +0900`, `description`, `categories: [Troubleshooting \| Exploration]`(정확히 1개), `tags: [...]`, 선택 `mermaid: true` |
| 작성 규칙 | `BLOG_POLICY.md`(글 유형·taxonomy), `CLAUDE.md`(멘토 제공 일반 가이드), `markdown-template.md` |

`BLOG_POLICY.md`의 글 유형:
- **Troubleshooting**: 문제 상황 → 초기 가설 → 확인/시도 → 결과 → 실제 원인 → 해결 → 더 나은 방법/예방 → 배운 점. 없는 수치는 만들지 않고, 실패한 시도도 기록한다.
- **Exploration**: 새로운 개념 → 흥미로운 지점 → 핵심 원리 → 기존 지식과 연결 → 활용/발전 방향.

부트캠프 참여자들의 블로그 구성이 같다고 가정하지 않는다. 글 경로, 파일명 규칙, front matter 기본값은 **블로그별 설정**으로 둔다(§5.1). Chirpy 기본값은 프리셋으로 제공한다.

## 4. 사용자 흐름

```
[v2.0] 저장소 연결·동기화   Reader App 설치 → 저장소 선택 → 커밋·PR·리뷰·이슈 동기화
[v2.0] 글감                활동·개발 기록에서 글감 저장(근거 snapshot) → 칸반에서 상태 관리
[v2.0] 초안                글감 → 글 유형(Troubleshooting / Exploration) 선택 → 템플릿 초안 → 편집·미리보기
                           블로그 연결 없이 쓸 수 있다. front matter는 Chirpy 프리셋으로 검증
[v2.1] 블로그 연결          Publisher App 설치 → 블로그 저장소 선택 → 구조 자동 감지(_posts, _config.yml)
[v2.1] 발행                초안을 블로그 설정으로 재검증 → `_posts/...md` 커밋 → Actions 실행·Pages 배포 추적 → 글 URL
[v2.1] 이후                발행 상태·URL 추적, 수정 발행은 같은 파일을 sha로 갱신
```

v1의 **개발 기록 → Troubleshooting 초안** 매핑이 핵심 재사용 지점이다.

| DevLog 개발 기록 | Troubleshooting 섹션 |
|---|---|
| 발생한 문제 | 문제 상황 |
| 진행한 작업 + 연결된 커밋/PR | 확인/시도, 결과 |
| 해결 방법 | 실제 원인, 해결 |
| 배운 점 | 배운 점 |
| 프로젝트 / 저장소 | tags 후보, 본문 링크 |

## 5. 데이터 모델 (추가 마이그레이션만)

초안 단계에서 쓰던 `posts.blog_id`·`post_sources` 구조는 **폐기**했다. posts가 블로그에 의존하면 v2.0(초안)이 v2.1(발행) 스키마를 먼저 요구하게 되기 때문이다. 상세 컬럼과 제약은 [V2_ARCHITECTURE.md](V2_ARCHITECTURE.md) §4.1을 따른다.

| 테이블 | 릴리즈 | 역할 |
|---|---|---|
| `writing_ideas` | v2.0 | 글감. 상태 `collected`/`planned`/`drafting`/`published`, 프로젝트 연결(삭제 시 `project_id`만 NULL) |
| `idea_sources` | v2.0 | 글감의 근거(GitHub 활동 또는 개발 기록). 원본이 지워져도 `snapshot`이 남는다 |
| `posts` | v2.0 | 초안. **블로그와 독립**이다. 한 글감에서 여러 초안(시리즈)을 만들 수 있다. 상태 `draft`/`ready`/`archived` |
| `blogs` | v2.1 | 블로그 저장소 설정(경로, 파일명 규칙, 프리셋, front matter 기본값) |
| `publications` | v2.1 | 발행 기록: (post_id, user_id) cascade, blog_id, path, blob_sha, commit_sha, `commit_status`, `deploy_status`, `deploy_status_raw`, published_at, url |

규칙: 모든 쿼리는 `user_id`로 스코프하고, 참조는 `user_id`를 포함한 복합 FK로 DB에서 강제한다(V2_ARCHITECTURE.md §4.4).

### 5.1 발행 파일 생성
- 파일 경로: `{posts_dir}/{YYYY-MM-DD}-{slug}.md`. slug는 영문 소문자·숫자·하이픈이다. 한글 제목이면 사용자가 slug를 입력한다.
- **`date`는 초안에 저장하지 않는다.** 발행 시점에 `publications.published_at`(KST)으로 정하고, 파일명 날짜와 front matter(`+0900`)에 넣는다.
- front matter는 YAML 직렬화 라이브러리로 생성한다(문자열 이스케이프 오류 방지).
- 검증(발행 전 차단): category 정확히 1개, 허용값 외 category 금지, tags에 category와 같은 값 금지, title·description 비어 있지 않음, Liquid 문법 이스케이프, 비밀값 패턴 경고, private 출처 경고. 초안 단계에서는 Chirpy 프리셋으로, 발행할 때는 블로그 설정으로 다시 검증한다.

### 5.2 발행과 배포 추적
- **커밋**: 로컬에서 blob SHA를 계산한다. 새 글은 생성 전용으로 커밋하고, 수정 발행은 저장된 blob SHA를 넘겨 갱신한다. 409(SHA 불일치)이면 충돌로 표시하고 **덮어쓰지 않는다.** 결과는 `commit_status`(`pending`/`committed`/`conflict`/`failed`)에 기록한다.
- **배포 추적(2단계)**: ① `GET /actions/runs?head_sha=<commit>`으로 workflow 실행 상태를 본다. ② 실행이 성공하면 `GET /pages/deployments/{sha}`로 Pages 배포 상태를 본다.
- 내부 `deploy_status`는 하나의 enum으로 통일하고, GitHub 원본 값은 `deploy_status_raw`에 보존한다. 변환은 `mapPagesStatus()` 한 곳에서 한다.

  | 내부 `deploy_status` | GitHub 원본 |
  |---|---|
  | `not_started` | — |
  | `queued`, `building` | Actions run `queued` / `in_progress` |
  | `build_failed` | run `failure` |
  | `cancelled` | run `cancelled` |
  | `not_triggered` | run 없음(시간 초과) |
  | `deploying` | Pages deployment 진행 중 |
  | `deployed` | Pages `succeed` |
  | `deploy_failed` | `deployment_failed`, `deployment_lost` |
  | `superseded` | 이후 커밋의 배포에 포함됨 |

- `deployed`가 되면 글감 상태가 자동으로 `published`가 된다. 실패하면 글감·초안 상태는 바꾸지 않고 publication에만 실패를 기록한다.
- **외부 수정**: 블로그 저장소에서 직접 수정된 글은 SHA 비교로 충돌만 표시한다. 블로그 쪽 수정을 DevLog로 가져오지는 않는다(v2.x 백로그).

## 6. GitHub 권한 설계

v1은 **읽기 전용 최소 scope**(`read:user`, `user:email`)만 쓴다. 소스 수집에는 저장소 읽기(비공개 포함 가능)가, 발행에는 블로그 저장소 쓰기가 필요하다. OAuth App에 `repo` scope를 추가하는 방식은 사용자의 모든 저장소 권한을 요구하므로 쓰지 않는다.

**확정 구조: 로그인 OAuth App 유지 + GitHub App 2개**

| App | 릴리즈 | 권한 | 용도 |
|---|---|---|---|
| Reader | v2.0 | Repository Metadata·Contents·Pull requests·Issues **Read-only**, 조직 권한 없음 | 저장소 활동 동기화 |
| Publisher | v2.1 | Contents **Read & write**, Metadata·Pages·Actions **Read**. **Workflows 권한 없음** | 블로그 글 커밋, 배포 추적 |

- 로그인은 기존 OAuth App + Better Auth를 그대로 쓴다(v1 영향 없음).
- 두 App을 나눠서, 소스 저장소에는 쓰기 권한이 생기지 않게 한다.
- 사용자 접근 검증은 App의 **User Access Token**(`GET /user/installations`)으로 하고, 서버 동기화·발행은 저장소 단위로 축소한 **Installation Token**(1시간 유효, 메모리에만 캐시)으로 한다. App private key는 Vercel 환경변수(sensitive)로 관리한다.
- 조직 설치는 여러 사용자가 공유하는 전역 객체다. 그래서 "설치 계정 = 로그인 사용자" 비교 대신, user token으로 그 사용자가 실제로 접근 가능한 저장소인지 확인한다(V2_ARCHITECTURE.md §3.1~3.3).
- 각 App은 별도 webhook 엔드포인트와 secret을 쓴다: `/api/github/webhook/reader`, `/api/github/webhook/publisher`.

## 7. 초안 생성 방식

**확정: 템플릿 조립만 한다(외부 AI 없음).** 비용이 없고 예측 가능하며, 저장소 코드·메시지를 외부 모델로 보내지 않는다.

- `buildDraft(idea, sources, preset)`가 BLOG_POLICY 섹션 구조로 초안을 만든다. 근거가 없는 섹션에는 `<!-- 작성 필요 -->`만 넣는다. **수치나 사실은 만들지 않는다.**
- 출처 링크는 "참고한 활동" 목록으로 사용자 문장과 분리한다.
- AI 초안·글감 추천은 v2.x 백로그다.

## 8. 화면

- v2.0: `/repos`(저장소 연결·동기화), `/activity`(활동 목록), `/ideas`(글감 칸반·목록), `/drafts`(초안 편집·미리보기), `/galaxy`(Development Galaxy)
- v2.1: 블로그 연결·설정 화면, 초안 화면의 발행 패널(검증 결과·발행 버튼·배포 상태), 발행 목록. 경로는 Phase 4 착수 때 정한다.
- 기존 화면 연결: 개발 기록 상세에서 글감 만들기, 대시보드에 글감 섹션

## 9. 결정 사항 (2026-10-17 확정)

| # | 질문 | 결정 |
|---|---|---|
| 1 | 릴리즈 배치 | v2.0 = GitHub 통합 + 글감 + 초안 + Galaxy, v2.1 = 발행. 기존 v2 항목(태그·검색·시각화 등)은 v2.x 백로그 |
| 2 | 초안 생성 | 템플릿만(A). AI(B)는 v2.x |
| 3 | 발행 방식 | 블로그 설정의 브랜치에 Contents API로 직접 커밋(생성 전용, sha 기반 수정, 409 충돌 표시). 블로그 저장소 PR 방식은 v2.x 검토 |
| 4 | 이미지 | **미결정** — Phase 4 착수 전에 확인한다. 그전까지는 텍스트·코드·Mermaid만 다룬다 |
| 5 | 비공개 저장소 소스 | 허용한다. 글감 근거 snapshot에 `is_private_at_capture`를 남기고, 초안 검증·발행 전에 경고하고 확인을 받는다. private 저장소 링크를 본문에 넣지 않도록 경고한다 |
| 6 | 다른 참여자 블로그 구성 | 같다고 가정하지 않는다. Chirpy 프리셋을 기본으로 제공하고 경로·파일명·front matter는 블로그별 설정으로 둔다 |

## 10. 단계

구현 순서와 완료 조건은 [RELEASE_PLAN.md](RELEASE_PLAN.md)의 v2.0(Phase 2c 초안)·v2.1(Phase 4·5b)을 따른다. 발행은 **테스트용 블로그 저장소**에서 먼저 검증하고, 실제 `my-blog` 발행은 사용자 승인 후 1회 한다.

## 11. 위험 요소

- **권한**: 쓰기 권한이 생기므로 토큰·키 관리, 설치 소유권 검증, 저장소 범위 검증이 v1보다 중요해진다.
- **블로그 빌드 실패**: 잘못된 front matter나 Liquid 문법(`{{ }}`, `{% %}`)이 본문에 있으면 Jekyll 빌드가 깨질 수 있다. 발행 전 검증, 코드 블록 내 Liquid 이스케이프(`{% raw %}`)가 필요하다.
- **덮어쓰기**: 사용자가 블로그 저장소에서 직접 수정한 글을 DevLog가 덮어쓰지 않도록, 수정 발행 시 파일 sha를 비교한다.
- **개인정보·비공개 코드 노출**: 비공개 저장소 내용을 공개 블로그로 옮길 때 사용자 확인 단계를 둔다.
- **빌드·배포 상태 오인**: Actions 실행 성공과 Pages 배포 성공은 다르다. 두 단계를 따로 추적하고, 실행되지 않은 경우(`not_triggered`)도 구분해 표시한다(§5.2).
