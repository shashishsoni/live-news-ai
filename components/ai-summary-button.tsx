"use client";

import { useState } from "react";
import type { NewsArticle } from "@/lib/types";
import { AiChatbox } from "./ai-chatbox";

export function AiSummaryButton({ article }: { article: NewsArticle }) {
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [message, setMessage] = useState<string>();

  async function summarize() {
    try {
      setIsSummarizing(true);
      setMessage("AI processing...");
      const response = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: article.title,
          description: article.description,
          sourceName: article.sourceName,
          publishedAt: article.publishedAt,
          url: article.url,
          verificationStatus: article.verificationStatus,
          language: article.language
        })
      });
      const data = (await response.json()) as { ok?: boolean; summary?: string; error?: string; provider?: string };
      if (data.ok && data.summary) {
        setMessage(data.summary);
      } else {
        setMessage(data.error ? `AI summary unavailable: ${data.error}` : "AI summary unavailable");
      }
    } catch {
      setMessage("AI summary request failed. Please retry.");
    } finally {
      setIsSummarizing(false);
    }
  }

  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <div className="ai-card-action">
      <div className="ai-action-buttons">
        <button type="button" onClick={summarize} disabled={isSummarizing} className="ai-summary-btn">
          {isSummarizing ? (
            <span className="ai-summary-loading" aria-live="polite">
              <span className="ai-summary-spinner" aria-hidden="true" />
              <span>AI summarizing</span>
            </span>
          ) : (
            "AI summary"
          )}
        </button>
        <button type="button" onClick={() => setIsChatOpen(!isChatOpen)} className="ai-discuss-btn">
          {isChatOpen ? "Close" : "Discuss"}
        </button>
      </div>
      {message ? <p className="ai-summary-msg">{message}</p> : null}
      {isChatOpen ? (
        <div className="ai-chatbox-container">
          <AiChatbox article={article} onClose={() => setIsChatOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
