import Link from "next/link";

export function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <strong>Live Update News</strong>
        <p>Aggregates trusted sources with citations, labels, and timestamps. Read original reports for complete context.</p>
      </div>
      <div className="footer-links">
        <Link href="/accuracy-policy">Accuracy Policy</Link>
        <Link href="/sources">Sources</Link>
        <Link href="/fact-check">Fact Check</Link>
      </div>
    </footer>
  );
}
