"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UNLOCK_EVENT, isUnlocked, lock, unlock } from "@/lib/private-unlock";

const buttonClass =
  "w-full rounded-md bg-fd-primary px-3 py-2 text-sm font-medium text-fd-primary-foreground hover:opacity-90";

function safeNext(next: string | null): string {
  return next && /^\/(?!\/)/.test(next) ? next : "/docs/en/exam-prep";
}

export function AdminLoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const update = () => setUnlocked(isUnlocked());
    update();
    window.addEventListener(UNLOCK_EVENT, update);
    return () => window.removeEventListener(UNLOCK_EVENT, update);
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("phrase");
    const phrase = typeof value === "string" ? value : "";
    if (await unlock(phrase)) router.push(next);
    else setError(true);
  }

  if (unlocked) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-fd-muted-foreground">
          Private pages are unlocked.
        </p>
        <button
          type="button"
          className={buttonClass}
          onClick={() => router.push(next)}
        >
          Open Exam Preparation
        </button>
        <button
          type="button"
          onClick={lock}
          className="w-full rounded-md border border-fd-border px-3 py-2 text-sm hover:bg-fd-accent"
        >
          Lock again
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input
        name="phrase"
        type="password"
        placeholder="Secret phrase"
        autoComplete="off"
        required
        className="w-full rounded-md border border-fd-border bg-fd-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fd-primary"
      />
      {error && (
        <p className="text-sm text-red-600">That phrase is not correct.</p>
      )}
      <button type="submit" className={buttonClass}>
        Unlock
      </button>
    </form>
  );
}
