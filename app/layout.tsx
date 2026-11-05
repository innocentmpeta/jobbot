import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { signOutAction } from "@/app/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobBot",
  description: "Job matches and application tracker for the household",
  appleWebApp: { capable: true, title: "JobBot", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <html lang="en-AU">
      <body>
        {session?.user && (
          <header className="nav">
            <Link href="/matches" className="brand">JobBot</Link>
            <nav>
              <Link href="/matches">Matches</Link>
              <Link href="/tracker">Tracker</Link>
              <Link href="/profile">Profile</Link>
            </nav>
            <form action={signOutAction}>
              <button className="link">Sign out</button>
            </form>
          </header>
        )}
        <main>{children}</main>
      </body>
    </html>
  );
}
