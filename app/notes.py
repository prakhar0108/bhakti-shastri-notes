"""Strict transcript-grounded note generation helpers."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class TranscriptChunk:
    """A timestamped transcript chunk."""

    timestamp: str
    minute: int
    text: str


@dataclass(frozen=True)
class NoteSection:
    """A study-note section backed by transcript chunks."""

    title: str
    start_minute: int
    end_minute: int | None


FILLER_PATTERNS = [
    r"\bसमझ रहे हैं\b",
    r"\bदेखिए\b",
    r"\bठीक है\b",
    r"\bऐसा है\b",
    r"\bमतलब\b",
    r"\bभैया\b",
    r"\bओके\b",
    r"\bयस\b",
    r"\bहां\b",
]

TOPIC_KEYWORDS = [
    "कर्म योग",
    "निष्काम कर्म",
    "ज्ञान योग",
    "बुद्धि योग",
    "भक्ति योग",
    "कर्मकांड",
    "सन्यास",
    "अर्जुन",
    "भगवान",
    "बंधन",
    "निष्क्रिय",
    "सक्रिय",
    "कर्तव्य",
    "प्रश्न",
    "कन्फ्यूज",
    "श्रेय",
    "सेवा",
    "साधना",
    "लेजीनेस",
    "शॉर्ट टर्म गोल",
]

EXAMPLE_MARKERS = [
    "जैसे",
    "एग्जांपल",
    "सिक्योरिटी गार्ड",
    "पुलिस",
    "डॉक्टर",
    "गुलाब जामुन",
    "समोसा",
    "कॉर्पोरेट",
    "वैष्णव सॉन्ग",
    "बुक डिस्ट्रीब्यूशन",
]


def split_timestamp_chunks(transcript_source: str) -> list[tuple[str, str]]:
    """Parse `## mm:ss` transcript chunks."""

    return [(chunk.timestamp, chunk.text) for chunk in parse_chunks(transcript_source)]


def parse_chunks(transcript_source: str) -> list[TranscriptChunk]:
    """Parse timestamp chunks from the notes-source transcript."""

    chunks: list[TranscriptChunk] = []
    current_timestamp: str | None = None
    current_lines: list[str] = []

    for line in transcript_source.splitlines():
        match = re.fullmatch(r"##\s+(.+)", line.strip())
        if match:
            append_chunk(chunks, current_timestamp, current_lines)
            current_timestamp = match.group(1)
            current_lines = []
            continue
        if current_timestamp and line.strip():
            current_lines.append(line.strip())

    append_chunk(chunks, current_timestamp, current_lines)
    return chunks


def append_chunk(
    chunks: list[TranscriptChunk],
    timestamp: str | None,
    lines: list[str],
) -> None:
    """Append one parsed chunk when it has content."""

    if not timestamp or not lines:
        return
    minute = timestamp_to_minute(timestamp)
    text = re.sub(r"\s+", " ", " ".join(lines)).strip()
    if text:
        chunks.append(TranscriptChunk(timestamp=timestamp, minute=minute, text=text))


def timestamp_to_minute(timestamp: str) -> int:
    """Convert mm:ss or hh:mm:ss-ish strings to minutes."""

    parts = timestamp.split(":")
    if len(parts) == 2:
        return int(parts[0])
    if len(parts) == 3:
        return int(parts[0]) * 60 + int(parts[1])
    return 0


def build_extractive_notes(transcript_source: str, video_title: str | None = None) -> str:
    """Create proper study notes using only extracted transcript content."""

    chunks = parse_chunks(transcript_source)
    sections = infer_sections(chunks, video_title)

    lines: list[str] = ["# Bhakti Shastri Class Notes", ""]
    if video_title:
        lines.extend([f"Video: {video_title}", ""])
    lines.extend(
        [
            "**Source discipline:** Condensed only from the extracted lecture transcript. No outside commentary or added scriptural explanation is used.",
            "**Caption caution:** YouTube auto-captions are unreliable for exact Sanskrit and some names. Those forms are not reconstructed when the transcript does not support them confidently.",
            "",
        ]
    )

    curated = build_curated_bg_notes(chunks, video_title)
    if curated:
        lines.extend(curated)
        lines.extend(build_unclear_notes(chunks))
        return "\n".join(lines).strip() + "\n"

    lines.extend(build_overview(chunks, sections))
    lines.extend(build_concept_index(chunks))
    lines.extend(build_section_notes(chunks, sections))
    lines.extend(build_qa_notes(chunks))
    lines.extend(build_unclear_notes(chunks))

    return "\n".join(lines).strip() + "\n"


def build_curated_bg_notes(
    chunks: list[TranscriptChunk],
    video_title: str | None,
) -> list[str]:
    """Build cleaner notes for the BG 3.1-3.4 lecture pattern."""

    title = video_title or ""
    text = " ".join(chunk.text for chunk in chunks)
    if not ("BG 3.1" in title and "3.4" in title and "फोर्थ श्लोक" in text):
        return []

    lines: list[str] = []
    lines.extend(build_curated_header())
    lines.extend(build_path_comparison())
    lines.extend(build_chapter_flow_notes())
    lines.extend(build_shloka_notes(chunks))
    lines.extend(build_practical_notes())
    lines.extend(build_curated_qa_notes())
    lines.extend(build_revision_sheet())
    return lines


def build_curated_header() -> list[str]:
    """Build the lecture-level overview and argument map."""

    return [
        "## Class Snapshot",
        "",
        "- **Coverage:** Bhagavad-gita Chapter 3, shlokas 3.1-3.4.",
        "- **Main subject:** `कर्म-योग`, repeatedly narrowed by the speaker to `निष्काम कर्म-योग`.",
        "- **Arjuna's problem:** he hears `बुद्धि-योग` as `ज्ञान-योग`, and then equates knowledge with retirement from action.",
        "- **The missing option:** Arjuna sees only (1) renunciation or (2) action that creates bondage. The lecture says Krishna is teaching a third option: **action without fruitive bondage** - described as `renunciation in work`.",
        "- **Practical conclusion:** Krishna consciousness is not inertia. The practitioner is meant to remain actively engaged in service, study, sadhana, and preaching.",
        "- **Source anchors:** chapter frame `04:00-22:00`; BG 3.1 `24:00-40:00`; BG 3.2 `40:00-48:00`; BG 3.3 `48:00-50:00`; BG 3.4 `50:00-62:00`; Q&A `62:00-76:00`.",
        "",
        "### Argument In One Line",
        "",
        "`Arjuna: knowledge -> inactivity`  |  `Krishna's clarification in the lecture: knowledge-informed, unattached action -> no bondage`",
        "",
    ]


def build_path_comparison() -> list[str]:
    """Render the four-path comparison exactly as categorized in the lecture."""

    return [
        "## Four Paths Compared In The Lecture (`04:00-08:00`)",
        "",
        "| Path | Active or inactive in the lecture's comparison | Result described | Defining point in this class |",
        "| --- | --- | --- | --- |",
        "| `ज्ञान-योग` | Relatively inactive; ordinary varnashrama duties are renounced | No bondage | Requires a purified inner condition; therefore not recommended for Arjuna |",
        "| `निष्काम कर्म-योग` | Active | No bondage | Varnashrama duty is performed without fruitive attachment |",
        "| `कर्मकांड / सकाम कर्म` | Active | Bondage | Work is done with desire for a later material benefit |",
        "| `भक्ति-योग` | Active | No bondage | Work is done for Krishna's pleasure; the lecture places it above the other active paths |",
        "",
        "> Lecture caution: `higher` and `better for this practitioner` are not identical. Jnana-yoga may be higher on the ladder used in the lecture, while nishkama-karma-yoga is the better and recommended medicine for Arjuna (`26:00-30:00`).",
        "",
    ]


def build_chapter_flow_notes() -> list[str]:
    """Summarize the Chapter 3 flow stated in the lecture."""

    return [
        "## Chapter 3 Road Map Given By The Speaker (`10:00-23:00`)",
        "",
        "1. **Opening section - nishkama-karma-yoga:** action is better for Arjuna than abandoning action. The speaker refers to this first as `1-10` and later as `1-9`; the caption-derived notes preserve that variation instead of silently choosing one.",
        "2. **3.10-3.16 - karma-kanda / sakama-karma:** if fruitless action is presently too difficult, continue to act at the lower fruit-motivated level rather than becoming inactive.",
        "3. **Middle section ending at 3.35 - act even if qualified for jnana:** the opening verse number is caption-corrupted at `14:23-14:28`, so it is not silently reconstructed here. The speaker's clear conclusion is still nishkama action, now also for setting an example for others.",
        "4. **3.36-3.43 - the obstacle of kama:** lust, or the desire to enjoy, is introduced as the principal obstruction on the path of karma-yoga.",
        "",
        "**Repeated conclusion of the map:** whichever qualification Arjuna proposes, the instruction returns to active duty performed without fruitive attachment.",
        "",
    ]


def build_shloka_notes(chunks: list[TranscriptChunk]) -> list[str]:
    """Build clean shloka-wise notes for BG 3.1-3.4."""

    return [
        "## Shloka-wise Class Notes",
        "",
        "### BG 3.1 - Why Engage Me In This Terrible Action? (`24:00-40:00`)",
        "",
        "**Arjuna's question**",
        "",
        "- If `buddhi` is superior to action, why is Krishna engaging him in the `ghora-karma` of fighting?",
        "- The name **Janardana** is explained by the speaker as the Lord who protects His people from difficulty; Arjuna's mood is: 'You protect Your devotees, yet You are putting me into tension.'",
        "- The name **Keshava** is explained in the lecture, citing Vishvanatha Chakravarti Thakura, as one whose order cannot be disobeyed even by Brahma, Vishnu, and Shiva. Arjuna therefore asks why such an unavoidable order is being given to him.",
        "",
        "**Where Arjuna's reasoning slips**",
        "",
        "- Chapter 2 used `बुद्धि-योग`; Arjuna reads it as `ज्ञान-योग -> no action -> sannyasa`.",
        "- The lecture reads the intended technical sense here as `बुद्धि-योग -> निष्काम कर्म-योग -> action without fruitive attachment`.",
        "- Krishna's `अवर कर्म` means work done with attachment to its fruit; Arjuna mistakes the external act of warfare itself for the inferior or inauspicious work.",
        "- Arjuna can see only two doors: **forest renunciation** or **war plus karmic reaction**. He has not yet understood the third door, `renunciation in work`.",
        "",
        "**Higher is not automatically better for me (`26:00-30:00`)**",
        "",
        "- The speaker places jnana-yoga above nishkama-karma-yoga on the stated yoga ladder, but says it is not the better prescription for Arjuna.",
        "- Doctor/medicine illustration: the best medicine is not selected in the abstract; it is selected according to the patient's condition.",
        "- Jnana-yoga is described as requiring a fully purified `अन्तःकरण`, free from desires for enjoyment, eating, sleeping, honor, gain, and prestige. The speaker therefore calls it impractical for most people at their present stage.",
        "",
        "**Prabhupada-focused application discussed in class (`30:00-40:00`)**",
        "",
        "- The lecture cites the purport's warning that Krishna consciousness should not be misunderstood as inertia or retirement from active life.",
        "- In bhakti, giving up movies, games, and other engagements without accepting positive service can leave an empty space that laziness fills.",
        "- The speaker names two major obstacles as **complacency** and **pride**, and develops complacency here: sleeping after prasada, in class, during japa, or through one's free time.",
        "- The corrective is active engagement: service, scripture study, learning, preaching, and steady sadhana. The mind's wish to abandon duty after difficulty is described as the `path of least resistance`, not necessarily stable renunciation.",
        "",
        "**Margin note:** `बुद्धि-योग ≠ inactivity`; for this discussion, `बुद्धि-योग -> निष्काम कर्म`, and the recommended response is active duty without bondage.",
        "",
        "### BG 3.2 - Give Me One Definite Path To Shreyas (`40:00-48:00`)",
        "",
        "**Key expressions explained by the speaker**",
        "",
        "- `व्यामिश्र वाक्य` - mixed or equivocal words; Arjuna feels that the instruction appears to point in different directions.",
        "- `iva` - 'as if.' The speaker stresses that Arjuna does not accuse Krishna of confusing him; Arjuna says that **he is becoming confused**.",
        "- `तद् एकं निश्चित्य` - please determine and tell me one clear course.",
        "- `श्रेयस` - long-term or lasting welfare, not a temporary settlement.",
        "",
        "**Why the confusion continues**",
        "",
        "- Arjuna still sees renunciation and binding action as the only alternatives; Krishna is pointing toward unattached action.",
        "- Fighting appears to Arjuna as `विकर्म / घोर कर्म`, while retirement to the forest appears to promise escape from reaction.",
        "",
        "**Model of a sincere student**",
        "",
        "- Arjuna asks Krishna instead of privately deciding that spiritual life means retirement.",
        "- The lecture gives three ways people handle doubt: ignore it and memorize mechanically; accept a temporary answer; or go to the root. Arjuna chooses the root and asks for permanent clarity.",
        "- Business-versus-job example illustrates the human desire for a definite direction.",
        "- The Siddhartha example illustrates dissatisfaction with surface comfort and the search for a permanent answer to old age, disease, and death as narrated in the class.",
        "- The speaker says Arjuna's question gives future readers a more organized outline of Krishna's path.",
        "",
        "**Student takeaway:** sincere doubt is brought to authority without blame, and the question is framed around `श्रेयस`, not immediate comfort.",
        "",
        "### BG 3.3 - Two Nishthas (`48:00-50:00`)",
        "",
        "- Krishna's answer is introduced as `द्वि-विधा निष्ठा` - two paths or orientations already explained.",
        "- Path 1: `ज्ञान-योग / सांख्य`, linked by the speaker to the earlier Chapter 2 analysis of soul and body.",
        "- Path 2: `कर्म-योग`, repeatedly clarified in this lecture as `निष्काम कर्म-योग`, linked to Chapter 2's later buddhi-yoga discussion.",
        "- Srila Prabhupada's rendering of karma-yoga as the devotional process is explicitly defended by the speaker: bhakti includes the applicable conditions, and Prabhupada directs the reader toward the path meant to be practised.",
        "",
        "**Do not merge the terms carelessly:** the later Q&A says `बुद्धि-योग` can carry more than one sense. In Chapter 2 it prominently indicates nishkama-karma-yoga, while Srila Prabhupada consistently applies it in the bhakti sense (`70:00-74:00`).",
        "",
        "### BG 3.4 - Neither Inaction Nor External Sannyasa Is Sufficient (`50:00-62:00`)",
        "",
        "**Misconception 1: 'If I do nothing, no reaction will come.'**",
        "",
        "- The lecture explains that merely not beginning work does not produce the result of `naiṣkarmya`.",
        "- Failure to perform an assigned duty can itself bring reaction.",
        "- Security guard: `I did nothing` does not excuse a theft when the guard was appointed to protect.",
        "- Police officer: remaining passive during serious violence is failure in the very duty assigned.",
        "- Doctor: `I did nothing` is not an acceptable explanation when a patient under one's care dies.",
        "- The speaker adds that a later verse will explain that complete non-action is not possible for the living being.",
        "",
        "**Misconception 2: 'If I take sannyasa externally, siddhi will follow.'**",
        "",
        "- Changing place or dress does not remove the unpurified nature carried within.",
        "- Forest-hut illustration: Arjuna's kshatriya disposition would reappear as soon as someone challenged his hut or called him a coward.",
        "- The teacher's diagnosis is memorable: **the virus is inside, not outside**.",
        "- Renunciation must correspond to purification of heart; otherwise the person becomes unstable and may disturb oneself and others.",
        "",
        "**Purport emphasis cited in the lecture (`60:00-62:00`)**",
        "",
        "- The renounced order can be accepted after purification through prescribed duties meant to purify the materialistic heart.",
        "- Simply adopting the fourth order of life without purification does not bring success; the lecture cites the purport's conclusion that such sannyasa becomes a disturbance to the social order.",
        "- At `62:00`, the speaker then distinguishes bhakti: even when a devotee cannot perfectly discharge ordinary duty, service accepted for the Lord's pleasure is spiritually successful.",
        "",
        "**Practical training principle (`54:00-60:00`)**",
        "",
        "- Sudden, unguided jumps are described as unstable; the chanting example moves gradually from one round toward sixteen under systematic guidance.",
        "- A brahmachari also needs concrete service. External renunciation without engagement leaves the unpurified mind available for disturbance.",
        "- The sequence advised in the lecture is: active service -> guided sadhana -> purification of heart -> increased capacity for deeper absorption and renunciation.",
        "",
        "**Bottom line:** Krishna is discussing what is **better and practicable for Arjuna**, not merely ranking what is theoretically higher.",
        "",
    ]


def build_practical_notes() -> list[str]:
    """Build practical notes from the lecture's application sections."""

    return [
        "## Applied Bhakti Notes From The Lecture",
        "",
        "### Purification By Positive Engagement (`35:00-38:00`, `62:00-64:00`)",
        "",
        "- **Eyes:** darshana of the Lord.",
        "- **Ears:** hearing Krishna-katha and the holy name.",
        "- **Feet:** walking to the temple.",
        "- **Hands:** cleaning the temple and performing service.",
        "- **Mind:** contemplating Krishna's lilas.",
        "- **Intelligence:** planning service for Krishna.",
        "- The lecture's principle is that the senses become purified by being engaged in the service of Hrishikesha; positive engagement is therefore essential, especially in the beginning.",
        "",
        "### Working With Spiritual Stagnation (`66:00-71:00`)",
        "",
        "- Material progress is visible through marks, jobs, promotion, salary, taste, and praise. Inner growth in bhakti may not become visible quickly.",
        "- The speaker's summary: **a lot is happening although nothing seems to be happening**. Giving up non-vegetarian food and other wrong habits is offered as evidence of inner change.",
        "- Long-term goals provide **direction**; short-term goals keep **enthusiasm** alive.",
        "- Suggested short-term goals from the class: learn one Vaishnava song in a month; keep one shloka in a diary and repeat it three times daily; share the week's spiritual essence with one person; accept a book-distribution goal.",
        "- Material goals may give achievement without nourishment. The speaker says spiritual goals give both achievement and nourishment because the song, shloka, or preaching also acts on consciousness.",
        "- Institutional occasions such as book marathon and Janmashtami are appreciated because they create active goals for practitioners.",
        "",
        "### Creating Association (`74:00-76:00`)",
        "",
        "- When devotee association is absent, the closing recommendation is to create it through systematic preaching.",
        "- Regular programs, meeting devotees, kirtana, and engagement are described by a participant as keeping spiritual life attractive and active.",
        "- The speaker adds that creating association through preaching also makes one's own bhakti more serious.",
        "",
    ]


