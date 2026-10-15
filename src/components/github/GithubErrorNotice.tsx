import { Card } from "@/components/ui/Card";
import { formatDateTimeKST } from "@/lib/format";
import type { GithubActivityError } from "@/lib/github/activity";

function messageFor(error: GithubActivityError): string {
  switch (error.kind) {
    case "unauthorized":
    case "account_mismatch":
      return "GitHub 연결이 만료되었거나 계정 정보가 일치하지 않습니다. 로그아웃 후 다시 로그인해 주세요.";
    case "rate_limited":
      return error.resetAt
        ? `GitHub API 요청 한도를 초과했습니다. ${formatDateTimeKST(error.resetAt)} 이후 다시 시도해 주세요.`
        : "GitHub API 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.";
    case "no_account":
      return "연결된 GitHub 계정을 찾을 수 없습니다. 로그아웃 후 GitHub로 다시 로그인해 주세요.";
    default:
      return "GitHub에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.";
  }
}

export function GithubErrorNotice({ error }: { error: GithubActivityError }) {
  return (
    <Card role="alert" className="max-w-3xl border-red-500/40 text-sm">
      {messageFor(error)}
    </Card>
  );
}
