import type { Metadata } from "next";
import { NewsGrid } from "@/components/news-grid";
import { SearchBox } from "@/components/search-box";
import { getFactChecks } from "@/lib/news";

export const metadata: Metadata = {
  title: "Fact Check",
  description: "Fact-checking updates from dedicated verification sources."
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FactCheckPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = Array.isArray(params.q) ? params.q[0] : params.q;
  const result = await getFactChecks({ query, limit: 30 });

  return (
    <section className="section-shell page-section">
      <span className="eyebrow">Dedicated verification</span>
      <h1>Fact Check</h1>
      <p className="page-intro">This page aggregates fact-check feeds where available. Claims remain linked to the original fact-check source for full context and evidence.</p>
      <SearchBox action="/fact-check" placeholder="Search fact-check items" defaultValue={query} />
      <div className="metadata-row">
        <span>Last updated {new Date(result.lastUpdated).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
        <span>{result.articles.length} items</span>
      </div>
      <NewsGrid articles={result.articles} emptyTitle="No fact-check items found" />
      {result.errors.length ? <p className="source-error">Some fact-check feeds were unavailable: {result.errors.join("; ")}</p> : null}
    </section>
  );
}
