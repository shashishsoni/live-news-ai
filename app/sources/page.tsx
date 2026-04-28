import type { Metadata } from "next";
import { TRUSTED_RSS_FEEDS, TRUSTED_SOURCE_REGISTRY } from "@/lib/sources";

export const metadata: Metadata = {
  title: "Sources",
  description: "Trusted source registry and RSS/API source transparency."
};

export default function SourcesPage() {
  return (
    <section className="section-shell page-section">
      <span className="eyebrow">Transparency</span>
      <h1>Sources</h1>
      <p className="page-intro">The platform uses a curated source registry and public RSS feeds. Sources are selected for traceability, editorial standards, official status, or dedicated fact-checking work.</p>

      <div className="source-table glass-card">
        {TRUSTED_SOURCE_REGISTRY.map((source) => (
          <article key={source.name} className="source-row">
            <div>
              <h2>{source.name}</h2>
              <p>{source.scope}</p>
            </div>
            <div className="source-meta">
              <span className="badge neutral">{source.kind}</span>
              <span>Reputation score {source.reputation}</span>
              <a href={source.homepage} target="_blank" rel="noreferrer">
                Source site
              </a>
            </div>
          </article>
        ))}
      </div>

      <div className="section-heading">
        <span className="eyebrow">Configured RSS feeds</span>
        <h2>Default public feeds</h2>
      </div>
      <div className="feed-grid">
        {TRUSTED_RSS_FEEDS.map((feed) => (
          <a key={feed.url} href={feed.homepage} className="feed-card glass-card" target="_blank" rel="noreferrer">
            <span>{feed.region}</span>
            <strong>{feed.name}</strong>
            <small>{feed.categories.join(" / ")}</small>
          </a>
        ))}
      </div>
    </section>
  );
}
