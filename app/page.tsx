import Link from "next/link";
import { AiDisclosure } from "@/components/ai-disclosure";
import { BreakingBanner } from "@/components/breaking-banner";
import { NewsGrid } from "@/components/news-grid";
import { SearchBox } from "@/components/search-box";
import { TrustPipeline } from "@/components/trust-pipeline";
import { getNews, getFactChecks } from "@/lib/news";

export const revalidate = 600;

export default async function HomePage() {
  const [globalNews, indiaNews, factChecks] = await Promise.all([
    getNews({ region: "global", limit: 8 }),
    getNews({ region: "india", limit: 8 }),
    getFactChecks({ limit: 4 })
  ]);

  const latest = [...globalNews.articles, ...indiaNews.articles].sort(
    (first, second) => new Date(second.publishedAt).getTime() - new Date(first.publishedAt).getTime()
  );

  return (
    <div>
      <section className="hero section-shell">
        <div className="hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">Live source intelligence</span>
            <h1>TRUTH CONSOLE // NEWS SIGNALS</h1>
            <p>
              A terminal-style news command center that separates Global and India feeds, exposes citations, and labels uncertainty before you open a report.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href="/global-news">
                INIT GLOBAL FEED
              </Link>
              <Link className="button secondary" href="/india-news">
                INIT INDIA FEED
              </Link>
            </div>
            <div className="hero-proof-strip" aria-label="Verification principles">
              <span>[SRC] original links required</span>
              <span>[SAFE] unverified hidden</span>
              <span>[AI] source-bound only</span>
            </div>
          </div>
          <aside className="source-console glass-card" aria-label="How to use this news desk">
            <span className="console-label">Protocol</span>
            <ol className="flow-map">
              <li>
                <strong>01</strong>
                <span>Select Global or India scope</span>
              </li>
              <li>
                <strong>02</strong>
                <span>Filter topic, source, or category</span>
              </li>
              <li>
                <strong>03</strong>
                <span>Check verification and confidence</span>
              </li>
              <li>
                <strong>04</strong>
                <span>Open the original report</span>
              </li>
            </ol>
            <p>
              No invented fallback stories. If a trusted source does not provide a traceable item, the console stays empty.
            </p>
            <SearchBox action="/global-news" placeholder="Search verified global updates" />
          </aside>
        </div>
      </section>

      <section className="section-shell compact-section scope-section">
        <div className="section-heading row-heading">
          <div>
            <span className="eyebrow">Feed router</span>
            <h2>Two isolated feeds. One source-first protocol.</h2>
          </div>
        </div>
        <div className="scope-switch-grid">
          <Link className="scope-card glass-card" href="/global-news">
            <span>// GLOBAL</span>
            <strong>World affairs, climate, markets, science, health, diplomacy, culture.</strong>
            <small>{globalNews.articles.length} source-backed packets loaded</small>
          </Link>
          <Link className="scope-card glass-card" href="/india-news">
            <span>// INDIA</span>
            <strong>National, states, policy, courts, jobs, weather, sports, entertainment.</strong>
            <small>{indiaNews.articles.length} source-backed packets loaded</small>
          </Link>
        </div>
      </section>

      <section className="section-shell compact-section">
        <BreakingBanner articles={latest.slice(0, 5)} />
      </section>

      <section className="section-shell split-section">
        <div>
          <div className="section-heading row-heading">
            <div>
              <span className="eyebrow">Global stream</span>
              <h2>Latest global packets</h2>
            </div>
            <Link href="/global-news">View all</Link>
          </div>
          <NewsGrid articles={globalNews.articles.slice(0, 4)} emptyTitle="No global updates available" />
        </div>
        <div>
          <div className="section-heading row-heading">
            <div>
              <span className="eyebrow">India stream</span>
              <h2>Latest India packets</h2>
            </div>
            <Link href="/india-news">View all</Link>
          </div>
          <NewsGrid articles={indiaNews.articles.slice(0, 4)} emptyTitle="No India updates available" />
        </div>
      </section>

      <section className="section-shell two-column-section">
        <TrustPipeline />
        <AiDisclosure />
      </section>

      <section className="section-shell compact-section">
        <div className="section-heading row-heading">
          <div>
            <span className="eyebrow">Fact-check channel</span>
            <h2>Verification packets from dedicated sources</h2>
          </div>
          <Link href="/fact-check">Open fact-check page</Link>
        </div>
        <NewsGrid articles={factChecks.articles} emptyTitle="No fact-check feed items available" />
      </section>
    </div>
  );
}
