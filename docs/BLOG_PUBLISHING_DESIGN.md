# 설계: 저장소 활동 → 기술 블로그 발행 연동

> 상태: **설계 초안 (2026-10-15)**. 구현은 사용자 승인 후 시작한다. v1.0.0 범위가 아니다.
> 미결정 사항은 §9에 정리했다.

## 1. 배경과 목표

부트캠프 참여자는 각자 GitHub Pages 기술 블로그를 운영한다. 학습·토이 프로젝트·팀 프로젝트는 GitHub 저장소에 쌓이는데, 그 경험을 블로그 글로 옮기는 과정은 수작업이다. 커밋과 PR, 메모를 다시 찾아 읽고, front matter를 맞춰 쓰고, 블로그 저장소에 커밋해야 한다.

**목표**: DevLog에서 내 저장소 활동과 개발 기록을 골라 **블로그 글 초안**을 만들고, 편집한 뒤 내 **GitHub Pages 블로그 저장소에 바로 발행**한다.

결정된 방향 (2026-10-15 사용자 확인):
- 발행 대상: **GitHub Pages 블로그** (예: [`wol20670/my-blog`](https://github.com/wol20670/my-blog), Jekyll Chirpy)
- 연동 방식: **활동 선택 → 초안 생성 → DevLog에서 편집 → 발행**. 자동 발행은 하지 않는다.
- 진행 방식: **설계 먼저**, 구현 범위와 릴리즈 배치는 이후 결정

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
[1] 블로그 연결         블로그 저장소 선택 → 구조 자동 감지(_posts, _config.yml) → 설정 확인
[2] 소스 선택           저장소 / 기간 선택 → 커밋·PR·README 목록 + DevLog 개발 기록에서 재료 고르기
[3] 초안 생성           글 유형(Troubleshooting / Exploration) 선택 → 구조에 맞춘 초안 생성
[4] 편집·미리보기       DevLog 에디터에서 Markdown 편집, front matter 검증(BLOG_POLICY 규칙)
[5] 발행               블로그 저장소에 `_posts/...md` 커밋 → Actions 빌드 → 글 URL 표시
[6] 이후               DevLog에서 발행 상태·URL 추적, 수정 시 같은 파일 업데이트
```

v1의 **개발 기록 → Troubleshooting 초안** 매핑이 핵심 재사용 지점이다.

| DevLog 개발 기록 | Troubleshooting 섹션 |
|---|---|
| 발생한 문제 | 문제 상황 |
| 진행한 작업 + 연결된 커밋/PR | 확인/시도, 결과 |
| 해결 방법 | 실제 원인, 해결 |
| 배운 점 | 배운 점 |
| 프로젝트 / 저장소 | tags 후보, 본문 링크 |

## 5. 데이터 모델 (v1 스키마 확장, 추가만)

| 테이블 | 주요 컬럼 | 비고 |
|---|---|---|
| `blogs` | id, user_id, repo_full_name, branch(기본 `main`), posts_dir(기본 `_posts`), filename_pattern(기본 `{date}-{slug}.md`), site_url, preset(`chirpy`), front_matter_defaults(jsonb) | 사용자당 여러 개 가능, 기본 1개 |
| `posts` | id, user_id, blog_id, status(`draft`/`published`/`publish_failed`), type(`troubleshooting`/`exploration`), title, slug, description, tags(text[]), body_md, published_path, published_sha, published_url, published_at | 블로그 글 초안·발행 상태 |
| `post_sources` | id, post_id, kind(`dev_log`/`commit`/`pull_request`/`readme`), ref(로그 id·커밋 sha·PR 번호), repo_full_name, snapshot(jsonb) | 초안 생성에 쓴 재료. 원본이 바뀌어도 근거가 남도록 스냅샷 |

규칙: 모든 쿼리는 `user_id`로 스코프하고, `blog_id`와 `dev_log` 소스의 소유권을 검증한다(v1과 동일 원칙).

### 5.1 발행 파일 생성
- 파일 경로: `{posts_dir}/{YYYY-MM-DD}-{slug}.md`. 날짜는 발행 시각 KST, slug는 영문 소문자·숫자·하이픈. 한글 제목이면 사용자가 slug를 입력한다.
- front matter는 YAML 직렬화 라이브러리로 생성한다(문자열 이스케이프 오류 방지). `date`는 `+0900`.
- 검증(발행 전 차단): category 정확히 1개, 허용값 외 category 금지, tags에 category와 같은 값 금지, title·description 비어 있지 않음, 같은 경로 파일이 이미 있으면 덮어쓰지 않고 확인을 요청한다.

## 6. GitHub 권한 설계 (가장 중요한 변경)

v1은 **읽기 전용 최소 scope**(`read:user`, `user:email`)만 쓴다. 블로그 발행에는 **블로그 저장소 쓰기**, 소스 수집에는 **저장소 읽기**(비공개 저장소 포함 가능)가 필요하다.

| 방식 | 권한 범위 | 평가 |
|---|---|---|
| OAuth App에 `public_repo`/`repo` scope 추가 | 사용자의 **모든** 공개(또는 전체) 저장소 쓰기 | ❌ 과도한 권한. 토큰 유출 시 영향이 큼 |
| **GitHub App (권장)** | 사용자가 **선택한 저장소에만** 설치, 저장소별 세분화 권한: Contents read/write(블로그), Contents·Pull requests·Metadata read(소스) | ✅ 최소 권한, 사용자가 저장소 단위로 철회 가능 |

권장 구조:
- **로그인은 기존 OAuth App + Better Auth를 유지한다** (v1 영향 없음).
- 저장소 접근용으로 **별도 GitHub App**을 등록한다. 사용자가 DevLog에서 "블로그 연결"을 누르면 App 설치 화면으로 이동해 블로그 저장소와 소스 저장소를 선택한다.
- 서버는 **installation access token**(1시간 유효, 설치된 저장소로 한정)을 그때그때 발급받아 사용하고 저장하지 않는다. App private key는 Vercel 환경변수(sensitive)로 관리한다.
- installation이 **현재 로그인한 GitHub 사용자 소유인지** 검증한다(`account.accountId`와 installation account id 비교, v1과 같은 원칙).

## 7. 초안 생성 방식

| 방식 | 장점 | 단점 |
|---|---|---|
| A. 템플릿 조립 (외부 AI 없음) | 비용 0, 예측 가능, 개인정보 외부 전송 없음 | 문장이 기계적. 사용자가 많이 다듬어야 함 |
| B. AI 초안 (Claude, Vercel AI Gateway) | 커밋·PR·기록을 읽고 자연스러운 서술 초안 생성, BLOG_POLICY 구조 준수 지시 가능 | 호출 비용, 저장소 코드·메시지의 외부 모델 전송, 사실 왜곡 위험 → "없는 수치를 만들지 않는다" 규칙과 근거 링크 필수 |

권장: **A를 기본으로 구현**하고, B는 사용자가 켜는 선택 기능으로 둔다. B를 도입하면 프롬프트에 BLOG_POLICY 규칙을 넣고, 초안의 각 주장에 근거 소스(커밋·PR·기록)를 표시해 사용자가 확인하게 한다.

## 8. 화면

- `/blog/settings`: 블로그 연결(App 설치), 저장소 구조 감지 결과, 경로·front matter 기본값
- `/blog/new`: 소스 선택(저장소 → 기간 → 커밋/PR/README, DevLog 기록) → 글 유형 선택 → 초안 생성
- `/blog/posts/[id]`: Markdown 편집기 + 미리보기 + front matter 폼 + 검증 결과 + 발행 버튼
- `/blog/posts`: 초안·발행 목록, 발행 URL, 실패 사유
- 기존 화면 연결: 개발 기록 상세에 "블로그 초안 만들기", 대시보드에 "최근 발행 글"

## 9. 미결정 사항 (사용자 결정 필요)

1. **릴리즈 배치**: v2.0 범위를 이 기능 중심으로 재정의할지, 기존 v2 항목(태그·검색·시각화 등)에 추가할지
2. **초안 생성**: 템플릿만(A) / AI 선택 기능 포함(A+B)
3. **발행 방식**: `main`에 바로 커밋(즉시 배포) / 블로그 저장소에 PR 생성 후 사용자가 GitHub에서 병합
4. **이미지**: 1차 범위에서 제외할지(텍스트·코드·Mermaid만), 아니면 `assets/img` 업로드 지원
5. **비공개 저장소**를 소스로 허용할지(허용 시 비공개 코드·메시지가 공개 블로그로 옮겨질 위험 → 발행 전 경고)
6. 부트캠프의 다른 참여자 블로그도 Chirpy인지(프리셋 우선순위 결정)

## 10. 단계 제안 (구현 승인 후)

1. GitHub App 등록·설치 흐름, 블로그 연결과 구조 감지 (권한 검증 테스트 포함)
2. `posts` CRUD + 편집기·미리보기 + front matter 검증
3. 개발 기록 → Troubleshooting 초안(템플릿)
4. 발행(커밋) + 상태 추적 + 실패 처리. **테스트용 블로그 저장소**에서 먼저 검증한 뒤 실제 블로그에 적용
5. 커밋·PR·README 소스 수집 → 초안 재료
6. (선택) AI 초안, Markdown 내보내기(Velog·티스토리용)

## 11. 위험 요소

- **권한**: 쓰기 권한이 생기므로 토큰·키 관리, 설치 소유권 검증, 저장소 범위 검증이 v1보다 중요해진다.
- **블로그 빌드 실패**: 잘못된 front matter나 Liquid 문법(`{{ }}`, `{% %}`)이 본문에 있으면 Jekyll 빌드가 깨질 수 있다. 발행 전 검증, 코드 블록 내 Liquid 이스케이프(`{% raw %}`)가 필요하다.
- **덮어쓰기**: 사용자가 블로그 저장소에서 직접 수정한 글을 DevLog가 덮어쓰지 않도록, 수정 발행 시 파일 sha를 비교한다.
- **개인정보·비공개 코드 노출**: 비공개 저장소 내용을 공개 블로그로 옮길 때 사용자 확인 단계를 둔다.