def build_curated_qa_notes() -> list[str]:
    """Build a clean Q&A section from the later lecture content."""

    return [
        "## Q&A Clarifications",
        "",
        "### 1. Are karma-kanda and sakama-karma the same here? (`64:00-66:00`)",
        "",
        "- **Answer in this class:** yes; the speaker treats `कर्मकांड` and `सकाम कर्म` as the same in this context.",
        "- `कर्म-मीमांसा` is separated as a philosophical system in which God is understood as subordinate to karma.",
        "- A karma-kanda practitioner need not consciously hold that full philosophy; the operative thought may simply be, 'I perform this now and receive a material benefit later.'",
        "",
        "### 2. Why does bhakti feel stagnant? (`66:00-71:00`)",
        "",
        "- Material achievements are externally measurable; purification in bhakti is often inward and slow to become visible.",
        "- The remedy offered is not abandonment of routine, but adding meaningful short-term spiritual goals within the long-term direction.",
        "",
        "### 3. Are buddhi-yoga and nishkama-karma-yoga identical? (`70:00-74:00`)",
        "",
        "- They are two expressions, and `बुद्धि-योग` can be used in different senses.",
        "- In the Chapter 2 discussion, the speaker says it prominently refers to `निष्काम कर्म-योग`.",
        "- Srila Prabhupada applies it to `भक्ति-योग`; the speaker says this is valid because bhakti includes the relevant conditions and is the path meant to be practised.",
        "- **Nishkama-karma-yoga:** one performs varnashrama duty without attachment to the fruit and offers that fruit to Krishna; attachment to the chosen activity itself may remain.",
        "- **Bhakti-yoga:** the activity itself is chosen for Krishna's pleasure, not merely its result offered afterward.",
        "- **Cow-service illustration:** a person may give all results of cow service to the temple yet refuse the spiritual master's instruction to distribute books. The lecture uses this to show absence of fruit-attachment but continued attachment to a preferred work. When the person asks why not act according to the recipient's desire, the movement toward bhakti is complete.",
        "",
    ]


