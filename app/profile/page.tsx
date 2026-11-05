import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { saveCriteria } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function Profile() {
  const user = await requireUser();
  const c = await prisma.criteria.findUnique({ where: { userId: user.id } });
  const countries = c?.countries ?? ["AU", "NZ"];
  const workTypes = c?.workTypes ?? [];

  return (
    <>
      <h1>Your criteria</h1>
      <p className="muted">Signed in as {user.email}. Separate lists with commas or new lines.</p>
      <form action={saveCriteria} className="card stack">
        <label>
          Job titles
          <textarea name="titles" rows={2} defaultValue={c?.titles.join(", ")} placeholder="Product manager, Product owner" required />
        </label>
        <label>
          Locations
          <textarea name="locations" rows={2} defaultValue={c?.locations.join(", ")} placeholder="Sydney, Melbourne, Auckland, Remote" />
        </label>

        <fieldset>
          <legend>Countries</legend>
          {[["AU", "Australia"], ["NZ", "New Zealand"]].map(([v, l]) => (
            <label key={v} className="inline">
              <input type="checkbox" name="countries" value={v} defaultChecked={countries.includes(v)} /> {l}
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>Work type (leave all unticked for any)</legend>
          {["remote", "hybrid", "onsite"].map((v) => (
            <label key={v} className="inline">
              <input type="checkbox" name="workTypes" value={v} defaultChecked={workTypes.includes(v)} /> {v}
            </label>
          ))}
        </fieldset>

        <div className="row">
          <label>
            Salary floor (annual, AUD/NZD)
            <input name="salaryMin" inputMode="numeric" defaultValue={c?.salaryMin ?? ""} placeholder="120000" />
          </label>
          <label>
            Salary ceiling (optional)
            <input name="salaryMax" inputMode="numeric" defaultValue={c?.salaryMax ?? ""} />
          </label>
        </div>
        <p className="muted small">
          Australian ads often quote base + super. Enter the figure you compare against (base salary works best).
        </p>

        <label>
          Nice-to-have keywords
          <textarea name="keywords" rows={2} defaultValue={c?.keywords.join(", ")} placeholder="SQL, stakeholder management, fintech" />
        </label>
        <label>
          Exclude jobs mentioning
          <textarea name="excludeKeywords" rows={2} defaultValue={c?.excludeKeywords.join(", ")} placeholder="commission only, unpaid, graduate" />
        </label>
        <label>
          Work rights
          <input name="workRights" defaultValue={c?.workRights ?? ""} placeholder="Australian citizen / NZ resident, needs AU sponsorship…" />
        </label>

        <button className="primary">Save criteria</button>
      </form>
    </>
  );
}
