"use client";

import { useState, useTransition } from "react";
import type { NewsArticle } from "@/lib/types";
import { AiChatbox } from "./ai-chatbox";

export function AiSummaryButton({ article }: { article: NewsArticle }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();

  function summarize() {
    startTransition(async () => {
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
          verificationStatus: article.verificationStatus
        })
      });
      const data = (await response.json()) as { ok?: boolean; summary?: string; error?: string; provider?: string };
      if (data.ok && data.summary) {
        setMessage(data.summary);
      } else {
        setMessage("AI summary unavailable");
      }
    });
  }

  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <div className="ai-card-action">
      <div className="ai-action-buttons">
        <button type="button" onClick={summarize} disabled={isPending} className="ai-summary-btn">
          {isPending ? "..." : "AI summary"}
        </button>
        <button type="button" onClick={() => setIsChatOpen(!isChatOpen)} className="ai-discuss-btn">
          {isChatOpen ? "Close" : "Discuss"}
        </button>
      </div>
      {message && !isChatOpen ? <p className="ai-summary-msg">{message}</p> : null}
      {isChatOpen ? (
        <div className="ai-chatbox-container">
          <AiChatbox article={article} onClose={() => setIsChatOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
