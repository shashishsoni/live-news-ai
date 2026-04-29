"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NewsArticle } from "@/lib/types";
import type { ChatMessage } from "@/lib/ai";

type ParsedResponse = {
  response: string;
  reasoning: string;
  counterpoint: string;
  followup: string;
};

type ChatApiResponse = {
  ok?: boolean;
  reply?: string;
  error?: string;
};

type AiChatboxProps = {
  article: NewsArticle;
  onClose: () => void;
};

const SEED_PROMPTS: readonly string[] = [
  "Summarize the key claims",
  "What's the strongest counter-argument?",
  "Who benefits from this story?"
];

const ERROR_MESSAGE = "Sorry, I encountered an error analyzing that.";
const NETWORK_ERROR_MESSAGE = "Network error. Please try again.";

function parseAiResponse(text: string): ParsedResponse {
  const parsed: ParsedResponse = { response: "", reasoning: "", counterpoint: "", followup: "" };

  const responseMatch = text.match(/Response:\s*([\s\S]*?)(?=Reasoning:|Counterpoint:|Follow-up:|$)/i);
  const reasoningMatch = text.match(/Reasoning:\s*([\s\S]*?)(?=Counterpoint:|Follow-up:|$)/i);
  const counterMatch = text.match(/Counterpoint:\s*([\s\S]*?)(?=Follow-up:|$)/i);
  const followupMatch = text.match(/Follow-up:\s*([\s\S]*?)$/i);

  if (responseMatch) parsed.response = responseMatch[1].trim();
  if (reasoningMatch) parsed.reasoning = reasoningMatch[1].trim();
  if (counterMatch) parsed.counterpoint = counterMatch[1].trim();
  if (followupMatch) parsed.followup = followupMatch[1].trim();

  if (!parsed.response && !parsed.reasoning && !parsed.counterpoint && !parsed.followup) {
    parsed.response = text;
  }

  return parsed;
}

export function AiChatbox({ article, onClose }: AiChatboxProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed || isLoading) return;

      const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
      setMessages(next);
      setInput("");
      setIsLoading(true);

      try {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            article: {
              title: article.title,
              description: article.description,
              sourceName: article.sourceName,
              url: article.url,
              language: article.language
            },
            messages: next
          })
        });

        const data = (await response.json()) as ChatApiResponse;
        const reply = data.ok && data.reply ? data.reply : ERROR_MESSAGE;
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      } catch {
        setMessages((prev) => [...prev, { role: "assistant", content: NETWORK_ERROR_MESSAGE }]);
      } finally {
        setIsLoading(false);
      }
    },
    [article.description, article.sourceName, article.title, article.url, isLoading, messages]
  );

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submit(input);
      }
    },
    [submit, input]
  );

  const handleFormSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      submit(input);
    },
    [submit, input]
  );

  const handleSeedClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const prompt = event.currentTarget.dataset.prompt;
      if (prompt) submit(prompt);
    },
    [submit]
  );

  const isEmpty = messages.length === 0 && !isLoading;
  const sendDisabled = isLoading || input.trim().length === 0;

  return (
    <section className="ai-chatbox" role="dialog" aria-label="AI debate panel">
      <header className="chat-header">
        <div className="chat-title-group">
          <span className="chat-status-dot" aria-hidden="true" />
          <span className="chat-title">[ DEBATE / DISCUSS ]</span>
          <span className="chat-meta">UNIT-AI / NVIDIA-405B</span>
        </div>
        <button
          type="button"
          className="chat-close-btn"
          onClick={onClose}
          aria-label="Close debate panel"
        >
          [ESC]
        </button>
      </header>

      <div className="chat-messages" aria-live="polite">
        {isEmpty ? (
          <div className="chat-empty">
            <span className="chat-empty-eyebrow">&gt;&gt;&gt; READY</span>
            <p>Challenge a claim, request a counterpoint, or stress-test the source.</p>
            <ul className="chat-seed-prompts">
              {SEED_PROMPTS.map((prompt) => (
                <li key={prompt}>
                  <button type="button" data-prompt={prompt} onClick={handleSeedClick}>
                    {prompt}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {messages.map((msg, idx) => {
          if (msg.role === "user") {
            return (
              <div key={idx} className="chat-bubble user">
                <span className="chat-bubble-tag">YOU</span>
                <p>{msg.content}</p>
              </div>
            );
          }

          const parsed = parseAiResponse(msg.content);
          return (
            <div key={idx} className="chat-bubble assistant">
              <span className="chat-bubble-tag">AI / 405B</span>
              {parsed.response ? (
                <div className="chat-section response">
                  <span className="section-label">[ RESPONSE ]</span>
                  <p>{parsed.response}</p>
                </div>
              ) : null}
              {parsed.reasoning ? (
                <div className="chat-section reasoning">
                  <span className="section-label">[ REASONING ]</span>
                  <p>{parsed.reasoning}</p>
                </div>
              ) : null}
              {parsed.counterpoint ? (
                <div className="chat-section counterpoint">
                  <span className="section-label">[ COUNTERPOINT ]</span>
                  <p>{parsed.counterpoint}</p>
                </div>
              ) : null}
              {parsed.followup ? (
                <div className="chat-section followup">
                  <span className="section-label">[ FOLLOW-UP ]</span>
                  <p>{parsed.followup}</p>
                </div>
              ) : null}
            </div>
          );
        })}

        {isLoading ? (
          <div className="chat-bubble assistant chat-loading" aria-label="AI is responding">
            <span className="chat-bubble-tag">AI / 405B</span>
            <span className="chat-loading-line">
              ANALYZING<span className="chat-caret" aria-hidden="true" />
            </span>
          </div>
        ) : null}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleFormSubmit}>
        <span className="chat-input-prompt" aria-hidden="true">&gt;</span>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type message — Enter to send, Shift+Enter for newline"
          disabled={isLoading}
          rows={1}
          aria-label="Message input"
        />
        <button type="submit" disabled={sendDisabled} className="send-btn">
          SEND
        </button>
      </form>
    </section>
  );
}
