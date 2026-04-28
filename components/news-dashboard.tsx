import { BreakingBanner } from "@/components/breaking-banner";
import { NewsGrid } from "@/components/news-grid";
import { SearchFilters } from "@/components/search-filters";
import { TrendingTopics } from "@/components/trending-topics";
import type { NewsRegion, NewsResult } from "@/lib/types";

export function NewsDashboard({
  title,
  description,
  basePath,
  region,
  categories,
  result,
  selectedCategory,
  query,
  includeUnverified
}: {
  title: string;
  description: string;
  basePath: string;
  region: NewsRegion;
  categories: string[];
  result: NewsResult;
  selectedCategory?: string;
  query?: string;
  includeUnverified?: boolean;
}) {
  return (
    <section className="section-shell page-section dashboard-page">
      <div className="dashboard-hero">
        <div>
          <span className="eyebrow">{region === "global" ? "Global feed" : "India feed"}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <aside className="glass-card trust-mini-card" aria-label="Verification default">
          <span>Safety state</span>
          <strong>UNVERIFIED HIDDEN</strong>
          <small>Enable only when inspecting low-confidence packets.</small>
        </aside>
      </div>

      <ol className="dashboard-flow" aria-label="News reading flow">
        <li>
          <strong>1</strong>
          <span>Scope lock</span>
        </li>
        <li>
          <strong>2</strong>
          <span>Filter query</span>
        </li>
        <li>
          <strong>3</strong>
          <span>Verify score</span>
        </li>
        <li>
          <strong>4</strong>
          <span>Open source</span>
        </li>
      </ol>

      <div className="dashboard-layout">
        <aside className="dashboard-controls" aria-label={`${title} controls`}>
          <SearchFilters basePath={basePath} categories={categories} selectedCategory={selectedCategory} query={query} includeUnverified={includeUnverified} />
          <TrendingTopics articles={result.articles} basePath={basePath} />
          <div className="truth-legend glass-card">
            <h2>STATUS LEGEND</h2>
            <p>VERIFIED means high reputation or corroborated. DEVELOPING means source-backed but changing. UNVERIFIED stays hidden unless requested.</p>
          </div>
        </aside>

        <div className="dashboard-feed">
          <BreakingBanner articles={result.articles} />
          <div className="metadata-row">
            <span>Last updated {new Date(result.lastUpdated).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
            <span>{result.articles.length} source-backed packets</span>
          </div>

          <NewsGrid articles={result.articles} emptyTitle={`No ${title.toLowerCase()} items found`} />
          {result.errors.length ? <p className="source-error">Some sources were unavailable: {result.errors.join("; ")}</p> : null}
        </div>
      </div>
    </section>
  );
}
