import { NewsCard } from "@/components/news-card";
import type { NewsArticle } from "@/lib/types";

export function NewsGrid({ articles, emptyTitle }: { articles: NewsArticle[]; emptyTitle: string }) {
  if (!articles.length) {
    return (
      <div className="empty-state glass-card">
        <span className="eyebrow">No fabricated fallback</span>
        <h2>{emptyTitle}</h2>
        <p>No article is shown unless it has a traceable source link and passes the current source, category, and verification filters.</p>
      </div>
    );
  }

  return (
    <div className="news-grid">
      {articles.map((article) => (
        <NewsCard key={article.id} article={article} />
      ))}
    </div>
  );
}
