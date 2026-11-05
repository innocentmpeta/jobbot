# JobBot

A private job-matching and application tracker for two people, biased to Australia and New Zealand.

- **Sources:** Adzuna (AU + NZ), company job boards on Greenhouse/Lever, and your own LinkedIn and SEEK job alert emails (read from Gmail, so neither site is scraped).
- **Matches:** per person, split into **Exact matches** (every hard criterion met) and **Recommendations** (close, with the misses spelled out).
- **Tracker:** what you applied for, why, its status, notes and follow-up dates.
- **Household:** each of you can view the other's matches and tracker (read-only), plus cities where you both have matches.
- **Mobile:** it's a PWA. Open it on your phone and use "Add to Home Screen".

Applying stays manual for now: "Open application" takes you to the job, and "Record it" logs it.

## Setup

### 1. Google OAuth (sign-in + Gmail alerts)
1. In [Google Cloud Console](https://console.cloud.google.com), create a project and enable the **Gmail API**.
2. Configure the OAuth consent screen: External; add the `gmail.readonly` scope; add both Gmail addresses as test users.
3. Create an **OAuth client ID** (Web application) with redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-domain>/api/auth/callback/google`
4. **Important:** while the app is in "Testing" status, Google expires refresh tokens after 7 days, so Gmail alerts would stop weekly. Click **Publish app**. Without Google verification you'll see an "unverified app" warning when signing in. Click through it; that's fine for personal use.

### 2. Adzuna
Register at [developer.adzuna.com](https://developer.adzuna.com) for a free app ID and key.

### 3. Job alerts
In LinkedIn and SEEK, create job alerts for your searches, delivered by **email** to the Gmail account you sign in with. The daily job reads alerts from the last 3 days.

### 4. Company boards (optional)
Add companies you're targeting to `COMPANY_BOARDS` in [lib/sources/boards.ts](lib/sources/boards.ts). The token is the slug in `boards.greenhouse.io/<token>` or `jobs.lever.co/<token>`.

### 5. Run locally
```bash
cp .env.example .env    # fill it in
npm install
npm run db:push         # creates the tables
npm run dev
```

### 6. Deploy to Vercel
1. Push this folder to a GitHub repo and import it in Vercel.
2. In the project's **Storage** tab, add **Neon Postgres**. It sets `DATABASE_URL`.
3. Add the other variables from `.env.example` (`AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_EMAILS`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `CRON_SECRET`).
4. Run `npm run db:push` once against the production `DATABASE_URL`.
5. Add your domain in Vercel → Domains, and add its callback URL to the Google OAuth client.

The cron in `vercel.json` runs daily at 20:00 UTC (7am Sydney summer time, 6am in winter). You can also press **Refresh now** on the Matches page.

## How matching works
See [lib/matching.ts](lib/matching.ts). Score out of 100: title 40, location 25, salary 15, country 10, keywords 10.
- A job is skipped if its title isn't related to any of your titles, or it mentions an excluded keyword.
- **Exact:** the title contains one of your titles, it's in your countries and locations, the work type is allowed, and the salary isn't below your floor. Unknown salary or work type doesn't count against it.
- **Recommendation:** not exact, but scoring 45+.

## Roadmap
- Tailored cover letters and CV notes per job (LLM)
- Push notifications for follow-ups and new exact matches
- Merging the same job seen on several sources
- Browser extension to save jobs and pre-fill forms while you browse LinkedIn/SEEK