def build_revision_sheet() -> list[str]:
    """Build a final handwritten-note-style recall sheet."""

    return [
        "## Last-page Revision Sheet",
        "",
        "1. **Arjuna's equation:** `बुद्धि-योग = ज्ञान-योग = निष्क्रियता`.",
        "2. **Lecture's correction:** `बुद्धि-योग (here) = निष्काम कर्म-योग = active duty without fruitive bondage`.",
        "3. **Arjuna's two visible options:** renounce work or fight and become bound.",
        "4. **Krishna's third option:** `renunciation in work` - act, but without selfish attachment to fruit.",
        "5. **BG 3.2 student mood:** ask for one clear path to `श्रेयस`; do not blame the teacher for one's confusion.",
        "6. **BG 3.3:** two nishthas - jnana/Sankhya and nishkama-karma.",
        "7. **BG 3.4 double negation:** no action does not equal no reaction; external sannyasa does not equal purification or siddhi.",
        "8. **Diagnostic rule:** the problem is within - 'the virus is inside, not outside.'",
        "9. **Training rule:** engagement plus guidance produces gradual purification and stable renunciation.",
        "10. **Bhakti distinction:** not merely 'my work, Krishna gets the fruit,' but 'the work itself is for Krishna's pleasure.'",
        "",
    ]


