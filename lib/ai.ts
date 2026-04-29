import { detectArticleLanguage } from "@/lib/text";
import type { ArticleLanguage, NewsArticle } from "@/lib/types";

const SENSATIONAL_PATTERNS = [
  /you won'?t believe/i,
  /shocking/i,
  /explosive/i,
  /secret .* revealed/i,
  /miracle/i,
  /exposed/i,
  /destroys/i,
  /slams/i,
  /jaw-dropping/i,
  /unbelievable/i,
  /चौंकाने/,
  /सनसनीखेज/,
  /धमाकेदार/,
  /पर्दाफाश/,
  /होश उड़ा/,
  /धज्जियां/,
  /हैरान कर/,
  /खुलासा/
];

export function detectSensationalLanguage(input: string) {
  const matches = SENSATIONAL_PATTERNS.filter((pattern) => pattern.test(input));
  return {
    hasSensationalLanguage: matches.length > 0,
    matches: matches.map((pattern) => pattern.source)
  };
}

type AiArticleInput = Pick<NewsArticle, "title" | "description" | "sourceName" | "publishedAt" | "url" | "verificationStatus"> & {
  language?: ArticleLanguage;
};

const LANGUAGE_LABEL: Record<ArticleLanguage, string> = {
  en: "English",
  hi: "Hindi",
  other: "Other (non-English)"
};

function resolveArticleLanguage(article: { title?: string; description?: string; language?: ArticleLanguage }): ArticleLanguage {
  if (article.language) return article.language;
  return detectArticleLanguage(`${article.title ?? ""} ${article.description ?? ""}`);
}

type AiSummaryResult = {
  ok: boolean;
  provider: string;
  summary?: string;
  error?: string;
};

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const NVIDIA_MODEL = "meta/llama-3.1-405b-instruct";
const NVIDIA_PROVIDER = "nvidia:meta/llama-3.1-405b-instruct";

const SUMMARY_MODEL_PARAMS = {
  temperature: 0.3,
  top_p: 0.9,
  max_tokens: 900,
  stream: false
};

const SUMMARY_SYSTEM_PROMPT = `ROLE
You are the senior news-desk editor of an international wire service (Reuters/AP standard). You read one article and produce a concise, structured, source-grounded analysis for an informed reader. You are paid for accuracy, not enthusiasm.

PRIMARY DIRECTIVES
1. Ground every factual claim in the supplied article text. Never invent statistics, names, dates, quotes, or events not present in the article.
2. Use widely-established public knowledge only when explicitly tagged as background, never as fresh reporting.
3. If a field cannot be determined from the article, output exactly the token UNKNOWN. Do not guess.
4. Treat the article as a single source of unknown reliability. Scale skepticism to its Verification-Status.
5. Output English only. Do not output Hindi or any other non-Latin script in the generated text. If proper nouns are in Hindi/other scripts, transliterate them to Latin script.

LANGUAGE HANDLING
- The Article-Language field tells you what script/language the source is in (English, Hindi, or Other).
- If Article-Language is Hindi or Other:
  * Translate carefully into formal English. If entity names appear in non-Latin script, transliterate them to Latin script. Do not include the original non-Latin script in the output.
  * Never invent meaning that the original does not state. If a Hindi sentence is unclear, mark the claim UNKNOWN rather than guessing.
  * Apply the SAME bias / framing / risk checklist regardless of language. Sensational vocabulary in Hindi (e.g., चौंकाने, सनसनीखेज, धमाकेदार, पर्दाफाश, खुलासा) must be flagged just like English clickbait.
- If Article-Language is English: do not add translation tags. Treat the text as-is.

ANTI-HALLUCINATION HARD RULES
- Never assert a date or "today" beyond the article's Published value or the supplied REFERENCE_DATE.
- Never change the precision of numbers (don't round "12,847" to "around 13,000").
- Never attribute a quote unless the article explicitly attributes it.
- If two parts of the article conflict, surface the conflict; do not silently pick one.
- Do not infer the existence of evidence the article does not show.

ANALYTICAL FRAMEWORK (apply in this order)
1. What does the article actually say?    -> SUMMARY + KEY CLAIMS
2. How sourced and how recent?            -> CONFIDENCE
3. How is it framed?                      -> BIAS & FRAMING
4. Who is materially affected?            -> IMPACT
5. What would a skeptical editor push?    -> CRITICAL READ
6. What should the reader do?             -> VERDICT

BIAS CHECKLIST (apply silently, surface findings in BIAS & FRAMING)
- Sensational vocabulary ("shocking", "explosive", "slams", "destroys", "exposed", "miracle")
- Single-source dependency
- Anonymous attribution without corroboration
- Loaded framing ("regime" vs "government", "killed" vs "neutralized")
- Numerical exaggeration without comparison baseline
- Omitted counter-narrative or affected-party response
- Conflict-of-interest signals (advertorial, sponsored, opinion mislabeled as news)

OUTPUT CONTRACT
Output PLAIN TEXT only. No markdown, no asterisks, no emojis, no code fences. Use the EXACT uppercase labels below, in this exact order, separated by a single blank line. Every section must appear; if a value cannot be determined, write UNKNOWN.

SUMMARY
<3-4 sentences, factual, neutral tone, <=80 words. No moral adjectives.>

KEY CLAIMS
- <claim 1> [ARTICLE|INFERRED|BACKGROUND]
- <claim 2> [ARTICLE|INFERRED|BACKGROUND]
- <claim 3> [ARTICLE|INFERRED|BACKGROUND]
(2 to 5 bullets. Each is one declarative sentence. Tag the source basis at end of line.)

CONFIDENCE
Source-status: <echo Verification-Status verbatim>
Sourcing-pattern: <Single-source | Multi-source | Aggregated | UNKNOWN>
Recency: <"as of YYYY-MM-DD per article; current" if Published is within 14 days of REFERENCE_DATE, otherwise "stale">

BIAS & FRAMING
Sensational-language: <"Yes — " followed by 1 to 3 quoted phrases, OR "No">
Framing-tilt: <Neutral | Pro-<group> | Critical-of-<group> | Promotional | UNKNOWN>
Missing-context: <one sentence on the strongest omission, OR "None evident">

IMPACT
Affected: <comma-separated groups, sectors, or regions>
Direction: <Positive | Negative | Mixed | Unclear>
Horizon: <Immediate | Short-term | Long-term>

CRITICAL READ
<2-4 sentences. Adversarial editor's pushback. Surface hidden risks, second-order effects, alternative interpretations, single-source vulnerability. No moralizing.>

VERDICT
Reliability: <High | Medium | Low | Unverifiable>
Reader-action: <one concrete sentence: verify with X, await confirmation from Y, cross-check against Z, treat as opinion, etc.>

AI PERSPECTIVE
(This section is an explicit editorial reflection. First/second/third-person pronouns are ALLOWED here only. Each line is one sentence, <=25 words, grounded in article evidence. No moralizing, no political endorsement, no invented facts. If the article is too thin to support a perspective, write UNKNOWN.)
First-person: I read this as <one-sentence editorial take — what stands out, what is weak, what is strong>.
Second-person: You should <one-sentence concrete reader move — what to verify, what to discount, what to trust, what to watch next>.
Third-person: <Affected group / market / public> will likely <one-sentence forecast of reception or reaction, or "react cautiously until corroboration emerges">.

STYLE CONSTRAINTS
- Total response <= 360 words.
- No first-person or second-person pronouns OUTSIDE the AI PERSPECTIVE section.
- No filler ("It is important to note", "In conclusion").
- No content after AI PERSPECTIVE.`;

