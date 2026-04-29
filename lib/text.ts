const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"'
};

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "amid",
  "from",
  "have",
  "into",
  "more",
  "over",
  "said",
  "says",
  "than",
  "that",
  "their",
  "this",
  "with",
  "will",
  "your"
]);

export function decodeHtml(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (_, name: string) => HTML_ENTITIES[name.toLowerCase()] ?? `&${name};`);
}

export function stripHtml(value = "") {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeWhitespace(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeTitle(value = "") {
  return normalizeWhitespace(stripHtml(value))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\b(live|updates?|breaking|latest)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

import type { ArticleLanguage } from "./types";

export type { ArticleLanguage };

export function detectArticleLanguage(value = ""): ArticleLanguage {
  const text = stripHtml(value);
  if (!text) {
    return "en";
  }

  let latin = 0;
  let devanagari = 0;
  let otherLetter = 0;

  for (const char of text) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;
    if ((code >= 0x0041 && code <= 0x007a) || (code >= 0x00c0 && code <= 0x024f)) {
      latin += 1;
    } else if (code >= 0x0900 && code <= 0x097f) {
      devanagari += 1;
    } else if (/\p{L}/u.test(char)) {
      otherLetter += 1;
    }
  }

  const totalLetters = latin + devanagari + otherLetter;
  if (totalLetters === 0) {
    return "en";
  }

  if (devanagari / totalLetters >= 0.3) {
    return "hi";
  }

  if (latin / totalLetters >= 0.7) {
    return "en";
  }

  return "other";
}

export function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

export function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function titleTokens(value: string) {
  return normalizeTitle(value)
    .split(" ")
    .filter((token) => token.length > 3 && !STOP_WORDS.has(token));
}

export function titlesLookSimilar(first: string, second: string) {
  const firstTokens = titleTokens(first);
  const secondTokens = titleTokens(second);

  if (firstTokens.length < 4 || secondTokens.length < 4) {
    return normalizeTitle(first) === normalizeTitle(second);
  }

  const secondSet = new Set(secondTokens);
  const shared = firstTokens.filter((token) => secondSet.has(token)).length;
  const score = shared / Math.min(firstTokens.length, secondTokens.length);
  return score >= 0.56;
}

export function cleanUrl(value = "") {
  try {
    const url = new URL(value);
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((param) => {
      url.searchParams.delete(param);
    });
    return url.toString();
  } catch {
    return value;
  }
}
