import { NormalizedJob, guessWorkType, stripHtml } from "./types";

type AdzunaResult = {
  id: string;
  title: string;
  description?: string;
  redirect_url: string;
  created?: string;
  salary_min?: number;
  salary_max?: number;
  company?: { display_name?: string };
  location?: { display_name?: string };
  contract_time?: string;
};

const CURRENCY: Record<string, string> = { au: "AUD", nz: "NZD" };

/** Searches Adzuna for one title in one country (au | nz), optionally near a location. */
export async function searchAdzuna(opts: {
  country: "au" | "nz";
  what: string;
  where?: string;
  salaryMin?: number | null;
  maxDaysOld?: number;
}): Promise<NormalizedJob[]> {
  const { ADZUNA_APP_ID, ADZUNA_APP_KEY } = process.env;
  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) return [];

  const params = new URLSearchParams({
    app_id: ADZUNA_APP_ID,
    app_key: ADZUNA_APP_KEY,
    what: opts.what,
    results_per_page: "50",
    max_days_old: String(opts.maxDaysOld ?? 7),
    "content-type": "application/json",
  });
  if (opts.where && !/remote/i.test(opts.where)) params.set("where", opts.where);
  if (opts.salaryMin) params.set("salary_min", String(opts.salaryMin));

  const res = await fetch(`https://api.adzuna.com/v1/api/jobs/${opts.country}/search/1?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`${opts.country.toUpperCase()} "${opts.what}" returned ${res.status}: ${(await res.text()).slice(0, 150)}`);
  }
  const data = (await res.json()) as { results?: AdzunaResult[] };

  return (data.results ?? []).map((r) => {
    const description = r.description ? stripHtml(r.description) : null;
    return {
      source: `adzuna-${opts.country}`,
      externalId: String(r.id),
      title: stripHtml(r.title),
      company: r.company?.display_name ?? null,
      location: r.location?.display_name ?? null,
      country: opts.country.toUpperCase(),
      salaryMin: r.salary_min ? Math.round(r.salary_min) : null,
      salaryMax: r.salary_max ? Math.round(r.salary_max) : null,
      currency: CURRENCY[opts.country],
      workType: guessWorkType(`${r.title} ${description ?? ""}`),
      url: r.redirect_url,
      description,
      postedAt: r.created ? new Date(r.created) : null,
    };
  });
}
