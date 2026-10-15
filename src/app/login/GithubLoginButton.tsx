"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/auth-client";

export function GithubLoginButton() {
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: "/dashboard",
        errorCallbackURL: "/login?error=oauth",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="primary"
      className="w-full py-2"
      onClick={onClick}
      disabled={pending}
    >
      {pending ? "GitHub로 이동 중..." : "GitHub로 로그인"}
    </Button>
  );
}
