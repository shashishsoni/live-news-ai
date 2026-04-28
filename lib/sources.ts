import type { ContentRegion, SourceKind } from "@/lib/types";

export type TrustedSourceProfile = {
  name: string;
  homepage: string;
  kind: SourceKind;
  reputation: number;
  scope: string;
};

export type TrustedFeed = {
  name: string;
  url: string;
  homepage: string;
  region: ContentRegion;
  kind: SourceKind;
  categories: string[];
  reputation: number;
};

export const TRUSTED_SOURCE_REGISTRY: TrustedSourceProfile[] = [
  {
    name: "The Guardian",
    homepage: "https://www.theguardian.com/international",
    kind: "established-media",
    reputation: 84,
    scope: "Global reporting, public RSS, optional Open Platform API"
  },
  {
    name: "The New York Times",
    homepage: "https://www.nytimes.com",
    kind: "established-media",
    reputation: 84,
    scope: "Global reporting, RSS, optional Top Stories API"
  },
  {
    name: "BBC News",
    homepage: "https://www.bbc.com/news",
    kind: "established-media",
    reputation: 84,
    scope: "Global reporting and public RSS"
  },
  {
    name: "Associated Press",
    homepage: "https://apnews.com",
    kind: "wire",
    reputation: 88,
    scope: "Wire reporting when available through configured APIs"
  },
  {
    name: "Reuters",
    homepage: "https://www.reuters.com",
    kind: "wire",
    reputation: 88,
    scope: "Wire reporting when available through configured APIs"
  },
  {
    name: "Press Information Bureau India",
    homepage: "https://pib.gov.in",
    kind: "official",
    reputation: 92,
    scope: "Official Government of India press releases"
  },
  {
    name: "India Meteorological Department",
    homepage: "https://mausam.imd.gov.in",
    kind: "official",
    reputation: 92,
    scope: "Official Indian weather warnings and advisories"
  },
  {
    name: "Election Commission of India",
    homepage: "https://eci.gov.in",
    kind: "official",
    reputation: 92,
    scope: "Official Indian election updates"
  },
  {
    name: "The Hindu",
    homepage: "https://www.thehindu.com",
    kind: "established-media",
    reputation: 82,
    scope: "India national, state, business, and public affairs reporting"
  },
  {
    name: "The Indian Express",
    homepage: "https://indianexpress.com",
    kind: "established-media",
    reputation: 80,
    scope: "India national, state, politics, and public affairs reporting"
  },
  {
    name: "NDTV",
    homepage: "https://www.ndtv.com",
    kind: "established-media",
    reputation: 82,
    scope: "India national and global reporting"
  },
  {
    name: "Times of India",
    homepage: "https://timesofindia.indiatimes.com",
    kind: "established-media",
    reputation: 80,
    scope: "India national and local reporting"
  },
  {
    name: "Hindustan Times",
    homepage: "https://www.hindustantimes.com",
    kind: "established-media",
    reputation: 80,
    scope: "India national reporting"
  },
  {
    name: "Livemint",
    homepage: "https://www.livemint.com",
    kind: "established-media",
    reputation: 82,
    scope: "India business and economy reporting"
  },
  {
    name: "Alt News",
    homepage: "https://www.altnews.in",
    kind: "fact-checker",
    reputation: 88,
    scope: "India-focused fact-checking"
  },
  {
    name: "BOOM Live",
    homepage: "https://www.boomlive.in",
    kind: "fact-checker",
    reputation: 86,
    scope: "India-focused fact-checking"
  },
  {
    name: "AFP Fact Check",
    homepage: "https://factcheck.afp.com",
    kind: "fact-checker",
    reputation: 88,
    scope: "Global fact-checking"
  },
  {
    name: "Snopes",
    homepage: "https://www.snopes.com",
    kind: "fact-checker",
    reputation: 84,
    scope: "Global fact-checking and rumor verification"
  }
];

