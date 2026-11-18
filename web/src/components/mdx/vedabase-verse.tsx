interface VedabaseVerseProps {
  /** e.g. "2.13" */
  number: string;
  /** direct vedabase.io link for this verse */
  href: string;
}

/**
 * A verse shown only as its live vedabase.io page — no Sanskrit, synonyms or
 * translation are stored in the note. The iframe is `loading="lazy"`, so verses
 * further down a long note are not fetched until scrolled near.
 */
export function VedabaseVerse({ number, href }: VedabaseVerseProps) {
  return (
    <figure className="vedabase-verse">
      <iframe
        src={href}
        title={`Bhagavad-gītā ${number} on vedabase.io`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      />
      <figcaption>
        <a href={href} target="_blank" rel="noreferrer">
          Bhagavad-gītā {number} on vedabase.io ↗
        </a>
      </figcaption>
    </figure>
  );
}
