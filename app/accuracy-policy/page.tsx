import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accuracy Policy",
  description: "How Live Update News selects sources, filters misinformation, labels verification status, and handles limitations."
};

export default function AccuracyPolicyPage() {
  return (
    <section className="section-shell page-section policy-page">
      <span className="eyebrow">Accuracy and corrections</span>
      <h1>Accuracy Policy</h1>
      <p className="page-intro">This product is designed around transparency. It aggregates source-backed reporting and labels uncertainty instead of pretending that an automated platform can guarantee perfect truth.</p>

      <div className="policy-grid">
        <PolicyCard title="How sources are selected">
          Sources are chosen for editorial reputation, official status, traceable publication history, or dedicated fact-checking work. Custom RSS feeds should only be added after manual review.
        </PolicyCard>
        <PolicyCard title="How misinformation is filtered">
          The pipeline removes duplicates, checks source reputation, looks for cross-source confirmation, detects sensational language, labels opinion, and hides unverified low-confidence items by default.
        </PolicyCard>
        <PolicyCard title="Verified">
          A story is labeled Verified when it comes from an official or high-reputation source, a fact-checking source, a wire service, or when similar coverage is found across multiple reputable sources.
        </PolicyCard>
        <PolicyCard title="Developing">
          Developing means the story is source-backed but may rely on a single reputable outlet or may still be changing. Readers should follow the original source and watch for updates.
        </PolicyCard>
        <PolicyCard title="Unverified">
          Unverified means the source, phrasing, or corroboration is insufficient. These items are hidden by default and should not be treated as confirmed reporting.
        </PolicyCard>
        <PolicyCard title="Corrections and limitations">
          No news website can honestly promise 100% factual accuracy. This site prioritizes citations, timestamps, labels, and correction readiness. Users should read original reports for full context.
        </PolicyCard>
      </div>
    </section>
  );
}

function PolicyCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="policy-card glass-card">
      <h2>{title}</h2>
      <p>{children}</p>
    </article>
  );
}