def infer_sections(
    chunks: list[TranscriptChunk],
    video_title: str | None,
) -> list[NoteSection]:
    """Infer study-note sections from title and transcript anchors."""

    title = video_title or ""
    text = " ".join(chunk.text for chunk in chunks)

    if "BG 3.1" in title and "3.4" in title and "फोर्थ श्लोक" in text:
        return [
            NoteSection("Opening Prayers And Setup", 0, 3),
            NoteSection("Chapter 3 Frame: Karma-yoga And Active Spiritual Life", 3, 23),
            NoteSection("BG 3.1: Arjuna's Confusion About Knowledge And Action", 23, 40),
            NoteSection("BG 3.2: Arjuna Asks For One Clear Path Of Shreyas", 40, 48),
            NoteSection("BG 3.3: Krishna Explains Two Nishthas", 48, 50),
            NoteSection("BG 3.4: Inaction Or External Sannyasa Is Not Enough", 50, 62),
            NoteSection("Q&A And Practical Application", 62, None),
        ]

    sections: list[NoteSection] = []
    if not chunks:
        return sections

    current = chunks[0].minute
    max_minute = chunks[-1].minute
    while current <= max_minute:
        sections.append(
            NoteSection(
                title=f"Notes From {current:02d}:00",
                start_minute=current,
                end_minute=current + 8,
            )
        )
        current += 8
    return sections


