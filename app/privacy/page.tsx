export const metadata = { title: "Privacy — JobBot" };

export default function Privacy() {
  return (
    <article className="card">
      <h1>Privacy policy</h1>
      <p className="muted">Last updated 5 November 2026</p>
      <p>
        JobBot is a private app used only by the two household members on its allow list. It is not offered to the
        public.
      </p>
      <h2>What it stores</h2>
      <ul>
        <li>Your Google name, email address and profile picture, used to sign you in.</li>
        <li>The job criteria you enter, the jobs it finds, and the applications, notes and reminders you record.</li>
        <li>A Google OAuth token that lets it read your Gmail on a schedule.</li>
      </ul>
      <h2>How it uses Gmail</h2>
      <p>
        JobBot requests read-only Gmail access. It only searches for job alert emails from LinkedIn and SEEK and
        extracts job titles and links from them. It does not read, store or process any other email, never sends or
        changes email, and never shares Gmail data with anyone.
      </p>
      <p>
        JobBot's use of information received from Google APIs adheres to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>
      <h2>Where data lives</h2>
      <p>
        Data is stored in a private Postgres database and the app runs on Vercel. It is not sold, shared or used for
        advertising.
      </p>
      <h2>Removing your data</h2>
      <p>
        You can revoke Gmail access at any time at{" "}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
          myaccount.google.com/permissions
        </a>
        . To have your data deleted, email innompeta@gmail.com.
      </p>
    </article>
  );
}
