import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import { AuthCard } from "@/components/auth-card";
import type { MemberAuthSession } from "@/lib/member-session";
import { IS_DEMO } from "@/lib/brand";

export function MemberLogin({ onAuthenticated }: { onAuthenticated: (session: MemberAuthSession) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    setWaitSeconds(0);
    try {
      const response = await fetch("/api/auth/member/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const result = (await response.json()) as MemberAuthSession & { error?: string; retryAfterSeconds?: number };
      if (!response.ok) {
        setError(result.error ?? "That access code could not be verified.");
        if (response.status === 429 && result.retryAfterSeconds) setWaitSeconds(result.retryAfterSeconds);
        return;
      }
      onAuthenticated(result);
    } catch {
      setError("Couldn't reach the club site. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      tone="member"
      icon={<LockKeyhole className="h-5 w-5" />}
      areaLabel={IS_DEMO ? "Portfolio demo" : "Members only"}
      eyebrow={IS_DEMO ? "Demo access" : "Member access"}
      title={IS_DEMO ? "Type any password" : "Enter your access code"}
      intro={IS_DEMO ? <p>This is a demo with made-up players and results. There is no real login: type anything to look around, and a short guided tour will start.</p> : <p>Don&apos;t have one? Ask a committee member.</p>}
      fieldLabel={IS_DEMO ? "Password" : "Access code"}
      value={code}
      onChange={setCode}
      error={error}
      waitSeconds={waitSeconds}
      submitting={submitting}
      submitLabel={IS_DEMO ? "Enter the demo" : "Open dashboard"}
      onSubmit={() => void submit()}
      testIds={{ input: "input-member-code", submit: "button-member-login", error: "status-member-login-error" }}
      note={
        IS_DEMO ? (
          <p>Nothing you do here is stored or sent anywhere.</p>
        ) : (
          <>
            <p>You&apos;ll stay signed in on this device.</p>
            <p className="mt-1">We record which sections you open and for how long, so the committee can see what&apos;s useful.</p>
          </>
        )
      }
      footer={IS_DEMO ? undefined : <a href="/admin" className="hover:text-primary hover:underline">Committee login</a>}
    />
  );
}
