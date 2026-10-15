import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "대시보드" };

export default async function DashboardPage() {
  const user = await requireUser();
  return (
    <PageHeader title="대시보드" description={`${user.name}님, 환영합니다`} />
  );
}