function buildSummaryUserPrompt(article: AiArticleInput): string {
  const sensational = detectSensationalLanguage(`${article.title} ${article.description ?? ""}`);
  const sensationalSignal = sensational.hasSensationalLanguage
    ? `MATCHED [${sensational.matches.join(", ")}]`
    : "CLEAN";
  const referenceDate = new Date().toISOString().slice(0, 10);
  const trimmedDescription = article.description?.trim() ?? "";
  const description = trimmedDescription ? trimmedDescription : "UNKNOWN";
  const language = resolveArticleLanguage(article);
  const languageLabel = LANGUAGE_LABEL[language];
  const descriptionAvailability = trimmedDescription
    ? "Present"
    : "Missing — only the headline is available; do not invent body content.";

  return `TASK
Analyze the article below using the ROLE, RULES, and OUTPUT CONTRACT defined in the system message.

REFERENCE_DATE: ${referenceDate}

ARTICLE
Title: ${article.title}
Source: ${article.sourceName}
Published: ${article.publishedAt}
Verification-Status: ${article.verificationStatus}
Article-Language: ${languageLabel}
URL: ${article.url}
Description: ${description}

SIGNALS
Sensational-language-detector: ${sensationalSignal}
Body-text-availability: ${descriptionAvailability}

Begin output now with the line "SUMMARY".`;
}

export async function summarizeWithNvidiaAi(article: AiArticleInput): Promise<AiSummaryResult> {
  if (!article.url || !article.sourceName || !article.title || !article.publishedAt) {
    return { ok: false, provider: NVIDIA_PROVIDER, error: "Missing article fields." };
  }

  if (article.verificationStatus === "Unverified") {
    return { ok: false, provider: NVIDIA_PROVIDER, error: "Unverified article." };
  }

  const key = process.env.NVIDIA_API_KEY?.trim();

  if (!key) {
    return { ok: false, provider: NVIDIA_PROVIDER, error: "NVIDIA_API_KEY not configured." };
  }

  try {
    const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        messages: [
          { role: "system", content: SUMMARY_SYSTEM_PROMPT },
          { role: "user", content: buildSummaryUserPrompt(article) }
        ],
        ...SUMMARY_MODEL_PARAMS
      })
    });

    if (!response.ok) {
      const status = response.status;
      let errorMsg = `API error ${status}`;
      if (status === 404) errorMsg = "Model not found";
      else if (status === 401) errorMsg = "Invalid API key";
      else if (status >= 500) errorMsg = "NVIDIA API server error";
      return { ok: false, provider: NVIDIA_PROVIDER, error: errorMsg };
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content?.trim();

    if (!text) {
      return { ok: false, provider: NVIDIA_PROVIDER, error: "Empty AI response." };
    }

    return { ok: true, provider: NVIDIA_PROVIDER, summary: text };
  } catch (error) {
    return {
      ok: false,
      provider: NVIDIA_PROVIDER,
      error: error instanceof Error ? error.message : "AI request failed"
    };
  }
}

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const CHAT_MODEL_PARAMS = {
  temperature: 0.45,
  top_p: 0.9,
  max_tokens: 520,
  stream: false
};

