import { prisma } from "@/lib/db";
import { matchJob } from "@/lib/matching";
import { searchAdzuna } from "@/lib/sources/adzuna";
import { COMPANY_BOARDS, fetchCompanyBoards } from "@/lib/sources/boards";
import { fetchGmailAlerts } from "@/lib/sources/gmailAlerts";
import type { NormalizedJob } from "@/lib/sources/types";

const MAX_TITLES_PER_PERSON = 5;
const MATCH_WINDOW_DAYS = 21;

/**
 * Pulls jobs from every source into the shared pool, then re-matches recent jobs against each person.
 * Jobs are shared: one fetched for either of you is matched against both.
 */
export async function runIngest(opts: { userIds?: string[] } = {}) {
  const users = await prisma.user.findMany({
    where: { criteria: { isNot: null }, ...(opts.userIds ? { id: { in: opts.userIds } } : {}) },
    include: { criteria: true },
  });

  // One line per source, shown after "Refresh now" so it's clear where jobs did or didn't come from
  const notes: string[] = [];
  const track = (label: string, p: Promise<NormalizedJob[]>) =>
    p.then(
      (jobs) => {
        notes.push(`${label}: ${jobs.length} jobs`);
        return jobs;
      },
      (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`${label} failed: ${msg}`);
        notes.push(`${label}: failed. ${msg}`);
        return [] as NormalizedJob[];
      },
    );

  const batches: Promise<NormalizedJob[]>[] = [];
  if (COMPANY_BOARDS.length) batches.push(track("Company boards", fetchCompanyBoards()));
  else notes.push("Company boards: none added yet (lib/sources/boards.ts)");
  const adzunaOn = !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
  if (!adzunaOn) notes.push("Adzuna: not set up (no API key)");

  for (const u of users) {
    const c = u.criteria!;
    batches.push(track(`Gmail alerts (${u.email})`, fetchGmailAlerts(u.id)));
    if (!adzunaOn) continue;
    const countries = c.countries.filter((x): x is "AU" | "NZ" => x === "AU" || x === "NZ");
    const searches: Promise<NormalizedJob[]>[] = [];
    for (const title of c.titles.slice(0, MAX_TITLES_PER_PERSON)) {
      for (const country of countries) {
        searches.push(searchAdzuna({ country: country.toLowerCase() as "au" | "nz", what: title }));
      }
    }
    batches.push(track(`Adzuna (${u.email})`, Promise.all(searches).then((r) => r.flat())));
  }
  const fetched = (await Promise.all(batches)).flat();

  let saved = 0;
  for (const j of fetched) {
    await prisma.job.upsert({
      where: { source_externalId: { source: j.source, externalId: j.externalId } },
      create: j,
      update: { ...j, fetchedAt: new Date() },
    });
    saved++;
  }

  // Re-match everything recent, so criteria edits apply to jobs already in the pool
  const since = new Date(Date.now() - MATCH_WINDOW_DAYS * 86_400_000);
  const jobs = await prisma.job.findMany({ where: { fetchedAt: { gte: since } } });
  let matched = 0;
  for (const u of users) {
    for (const job of jobs) {
      const m = matchJob(job, u.criteria!);
      if (!m) continue;
      await prisma.match.upsert({
        where: { userId_jobId: { userId: u.id, jobId: job.id } },
        create: { userId: u.id, jobId: job.id, ...m },
        update: m, // leaves `dismissed` alone
      });
      matched++;
    }
  }

  return { users: users.length, fetched: saved, matched, notes };
}
