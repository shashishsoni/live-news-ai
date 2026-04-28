export const GLOBAL_CATEGORIES = [
  "World politics",
  "Economy",
  "Technology",
  "Science",
  "Climate",
  "Health",
  "Business",
  "Sports",
  "Conflict and diplomacy",
  "Culture and society"
];

export const INDIA_CATEGORIES = [
  "National news",
  "State-wise news",
  "Politics",
  "Economy",
  "Government policy",
  "Law and courts",
  "Education",
  "Jobs and employment",
  "Technology",
  "Weather and disasters",
  "Sports",
  "Entertainment",
  "Local verified updates"
];

export const FACT_CHECK_CATEGORIES = ["Fact checks", "Misinformation", "Source verification"];

export const NEWS_CACHE_SECONDS = Number(process.env.NEWS_CACHE_SECONDS ?? 600);
export const DEFAULT_ARTICLE_LIMIT = 24;

export const SITE_NAME = "Live Update News";
export const SITE_DESCRIPTION =
  "A source-backed live news dashboard for Global News and India News with verification labels, citations, confidence indicators, and a transparent accuracy policy.";
