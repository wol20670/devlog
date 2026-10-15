"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/projects", label: "프로젝트" },
  { href: "/logs", label: "개발 기록" },
  { href: "/reviews", label: "주간 회고" },
  { href: "/github", label: "GitHub 활동" },
];

export function AppNav({
  orientation,
}: {
  orientation: "vertical" | "horizontal";
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="주 메뉴"
      className={
        orientation === "vertical"
          ? "flex flex-col gap-1"
          : "flex gap-1 overflow-x-auto px-3 pb-2"
      }
    >
      {ITEMS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={[
              "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-accent/15 font-medium text-accent"
                : "text-muted hover:bg-border/40 hover:text-foreground",
            ].join(" ")}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
