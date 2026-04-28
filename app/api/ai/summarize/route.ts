import { NextResponse } from "next/server";
import { summarizeWithNvidiaAi } from "@/lib/ai";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    title?: string;
    description?: string;
    sourceName?: string;
    publishedAt?: string;
    url?: string;
    verificationStatus?: "Verified" | "Developing" | "Unverified";
  };

  if (!body.title || !body.sourceName || !body.url || !body.publishedAt || !body.verificationStatus) {
    return NextResponse.json({ ok: false, error: "Missing source-backed article fields." }, { status: 400 });
  }

  const result = await summarizeWithNvidiaAi({
    title: body.title,
    description: body.description ?? "",
    sourceName: body.sourceName,
    publishedAt: body.publishedAt,
    url: body.url,
    verificationStatus: body.verificationStatus
  });

  return NextResponse.json(result);
}
