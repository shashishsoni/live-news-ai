import { DEFAULT_ARTICLE_LIMIT, FACT_CHECK_CATEGORIES, GLOBAL_CATEGORIES, INDIA_CATEGORIES, NEWS_CACHE_SECONDS } from "@/lib/config";
import { detectSensationalLanguage } from "@/lib/ai";
import { lookupSourceProfile, TRUSTED_RSS_FEEDS, type TrustedFeed, type TrustedSourceProfile } from "@/lib/sources";
import { cleanUrl, decodeHtml, detectArticleLanguage, getDomain, hashString, normalizeTitle, stripHtml, titlesLookSimilar, type ArticleLanguage } from "@/lib/text";
import type { ContentRegion, FactCheckLabel, NewsArticle, NewsQuery, NewsResult, SourceKind, VerificationStatus } from "@/lib/types";

type RawArticle = {
  title: string;
  description?: string;
  url: string;
  imageUrl?: string;
  sourceName: string;
  sourceUrl?: string;
  sourceKind: SourceKind;
  sourceReputation: number;
  author?: string;
  publishedAt?: string;
  categories: string[];
  region: ContentRegion;
};

type FetchOutcome = {
  articles: NewsArticle[];
  errors: string[];
};

type RiskDetection = {
  riskCues: string[];
  riskPenalty: number;
  hasHighRisk: boolean;
  hasMediumRisk: boolean;
};

const HIGH_RISK_CUES = new Set(["no evidence", "allegedly/claimed", "fake/false"]);
const MEDIUM_RISK_CUES = new Set(["viral", "screenshot", "video/footage"]);

function applyRiskCueCap(confidence: number, riskCues: string[] | undefined): number {
  if (!riskCues?.length) return confidence;
  const hasHighRisk = riskCues.some((cue) => HIGH_RISK_CUES.has(cue));
  if (hasHighRisk) return Math.min(confidence, 84);
  const hasMediumRisk = riskCues.some((cue) => MEDIUM_RISK_CUES.has(cue));
  if (hasMediumRisk) return Math.min(confidence, 86);
  return confidence;
}

function statusForConfidence(confidence: number): VerificationStatus {
  if (confidence >= 88) return "Verified";
  if (confidence >= 76) return "Developing";
  return "Unverified";
}

export async function getNews(query: NewsQuery = {}): Promise<NewsResult> {
  const limit = query.limit ?? DEFAULT_ARTICLE_LIMIT;
  const [rssOutcome, apiOutcome] = await Promise.all([fetchRssArticles(query), fetchApiArticles(query)]);
  const errors = [...rssOutcome.errors, ...apiOutcome.errors];
  const combined = [...rssOutcome.articles, ...apiOutcome.articles];
  const checked = crossCheckArticles(combined);
  const deduped = dedupeArticles(checked);
  const filtered = deduped
    .filter((article) => (query.region ? article.region === query.region : true))
    .filter((article) => (query.category ? article.category === query.category : true))
    .filter((article) => matchesSearch(article, query.query))
    .filter((article) => query.includeUnverified || article.verificationStatus !== "Unverified")
    .sort((first, second) => new Date(second.publishedAt).getTime() - new Date(first.publishedAt).getTime())
    .slice(0, limit);

  return {
    articles: filtered,
    lastUpdated: new Date().toISOString(),
    errors
  };
}

export async function getFactChecks(query: Omit<NewsQuery, "region"> = {}) {
  return getNews({ ...query, region: "fact-check", includeUnverified: true });
}

async function fetchRssArticles(query: NewsQuery): Promise<FetchOutcome> {
  const feeds = getConfiguredFeeds().filter((feed) => shouldUseFeed(feed, query));
  const settled = await Promise.allSettled(feeds.map((feed) => fetchSingleRssFeed(feed)));
  const errors: string[] = [];
  const articles: NewsArticle[] = [];

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      articles.push(...result.value);
      return;
    }

    const feed = feeds[index];
    const errorMessage = result.reason instanceof Error ? result.reason.message : "fetch failed";
    if (feed && shouldReportFeedError(feed, errorMessage)) {
      errors.push(`${feed.name}: ${errorMessage}`);
    }
  });

  return { articles, errors };
}

