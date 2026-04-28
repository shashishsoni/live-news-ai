import { NextResponse } from "next/server";
import { getNews } from "@/lib/news";
import type { ContentRegion } from "@/lib/types";

export const revalidate = 600;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") as ContentRegion | null;
  const category = searchParams.get("category") ?? undefined;
  const query = searchParams.get("q") ?? undefined;
  const includeUnverified = searchParams.get("includeUnverified") === "true";
  const limit = Number(searchParams.get("limit") ?? 24);

  if (region && !["global", "india", "fact-check"].includes(region)) {
    return NextResponse.json({ error: "Invalid region" }, { status: 400 });
  }

  const result = await getNews({ region: region ?? undefined, category, query, includeUnverified, limit });
  return NextResponse.json(result);
}
