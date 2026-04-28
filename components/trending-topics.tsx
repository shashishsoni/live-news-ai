import Link from "next/link";
import { getTrendingTopics } from "@/lib/trending";
import type { NewsArticle } from "@/lib/types";

export function TrendingTopics({ articles, basePath }: { articles: NewsArticle[]; basePath: string }) {
  const topics = getTrendingTopics(articles);

  if (!topics.length) {
    return null;
  }

  return (
    <div className="trending-row">
      <strong>HOT SIGNALS</strong>
      {topics.map((topic) => (
        <Link key={topic.topic} href={`${basePath}?q=${encodeURIComponent(topic.topic)}`}>
          {topic.topic}
        </Link>
      ))}
    </div>
  );
}
