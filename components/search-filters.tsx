import Link from "next/link";

export function SearchFilters({
  basePath,
  categories,
  selectedCategory,
  query,
  includeUnverified
}: {
  basePath: string;
  categories: string[];
  selectedCategory?: string;
  query?: string;
  includeUnverified?: boolean;
}) {
  return (
    <div className="filters glass-card">
      <div className="filter-header">
        <span>Command input</span>
        <strong>QUERY / CATEGORY / CONFIDENCE</strong>
      </div>
      <form className="filter-form" action={basePath}>
        <label>
          <span>$ SEARCH</span>
          <input name="q" type="search" placeholder="Topic, source, or keyword" defaultValue={query} />
        </label>
        <label>
          <span>$ CATEGORY</span>
        <select name="category" defaultValue={selectedCategory ?? ""} aria-label="Category filter">
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        </label>
        <label className="checkbox-label">
          <input name="includeUnverified" value="true" type="checkbox" defaultChecked={includeUnverified} />
          Show unverified packets
        </label>
        <button type="submit">RUN QUERY</button>
      </form>
      <div className="category-scroll" aria-label="Category shortcuts">
        <Link className={!selectedCategory ? "category-pill active" : "category-pill"} href={basePath}>
          All
        </Link>
        {categories.map((category) => (
          <Link key={category} className={selectedCategory === category ? "category-pill active" : "category-pill"} href={`${basePath}?category=${encodeURIComponent(category)}`}>
            {category}
          </Link>
        ))}
      </div>
    </div>
  );
}