function shouldReportFeedError(feed: TrustedFeed, errorMessage: string) {
  // AFP Fact Check frequently blocks server-side RSS requests with HTTP 403.
  // This is an upstream anti-bot restriction and should not show as a platform error.
  if (feed.name === "AFP Fact Check" && errorMessage.includes("HTTP 403")) {
    return false;
  }
  return true;
}

function getConfiguredFeeds() {
  const customFeeds = process.env.TRUSTED_RSS_FEEDS;
  if (!customFeeds) {
    return TRUSTED_RSS_FEEDS;
  }

  try {
    const parsed = JSON.parse(customFeeds) as TrustedFeed[];
    const validFeeds = parsed.filter((feed) => feed.name && feed.url && feed.homepage && feed.region && feed.kind && Array.isArray(feed.categories));
    return [...TRUSTED_RSS_FEEDS, ...validFeeds];
  } catch {
    return TRUSTED_RSS_FEEDS;
  }
}

function shouldUseFeed(feed: TrustedFeed, query: NewsQuery) {
  if (query.region && feed.region !== query.region) {
    return false;
  }
  return true;
}

function detectRiskCues(input: string, language: ArticleLanguage, sourceKind: SourceKind): RiskDetection {
  const text = input;
  const riskCues: string[] = [];

  const addCue = (cue: string, penalty: number, severity: "high" | "medium") => {
    if (riskCues.includes(cue)) return;
    riskCues.push(cue);
    riskPenalty += penalty;
    if (severity === "high") hasHighRisk = true;
    if (severity === "medium") hasMediumRisk = true;
  };

  // Derived from the detected cues.
  let hasHighRisk = false;
  let hasMediumRisk = false;
  let riskPenalty = 0;

  const maybeEnglish = language === "en" || /[a-z]/i.test(text);
  const maybeHindi = language === "hi" || /[\u0900-\u097F]/.test(text);

  // For fact-checker feeds, we still detect cues, but apply milder penalties later.
  const penaltyScale = sourceKind === "fact-checker" ? 0.6 : 1;

  if (maybeEnglish) {
    if (/\b(allegedly|it is claimed|it is said)\b/i.test(text)) {
      addCue("allegedly/claimed", Math.floor(10 * penaltyScale), "high");
    }

    if (/\b(no evidence|without evidence|no proof|lack of evidence)\b/i.test(text)) {
      addCue("no evidence", Math.floor(14 * penaltyScale), "high");
    }

    if (/\b(fake|false|hoax|fraud)\b/i.test(text)) {
      addCue("fake/false", Math.floor(10 * penaltyScale), "high");
    }

    if (/\b(viral|trending)\b/i.test(text)) {
      addCue("viral", Math.floor(6 * penaltyScale), "medium");
    }

    if (/\b(screenshot|screenshots)\b/i.test(text)) {
      addCue("screenshot", Math.floor(6 * penaltyScale), "medium");
    }

    if (/\b(video|footage|clip)\b/i.test(text)) {
      addCue("video/footage", Math.floor(6 * penaltyScale), "medium");
    }
  }

  if (maybeHindi) {
    if (/(कथित|दावा है|कहा जा रहा|बताया जा रहा)/.test(text)) {
      addCue("alleged/claimed", Math.floor(10 * penaltyScale), "high");
    }

    if (/(बिना सबूत|कोई सबूत नहीं|बिना प्रमाण|प्रमाण नहीं)/.test(text)) {
      addCue("no evidence", Math.floor(14 * penaltyScale), "high");
    }

    if (/(फर्जी|झूठ|मिथ्या|फेक)/.test(text)) {
      addCue("fake/false", Math.floor(10 * penaltyScale), "high");
    }

    if (/(वायरल|ट्रेंडिंग)/.test(text)) {
      addCue("viral", Math.floor(6 * penaltyScale), "medium");
    }

    if (/स्क्रीनशॉट/.test(text)) {
      addCue("screenshot", Math.floor(6 * penaltyScale), "medium");
    }

    if (/(वीडियो|क्लिप|फुटेज)/.test(text)) {
      addCue("video/footage", Math.floor(6 * penaltyScale), "medium");
    }
  }

  riskPenalty = Math.min(24, riskPenalty);

  return {
    riskCues,
    riskPenalty,
    hasHighRisk,
    hasMediumRisk
  };
}

