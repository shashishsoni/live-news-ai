# Live Update News

A modern Next.js news dashboard for Global News and India News with source citations, verification labels, confidence indicators, fact-check feeds, and a transparent accuracy policy.

## Core Rules

- The app never invents headlines, dates, quotes, claims, or sources.
- Every item must include an original source link.
- Unverified or low-confidence items are hidden by default.
- AI is server-side through NVIDIA only. It can summarize supplied source-backed metadata, but it must not create original news.
- The site clearly states that no platform can guarantee 100% truth, so it uses citations, timestamps, source reputation, duplicate detection, confidence scores, and warning labels to reduce misinformation risk.

## Run Locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Environment Variables

Copy `.env.example` to `.env.local` and add server-side API keys. Keys are read only on the server.

The configured source registry and API responses are the source of truth. If trusted sources return no matching item, the site shows an empty state instead of generating fallback news.

## Free AI Setup

The AI endpoint is NVIDIA NIM only. Create a free NVIDIA API key and set:

```env
NVIDIA_API_KEY=your_nvidia_api_key
```

The endpoint and model are fixed in code as the project's single AI source:

- Endpoint: `https://integrate.api.nvidia.com/v1/chat/completions`
- Model: `nvidia/llama-3.1-nemotron-70b-instruct`

AI output is labeled and constrained to the supplied article metadata. If there is not enough context, the assistant should say so instead of adding facts.

## Verification Pipeline

1. Fetch from trusted APIs and RSS feeds.
2. Normalize titles, descriptions, source names, links, and timestamps.
3. Remove duplicates while preserving citations.
4. Check source reputation and source type.
5. Cross-check similar stories across different reputable sources when possible.
6. Detect sensational language and label potential context risks.
7. Assign `Verified`, `Developing`, or `Unverified` with confidence scores.
8. Hide unverified content by default.

## Important Limitation

This product reduces misinformation risk, but no automated news system can honestly guarantee 100% factual accuracy. Users should follow original links for full context.