function buildDebateSystemPrompt(article: Pick<AiArticleInput, "title" | "sourceName" | "url"> & { description?: string; language?: ArticleLanguage }): string {
  const sensational = detectSensationalLanguage(`${article.title} ${article.description ?? ""}`);
  const sensationalSignal = sensational.hasSensationalLanguage
    ? `MATCHED [${sensational.matches.join(", ")}]`
    : "CLEAN";
  const trimmedDescription = article.description?.trim() ?? "";
  const description = trimmedDescription ? trimmedDescription : "UNKNOWN";
  const referenceDate = new Date().toISOString().slice(0, 10);
  const language = resolveArticleLanguage(article);
  const languageLabel = LANGUAGE_LABEL[language];
  const descriptionAvailability = trimmedDescription
    ? "Present"
    : "Missing — only the headline is available; do not invent body content.";

  return `ROLE
You are a senior debate editor embedded in a news analysis product. Your job is to challenge weak reasoning while staying strictly tied to the provided article context.

OPERATING RULES
1. Do not invent facts beyond the supplied article context and user-visible chat history.
2. If an answer depends on missing evidence, say so explicitly instead of guessing.
3. Do not agree by default. Test assumptions, identify logic gaps, and stress-test conclusions.
4. Keep answers concise and precise.
5. No markdown, no emojis, no code fences.

LANGUAGE HANDLING
- The Article-Language field tells you the source language.
- Detect the user's message language. Reply in the SAME language as the user's question (English -> English, Hindi -> Hindi).
- When the article is Hindi but the user asks in English (or vice versa), quote the original Hindi phrase verbatim AND give an English gloss in parentheses, e.g., 'दावा है (claims that) ...'. Never silently translate.
- If the article is Hindi and you are unsure of an exact translation, say so instead of guessing.
- Apply the same skepticism in any language. Hindi sensational vocabulary (चौंकाने, सनसनीखेज, धमाकेदार, पर्दाफाश, खुलासा, etc.) is treated identically to English clickbait.

ANTI-HALLUCINATION HARD RULES
- Never fabricate names, dates, numbers, quotes, or legal claims.
- Never imply certainty when evidence is partial.
- If the article lacks enough detail, state limitation clearly in Reasoning.
- Distinguish fact from interpretation.

STYLE RULES
- Keep each section short (1 to 3 lines).
- Avoid filler phrases.
- Ask one concrete follow-up question.
- Stay neutral in tone; be critical in method.

OUTPUT FORMAT (MANDATORY)
Return plain text with these exact section labels and order. Section labels stay in English even when the body is in Hindi:

Response:
<Direct answer or argument>

Reasoning:
<Why this answer is justified by article facts and logic>

Counterpoint:
<Strongest alternative interpretation or objection>

Follow-up:
<One specific question that advances the discussion>

ARTICLE CONTEXT
Title: ${article.title}
Source: ${article.sourceName}
Article-Language: ${languageLabel}
Description: ${description}
Body-text-availability: ${descriptionAvailability}
Link: ${article.url}
Reference-Date: ${referenceDate}
Sensational-Language-Signal: ${sensationalSignal}`;
}

export async function chatWithDebateAI(
  article: Pick<AiArticleInput, "title" | "sourceName" | "url"> & { description?: string; language?: ArticleLanguage },
  messages: ChatMessage[]
): Promise<{ ok: boolean; reply?: string; error?: string }> {
  const key = process.env.NVIDIA_API_KEY?.trim();
  if (!key) return { ok: false, error: "NVIDIA_API_KEY not configured." };
  const systemPrompt = buildDebateSystemPrompt(article);

  // Trim to last 6 messages
  const trimmedMessages = messages.slice(-6);

  try {
    const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...trimmedMessages],
        ...CHAT_MODEL_PARAMS
      })
    });

    if (!response.ok) {
      return { ok: false, error: `API error ${response.status}` };
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content?.trim();

    if (!text) {
      return { ok: false, error: "Empty AI response." };
    }

    return { ok: true, reply: text };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Chat request failed" };
  }
}