export function LoadingSkeleton() {
  return (
    <section className="section-shell page-section">
      <div className="skeleton hero-skeleton" />
      <div className="news-grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="skeleton card-skeleton" key={index} />
        ))}
      </div>
    </section>
  );
}
