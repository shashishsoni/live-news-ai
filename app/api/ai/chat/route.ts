import { NextResponse } from "next/server";
import { z } from "zod";
import { chatWithDebateAI } from "@/lib/ai";

const chatSchema = z.object({
  article: z.object({
    title: z.string(),
    description: z.string().optional(),
    sourceName: z.string(),
    url: z.string(),
    language: z.enum(["en", "hi", "other"]).optional()
  }),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1, "Message cannot be empty").max(8000, "Message too long")
    })
  ).min(1, "Messages array cannot be empty")
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Zod Validation
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid request payload", details: parsed.error.issues }, { status: 400 });
    }

    const { article, messages } = parsed.data;

    // 2. Garbage Input / Safety Handling (Basic)
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === "user") {
      const userText = lastMessage.content.trim();
      // Extremely basic garbage filter
      if (userText.length < 3 || /^[a-zA-Z]$/.test(userText)) {
        return NextResponse.json({
          ok: true,
          reply: "Your input lacks a clear argument or context. Can you clarify your point regarding the article?"
        });
      }
    }

    // 3. AI Processing
    const result = await chatWithDebateAI(article, messages);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, reply: result.reply });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