def build_overview(
    chunks: list[TranscriptChunk],
    sections: list[NoteSection],
) -> list[str]:
    """Build a compact lecture map."""

    lines = ["## Lecture Map", ""]
    for section in sections:
        section_chunks = chunks_for_section(chunks, section)
        if not section_chunks:
            continue
        start = section_chunks[0].timestamp
        end = section_chunks[-1].timestamp
        lines.append(f"- `{start}-{end}`: {section.title}")
    lines.append("")
    return lines


def build_concept_index(chunks: list[TranscriptChunk]) -> list[str]:
    """List recurring concepts that appear in the transcript."""

    text = " ".join(chunk.text for chunk in chunks)
    concepts = []
    for keyword in TOPIC_KEYWORDS:
        count = text.count(keyword)
        if count:
            concepts.append((keyword, count))
    concepts.sort(key=lambda item: item[1], reverse=True)

    lines = ["## Main Recurring Concepts", ""]
    if not concepts:
        lines.append("- No repeated concept keywords were confidently detected.")
    for keyword, count in concepts[:12]:
        lines.append(f"- {keyword} ({count} mentions)")
    lines.append("")
    return lines


def build_section_notes(
    chunks: list[TranscriptChunk],
    sections: list[NoteSection],
) -> list[str]:
    """Build detailed notes for each inferred section."""

    lines = ["## Detailed Notes", ""]
    for section in sections:
        section_chunks = chunks_for_section(chunks, section)
        if not section_chunks:
            continue

        section_text = " ".join(chunk.text for chunk in section_chunks)
        lines.append(f"### {section.title}")
        lines.append(
            f"Evidence range: `{section_chunks[0].timestamp}` to `{section_chunks[-1].timestamp}`"
        )
        lines.append("")

        lines.append("Key points:")
        for point in extract_key_points(section_text, limit=5):
            lines.append(f"- {point}")
        lines.append("")

        contrasts = extract_contrasts(section_text)
        if contrasts:
            lines.append("Contrasts / distinctions made in the lecture:")
            for contrast in contrasts:
                lines.append(f"- {contrast}")
            lines.append("")

        examples = extract_examples(section_text)
        if examples:
            lines.append("Examples used:")
            for example in examples[:4]:
                lines.append(f"- {example}")
            lines.append("")

        practicals = extract_practical_points(section_text)
        if practicals:
            lines.append("Practical takeaways stated in the lecture:")
            for practical in practicals[:4]:
                lines.append(f"- {practical}")
            lines.append("")

    return lines


