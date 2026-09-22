"""One-off: write shared verse files carrying the public-domain Sanskrit for a chapter range.

Word-for-word meanings and translations are deliberately not fetched; the rendered
block links out to vedabase.io for those.

    uv run python scripts/fetch_verse_sanskrit.py 1 10-15 16-18 19 20 21-22 23
"""

from __future__ import annotations

import html
import re
import sys
import urllib.request
from pathlib import Path

VERSES_DIR = Path(__file__).resolve().parents[1] / "outputs" / "shared" / "verses"
BLOCK_RE = r'<div class="[^"]*{}[^"]*">(.*?)</div>'


def field(page: str, css_class: str) -> list[str]:
    match = re.search(BLOCK_RE.format(css_class), page, re.S)
    if not match:
        return []
    text = re.sub(r"<br\s*/?>", "\n", match.group(1))
    text = re.sub(r"<[^>]+>", "", text)
    lines = html.unescape(text).strip().split("\n")
    # vedabase prefixes the block with its own label ("Devanagari", "Verse text").
    lines[0] = re.sub(r"^(Devanagari|Verse text)", "", lines[0])
    return [line.strip() for line in lines if line.strip()]


def js_array(lines: list[str]) -> str:
    body = "".join(f'\n"{line}",' for line in lines)
    return f"[{body}\n]"


def main() -> None:
    chapter, slugs = sys.argv[1], sys.argv[2:]
    for slug in slugs:
        url = f"https://vedabase.io/en/library/bg/{chapter}/{slug}/"
        # vedabase rejects the default urllib User-Agent with a 403.
        request = urllib.request.Request(url, headers={"User-Agent": "curl/8.7.1"})
        with urllib.request.urlopen(request) as response:
            page = response.read().decode("utf-8")

        sanskrit, transliteration = field(page, "av-devanagari"), field(page, "av-verse_text")
        if not sanskrit or not transliteration:
            raise SystemExit(f"could not parse {url}")

        first = slug.split("-")[0]
        number = f"{chapter}.{slug.replace('-', '–')}"
        path = VERSES_DIR / f"bg-{chapter}-{int(first):02d}.md"
        path.write_text(
            f'<Shloka\nnumber="{number}"\nhref="{url}"\n'
            f"sanskrit={{{js_array(sanskrit)}}}\n"
            f"transliteration={{{js_array(transliteration)}}}\n/>\n",
            encoding="utf-8",
        )
        print(f"{path.name}  {number}")


if __name__ == "__main__":
    main()
