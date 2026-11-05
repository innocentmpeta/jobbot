import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    Google({
      authorization: {
        params: {
          // gmail.readonly lets the cron job read LinkedIn/SEEK job alert emails
          scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  pages: { signIn: "/signin" },
  callbacks: {
    signIn({ user }) {
      return !!user.email && allowedEmails.includes(user.email.toLowerCase());
    },
  },
  events: {
    // The adapter only stores tokens when an account is first linked; keep them fresh on every sign-in
    async signIn({ account }) {
      if (!account?.refresh_token) return;
      await prisma.account.updateMany({
        where: { provider: account.provider, providerAccountId: account.providerAccountId },
        data: {
          refresh_token: account.refresh_token,
          access_token: account.access_token,
          expires_at: account.expires_at,
          scope: account.scope,
        },
      });
    },
  },
});

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  return session.user as { id: string; email: string; name?: string | null };
}
