import { NextResponse } from "next/server";
import { summarizeWithNvidiaAi } from "@/lib/ai";
import type { ArticleLanguage } from "@/lib/types";

const ALLOWED_LANGUAGES: ArticleLanguage[] = ["en", "hi", "other"];

export async function POST(request: Request) {
  const body = (await request.json()) as {
    title?: string;
    description?: string;
    sourceName?: string;
    publishedAt?: string;
    url?: string;
    verificationStatus?: "Verified" | "Developing" | "Unverified";
    language?: string;
  };

  if (!body.title || !body.sourceName || !body.url || !body.publishedAt || !body.verificationStatus) {
    return NextResponse.json({ ok: false, error: "Missing source-backed article fields." }, { status: 400 });
  }

  const language = ALLOWED_LANGUAGES.includes(body.language as ArticleLanguage)
    ? (body.language as ArticleLanguage)
    : undefined;

  const result = await summarizeWithNvidiaAi({
    title: body.title,
    description: body.description ?? "",
    sourceName: body.sourceName,
    publishedAt: body.publishedAt,
    url: body.url,
    verificationStatus: body.verificationStatus,
    language
  });

  return NextResponse.json(result);
}
