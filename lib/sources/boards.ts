import { NormalizedJob, guessCountry, guessWorkType, stripHtml } from "./types";

/**
 * Company job boards to watch, by hiring system.
 * The token is the slug in the company's public board URL:
 *   boards.greenhouse.io/<token>   → { ats: "greenhouse", token: "<token>" }
 *   jobs.lever.co/<token>          → { ats: "lever", token: "<token>" }
 * Wrong tokens are skipped with a warning, so it's safe to experiment.
 */
export const COMPANY_BOARDS: { ats: "greenhouse" | "lever"; token: string; company: string }[] = [
  // { ats: "greenhouse", token: "examplecompany", company: "Example Co" },
  // { ats: "lever", token: "examplecompany", company: "Example Co" },
];

type GreenhouseJob = {
  id: number;
  title: string;
  absolute_url: string;
  updated_at?: string;
  location?: { name?: string };
  content?: string;
};

async function fetchGreenhouse(token: string, company: string): Promise<NormalizedJob[]> {
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`, {
    cache: "no-store",
  });
  if (!res.ok) {
    console.warn(`Greenhouse board "${token}" failed: ${res.status}`);
    return [];
  }
  const data = (await res.json()) as { jobs?: GreenhouseJob[] };
  return (data.jobs ?? []).map((j) => {
    const location = j.location?.name ?? null;
    const description = j.content ? stripHtml(j.content) : null;
    return {
      source: "greenhouse",
      externalId: `${token}:${j.id}`,
      title: j.title,
      company,
      location,
      country: guessCountry(location),
      workType: guessWorkType(`${location ?? ""} ${j.title}`),
      url: j.absolute_url,
      description,
      postedAt: j.updated_at ? new Date(j.updated_at) : null,
    };
  });
}

type LeverPosting = {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt?: number;
  descriptionPlain?: string;
  workplaceType?: string;
  categories?: { location?: string; commitment?: string };
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
};

async function fetchLever(token: string, company: string): Promise<NormalizedJob[]> {
  const res = await fetch(`https://api.lever.co/v0/postings/${token}?mode=json`, { cache: "no-store" });
  if (!res.ok) {
    console.warn(`Lever board "${token}" failed: ${res.status}`);
    return [];
  }
  const postings = (await res.json()) as LeverPosting[];
  return postings.map((p) => {
    const location = p.categories?.location ?? null;
    const yearly = p.salaryRange?.interval === "per-year-salary";
    return {
      source: "lever",
      externalId: `${token}:${p.id}`,
      title: p.text,
      company,
      location,
      country: guessCountry(location),
      salaryMin: yearly ? p.salaryRange?.min ?? null : null,
      salaryMax: yearly ? p.salaryRange?.max ?? null : null,
      currency: yearly ? p.salaryRange?.currency ?? null : null,
      workType: p.workplaceType && p.workplaceType !== "unspecified" ? p.workplaceType : guessWorkType(location),
      url: p.hostedUrl,
      description: p.descriptionPlain ?? null,
      postedAt: p.createdAt ? new Date(p.createdAt) : null,
    };
  });
}

export async function fetchCompanyBoards(): Promise<NormalizedJob[]> {
  const results = await Promise.all(
    COMPANY_BOARDS.map((b) =>
      (b.ats === "greenhouse" ? fetchGreenhouse(b.token, b.company) : fetchLever(b.token, b.company)).catch(
        (err) => {
          console.warn(`Board ${b.ats}/${b.token} error`, err);
          return [] as NormalizedJob[];
        },
      ),
    ),
  );
  return results.flat();
}
