import type { MetadataRoute } from "next";

const routes = ["", "/global-news", "/india-news", "/categories", "/fact-check", "/sources", "/accuracy-policy", "/about-accuracy-policy", "/contact"];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const now = new Date();

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: route.includes("news") || route.includes("fact-check") ? "hourly" : "weekly",
    priority: route === "" ? 1 : 0.7
  }));
}