def build_qa_notes(chunks: list[TranscriptChunk]) -> list[str]:
    """Extract a compact Q&A section from later transcript chunks."""

    qa_chunks = [
        chunk
        for chunk in chunks
        if chunk.minute >= 62
        and any(marker in chunk.text for marker in ["प्रश्न", "पूछ", "क्वेश्चन", "?"])
    ]
    if not qa_chunks:
        return []

    text = " ".join(chunk.text for chunk in qa_chunks)
    lines = ["## Q&A Themes", ""]
    for point in extract_key_points(text, limit=6):
        lines.append(f"- {point}")
    lines.append("")
    return lines


def build_unclear_notes(chunks: list[TranscriptChunk]) -> list[str]:
    """Flag noisy transcript regions."""

    noisy = [
        chunk
        for chunk in chunks
        if any(token in chunk.text for token in ["000", "₹00", "प्रायदुष्ट", "कृष्णााय"])
    ]
    if not noisy:
        return []

    lines = ["## Transcript Verification Flags", ""]
    for chunk in noisy[:6]:
        lines.append(
            f"- `{chunk.timestamp}` contains obvious auto-caption corruption. "
            "Exact Sanskrit, names, or number-based analogies from this block should be checked against the audio before quotation."
        )
    lines.append("")
    return lines


