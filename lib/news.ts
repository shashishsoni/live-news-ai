import { DEFAULT_ARTICLE_LIMIT, FACT_CHECK_CATEGORIES, GLOBAL_CATEGORIES, INDIA_CATEGORIES, NEWS_CACHE_SECONDS } from "@/lib/config";
import { detectSensationalLanguage } from "@/lib/ai";
import { lookupSourceProfile, TRUSTED_RSS_FEEDS, type TrustedFeed, type TrustedSourceProfile } from "@/lib/sources";
import { cleanUrl, decodeHtml, getDomain, hashString, normalizeTitle, stripHtml, titlesLookSimilar } from "@/lib/text";
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

    errors.push(`${feeds[index]?.name ?? "RSS feed"}: ${result.reason instanceof Error ? result.reason.message : "fetch failed"}`);
  });

  return { articles, errors };
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
      const description = extractTag(block, "description") || extractTag(block, "summary") || extractTag(block, "content:encoded");
      const publishedAt = extractTag(block, "pubDate") || extractTag(block, "updated") || extractTag(block, "published");
      const author = extractTag(block, "dc:creator") || extractTag(block, "author");
      const imageUrl = extractImage(block);

      return {
        title: stripHtml(title),
        link: cleanUrl(stripHtml(link)),
        description: stripHtml(description),
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
  const verification = scoreVerification(raw.sourceReputation, raw.sourceKind, sensational.hasSensationalLanguage, isOpinion);
  const factCheckLabel = getFactCheckLabel(raw.sourceKind, sensational.hasSensationalLanguage, verification.status);
  const url = cleanUrl(raw.url);

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
    warning: sensational.hasSensationalLanguage
      ? "Potentially sensational wording detected. Read the original source and look for corroboration."
      : undefined,
    isOpinion,
    citations: [{ name: raw.sourceName, url }],
    matchedSources: [raw.sourceName]
  };
}

function scoreVerification(sourceReputation: number, sourceKind: SourceKind, sensational: boolean, isOpinion: boolean): { status: VerificationStatus; confidence: number } {
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

  confidence = Math.max(20, Math.min(98, confidence));

  if (confidence >= 88) {
    return { status: "Verified", confidence };
  }
  if (confidence >= 76) {
    return { status: "Developing", confidence };
  }
  return { status: "Unverified", confidence };
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
    const confidence = Math.min(98, Math.max(article.confidence, 86) + Math.min(8, matches.length * 3));

    return {
      ...article,
      verificationStatus: "Verified" as VerificationStatus,
      confidence,
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
    if (existing.matchedSources.length > 1 && existing.verificationStatus !== "Unverified") {
      existing.verificationStatus = "Verified";
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
