import type { NewsArticle } from "@/lib/types";
import { titleTokens } from "@/lib/text";

export function getTrendingTopics(articles: NewsArticle[], limit = 8) {
  const counts = new Map<string, number>();

  articles.forEach((article) => {
    counts.set(article.category, (counts.get(article.category) ?? 0) + 2);
    titleTokens(article.title).forEach((token) => {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((first, second) => second[1] - first[1])
    .slice(0, limit)
    .map(([topic, count]) => ({ topic, count }));
}
