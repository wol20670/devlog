export function GithubScopeNotice() {
  return (
    <p className="mb-4 max-w-3xl rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted">
      GitHub 공개 이벤트 기준 · 최근 30일 · 최대 300건. 비공개 활동은 포함되지
      않으며, 전체 커밋 이력이나 기여 통계가 아닙니다. 푸시 이벤트의 커밋 수는
      GitHub API에서 제공되지 않습니다.
    </p>
  );
}
