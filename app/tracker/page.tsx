import type { AppStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getHousehold } from "@/lib/household";
import { updateApplication } from "@/app/actions";
import { PersonSwitch } from "@/app/PersonSwitch";

export const dynamic = "force-dynamic";

const STATUSES: AppStatus[] = ["SAVED", "APPLIED", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"];
const label = (s: string) => s[0] + s.slice(1).toLowerCase();
const date = (d?: Date | null) =>
  d ? d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default async function Tracker({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  const me = await requireUser();
  const { who } = await searchParams;
  const { people, viewing, isMe } = await getHousehold(me.id, who);

  const apps = await prisma.application.findMany({
    where: { userId: viewing.id },
    include: { job: true },
    orderBy: [{ followUpAt: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
  });
  const now = new Date();
  const open = (s: AppStatus) => s === "SAVED" || s === "APPLIED" || s === "INTERVIEW";
  const due = apps.filter((a) => a.followUpAt && a.followUpAt <= now && open(a.status));

  return (
    <>
      <h1>Tracker</h1>
      <PersonSwitch people={people} viewingId={viewing.id} meId={me.id} href={(id) => `/tracker?who=${id}`} />

      <div className="row stats">
        {STATUSES.map((s) => (
          <div key={s} className="stat">
            <span>{apps.filter((a) => a.status === s).length}</span>
            {label(s)}
          </div>
        ))}
      </div>

      {due.length > 0 && <div className="card warn">{due.length} follow-up{due.length > 1 ? "s" : ""} due</div>}
      {apps.length === 0 && <p className="muted">No applications recorded yet.</p>}

      {apps.map((a) => {
        const isDue = a.followUpAt && a.followUpAt <= now && open(a.status);
        return (
          <article key={a.id} className={isDue ? "card job due" : "card job"}>
            <h2>
              <a href={a.job.url} target="_blank" rel="noreferrer">{a.job.title}</a>
            </h2>
            <p className="muted">
              {[a.job.company, a.job.location].filter(Boolean).join(" · ")} · applied {date(a.appliedAt)}
            </p>
            <p><strong>Why: </strong>{a.reason}</p>

            {isMe ? (
              <form action={updateApplication} className="grid">
                <input type="hidden" name="id" value={a.id} />
                <label>
                  Status
                  <select name="status" defaultValue={a.status}>
                    {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                  </select>
                </label>
                <label>
                  Follow up on
                  <input type="date" name="followUpAt" defaultValue={a.followUpAt?.toISOString().slice(0, 10) ?? ""} />
                </label>
                <label className="wide">
                  Notes
                  <textarea name="notes" rows={2} defaultValue={a.notes ?? ""} placeholder="Recruiter name, interview dates…" />
                </label>
                <button>Save</button>
              </form>
            ) : (
              <p className="muted">
                {label(a.status)} · follow up {date(a.followUpAt)}
                {a.notes && <> · {a.notes}</>}
              </p>
            )}
          </article>
        );
      })}
    </>
  );
}
