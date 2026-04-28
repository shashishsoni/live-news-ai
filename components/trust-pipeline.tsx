const steps = [
  "Fetch from trusted APIs and RSS feeds",
  "Normalize titles, links, timestamps, and source names",
  "Remove duplicates while preserving citations",
  "Check source reputation and official/fact-check status",
  "Cross-check similar stories across reputable sources",
  "Detect sensational wording and label context risks",
  "Assign confidence score and publish with clear status"
];

export function TrustPipeline() {
  return (
    <section className="glass-card info-panel">
      <span className="eyebrow">Verification pipeline</span>
      <h2>SOURCE VALIDATION STACK</h2>
      <ol className="pipeline-list">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </section>
  );
}
