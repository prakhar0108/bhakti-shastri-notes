import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminLoginForm } from "@/components/admin-login-form";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-fd-border bg-fd-card p-6 shadow-sm">
        <h1 className="font-heading mb-1 text-2xl font-semibold">Admin</h1>
        <p className="mb-5 text-sm text-fd-muted-foreground">
          Enter the secret phrase to show private pages.
        </p>
        <Suspense>
          <AdminLoginForm />
        </Suspense>
        <Link
          href="/docs"
          className="mt-4 block text-center text-sm text-fd-muted-foreground hover:underline"
        >
          Back to notes
        </Link>
      </div>
    </main>
  );
}
