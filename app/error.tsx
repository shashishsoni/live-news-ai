"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <section className="section-shell page-section">
      <div className="empty-state glass-card">
        <span className="eyebrow">Temporary issue</span>
        <h1>News sources could not be loaded</h1>
        <p>{error.message || "A source request failed. Try again or check API/RSS configuration."}</p>
        <button className="button primary" onClick={reset}>
          Try again
        </button>
      </div>
    </section>
  );
}
