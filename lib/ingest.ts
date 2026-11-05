import { prisma } from "@/lib/db";
import { matchJob } from "@/lib/matching";
import { searchAdzuna } from "@/lib/sources/adzuna";
import { fetchCompanyBoards } from "@/lib/sources/boards";
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

  const batches: Promise<NormalizedJob[]>[] = [fetchCompanyBoards()];
  for (const u of users) {
    const c = u.criteria!;
    batches.push(fetchGmailAlerts(u.id).catch(() => []));
    const countries = c.countries.filter((x): x is "AU" | "NZ" => x === "AU" || x === "NZ");
    for (const title of c.titles.slice(0, MAX_TITLES_PER_PERSON)) {
      for (const country of countries) {
        batches.push(
          searchAdzuna({ country: country.toLowerCase() as "au" | "nz", what: title }).catch(() => []),
        );
      }
    }
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

  return { users: users.length, fetched: saved, matched };
}
