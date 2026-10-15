import { Suspense, type ReactNode } from "react";
import { AppNav } from "@/components/app/AppNav";
import { SignOutButton } from "@/components/app/SignOutButton";
import { requireUser } from "@/lib/session";

async function Shell({ children }: { children: ReactNode }) {
  const user = await requireUser();

  const account = (
    <div className="flex min-w-0 items-center gap-2">
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.image} alt="" className="size-7 rounded-full" />
      ) : (
        <span className="flex size-7 items-center justify-center rounded-full bg-border text-xs">
          {user.name.slice(0, 1)}
        </span>
      )}
      <span className="truncate text-sm">{user.name}</span>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface p-4 md:flex">
        <p className="mb-6 px-2 font-mono text-lg font-semibold">DevLog</p>
        <AppNav orientation="vertical" />
        <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
          {account}
          <SignOutButton />
        </div>
      </aside>
      <header className="border-b border-border bg-surface md:hidden">
        <div className="flex items-center justify-between px-4 py-2">
          <p className="font-mono font-semibold">DevLog</p>
          <div className="flex items-center gap-2">
            {account}
            <SignOutButton />
          </div>
        </div>
        <AppNav orientation="horizontal" />
      </header>
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={<div className="p-6 text-sm text-muted">불러오는 중...</div>}
    >
      <Shell>{children}</Shell>
    </Suspense>
  );
}