async function fetchSingleRssFeed(feed: TrustedFeed) {
  const response = await fetch(feed.url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/rss+xml, application/xml, text/xml"
    },
    next: { revalidate: NEWS_CACHE_SECONDS }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const xml = await response.text();
  const items = parseRssItems(xml).slice(0, 20);

  return items.map((item) =>
    normalizeRawArticle({
      title: item.title,
      description: item.description,
      url: item.link,
      imageUrl: item.imageUrl,
      sourceName: feed.name,
      sourceUrl: feed.homepage,
      sourceKind: feed.kind,
      sourceReputation: feed.reputation,
      author: item.author,
      publishedAt: item.publishedAt,
      categories: feed.categories,
      region: feed.region
    })
  );
}

function parseRssItems(xml: string) {
  const blocks = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  const atomBlocks = blocks.length ? [] : [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]);

  return [...blocks, ...atomBlocks]
    .map((block) => {
      const title = extractTag(block, "title");
      const link = extractLink(block);
      const descriptionCandidates = [
        extractTag(block, "description"),
        extractTag(block, "summary"),
        extractTag(block, "subtitle"),
        extractTag(block, "content:encoded"),
        extractTag(block, "dc:description"),
        extractTag(block, "media:description"),
        extractTag(block, "media:text"),
        extractTag(block, "itunes:summary")
      ];
      const description = pickFirstNonEmpty(descriptionCandidates.map((value) => stripHtml(value)));
      const publishedAt = extractTag(block, "pubDate") || extractTag(block, "updated") || extractTag(block, "published");
      const author = extractTag(block, "dc:creator") || extractTag(block, "author");
      const imageUrl = extractImage(block);

      return {
        title: stripHtml(title),
        link: cleanUrl(stripHtml(link)),
        description,
        publishedAt: stripHtml(publishedAt),
        author: stripHtml(author),
        imageUrl
      };
    })
    .filter((item) => item.title && item.link);
}

