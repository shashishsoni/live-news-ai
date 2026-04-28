import type { NewsArticle } from "@/lib/types";

export function BreakingBanner({ articles }: { articles: NewsArticle[] }) {
  if (!articles.length) {
    return (
      <div className="breaking-banner muted-banner">
        <strong>LIVE WIRE</strong>
        <span>No source-backed packets are available right now.</span>
      </div>
    );
  }

  return (
    <div className="breaking-banner" aria-label="Breaking and developing news">
      <strong>LIVE WIRE</strong>
      <div className="breaking-track">
        {articles.map((article) => (
          <a key={article.id} href={article.url} target="_blank" rel="noreferrer" className="banner-item">
            <span className="banner-status">{article.verificationStatus}</span>
            <span className="banner-title">{article.title}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
