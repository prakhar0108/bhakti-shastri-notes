"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  UNLOCK_EVENT,
  isUnlocked,
  syncUnlockAttribute,
} from "@/lib/private-unlock";

/** Shows its children only after the phrase has been entered on /admin. */
export function PrivateGate({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);

  useEffect(() => {
    const update = () => setUnlocked(isUnlocked());
    update();
    document.documentElement.setAttribute("data-private-page", "");
    window.addEventListener(UNLOCK_EVENT, update);
    return () => {
      document.documentElement.removeAttribute("data-private-page");
      window.removeEventListener(UNLOCK_EVENT, update);
    };
  }, []);

  if (unlocked) return <>{children}</>;
  return (
    <>
      <div hidden>{children}</div>
      {unlocked === false && (
        <div className="not-prose rounded-xl border border-fd-border bg-fd-card p-6 text-center">
          <p className="mb-4 text-fd-muted-foreground">This page is private.</p>
          <Link
            href={`/admin?next=${encodeURIComponent(path)}`}
            className="rounded-md bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground hover:opacity-90"
          >
            Unlock
          </Link>
        </div>
      )}
    </>
  );
}

/** Mounted once so CSS can hide private links until unlocked. */
export function PrivateUnlockSync() {
  useEffect(() => {
    syncUnlockAttribute();
  }, []);
  return null;
}
