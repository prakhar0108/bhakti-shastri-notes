"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Render `_term_` spans in a plain-string question as italics (Sanskrit vocabulary). */
function withItalics(text: string): ReactNode[] {
  return text
    .split(/(_[^_]+_)/g)
    .map((part, i) =>
      /^_[^_]+_$/.test(part) ? <em key={i}>{part.slice(1, -1)}</em> : part,
    );
}

function setAllOpen(root: HTMLElement | null, open: boolean) {
  root?.querySelectorAll<HTMLDetailsElement>("details.exam-q").forEach((d) => {
    d.open = open;
  });
}

/** A list of exam questions with "expand all / collapse all" controls; printing opens every answer. */
export function ExamQuestions({
  expandLabel = "Expand all answers",
  collapseLabel = "Collapse all",
  children,
}: {
  expandLabel?: string;
  collapseLabel?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPrint = () => setAllOpen(ref.current, true);
    window.addEventListener("beforeprint", onPrint);
    return () => window.removeEventListener("beforeprint", onPrint);
  }, []);

  const buttonClass =
    "rounded-full border border-fd-border px-4 py-1.5 text-sm font-medium text-fd-foreground transition-colors hover:border-fd-primary hover:text-fd-primary";

  return (
    <div ref={ref} className="exam-questions">
      <div className="not-prose mb-4 flex flex-wrap gap-2 print:hidden">
        <button
          type="button"
          className={buttonClass}
          onClick={() => setAllOpen(ref.current, true)}
        >
          {expandLabel}
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() => setAllOpen(ref.current, false)}
        >
          {collapseLabel}
        </button>
      </div>
      {children}
    </div>
  );
}

/** One collapsible exam question: number, question text, verse reference, and the written answer. */
export function ExamQuestion({
  n,
  question,
  refs,
  children,
}: {
  n: string;
  question: string;
  refs?: string;
  children: ReactNode;
}) {
  return (
    <details
      id={`q${n}`}
      className="exam-q group my-3 scroll-mt-24 rounded-xl border border-fd-border bg-fd-card"
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-fd-primary text-xs font-bold text-fd-primary-foreground">
          {n}
        </span>
        <span className="flex-1 font-medium leading-relaxed text-fd-foreground">
          {withItalics(question)}
          {refs && (
            <span className="ms-2 inline-block rounded-md bg-fd-muted px-1.5 py-0.5 align-middle text-xs font-normal text-fd-muted-foreground">
              {refs}
            </span>
          )}
        </span>
        <span
          aria-hidden
          className="mt-1 shrink-0 text-fd-muted-foreground transition-transform group-open:rotate-90"
        >
          ▸
        </span>
      </summary>
      <div className="exam-a border-t border-fd-border px-5 pb-2 pt-1">
        {children}
      </div>
    </details>
  );
}

/** Collapsible wrapper for the verified verse block attached to an answer. */
export function ExamVerse({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <details className="exam-verse my-3 rounded-lg border border-dashed border-fd-border px-3 py-1">
      <summary className="cursor-pointer text-sm font-medium text-fd-muted-foreground">
        {label}
      </summary>
      {children}
    </details>
  );
}
