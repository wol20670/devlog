import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <EmptyState
        title="페이지를 찾을 수 없습니다"
        description="주소가 올바른지 확인해 주세요."
        action={<ButtonLink href="/">홈으로</ButtonLink>}
      />
    </main>
  );
}
