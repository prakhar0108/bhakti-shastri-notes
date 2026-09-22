"use client";

import { useState } from "react";

interface VedabaseEmbedProps {
  /** e.g. "3.7" */
  number: string;
  /** direct vedabase.io link for this verse */
  href: string;
}

/**
 * Collapsible vedabase.io reader for a single verse. The iframe is mounted only
 * after the panel is first opened, so a note with a dozen verses does not fetch
 * a dozen cross-origin pages on load.
 */
export function VedabaseEmbed({ number, href }: VedabaseEmbedProps) {
  const [mounted, setMounted] = useState(false);

  return (
    <details
      className="shloka-embed"
      onToggle={(e) => {
        if (e.currentTarget.open) setMounted(true);
      }}
    >
      <summary>
        Read this verse on vedabase.io (word-for-word, translation &amp;
        purport)
      </summary>
      {mounted && (
        <iframe
          src={href}
          title={`Bhagavad-gītā ${number} on vedabase.io`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        />
      )}
    </details>
  );
}
