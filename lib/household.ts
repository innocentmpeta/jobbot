import { prisma } from "@/lib/db";

export const firstName = (u: { name?: string | null; email: string }) => u.name?.split(" ")[0] ?? u.email.split("@")[0];

/** Everyone who has signed in, plus which of them the page is showing (`who` is a user id from the URL). */
export async function getHousehold(meId: string, who?: string) {
  const people = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true } });
  const viewing = people.find((p) => p.id === who) ?? people.find((p) => p.id === meId)!;
  return { people, viewing, isMe: viewing.id === meId };
}
