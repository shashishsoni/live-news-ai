import type { Metadata } from "next";
import { NewsDashboard } from "@/components/news-dashboard";
import { GLOBAL_CATEGORIES } from "@/lib/config";
import { getNews } from "@/lib/news";

export const metadata: Metadata = {
  title: "Global News",
  description: "Source-backed global news across politics, economy, technology, science, climate, health, business, sports, conflict, diplomacy, culture, and society."
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GlobalNewsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const category = getParam(params.category);
  const query = getParam(params.q);
  const includeUnverified = getParam(params.includeUnverified) === "true";
  const result = await getNews({ region: "global", category, query, includeUnverified, limit: 36 });

  return (
    <NewsDashboard
      title="Global News"
      description="World politics, economy, technology, science, climate, health, business, sports, conflict, diplomacy, culture, and society."
      basePath="/global-news"
      region="global"
      categories={GLOBAL_CATEGORIES}
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
