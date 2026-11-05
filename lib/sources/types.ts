export type NormalizedJob = {
  source: string;
  externalId: string;
  title: string;
  company?: string | null;
  location?: string | null;
  country?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  workType?: string | null;
  url: string;
  description?: string | null;
  postedAt?: Date | null;
};

export function stripHtml(html: string): string {
  return html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const AU_HINTS = /\b(australia|sydney|melbourne|brisbane|perth|adelaide|canberra|hobart|darwin|gold coast|newcastle|nsw|vic|qld|wa|sa|act|tas|nt)\b/i;
const NZ_HINTS = /\b(new zealand|aotearoa|auckland|wellington|christchurch|hamilton|tauranga|dunedin|queenstown|nelson|napier)\b/i;

/** Best-effort AU/NZ detection from a free-text location. */
export function guessCountry(location?: string | null): string | null {
  if (!location) return null;
  if (NZ_HINTS.test(location)) return "NZ";
  if (AU_HINTS.test(location)) return "AU";
  return null;
}

export function guessWorkType(text?: string | null): string | null {
  if (!text) return null;
  if (/\bhybrid\b/i.test(text)) return "hybrid";
  if (/\bremote\b|work from home|\bwfh\b/i.test(text)) return "remote";
  return null;
}
