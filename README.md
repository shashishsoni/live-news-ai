# Live Update News

Source-backed news dashboard built with Next.js (App Router) and TypeScript.

The app aggregates news from curated RSS feeds + optional news APIs, then applies a transparent verification pipeline:
- source profiling
- confidence scoring
- sensational wording detection
- cross-source matching
- explicit labels (`Verified`, `Developing`, `Unverified`)
- citations to original links

The goal is not to claim "perfect truth." The goal is to make verification logic inspectable and reduce misinformation risk.

---

## What This Project Does

- Aggregates stories for `global`, `india`, and `fact-check` regions.
- Normalizes raw feed/API records into one `NewsArticle` model.
- Scores each article with a numeric confidence value.
- Assigns a verification status from that score.
- Attaches a fact-check label based on source type + risk flags.
- Tries cross-source title matching to raise confidence when multiple outlets report similar events.
- Shows source errors transparently (except known upstream blocked cases like AFP RSS `403`).

No synthetic fallback news is generated when sources are empty.

---

## Exactly How Verification Is Calculated

All logic below is from `lib/news.ts` and `lib/ai.ts`.

### 1) Inputs used by the verifier

Each normalized article includes:
- `sourceKind` (`established-media` | `official` | `fact-checker` | `wire` | `api`)
- `sourceReputation` (from curated source registry/feed config)
- `title` + `description`
- `url`
- `publishedAt`
- inferred `category`

### 2) Sensational language detection

`detectSensationalLanguage()` checks title + description against regex patterns:
- `you won't believe`
- `shocking`
- `explosive`
- `secret ... revealed`
- `miracle`
- `exposed`
- `destroys`
- `slams`
- `jaw-dropping`
- `unbelievable`

If matched:
- `warning` is added on the article
- confidence penalty is applied

### 3) Opinion detection

Article is marked opinion if URL/category text contains:
- `opinion`
- `editorial`
- `column`
- `analysis`

Opinion gets a confidence penalty.

### 4) Base confidence scoring formula

Raw confidence starts from `sourceReputation` and is adjusted:

- `+4` if source kind is `official` or `fact-checker` or `wire`
- `-14` if sensational wording is detected
- `-10` if opinion/editorial-like

Then clamped to `[20, 98]`.

### 5) Verification status thresholds

After score calculation:
- `Verified` if confidence `>= 88`
- `Developing` if confidence `>= 76` and `< 88`
- `Unverified` if confidence `< 76`

### 6) Cross-source verification boost

After initial scoring, articles are cross-checked by title similarity against other sources in the same region.

If matches exist:
- status is upgraded to `Verified`
- confidence is increased with:
  - baseline: `max(currentConfidence, 86)`
  - boost: `+ min(8, matches * 3)`
  - cap at `98`
- citations are merged
- matched source list is expanded

This is why multi-source coverage can outrank single-source coverage.

### 7) Deduplication behavior

Articles are deduped by:
- exact URL match OR
- similar title match

When deduping:
- citations and matched sources are merged
- confidence keeps the higher value
- if article has multiple matched sources and is not already `Unverified`, it is set to `Verified`

### 8) Fact-check label assignment

`factCheckLabel` is assigned by deterministic rules:
- `Fact-check source` if `sourceKind === "fact-checker"`
- `Needs context` if sensational wording is detected
- `Unverified claim` if verification status is `Unverified`
- else `No known dispute`

Important: this is a labeling heuristic, not courtroom-level fact adjudication.

---

## What "Legit" Means Here (and What It Does Not)

This project is legitimate in the sense that:
- it does not invent headlines/sources in the feed pipeline
- every article keeps original source URLs and citations
- scoring rules are deterministic and visible in code
- uncertainty is surfaced via `Developing`/`Unverified` labels

But it does **not** prove absolute truth:
- source feeds can be wrong or biased
- cross-source agreement can still repeat the same mistake
- regex-based sensational detection is a heuristic
- category inference is keyword-based and can misclassify edge cases

Use the labels as risk signals, not as final truth certificates.

---

## AI Usage (Summarize + Debate)

AI is used for analysis UX, not for generating news inventory.

### Provider
- Endpoint: `https://integrate.api.nvidia.com/v1/chat/completions`
- Model in code: `meta/llama-3.1-405b-instruct`

### Summary mode (`/api/ai/summarize`)
- Denies summarization for `Unverified` articles.
- Uses strict system prompt with anti-hallucination rules.
- Requires structured output sections (`SUMMARY`, `KEY CLAIMS`, `CONFIDENCE`, `BIAS & FRAMING`, `IMPACT`, `CRITICAL READ`, `VERDICT`).
- Enforces "UNKNOWN instead of guessing" behavior in prompt contract.

### Debate mode (`/api/ai/chat`)
- Requires `Response / Reasoning / Counterpoint / Follow-up` format.
- Instructs model to challenge weak logic and avoid unsupported claims.
- Includes sensational-language signal in prompt context.

AI responses are only as good as provided context; they are not treated as primary source data in the article feed pipeline.

---

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

---

## Environment Variables

Copy `.env.example` to `.env.local` and set only server-side secrets:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEWS_CACHE_SECONDS=600

NEWSAPI_KEY=
GNEWS_API_KEY=
GUARDIAN_API_KEY=
NYT_API_KEY=
MEDIASTACK_KEY=

TRUSTED_RSS_FEEDS=
NVIDIA_API_KEY=
```

Notes:
- API keys are read server-side.
- `TRUSTED_RSS_FEEDS` can append reviewed custom feeds as JSON.
- If no upstream provider returns usable items, the app shows empty states instead of fabricated stories.

---

## API and Revalidation

- `GET /api/news?region=&category=&q=&includeUnverified=&limit=`
- Route revalidation: `600s` by default.
- Upstream fetches use `NEWS_CACHE_SECONDS` for Next.js fetch cache hints.

---

## Project Principle

This system is a **risk-reduction pipeline**, not a truth oracle.
It is designed to be auditable, source-linked, and explicit about uncertainty.
