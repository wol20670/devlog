import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground hover:opacity-90",
  secondary: "border border-border bg-surface hover:bg-border/40",
  danger: "bg-danger text-white hover:opacity-90",
  ghost: "text-muted hover:bg-surface hover:text-foreground",
};

function classes(variant: Variant, className?: string) {
  return [base, variants[variant], className].filter(Boolean).join(" ");
}

export function Button({
  variant = "secondary",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type={type} className={classes(variant, className)} {...props} />;
}

export function ButtonLink({
  variant = "secondary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={classes(variant, className)} {...props} />;
}
