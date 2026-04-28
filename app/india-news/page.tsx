import type { Metadata } from "next";
import { NewsDashboard } from "@/components/news-dashboard";
import { INDIA_CATEGORIES } from "@/lib/config";
import { getNews } from "@/lib/news";

export const metadata: Metadata = {
  title: "India News",
  description: "Source-backed India news across national, state-wise, politics, economy, government policy, law, education, jobs, technology, weather, sports, entertainment, and local updates."
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function IndiaNewsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const category = getParam(params.category);
  const query = getParam(params.q);
  const includeUnverified = getParam(params.includeUnverified) === "true";
  const result = await getNews({ region: "india", category, query, includeUnverified, limit: 36 });

  return (
    <NewsDashboard
      title="India News"
      description="National, state-wise, politics, economy, policy, law and courts, education, jobs, technology, weather, sports, entertainment, and local verified updates."
      basePath="/india-news"
      region="india"
      categories={INDIA_CATEGORIES}
      result={result}
      selectedCategory={category}
      query={query}
      includeUnverified={includeUnverified}
    />
  );
}

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