function extractTag(block: string, tag: string) {
  const escapedTag = tag.replace(":", "\\:");
  const regex = new RegExp(`<${escapedTag}[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, "i");
  return decodeHtml(block.match(regex)?.[1] ?? "");
}

function pickFirstNonEmpty(values: string[]): string {
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return "";
}

function extractLink(block: string) {
  const linkTag = extractTag(block, "link");
  if (linkTag) {
    return linkTag;
  }

  return decodeHtml(block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] ?? "");
}

function extractImage(block: string) {
  const mediaMatch = block.match(/<media:(?:content|thumbnail)[^>]+url=["']([^"']+)["'][^>]*>/i);
  const enclosureMatch = block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*>/i);
  return cleanUrl(decodeHtml(mediaMatch?.[1] ?? enclosureMatch?.[1] ?? "")) || undefined;
}

async function fetchApiArticles(query: NewsQuery): Promise<FetchOutcome> {
  const providers = [fetchGuardianArticles(query), fetchNytArticles(query), fetchNewsApiArticles(query), fetchGNewsArticles(query), fetchMediaStackArticles(query)];
  const settled = await Promise.allSettled(providers);
  const articles: NewsArticle[] = [];
  const errors: string[] = [];

  settled.forEach((result) => {
    if (result.status === "fulfilled") {
      articles.push(...result.value.articles);
      errors.push(...result.value.errors);
    } else {
      errors.push(result.reason instanceof Error ? result.reason.message : "API provider failed");
    }
  });

  return { articles, errors };
}

async function fetchGuardianArticles(query: NewsQuery): Promise<FetchOutcome> {
  const key = process.env.GUARDIAN_API_KEY;
  if (!key || query.region === "fact-check" || query.region === "india") {
    return { articles: [], errors: [] };
  }

  const section = guardianSectionFor(query.category);
  const searchQuery = [query.query, query.category].filter(Boolean).join(" ");
  const params = new URLSearchParams({
    "api-key": key,
    "show-fields": "thumbnail,trailText,byline",
    "page-size": "20",
    "order-by": "newest"
  });

  if (section) {
    params.set("section", section);
  }

  if (searchQuery) {
    params.set("q", searchQuery);
  }

  try {
    const data = await fetchJson<{
      response?: { results?: Array<{ webTitle: string; webUrl: string; webPublicationDate: string; sectionName?: string; fields?: { thumbnail?: string; trailText?: string; byline?: string } }> };
    }>(`https://content.guardianapis.com/search?${params.toString()}`);

    const articles = (data.response?.results ?? []).map((item) =>
      normalizeRawArticle({
        title: item.webTitle,
        description: item.fields?.trailText,
        url: item.webUrl,
        imageUrl: item.fields?.thumbnail,
        sourceName: "The Guardian",
        sourceUrl: "https://www.theguardian.com/international",
        sourceKind: "established-media",
        sourceReputation: 84,
        author: item.fields?.byline,
        publishedAt: item.webPublicationDate,
        categories: [query.category ?? mapGuardianSection(item.sectionName), item.sectionName ?? ""].filter(Boolean),
        region: query.region === "india" ? "india" : "global"
      })
    );

    return { articles, errors: [] };
  } catch (error) {
    return { articles: [], errors: [`The Guardian API: ${error instanceof Error ? error.message : "request failed"}`] };
  }
}

async function fetchNytArticles(query: NewsQuery): Promise<FetchOutcome> {
  const key = process.env.NYT_API_KEY;
  if (!key || query.region === "fact-check" || query.region === "india") {
    return { articles: [], errors: [] };
  }

  const section = nytSectionFor(query.category);

  try {
    const data = await fetchJson<{
      results?: Array<{ title: string; abstract?: string; url: string; published_date?: string; byline?: string; multimedia?: Array<{ url?: string }> }>;
    }>(`https://api.nytimes.com/svc/topstories/v2/${section}.json?api-key=${key}`);

    const articles = (data.results ?? []).map((item) =>
      normalizeRawArticle({
        title: item.title,
        description: item.abstract,
        url: item.url,
        imageUrl: item.multimedia?.find((media) => media.url)?.url,
        sourceName: "The New York Times",
        sourceUrl: "https://www.nytimes.com",
        sourceKind: "established-media",
        sourceReputation: 84,
        author: item.byline,
        publishedAt: item.published_date,
        categories: [query.category ?? section],
        region: "global"
      })
    );

    return { articles, errors: [] };
  } catch (error) {
    return { articles: [], errors: [`NYT API: ${error instanceof Error ? error.message : "request failed"}`] };
  }
}

async function fetchNewsApiArticles(query: NewsQuery): Promise<FetchOutcome> {
  const key = process.env.NEWSAPI_KEY;
  if (!key || query.region === "fact-check") {
    return { articles: [], errors: [] };
  }

  const params = new URLSearchParams({ apiKey: key, language: "en", pageSize: "30" });
  if (query.region === "india") {
    params.set("country", "in");
  }
  if (query.query || query.category) {
    params.set("q", [query.query, query.category].filter(Boolean).join(" "));
  }

  try {
    const data = await fetchJson<{
      articles?: Array<{ title?: string; description?: string; url?: string; urlToImage?: string; publishedAt?: string; author?: string; source?: { name?: string } }>;
    }>(`https://newsapi.org/v2/top-headlines?${params.toString()}`);

    const articles = (data.articles ?? []).flatMap((item) => mapApiAggregatorArticle(item, query, "NewsAPI"));
    return { articles, errors: [] };
  } catch (error) {
    return { articles: [], errors: [`NewsAPI: ${error instanceof Error ? error.message : "request failed"}`] };
  }
}

