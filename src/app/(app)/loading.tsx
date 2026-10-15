export default function AppLoading() {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      <div className="mb-6 h-7 w-40 animate-pulse rounded bg-border/30" />
      <div className="flex max-w-3xl flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-border/30" />
        ))}
      </div>
    </div>
  );
}
