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

function enforceEnglishOnlySummary(text: string): string {
  const withoutDevanagari = text.replace(/[\u0900-\u097F]+/g, "");
  return withoutDevanagari
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type AiSummaryResult = {
  ok: boolean;
  provider: string;
  summary?: string;
  error?: string;
};

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const DEFAULT_GROQ_PRIMARY_MODEL = "openai/gpt-oss-120b";
const DEFAULT_GROQ_FALLBACK_MODELS = ["openai/gpt-oss-20b"] as const;
const DEFAULT_OPENROUTER_FREE_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openai/gpt-oss-120b:free",
  "qwen/qwen3.6-plus-preview:free"
] as const;
const REQUEST_TIMEOUT_MS = 22000;

function getOpenRouterModels() {
  const configured = (process.env.OPENROUTER_FREE_MODELS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return configured.length ? configured : [...DEFAULT_OPENROUTER_FREE_MODELS];
}

function getGroqModels() {
  const primary = process.env.GROQ_PRIMARY_MODEL?.trim() || DEFAULT_GROQ_PRIMARY_MODEL;
  const configuredFallbacks = (process.env.GROQ_FALLBACK_MODELS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const fallbacks = configuredFallbacks.length ? configuredFallbacks : [...DEFAULT_GROQ_FALLBACK_MODELS];
  return Array.from(new Set([primary, ...fallbacks]));
}

type ProviderTarget = {
  provider: "groq" | "openrouter";
  baseUrl: string;
  apiKey: string;
  models: string[];
};

function getProviderTargets(): ProviderTarget[] {
  const targets: ProviderTarget[] = [];
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim();

  if (groqKey) {
    targets.push({
      provider: "groq",
      baseUrl: GROQ_BASE_URL,
      apiKey: groqKey,
      models: getGroqModels()
    });
  }

  if (openrouterKey) {
    targets.push({
      provider: "openrouter",
      baseUrl: OPENROUTER_BASE_URL,
      apiKey: openrouterKey,
      models: getOpenRouterModels()
    });
  }

  return targets;
}

function providerLabel(provider: ProviderTarget["provider"], model: string) {
  return `${provider}:${model}`;
}

const DEFAULT_PROVIDER_LABEL = providerLabel("groq", DEFAULT_GROQ_PRIMARY_MODEL);

const SUMMARY_MODEL_PARAMS = {
  temperature: 0.25,
  top_p: 0.9,
  max_tokens: 1200,
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

REASONING PROTOCOL (MANDATORY, INTERNAL)
- Rank evidence strength before writing: direct article fact > quoted statement > metadata > weak inference.
- Attack assumptions: identify the weakest premise and stress-test it.
- Check contradictions: if any claim conflicts with another claim, surface conflict explicitly.
- Calibrate certainty: if evidence is partial, lower certainty and state what is missing.
- Prefer omission to speculation: remove unsupported claims instead of guessing.

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
- Certainty-overreach (strong conclusion from weak evidence)

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
(Write ONE unified overall perspective, not split labels. This is the model's experienced truth-first journalist judgment, combining multiple angles in one coherent view.)
<2-4 sentences, <=130 words total, grounded in article evidence only. It must naturally connect first-person ("I think"), second-person ("you should"), and third-person ("they/public/stakeholders") viewpoints in one continuous narrative, not as separate bullet points or headings.>
<Include a practical trust judgment: what should be treated as confirmed now vs what should remain provisional pending corroboration.>
<Use first-person voice naturally ("I think...") when useful, but do not invent facts, do not moralize, and do not endorse political positions. If evidence is too thin, write UNKNOWN.>

STYLE CONSTRAINTS
- Total response <= 520 words.
- First-person pronouns are allowed only in AI PERSPECTIVE.
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

export async function summarizeWithAi(article: AiArticleInput): Promise<AiSummaryResult> {
  if (!article.url || !article.sourceName || !article.title || !article.publishedAt) {
    return { ok: false, provider: DEFAULT_PROVIDER_LABEL, error: "Missing article fields." };
  }

  if (article.verificationStatus === "Unverified") {
    return { ok: false, provider: DEFAULT_PROVIDER_LABEL, error: "Unverified article." };
  }
  if (!getProviderTargets().length) {
    return { ok: false, provider: DEFAULT_PROVIDER_LABEL, error: "No AI provider key configured. Set GROQ_API_KEY or OPENROUTER_API_KEY." };
  }

  try {
    const result = await requestChatCompletionWithFallback({
      messages: [
        { role: "system", content: SUMMARY_SYSTEM_PROMPT },
        { role: "user", content: buildSummaryUserPrompt(article) }
      ],
      ...SUMMARY_MODEL_PARAMS
    });

    if (!result.ok) {
      const status = result.status ?? 504;
      let errorMsg = `API error ${status}`;
      if (status === 404) errorMsg = "Model not found";
      else if (status === 401) errorMsg = "Invalid API key";
      else if (status === 429) errorMsg = "AI models are busy. Please retry.";
      else if (status === 504) errorMsg = "AI request timed out. Please retry.";
      else if (status >= 500) errorMsg = "AI provider server error";
      return { ok: false, provider: DEFAULT_PROVIDER_LABEL, error: errorMsg };
    }

    const data = result.data;
    const text = extractAssistantText(data);

    if (!text) {
      return { ok: false, provider: DEFAULT_PROVIDER_LABEL, error: "Empty AI response." };
    }

    let englishOnlySummary = enforceEnglishOnlySummary(text);
    let provider = providerLabel(result.provider, result.model);

    if (!summaryLooksComplete(englishOnlySummary)) {
      const retry = await requestChatCompletionWithFallback({
        messages: [
          { role: "system", content: SUMMARY_SYSTEM_PROMPT },
          { role: "user", content: buildSummaryUserPrompt(article) }
        ],
        ...SUMMARY_MODEL_PARAMS,
        max_tokens: 1200
      });

      if (retry.ok) {
        const retryText = extractAssistantText(retry.data);
        if (retryText) {
          englishOnlySummary = enforceEnglishOnlySummary(retryText);
          provider = providerLabel(retry.provider, retry.model);
        }
      }
    }

    return { ok: true, provider, summary: englishOnlySummary || "SUMMARY\nUNKNOWN" };
  } catch (error) {
    return {
      ok: false,
      provider: DEFAULT_PROVIDER_LABEL,
      error: error instanceof Error ? error.message : "AI request failed"
    };
  }
}

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const CHAT_MODEL_PARAMS = {
  temperature: 0.4,
  top_p: 0.9,
  max_tokens: 950,
  stream: false
};

type ChatCompletionPayload = {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature: number;
  top_p: number;
  max_tokens: number;
  stream: boolean;
};

function extractAssistantText(data: { choices?: Array<{ message?: { content?: unknown; reasoning?: unknown }; delta?: { content?: unknown } }> }) {
  const choice = data.choices?.[0];
  if (!choice) return "";

  const messageContent = choice.message?.content;
  if (typeof messageContent === "string") return messageContent.trim();

  if (Array.isArray(messageContent)) {
    const joined = messageContent
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          const value = (part as { text?: unknown }).text;
          return typeof value === "string" ? value : "";
        }
        return "";
      })
      .join("")
      .trim();
    if (joined) return joined;
  }

  const deltaContent = choice.delta?.content;
  if (typeof deltaContent === "string" && deltaContent.trim()) return deltaContent.trim();

  const reasoning = choice.message?.reasoning;
  if (typeof reasoning === "string" && reasoning.trim()) return reasoning.trim();

  return "";
}

function summaryLooksComplete(text: string) {
  const requiredSections = ["SUMMARY", "KEY CLAIMS", "CONFIDENCE", "BIAS & FRAMING", "IMPACT", "CRITICAL READ", "VERDICT", "AI PERSPECTIVE"];
  return requiredSections.every((section) => text.includes(section));
}

function debateLooksComplete(text: string) {
  const requiredSections = ["Response:", "Reasoning:", "Counterpoint:", "Follow-up:"];
  return requiredSections.every((section) => text.includes(section));
}

async function requestChatCompletionWithFallback(
  payload: ChatCompletionPayload
): Promise<
  | { ok: true; provider: ProviderTarget["provider"]; model: string; data: { choices?: Array<{ message?: { content?: string } }> } }
  | { ok: false; status?: number }
> {
  const targets = getProviderTargets();
  if (!targets.length) {
    return { ok: false, status: 401 };
  }

  let lastStatus: number | undefined;

  for (const target of targets) {
    for (const model of target.models) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${target.apiKey}`,
          "Content-Type": "application/json"
        };
        if (target.provider === "openrouter") {
          headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
          headers["X-Title"] = "Live Update News";
        }

        const response = await fetch(`${target.baseUrl}/chat/completions`, {
          method: "POST",
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            model,
            ...payload
          })
        });
        clearTimeout(timeout);

        if (response.ok) {
          const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
          return { ok: true, provider: target.provider, model, data };
        }

        lastStatus = response.status;
        if (response.status === 401 || response.status === 400 || response.status === 403) {
          break;
        }
      } catch {
        clearTimeout(timeout);
      }
    }
  }

  return { ok: false, status: lastStatus };
}

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

REASONING METHOD (MANDATORY)
- First identify the strongest claim and the weakest claim in the article context.
- Separate observed facts from interpretations.
- Provide one steelman counterpoint (best opposing interpretation, not a strawman).
- Flag one key uncertainty that would materially change the conclusion.
- If evidence is insufficient, say UNKNOWN rather than filling gaps.

LANGUAGE HANDLING
- The Article-Language field tells you the source language.
- Reply in English only, regardless of the user's input language.
- When the article is Hindi but the user asks in English (or vice versa), quote the original Hindi phrase verbatim AND give an English gloss in parentheses, e.g., 'दावा है (claims that) ...'. Never silently translate.
- If the article is Hindi and you are unsure of an exact translation, say so instead of guessing.
- Apply the same skepticism in any language. Hindi sensational vocabulary (चौंकाने, सनसनीखेज, धमाकेदार, पर्दाफाश, खुलासा, etc.) is treated identically to English clickbait.

ANTI-HALLUCINATION HARD RULES
- Never fabricate names, dates, numbers, quotes, or legal claims.
- Never imply certainty when evidence is partial.
- If the article lacks enough detail, state limitation clearly in Reasoning.
- Distinguish fact from interpretation.

STYLE RULES
- Keep each section compact but complete (2 to 6 lines).
- Avoid filler phrases.
- Ask one concrete follow-up question.
- Stay neutral in tone; be critical in method.
- Prefer short, high-information sentences over long explanations.

OUTPUT FORMAT (MANDATORY)
Return plain English text with these exact section labels and order:

Response:
<Direct answer or argument>

Reasoning:
<Why this answer is justified, including strongest evidence, weakest assumption, and key uncertainty>

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
  if (!getProviderTargets().length) {
    return { ok: false, error: "No AI provider key configured. Set GROQ_API_KEY or OPENROUTER_API_KEY." };
  }
  const systemPrompt = buildDebateSystemPrompt(article);

  // Trim to last 6 messages
  const trimmedMessages = messages.slice(-6);

  try {
    const result = await requestChatCompletionWithFallback({
      messages: [{ role: "system", content: systemPrompt }, ...trimmedMessages],
      ...CHAT_MODEL_PARAMS
    });

    if (!result.ok) {
      const status = result.status ?? 504;
      if (status === 429) return { ok: false, error: "AI models are busy. Please retry." };
      if (status === 504) return { ok: false, error: "AI request timed out. Please retry." };
      return { ok: false, error: `API error ${status}` };
    }

    const data = result.data;
    const text = extractAssistantText(data);

    if (!text) {
      return { ok: false, error: "Empty AI response." };
    }

    let debateReply = enforceEnglishOnlySummary(text) || "Response:\nUNKNOWN";

    // Retry once with larger completion budget if required sections are truncated.
    if (!debateLooksComplete(debateReply)) {
      const retry = await requestChatCompletionWithFallback({
        messages: [{ role: "system", content: systemPrompt }, ...trimmedMessages],
        ...CHAT_MODEL_PARAMS,
        max_tokens: 1100
      });
      if (retry.ok) {
        const retryText = extractAssistantText(retry.data);
        if (retryText) {
          debateReply = enforceEnglishOnlySummary(retryText) || debateReply;
        }
      }
    }

    return { ok: true, reply: debateReply };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Chat request failed" };
  }
}