export const TRUSTED_RSS_FEEDS: TrustedFeed[] = [
  {
    name: "BBC News World",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    homepage: "https://www.bbc.com/news/world",
    region: "global",
    kind: "established-media",
    categories: ["World politics", "Conflict and diplomacy", "Culture and society"],
    reputation: 84
  },
  {
    name: "The Guardian World",
    url: "https://www.theguardian.com/world/rss",
    homepage: "https://www.theguardian.com/world",
    region: "global",
    kind: "established-media",
    categories: ["World politics", "Conflict and diplomacy", "Culture and society"],
    reputation: 84
  },
  {
    name: "The Guardian Technology",
    url: "https://www.theguardian.com/technology/rss",
    homepage: "https://www.theguardian.com/technology",
    region: "global",
    kind: "established-media",
    categories: ["Technology", "Business"],
    reputation: 84
  },
  {
    name: "The Guardian Science",
    url: "https://www.theguardian.com/science/rss",
    homepage: "https://www.theguardian.com/science",
    region: "global",
    kind: "established-media",
    categories: ["Science", "Health"],
    reputation: 84
  },
  {
    name: "The Guardian Environment",
    url: "https://www.theguardian.com/environment/rss",
    homepage: "https://www.theguardian.com/environment",
    region: "global",
    kind: "established-media",
    categories: ["Climate", "Science"],
    reputation: 84
  },
  {
    name: "The Guardian Business",
    url: "https://www.theguardian.com/business/rss",
    homepage: "https://www.theguardian.com/business",
    region: "global",
    kind: "established-media",
    categories: ["Business", "Economy"],
    reputation: 84
  },
  {
    name: "The New York Times World",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    homepage: "https://www.nytimes.com/section/world",
    region: "global",
    kind: "established-media",
    categories: ["World politics", "Conflict and diplomacy"],
    reputation: 84
  },
  {
    name: "The New York Times Science",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml",
    homepage: "https://www.nytimes.com/section/science",
    region: "global",
    kind: "established-media",
    categories: ["Science", "Health"],
    reputation: 84
  },
  {
    name: "The New York Times Climate",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Climate.xml",
    homepage: "https://www.nytimes.com/section/climate",
    region: "global",
    kind: "established-media",
    categories: ["Climate", "Science"],
    reputation: 84
  },
  {
    name: "The Hindu National",
    url: "https://www.thehindu.com/news/national/feeder/default.rss",
    homepage: "https://www.thehindu.com/news/national/",
    region: "india",
    kind: "established-media",
    categories: ["National news", "Politics", "Law and courts"],
    reputation: 82
  },
  {
    name: "The Hindu States",
    url: "https://www.thehindu.com/news/states/feeder/default.rss",
    homepage: "https://www.thehindu.com/news/states/",
    region: "india",
    kind: "established-media",
    categories: ["State-wise news", "Local verified updates"],
    reputation: 82
  },
  {
    name: "The Hindu Business",
    url: "https://www.thehindu.com/business/feeder/default.rss",
    homepage: "https://www.thehindu.com/business/",
    region: "india",
    kind: "established-media",
    categories: ["Economy", "Business", "Jobs and employment"],
    reputation: 82
  },
  {
    name: "The Indian Express India",
    url: "https://indianexpress.com/section/india/feed/",
    homepage: "https://indianexpress.com/section/india/",
    region: "india",
    kind: "established-media",
    categories: ["National news", "Politics", "State-wise news"],
    reputation: 80
  },
  {
    name: "Press Information Bureau India",
    url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3",
    homepage: "https://pib.gov.in",
    region: "india",
    kind: "official",
    categories: ["Government policy", "National news", "Economy"],
    reputation: 92
  },
  {
    name: "NDTV",
    url: "https://feeds.feedburner.com/ndtvnews-top-stories",
    homepage: "https://www.ndtv.com",
    region: "india",
    kind: "established-media",
    categories: ["National news", "Politics"],
    reputation: 82
  },
  {
    name: "Times of India",
    url: "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
    homepage: "https://timesofindia.indiatimes.com",
    region: "india",
    kind: "established-media",
    categories: ["National news", "State-wise news"],
    reputation: 80
  },
  {
    name: "Hindustan Times",
    url: "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml",
    homepage: "https://www.hindustantimes.com",
    region: "india",
    kind: "established-media",
    categories: ["National news", "Politics"],
    reputation: 80
  },
  {
    name: "Livemint",
    url: "https://www.livemint.com/rss/news",
    homepage: "https://www.livemint.com",
    region: "india",
    kind: "established-media",
    categories: ["Economy", "Business"],
    reputation: 82
  },
  {
    name: "Alt News",
    url: "https://www.altnews.in/feed/",
    homepage: "https://www.altnews.in",
    region: "fact-check",
    kind: "fact-checker",
    categories: ["Fact checks", "Misinformation"],
    reputation: 88
  },
  {
    name: "AFP Fact Check",
    url: "https://factcheck.afp.com/rss.xml",
    homepage: "https://factcheck.afp.com",
    region: "fact-check",
    kind: "fact-checker",
    categories: ["Fact checks", "Misinformation"],
    reputation: 88
  },
  {
    name: "Snopes",
    url: "https://www.snopes.com/feed/",
    homepage: "https://www.snopes.com",
    region: "fact-check",
    kind: "fact-checker",
    categories: ["Fact checks", "Misinformation"],
    reputation: 84
  }
];

export function lookupSourceProfile(sourceName: string): TrustedSourceProfile | undefined {
  const normalized = sourceName.toLowerCase();
  return TRUSTED_SOURCE_REGISTRY.find((source) => {
    const sourceKey = source.name.toLowerCase();
    return normalized.includes(sourceKey) || sourceKey.includes(normalized);
  });
}
