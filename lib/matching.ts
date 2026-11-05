import type { Criteria, Job, MatchCategory } from "@prisma/client";

export type MatchResult = {
  category: MatchCategory;
  score: number;
  reasons: string[];
  misses: string[];
};

type JobLike = Pick<
  Job,
  "title" | "location" | "country" | "salaryMin" | "salaryMax" | "currency" | "workType" | "description"
>;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim();
const STOPWORDS = new Set(["and", "or", "of", "the", "a", "in", "senior", "junior", "lead", "sr", "jr"]);
const money = (n: number, cur?: string | null) => `${cur ?? "$"} ${Math.round(n / 1000)}k`;

/**
 * Scores one job against one person's criteria.
 * EXACT: every hard criterion is met (unknown salary/work type counts as met).
 * RECOMMENDED: title is close and the overall score is decent, but something is off — `misses` says what.
 * Returns null when the job is irrelevant or hits an excluded keyword.
 */
export function matchJob(job: JobLike, c: Criteria): MatchResult | null {
  const title = norm(job.title);
  const text = norm(`${job.title} ${job.description ?? ""}`);
  const reasons: string[] = [];
  const misses: string[] = [];
  let score = 0;

  const excluded = c.excludeKeywords.find((k) => text.includes(norm(k)));
  if (excluded) return null;

  // Title — the one thing a match can't do without
  let titleFull = false;
  let titlePartial = false;
  for (const t of c.titles) {
    const wanted = norm(t);
    if (!wanted) continue;
    if (title.includes(wanted)) {
      titleFull = true;
      reasons.push(`Title matches "${t}"`);
      break;
    }
    const words = wanted.split(" ").filter((w) => !STOPWORDS.has(w));
    const hits = words.filter((w) => title.split(" ").includes(w));
    if (words.length && hits.length / words.length >= 0.5) titlePartial = true;
  }
  if (titleFull) score += 40;
  else if (titlePartial) {
    score += 20;
    misses.push("Title is related but not one of your target titles");
  } else return null;

  // Country — AU/NZ bias
  let countryOk = true;
  if (job.country) {
    if (c.countries.includes(job.country)) {
      score += 10;
      reasons.push(`Based in ${job.country === "NZ" ? "New Zealand" : job.country === "AU" ? "Australia" : job.country}`);
    } else {
      countryOk = false;
      misses.push(`Outside your countries (${job.country})`);
    }
  }

  // Location / work type
  let locationOk = c.locations.length === 0;
  const jobLoc = norm(job.location ?? "");
  for (const l of c.locations) {
    const wanted = norm(l);
    if (wanted === "remote" ? job.workType === "remote" : jobLoc.includes(wanted)) {
      locationOk = true;
      reasons.push(wanted === "remote" ? "Remote role" : `Located in ${l}`);
      break;
    }
  }
  if (locationOk) score += 25;
  else misses.push(`Location${job.location ? ` (${job.location})` : ""} isn't one of yours`);

  let workTypeOk = true;
  if (c.workTypes.length && job.workType) {
    workTypeOk = c.workTypes.includes(job.workType);
    if (workTypeOk) reasons.push(`${job.workType[0].toUpperCase()}${job.workType.slice(1)} work`);
    else misses.push(`${job.workType} isn't a work type you selected`);
  }

  // Salary — unknown salary doesn't block an exact match
  let salaryOk = true;
  const top = job.salaryMax ?? job.salaryMin;
  if (c.salaryMin && top) {
    if (top >= c.salaryMin) {
      score += 15;
      reasons.push(`Pays up to ${money(top, job.currency)} (your floor ${money(c.salaryMin, job.currency)})`);
    } else {
      salaryOk = false;
      const gap = Math.round(((c.salaryMin - top) / c.salaryMin) * 100);
      misses.push(`Salary tops out ${gap}% below your floor`);
      if (gap <= 10) score += 5;
    }
  } else {
    score += 5;
  }

  // Nice-to-have keywords
  const hitKeywords = c.keywords.filter((k) => text.includes(norm(k)));
  if (hitKeywords.length) {
    score += Math.min(10, hitKeywords.length * 3);
    reasons.push(`Mentions ${hitKeywords.slice(0, 4).join(", ")}`);
  }

  score = Math.min(100, score);
  const exact = titleFull && countryOk && locationOk && workTypeOk && salaryOk;
  if (exact) return { category: "EXACT", score, reasons, misses };
  if (score >= 45) return { category: "RECOMMENDED", score, reasons, misses };
  return null;
}