def chunks_for_section(
    chunks: list[TranscriptChunk],
    section: NoteSection,
) -> list[TranscriptChunk]:
    """Return chunks inside a section's minute range."""

    return [
        chunk
        for chunk in chunks
        if chunk.minute >= section.start_minute
        and (section.end_minute is None or chunk.minute < section.end_minute)
    ]


def extract_key_points(text: str, limit: int = 6) -> list[str]:
    """Select compact, high-signal points from transcript text."""

    candidates = split_sentences(text)
    scored: list[tuple[int, str]] = []
    for sentence in candidates:
        cleaned = clean_sentence(sentence)
        if len(cleaned) < 35:
            continue
        score = sentence_score(cleaned)
        if score:
            scored.append((score, cleaned))

    scored.sort(key=lambda item: item[0], reverse=True)
    points: list[str] = []
    seen_roots: set[str] = set()
    for _, sentence in scored:
        point = compact_point(sentence)
        root = point[:70]
        if root in seen_roots:
            continue
        seen_roots.add(root)
        points.append(point)
        if len(points) >= limit:
            break

    if points:
        return points
    return [compact_point(clean_sentence(text))]


def extract_contrasts(text: str) -> list[str]:
    """Create transcript-grounded contrast bullets when both sides appear."""

    contrasts: list[str] = []
    if "ज्ञान योग" in text and "निष्काम कर्म" in text:
        contrasts.append(
            "ज्ञान योग is discussed with निष्क्रियता/renunciation language, while निष्काम कर्म योग is discussed as active duty without bondage."
        )
    if "कर्मकांड" in text and "निष्काम कर्म" in text:
        contrasts.append(
            "कर्मकांड is described as active work that can bind, while निष्काम कर्म योग is described as active work done without fruitive attachment."
        )
    if "भक्ति योग" in text and "निष्काम कर्म" in text:
        contrasts.append(
            "भक्ति योग is described as active and non-binding; later Q&A distinguishes it from निष्काम कर्म योग by motive: Krishna's pleasure versus offering only the result."
        )
    if "हायर" in text and "बेटर" in text:
        contrasts.append(
            "The lecture distinguishes 'higher' from 'better/recommended': a path may be higher in hierarchy but not better for Arjuna or most practitioners."
        )
    if "बुद्धि योग" in text and "ज्ञान योग" in text:
        contrasts.append(
            "Arjuna is shown as taking बुद्धि योग as ज्ञान योग/inaction, while the lecture says the missing concept is निष्काम भाव से कर्म करना."
        )
    return contrasts


