interface ShlokaProps {
  /** e.g. "3.7" */
  number: string;
  /** direct vedabase.io link for this verse */
  href: string;
  /** Devanagari, one array entry per printed line */
  sanskrit: string[];
  /** Roman transliteration, one array entry per printed line */
  transliteration: string[];
  /** word-for-word meanings, in vedabase's original order */
  synonyms: [term: string, meaning: string][];
  /** the exact vedabase.io translation */
  translation: string;
}

/**
 * Verified scripture reference (Bhagavad-gītā As It Is, vedabase.io). Renders
 * Devanagari, transliteration, word-for-word meanings, and translation as an
 * unframed, generously spaced section — distinct from surrounding lecture
 * commentary but not boxed like a card.
 */
export function Shloka({
  number,
  href,
  sanskrit,
  transliteration,
  synonyms,
  translation,
}: ShlokaProps) {
  return (
    <section
      className="shloka not-prose"
      aria-label={`Bhagavad-gita ${number}, verified from vedabase.io`}
    >
      <a href={href} target="_blank" rel="noreferrer" className="shloka-source">
        vedabase.io ↗
      </a>

      <div className="shloka-sanskrit font-devanagari" lang="sa">
        {sanskrit.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>

      <div className="shloka-transliteration">
        {transliteration.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>

      <div className="shloka-synonyms">
        <h4>Word-for-Word</h4>
        <p>
          {synonyms.map(([term, meaning], i) => (
            <span key={i}>
              <em className="shloka-term">{term}</em> — {meaning}
              {i < synonyms.length - 1 ? "; " : "."}
            </span>
          ))}
        </p>
      </div>

      <div className="shloka-translation">
        <h4>Translation</h4>
        <p>{translation}</p>
      </div>
    </section>
  );
}
