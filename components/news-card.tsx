import { AiSummaryButton } from "@/components/ai-summary-button";
import type { NewsArticle } from "@/lib/types";

export function NewsCard({ article }: { article: NewsArticle }) {
  return (
    <article className={`news-card glass-card status-${article.verificationStatus.toLowerCase()}`}>
      <div className="card-media">
        {article.imageUrl ? (
          <img src={article.imageUrl} alt={`Source image for ${article.title}`} loading="lazy" />
        ) : (
          <div className="image-placeholder">{article.category}</div>
        )}
        <span className="source-chip">{article.category}</span>
      </div>
      <div className="card-body">
        <div className="card-kicker">
          <samp>{article.region === "india" ? "IND" : article.region === "global" ? "GLB" : "FC"}</samp>
          <samp>{article.sourceKind}</samp>
        </div>
        <div className="card-badges">
          <span className={`badge ${article.verificationStatus.toLowerCase()}`}>{article.verificationStatus}</span>
          <span className="badge neutral">{article.confidence}% confidence</span>
          <span className="badge neutral">{article.factCheckLabel}</span>
        </div>
        <h2>
          <a href={article.url} target="_blank" rel="noreferrer">
            {article.title}
          </a>
        </h2>
        {article.description ? (
          <p lang={article.language === "hi" ? "hi" : article.language === "en" ? "en" : undefined}>{article.description}</p>
        ) : (
          <p className="muted-text">
            {article.language === "hi"
              ? "इस फ़ीड में संक्षिप्त विवरण उपलब्ध नहीं है। पूर्ण समाचार के लिए मूल स्रोत खोलें।"
              : "Headline only — this feed did not include a body snippet. Open the original source for full context."}
          </p>
        )}
        {article.warning ? <p className="warning-label">{article.warning}</p> : null}
        {article.isOpinion ? <p className="warning-label">Opinion/editorial label detected. Treat separately from factual reporting.</p> : null}
        <dl className="trust-metrics">
          <div>
            <dt>SRC</dt>
            <dd>{article.sourceName}</dd>
          </div>
          <div>
            <dt>MATCH</dt>
            <dd>{article.matchedSources.length}</dd>
          </div>
        </dl>
        <div className="card-meta">
          <span>UPLINK {article.sourceName}</span>
          <time dateTime={article.publishedAt}>{new Date(article.publishedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</time>
        </div>
        <div className="citation-row" aria-label="Source citations">
          <span>SRC TRAIL</span>
          {article.citations.slice(0, 3).map((citation) => (
            <a key={`${citation.name}-${citation.url}`} href={citation.url} target="_blank" rel="noreferrer">
              {citation.name}
            </a>
          ))}
        </div>
        <a className="source-link-button" href={article.url} target="_blank" rel="noreferrer">
          OPEN ORIGINAL SOURCE
        </a>
        <AiSummaryButton article={article} />
      </div>
    </article>
  );
}
