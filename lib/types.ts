export type NewsRegion = "global" | "india";
export type ContentRegion = NewsRegion | "fact-check";

export type VerificationStatus = "Verified" | "Developing" | "Unverified";

export type ArticleLanguage = "en" | "hi" | "other";

export type FactCheckLabel =
  | "No known dispute"
  | "Needs context"
  | "Fact-check source"
  | "Unverified claim";

export type SourceKind = "established-media" | "official" | "fact-checker" | "wire" | "api";

export type Citation = {
  name: string;
  url: string;
};

export type NewsArticle = {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  sourceName: string;
  sourceUrl?: string;
  sourceKind: SourceKind;
  author?: string;
  publishedAt: string;
  category: string;
  region: ContentRegion;
  verificationStatus: VerificationStatus;
  confidence: number;
  factCheckLabel: FactCheckLabel;
  warning?: string;
  /**
   * Heuristic risk cues detected in headline/description/URL patterns
   * (e.g., "allegedly", "viral", "no evidence") that reduce confidence.
   */
  riskCues?: string[];
  /**
   * Detected article language used by scoring and AI prompts to apply
   * language-aware strictness and avoid silent translation.
   */
  language: ArticleLanguage;
  isOpinion: boolean;
  citations: Citation[];
  matchedSources: string[];
};

export type NewsQuery = {
  region?: ContentRegion;
  category?: string;
  query?: string;
  limit?: number;
  includeUnverified?: boolean;
};

export type NewsResult = {
  articles: NewsArticle[];
  lastUpdated: string;
  errors: string[];
};
