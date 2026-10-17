# Changelog

이 프로젝트는 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 형식과 [Semantic Versioning](https://semver.org/lang/ko/)을 따른다.

## [Unreleased]

v2 작업 중(`release/v2`). 아직 운영에 배포하지 않았다.

### Added
- v2 설계 문서: `docs/V2_ARCHITECTURE.md`, v2.1 블로그 발행 설계 갱신
- v2 GitHub 저장소 통합 DB 스키마(마이그레이션 `0001_v2_github_integration`): GitHub App 자격 증명, 설치, 연결 저장소, 프로젝트↔저장소, 활동, PR↔커밋, PR 상세 동기화, 동기화 상태, webhook delivery. 사용자·저장소·종류 무결성을 복합 FK와 CHECK로 DB에서 강제
- `scripts/check-constraints.mjs`: DB 제약 catalog 읽기 전용 확인

### Changed
- `projects`, `dev_logs`에 `UNIQUE(id, user_id)` 추가(복합 FK 참조용, 기존 데이터와 항상 호환)

## [1.0.0] - 2026-10-15

첫 릴리즈(MVP). 프로덕션: https://devlog-psi-three.vercel.app

### Added
- GitHub OAuth 로그인·로그아웃(Better Auth), 7일 세션, 서버 측 세션 검증(`requireUser`)과 보호 경로 리다이렉트
- 프로젝트 CRUD(이름·설명·진행 상태), 프로젝트별 개발 기록 목록
- 일별 개발 기록 CRUD(날짜·프로젝트 연결, 진행한 작업·배운 점·발생한 문제·해결 방법), 날짜별 목록과 페이지네이션
- 주간(KST 월~일) 통계: 기록 수, 기록한 날 수, 요일별·프로젝트별 집계
- 주간 회고 CRUD와 해당 주 기록 기반 기본 회고 템플릿
- GitHub 공개 활동 조회(최근 30일·최대 300건, 유형별 이벤트 수, 저장소·링크), 오류·요청 한도 안내
- 대시보드(이번 주 통계, 최근 기록, 프로젝트, 최근 회고, 최근 GitHub 활동)
- 다크/라이트 자동 테마, 데스크톱 사이드바·모바일 상단 내비게이션

### Security
- 모든 데이터 접근을 사용자 ID로 스코프, 기록-프로젝트 연결 시 소유권을 트랜잭션 + `FOR SHARE`로 검증
- GitHub OAuth 토큰 암호화 저장(`encryptOAuthTokens`), 최소 scope(`read:user`, `user:email`), GitHub 요청 `cache: 'no-store'`, 토큰 서버 전용
- GitHub `/user`의 id를 저장된 GitHub 계정 ID와 대조
- 인증 로그에서 DB 쿼리 파라미터(세션 토큰 등) 마스킹

### Fixed (릴리즈 전 검증 과정)
- 만료·위조 세션 쿠키로 인한 `/login` ↔ `/dashboard` 리다이렉트 루프
- 페이지 간 이동 시 instant navigation 차단(페이지 수준 Suspense 적용)
- OAuth state 만료·권한 거부 시 원인별 안내 문구

### Known limitations
- Preview 배포에서는 로그인 불가(OAuth Redirect URI를 프로덕션·로컬만 등록)
- GitHub 활동은 공개 이벤트만, PushEvent 커밋 수는 API에서 제공되지 않아 표시하지 않음
- 운영 환경에서 일시적 DB 연결 시간 초과 1건 관찰(재현되지 않음, 원인 미확정)