async function fetchGNewsArticles(query: NewsQuery): Promise<FetchOutcome> {
  const key = process.env.GNEWS_API_KEY;
  if (!key || query.region === "fact-check") {
    return { articles: [], errors: [] };
  }

  const params = new URLSearchParams({ apikey: key, lang: "en", max: "20" });
  if (query.region === "india") {
    params.set("country", "in");
  }
  if (query.query || query.category) {
    params.set("q", [query.query, query.category].filter(Boolean).join(" "));
  }

  try {
    const data = await fetchJson<{
      articles?: Array<{ title?: string; description?: string; url?: string; image?: string; publishedAt?: string; source?: { name?: string; url?: string } }>;
    }>(`https://gnews.io/api/v4/top-headlines?${params.toString()}`);

    const articles = (data.articles ?? []).flatMap((item) => mapApiAggregatorArticle(item, query, "GNews"));
    return { articles, errors: [] };
  } catch (error) {
    return { articles: [], errors: [`GNews: ${error instanceof Error ? error.message : "request failed"}`] };
  }
}

async function fetchMediaStackArticles(query: NewsQuery): Promise<FetchOutcome> {
  const key = process.env.MEDIASTACK_KEY;
  if (!key || query.region === "fact-check") {
    return { articles: [], errors: [] };
  }

  const params = new URLSearchParams({ access_key: key, languages: "en", limit: "30", sort: "published_desc" });
  if (query.region === "india") {
    params.set("countries", "in");
  }
  if (query.query || query.category) {
    params.set("keywords", [query.query, query.category].filter(Boolean).join(" "));
  }

  try {
    const data = await fetchJson<{
      data?: Array<{ title?: string; description?: string; url?: string; image?: string; published_at?: string; author?: string; source?: string; category?: string }>;
    }>(`https://api.mediastack.com/v1/news?${params.toString()}`);

    const articles = (data.data ?? []).flatMap((item) =>
      mapApiAggregatorArticle(
        {
          title: item.title,
          description: item.description,
          url: item.url,
          image: item.image,
          publishedAt: item.published_at,
          author: item.author,
          source: { name: item.source }
        },
        { ...query, category: query.category ?? item.category },
        "MediaStack"
      )
    );
    return { articles, errors: [] };
  } catch (error) {
    return { articles: [], errors: [`MediaStack: ${error instanceof Error ? error.message : "request failed"}`] };
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: NEWS_CACHE_SECONDS }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function mapApiAggregatorArticle(
  item: { title?: string; description?: string; url?: string; urlToImage?: string; image?: string; publishedAt?: string; author?: string; source?: { name?: string; url?: string } },
  query: NewsQuery,
  provider: string
) {
  if (!item.title || !item.url) {
    return [];
  }

  const sourceName = item.source?.name ?? provider;
  const profile = lookupSourceProfile(sourceName);
  const reputation = profile?.reputation ?? 64;

  return [
    normalizeRawArticle({
      title: item.title,
      description: item.description,
      url: item.url,
      imageUrl: item.urlToImage ?? item.image,
      sourceName,
      sourceUrl: item.source?.url ?? profile?.homepage ?? `https://${getDomain(item.url)}`,
      sourceKind: profile?.kind ?? "api",
      sourceReputation: reputation,
      author: item.author,
      publishedAt: item.publishedAt,
      categories: [query.category ?? inferCategory(`${item.title} ${item.description ?? ""}`, [], query.region)],
      region: query.region === "india" ? "india" : "global"
    })
  ];
}

function normalizeRawArticle(raw: RawArticle): NewsArticle {
  const title = stripHtml(raw.title);
  const description = stripHtml(raw.description ?? "");
  const publishedAt = normalizeDate(raw.publishedAt);
  const sensational = detectSensationalLanguage(`${title} ${description}`);
  const category = inferCategory(`${title} ${description}`, raw.categories, raw.region);
  const isOpinion = /opinion|editorial|column|analysis/i.test(`${raw.url} ${category}`);
  const language = detectArticleLanguage(`${title} ${description}`);
  const risk = detectRiskCues(`${title} ${description} ${raw.url} ${category}`, language, raw.sourceKind);
  const verification = scoreVerification(raw.sourceReputation, raw.sourceKind, sensational.hasSensationalLanguage, isOpinion, language, raw.region, risk);
  const factCheckLabel = getFactCheckLabel(raw.sourceKind, sensational.hasSensationalLanguage, verification.status);
  const url = cleanUrl(raw.url);
  const warning = buildArticleWarning(sensational.hasSensationalLanguage, language, raw.region, risk.riskCues);

  return {
    id: `news_${hashString(`${url}-${title}-${raw.sourceName}`)}`,
    title,
    description,
    url,
    imageUrl: raw.imageUrl ? cleanUrl(raw.imageUrl) : undefined,
    sourceName: raw.sourceName,
    sourceUrl: raw.sourceUrl,
    sourceKind: raw.sourceKind,
    author: raw.author ? stripHtml(raw.author) : undefined,
    publishedAt,
    category,
    region: raw.region,
    verificationStatus: verification.status,
    confidence: verification.confidence,
    factCheckLabel,
    warning,
    riskCues: risk.riskCues.length ? risk.riskCues : undefined,
    language,
    isOpinion,
    citations: [{ name: raw.sourceName, url }],
    matchedSources: [raw.sourceName]
  };
}

function buildArticleWarning(
  sensational: boolean,
  language: ArticleLanguage,
  region: ContentRegion,
  riskCues?: string[]
): string | undefined {
  const notes: string[] = [];
  if (sensational) {
    notes.push("Potentially sensational wording detected.");
  }
  if (region === "global" && language !== "en") {
    notes.push("Global feed is expected to be English; non-English content gets extra caution.");
  } else if (region === "india" && language === "other") {
    notes.push("Non-English (non-Hindi/English) content in India feed; treat confidence with extra caution.");
  }
  if (riskCues?.length) {
    notes.push(`Headline/metadata includes risk cues: ${riskCues.join(", ")}.`);
  }
  if (!notes.length) {
    return undefined;
  }
  return `${notes.join(" ")} Read the original source and look for corroboration.`;
}

function scoreVerification(
  sourceReputation: number,
  sourceKind: SourceKind,
  sensational: boolean,
  isOpinion: boolean,
  language: ArticleLanguage,
  region: ContentRegion,
  risk: RiskDetection
): { status: VerificationStatus; confidence: number } {
  let confidence = sourceReputation;
  if (sourceKind === "official" || sourceKind === "fact-checker" || sourceKind === "wire") {
    confidence += 4;
  }
  if (sensational) {
    confidence -= 14;
  }
  if (isOpinion) {
    confidence -= 10;
  }
  // Language affects auditability because the heuristics here are headline/metadata-based.
  // Global feed is expected to be English; India feed accepts both English and Hindi.
  if (region === "global" && language !== "en") {
    confidence -= 12;
  }
  if (region === "india" && language === "other") {
    confidence -= 8;
  }

  if (risk.riskPenalty) {
    const scaled = sourceKind === "fact-checker" ? Math.floor(risk.riskPenalty / 2) : risk.riskPenalty;
    confidence -= scaled;
  }

  confidence = Math.max(20, Math.min(98, confidence));

  if (region === "global" && language !== "en" && confidence > 84) {
    confidence = 84;
  }
  if (region === "india" && language === "other" && confidence > 84) {
    confidence = 84;
  }

  // Strictness: if risk cues exist, cap how high the confidence can go.
  // This prevents "high reputation" sources + vague/viral framing from being marked Verified.
  confidence = applyRiskCueCap(confidence, risk.riskCues);

  return { status: statusForConfidence(confidence), confidence };
}

function getFactCheckLabel(sourceKind: SourceKind, sensational: boolean, verificationStatus: VerificationStatus): FactCheckLabel {
  if (sourceKind === "fact-checker") {
    return "Fact-check source";
  }
  if (sensational) {
    return "Needs context";
  }
  if (verificationStatus === "Unverified") {
    return "Unverified claim";
  }
  return "No known dispute";
}

function crossCheckArticles(articles: NewsArticle[]) {
  return articles.map((article, index) => {
    const matches = articles.filter(
      (candidate, candidateIndex) =>
        candidateIndex !== index && candidate.sourceName !== article.sourceName && candidate.region === article.region && titlesLookSimilar(candidate.title, article.title)
    );

    if (!matches.length) {
      return article;
    }

    const citations = mergeCitations(article.citations, matches.flatMap((match) => match.citations));
    const matchedSources = Array.from(new Set([article.sourceName, ...matches.map((match) => match.sourceName)]));
    let confidence = Math.min(98, Math.max(article.confidence, 86) + Math.min(8, matches.length * 3));
    // Strictness: if the article headline/metadata looks low-evidence/viral,
    // keep it below "Verified" even if multiple outlets share similar titles.
    confidence = applyRiskCueCap(confidence, article.riskCues);

    return {
      ...article,
      confidence,
      verificationStatus: statusForConfidence(confidence),
      citations,
      matchedSources
    };
  });
}

function dedupeArticles(articles: NewsArticle[]) {
  const deduped: NewsArticle[] = [];

  articles.forEach((article) => {
    const existing = deduped.find((candidate) => candidate.url === article.url || titlesLookSimilar(candidate.title, article.title));

    if (!existing) {
      deduped.push(article);
      return;
    }

    existing.citations = mergeCitations(existing.citations, article.citations);
    existing.matchedSources = Array.from(new Set([...existing.matchedSources, ...article.matchedSources]));
    existing.confidence = Math.max(existing.confidence, article.confidence);
    if (article.riskCues?.length) {
      existing.riskCues = Array.from(new Set([...(existing.riskCues ?? []), ...article.riskCues]));
    }
    if (existing.matchedSources.length > 1) {
      // Strictness cap after merging confidence/cues, then derive status from confidence.
      existing.confidence = applyRiskCueCap(existing.confidence, existing.riskCues);
      existing.verificationStatus = statusForConfidence(existing.confidence);
    }
  });

  return deduped;
}

function mergeCitations(first: NewsArticle["citations"], second: NewsArticle["citations"]) {
  const seen = new Set<string>();
  return [...first, ...second].filter((citation) => {
    const key = `${citation.name}-${citation.url}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function matchesSearch(article: NewsArticle, query?: string) {
  if (!query) {
    return true;
  }
  const haystack = `${article.title} ${article.description} ${article.sourceName} ${article.category}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function normalizeDate(value?: string) {
  if (!value) {
    return new Date().toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function inferCategory(text: string, categories: string[], region?: ContentRegion) {
  const knownCategories = region === "india" ? INDIA_CATEGORIES : region === "fact-check" ? FACT_CHECK_CATEGORIES : GLOBAL_CATEGORIES;
  const lower = text.toLowerCase();
  const keywordMap: Array<[string, string[]]> = [
    ["Technology", ["ai", "artificial intelligence", "technology", "tech", "software", "cyber", "semiconductor", "startup", "algorithm", "robotics", "smartphone", "fintech", "cybersecurity", "gadget"]],
    ["Science", ["science", "space", "research", "study", "nasa", "isro", "physics", "biology", "astronomy", "scientific", "scientists", "discovery", "quantum"]],
    ["Climate", ["climate", "emissions", "global warming", "pollution", "carbon", "environment", "sustainability", "renewable energy", "greenhouse gas", "climate change"]],
    ["Health", ["health", "hospital", "medicine", "virus", "disease", "vaccine", "medical", "cancer", "treatment", "outbreak", "pandemic", "healthcare", "symptoms", "clinic"]],
    ["Business", ["business", "market", "stock", "company", "trade", "earnings", "corporate", "investment", "investors", "ceo", "revenue", "merger", "acquisition"]],
    ["Economy", ["economy", "inflation", "gdp", "rupee", "dollar", "jobs", "economic", "recession", "unemployment", "interest rates", "central bank", "fiscal"]],
    ["Sports", ["sport", "sports", "cricket", "football", "tennis", "olympic", "olympics", "tournament", "championship", "bcci", "fifa", "athlete", "match", "stadium"]],
    ["Government policy", ["policy", "cabinet", "ministry", "scheme", "government", "parliament", "legislation", "minister", "prime minister", "president", "governor", "assembly"]],
    ["Law and courts", ["court", "judge", "supreme court", "high court", "law", "legal", "justice", "tribunal", "verdict", "hearing", "bail", "lawsuit", "prosecution", "litigation"]],
    ["Education", ["school", "college", "university", "exam", "education", "student", "teacher", "curriculum", "campus", "tuition", "academic", "syllabus"]],
    ["Weather and disasters", ["weather", "cyclone", "rain", "flood", "earthquake", "landslide", "storm", "hurricane", "tsunami", "monsoon", "disaster", "meteorological", "wildfire", "heatwave"]],
    ["Entertainment", ["film", "movie", "actor", "actress", "entertainment", "music", "hollywood", "bollywood", "celebrity", "cinema", "director", "box office"]],
    ["Conflict and diplomacy", ["war", "ceasefire", "diplomacy", "military", "conflict", "border", "troops", "defense", "treaty", "ambassador", "sanctions", "peace", "missile"]],
    ["Culture and society", ["culture", "society", "rights", "migration", "community", "heritage", "festival", "tradition", "diversity", "social", "demographics"]]
  ];

  const match = keywordMap.find(([category, keywords]) => knownCategories.includes(category) && keywords.some((keyword) => new RegExp(`\\b${keyword}\\b`, "i").test(text)));
  if (match) {
    return match[0];
  }

  const explicit = categories.find((category) => knownCategories.includes(category));
  if (explicit) {
    return explicit;
  }

  return region === "india" ? "National news" : region === "fact-check" ? "Fact checks" : "World politics";
}

function guardianSectionFor(category?: string) {
  const map: Record<string, string> = {
    Business: "business",
    Climate: "environment",
    Science: "science",
    Sports: "sport",
    Technology: "technology",
    Health: "society",
    "Culture and society": "culture",
    "World politics": "world",
    "Conflict and diplomacy": "world"
  };
  return category ? map[category] : undefined;
}

function mapGuardianSection(section?: string) {
  const lower = section?.toLowerCase() ?? "";
  if (lower.includes("business")) return "Business";
  if (lower.includes("technology")) return "Technology";
  if (lower.includes("science")) return "Science";
  if (lower.includes("environment")) return "Climate";
  if (lower.includes("sport")) return "Sports";
  if (lower.includes("culture")) return "Culture and society";
  return "World politics";
}

function nytSectionFor(category?: string) {
  const map: Record<string, string> = {
    Business: "business",
    Climate: "climate",
    Science: "science",
    Sports: "sports",
    Technology: "technology",
    Health: "health",
    "Culture and society": "arts",
    "World politics": "world",
    "Conflict and diplomacy": "world"
  };
  return category ? map[category] ?? "world" : "world";
}
