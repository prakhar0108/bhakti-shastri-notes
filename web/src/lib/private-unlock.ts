"use client";

// Convenience lock only: the content still ships to the browser, the phrase just hides it.
const STORAGE_KEY = "private-notes-unlocked";
const EXPECTED_HASH = process.env.NEXT_PUBLIC_PRIVATE_PHRASE_HASH ?? "";
export const UNLOCK_EVENT = "private-notes-change";

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export function isUnlocked(): boolean {
  return (
    Boolean(EXPECTED_HASH) &&
    localStorage.getItem(STORAGE_KEY) === EXPECTED_HASH
  );
}

function notify() {
  document.documentElement.toggleAttribute(
    "data-private-unlocked",
    isUnlocked(),
  );
  window.dispatchEvent(new Event(UNLOCK_EVENT));
}

export async function unlock(phrase: string): Promise<boolean> {
  if (!EXPECTED_HASH || (await sha256(phrase)) !== EXPECTED_HASH) return false;
  localStorage.setItem(STORAGE_KEY, EXPECTED_HASH);
  notify();
  return true;
}

export function lock() {
  localStorage.removeItem(STORAGE_KEY);
  notify();
}

export function syncUnlockAttribute() {
  notify();
}
