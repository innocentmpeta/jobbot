import Link from "next/link";
import type { MatchCategory } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { firstName, getHousehold } from "@/lib/household";
import { dismissMatch, markApplied } from "@/app/actions";
import { RefreshButton } from "@/app/matches/RefreshButton";
import { PersonSwitch } from "@/app/PersonSwitch";

export const dynamic = "force-dynamic";
// "Refresh now" runs the whole ingest inside this page's server action
export const maxDuration = 60;

const city = (loc?: string | null) => loc?.split(",")[0].trim() || null;

function salary(min?: number | null, max?: number | null, cur?: string | null) {
  if (!min && !max) return null;
  const k = (n: number) => `${Math.round(n / 1000)}k`;
  const range = min && max && min !== max ? `${k(min)}–${k(max)}` : k((max ?? min)!);
  return `${cur ?? "$"} ${range}`;
}

export default async function Matches({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; who?: string }>;
}) {
  const me = await requireUser();
  const { tab, who } = await searchParams;
  const category: MatchCategory = tab === "recommended" ? "RECOMMENDED" : "EXACT";
  const { people, viewing, isMe } = await getHousehold(me.id, who);
  const qs = (t: string, w: string) => `/matches?tab=${t}&who=${w}`;
  const tabKey = category === "EXACT" ? "exact" : "recommended";

  const [matches, counts, criteria] = await Promise.all([
    prisma.match.findMany({
      where: { userId: viewing.id, category, dismissed: false, job: { applications: { none: { userId: viewing.id } } } },
      include: { job: true },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.match.groupBy({
      by: ["category"],
      where: { userId: viewing.id, dismissed: false, job: { applications: { none: { userId: viewing.id } } } },
      _count: true,
    }),
    prisma.criteria.findUnique({ where: { userId: viewing.id } }),
  ]);
  const count = (c: MatchCategory) => counts.find((x) => x.category === c)?._count ?? 0;

  // Cities where both of you have live matches — useful if you'd move together
  let sharedCities: { city: string; perPerson: number[] }[] = [];
  if (people.length >= 2) {
    const all = await prisma.match.findMany({
      where: { dismissed: false, userId: { in: people.map((p) => p.id) } },
      select: { userId: true, job: { select: { location: true } } },
    });
    const byCity = new Map<string, Map<string, number>>();
    for (const m of all) {
      const c = city(m.job.location);
      if (!c || /remote/i.test(c)) continue;
      const per = byCity.get(c) ?? new Map<string, number>();
      per.set(m.userId, (per.get(m.userId) ?? 0) + 1);
      byCity.set(c, per);
    }
    sharedCities = [...byCity]
      .filter(([, per]) => people.every((p) => per.has(p.id)))
      .map(([c, per]) => ({ city: c, perPerson: people.map((p) => per.get(p.id) ?? 0) }))
      .sort((a, b) => b.perPerson.reduce((x, y) => x + y) - a.perPerson.reduce((x, y) => x + y))
      .slice(0, 6);
  }

  return (
    <>
      <div className="row between">
        <h1>Matches</h1>
        {isMe && <RefreshButton />}
      </div>

      <PersonSwitch people={people} viewingId={viewing.id} meId={me.id} href={(id) => qs(tabKey, id)} />

      {!criteria && (
        <div className="card">
          {isMe ? (
            <>No criteria yet. <Link href="/profile">Set up your profile</Link> and then refresh.</>
          ) : (
            <>{firstName(viewing)} hasn't set up their criteria yet.</>
          )}
        </div>
      )}

      {sharedCities.length > 0 && (
        <div className="card">
          <strong>Cities with matches for both of you: </strong>
          {sharedCities.map((c, i) => (
            <span key={c.city}>
              {i > 0 && " · "}
              {c.city} ({c.perPerson.join(" / ")})
            </span>
          ))}
        </div>
      )}

      <div className="tabs">
        <Link href={qs("exact", viewing.id)} className={category === "EXACT" ? "tab active" : "tab"}>
          Exact matches ({count("EXACT")})
        </Link>
        <Link href={qs("recommended", viewing.id)} className={category === "RECOMMENDED" ? "tab active" : "tab"}>
          Recommendations ({count("RECOMMENDED")})
        </Link>
      </div>

      {matches.length === 0 && <p className="muted">Nothing here yet.</p>}

      {matches.map(({ id, job, score, reasons, misses }) => (
        <article key={id} className="card job">
          <div className="row between">
            <div>
              <h2>
                <a href={job.url} target="_blank" rel="noreferrer">{job.title}</a>
              </h2>
              <p className="muted">
                {[job.company, job.location, salary(job.salaryMin, job.salaryMax, job.currency), job.workType]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <span className="score">{score}</span>
          </div>
          <ul className="reasons">
            {reasons.map((r) => <li key={r} className="ok">{r}</li>)}
            {misses.map((r) => <li key={r} className="miss">{r}</li>)}
          </ul>
          <p className="muted small">via {job.source}</p>

          {isMe && (
            <div className="row actions">
              <a className="button primary" href={job.url} target="_blank" rel="noreferrer">Open application</a>
              <details>
                <summary className="button">Record it</summary>
                <form action={markApplied} className="stack">
                  <input type="hidden" name="jobId" value={job.id} />
                  <label>
                    Why this job?
                    <textarea name="reason" rows={3} defaultValue={reasons.join("; ")} />
                  </label>
                  <label>
                    Follow up in
                    <select name="followUpDays" defaultValue="7">
                      <option value="">No reminder</option>
                      <option value="3">3 days</option>
                      <option value="7">1 week</option>
                      <option value="14">2 weeks</option>
                    </select>
                  </label>
                  <div className="row">
                    <button className="primary" name="status" value="APPLIED">I applied</button>
                    <button name="status" value="SAVED">Save for later</button>
                  </div>
                </form>
              </details>
              <form action={dismissMatch}>
                <input type="hidden" name="matchId" value={id} />
                <button className="link">Not interested</button>
              </form>
            </div>
          )}
        </article>
      ))}
    </>
  );
}
