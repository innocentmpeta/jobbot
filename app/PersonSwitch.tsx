import Link from "next/link";
import { firstName } from "@/lib/household";

type Person = { id: string; name: string | null; email: string };

export function PersonSwitch({
  people,
  viewingId,
  meId,
  href,
}: {
  people: Person[];
  viewingId: string;
  meId: string;
  href: (id: string) => string;
}) {
  if (people.length < 2) return null;
  return (
    <div className="tabs">
      {people.map((p) => (
        <Link key={p.id} href={href(p.id)} className={p.id === viewingId ? "tab active" : "tab"}>
          {p.id === meId ? "Me" : firstName(p)}
        </Link>
      ))}
    </div>
  );
}
