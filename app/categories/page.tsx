import type { Metadata } from "next";
import Link from "next/link";
import { GLOBAL_CATEGORIES, INDIA_CATEGORIES } from "@/lib/config";

export const metadata: Metadata = {
  title: "Categories",
  description: "Browse dedicated Global News and India News categories."
};

export default function CategoriesPage() {
  return (
    <section className="section-shell page-section">
      <span className="eyebrow">Browse coverage</span>
      <h1>Categories</h1>
      <p className="page-intro">Global and India coverage are intentionally separated so readers can understand scope, source context, and verification status clearly.</p>

      <div className="split-section category-page-grid">
        <CategoryGroup title="Global News" href="/global-news" categories={GLOBAL_CATEGORIES} />
        <CategoryGroup title="India News" href="/india-news" categories={INDIA_CATEGORIES} />
      </div>
    </section>
  );
}

function CategoryGroup({ title, href, categories }: { title: string; href: string; categories: string[] }) {
  return (
    <div className="glass-card category-group">
      <div className="row-heading">
        <h2>{title}</h2>
        <Link href={href}>Open section</Link>
      </div>
      <div className="category-cloud">
        {categories.map((category) => (
          <Link key={category} className="category-pill" href={`${href}?category=${encodeURIComponent(category)}`}>
            {category}
          </Link>
        ))}
      </div>
    </div>
  );
}