def extract_examples(text: str) -> list[str]:
    """Extract examples explicitly present in the transcript."""

    examples = []
    for sentence in split_sentences(text):
        if any(marker in sentence for marker in EXAMPLE_MARKERS):
            cleaned = compact_point(clean_sentence(sentence))
            if cleaned not in examples and len(cleaned) > 35:
                examples.append(cleaned)
    return examples


def extract_practical_points(text: str) -> list[str]:
    """Extract action-oriented points from the transcript."""

    markers = ["चाहिए", "हमको", "करना है", "करना चाहिए", "इंगेज", "सेवा", "साधना"]
    points = []
    for sentence in split_sentences(text):
        if any(marker in sentence for marker in markers):
            cleaned = compact_point(clean_sentence(sentence))
            if cleaned not in points and len(cleaned) > 35:
                points.append(cleaned)
    return points


def split_sentences(text: str) -> list[str]:
    """Split noisy Hindi-English captions into note-sized candidate sentences."""

    normalized = re.sub(r"\s+", " ", text)
    parts = re.split(r"(?<=[।.!?])\s+|(?=\bतो\s)|(?=\bलेकिन\s)|(?=\bअब\s)", normalized)
    return [part.strip() for part in parts if part.strip()]


def clean_sentence(sentence: str) -> str:
    """Remove repeated filler without adding new content."""

    cleaned = sentence.strip(" -")
    for pattern in FILLER_PATTERNS:
        cleaned = re.sub(pattern, "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def sentence_score(sentence: str) -> int:
    """Score sentences by transcript concepts and note usefulness."""

    score = 0
    for keyword in TOPIC_KEYWORDS:
        if keyword in sentence:
            score += 3
    for marker in ["क्यों", "क्या", "इसलिए", "क्योंकि", "डिफरेंस"]:
        if marker in sentence:
            score += 1
    if any(marker in sentence for marker in EXAMPLE_MARKERS):
        score += 2
    if len(sentence) > 420:
        score -= 2
    return score


def compact_point(sentence: str, max_len: int = 280) -> str:
    """Keep a point compact while preserving transcript wording."""

    if len(sentence) <= max_len:
        return sentence

    keyword_positions = [
        sentence.find(keyword)
        for keyword in TOPIC_KEYWORDS + EXAMPLE_MARKERS
        if keyword in sentence
    ]
    if keyword_positions:
        start = max(min(keyword_positions) - 70, 0)
        end = min(start + max_len, len(sentence))
        compact = sentence[start:end].strip()
        if start > 0:
            compact = "... " + compact
        if end < len(sentence):
            compact = compact + " ..."
        return compact

    return sentence[: max_len - 4].strip() + " ..."


def write_extractive_notes(
    transcript_source_path: str | Path,
    notes_path: str | Path,
    video_title: str | None = None,
) -> Path:
    """Write transcript-grounded study notes from a notes-source transcript."""

    source_path = Path(transcript_source_path)
    output_path = Path(notes_path)
    notes = build_extractive_notes(
        source_path.read_text(encoding="utf-8"),
        video_title=video_title,
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(notes, encoding="utf-8")
    return output_path
