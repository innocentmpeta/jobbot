import { prisma } from "@/lib/db";
import { NormalizedJob, stripHtml } from "./types";

/**
 * Reads LinkedIn and SEEK job alert emails from a user's own Gmail and pulls out the jobs they link to.
 * Nothing is scraped from LinkedIn or SEEK themselves: the alerts are emails those sites send you.
 * Alert email layouts change, so parsing is best effort. Only the title and link are reliable.
 */

const ALERT_QUERY =
  "(from:jobalerts-noreply@linkedin.com OR from:jobs-noreply@linkedin.com OR from:seek.com.au OR from:seek.co.nz) newer_than:3d";

const LINK_PATTERNS: { source: string; re: RegExp; url: (id: string) => string; country?: string }[] = [
  {
    source: "linkedin-alert",
    re: /https?:\/\/(?:[a-z]+\.)?linkedin\.com\/(?:comm\/)?jobs\/view\/(\d+)/i,
    url: (id) => `https://www.linkedin.com/jobs/view/${id}/`,
  },
  {
    source: "seek-alert",
    re: /https?:\/\/(?:www\.)?seek\.com\.au\/job\/(\d+)/i,
    url: (id) => `https://www.seek.com.au/job/${id}`,
    country: "AU",
  },
  {
    source: "seek-alert",
    re: /https?:\/\/(?:www\.)?seek\.co\.nz\/job\/(\d+)/i,
    url: (id) => `https://www.seek.co.nz/job/${id}`,
    country: "NZ",
  },
];

const JUNK_TEXT = /^(view( job)?|apply( now)?|see (all )?jobs?|easy apply|save|more|unsubscribe)$/i;

type GmailPart = { mimeType?: string; body?: { data?: string }; parts?: GmailPart[] };

function decodePart(part: GmailPart): string {
  let out = "";
  if (part.mimeType === "text/html" && part.body?.data) {
    out += Buffer.from(part.body.data, "base64url").toString("utf8");
  }
  for (const p of part.parts ?? []) out += decodePart(p);
  return out;
}

export function parseAlertHtml(html: string): NormalizedJob[] {
  const found = new Map<string, NormalizedJob>();
  const anchorRe = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const [, rawHref, inner] of html.matchAll(anchorRe)) {
    const href = rawHref.replace(/&amp;/g, "&");
    for (const p of LINK_PATTERNS) {
      const m = href.match(p.re);
      if (!m) continue;
      const key = `${p.source}:${m[1]}`;
      const text = stripHtml(inner);
      const existing = found.get(key);
      const goodText = text.length > 2 && !JUNK_TEXT.test(text);
      if (!existing) {
        found.set(key, {
          source: p.source,
          externalId: m[1],
          title: goodText ? text : "",
          country: p.country ?? null,
          url: p.url(m[1]),
        });
      } else if (goodText && text.length > existing.title.length) {
        existing.title = text;
      }
    }
  }
  return [...found.values()].filter((j) => j.title);
}

async function getAccessToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({ where: { userId, provider: "google" } });
  if (!account?.refresh_token) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID ?? "",
      client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
      refresh_token: account.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    console.warn(`Gmail token refresh failed for ${userId}: ${res.status} — sign in again to re-grant access`);
    return null;
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function fetchGmailAlerts(userId: string): Promise<NormalizedJob[]> {
  const token = await getAccessToken(userId);
  if (!token) return [];
  const headers = { Authorization: `Bearer ${token}` };
  const api = "https://gmail.googleapis.com/gmail/v1/users/me/messages";

  const list = await fetch(`${api}?${new URLSearchParams({ q: ALERT_QUERY, maxResults: "25" })}`, { headers });
  if (!list.ok) {
    console.warn(`Gmail list failed for ${userId}: ${list.status}`);
    return [];
  }
  const { messages = [] } = (await list.json()) as { messages?: { id: string }[] };

  const jobs: NormalizedJob[] = [];
  for (const { id } of messages) {
    const res = await fetch(`${api}/${id}?format=full`, { headers });
    if (!res.ok) continue;
    const msg = (await res.json()) as { payload?: GmailPart; internalDate?: string };
    if (!msg.payload) continue;
    const postedAt = msg.internalDate ? new Date(Number(msg.internalDate)) : null;
    for (const job of parseAlertHtml(decodePart(msg.payload))) jobs.push({ ...job, postedAt });
  }
  return jobs;
}
