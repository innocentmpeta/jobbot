import { signInWithGoogle } from "@/app/actions";

export default async function SignIn({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="card narrow center">
      <h1>JobBot</h1>
      <p className="muted">Private to our household.</p>
      {error && (
        <p className="error">
          {error === "AccessDenied" ? "That Google account isn't on the allow list." : "Sign-in failed, try again."}
        </p>
      )}
      <form action={signInWithGoogle}>
        <button className="primary">Sign in with Google</button>
      </form>
      <p className="muted small">
        Google will ask for read-only Gmail access. It's used only to read LinkedIn and SEEK job alert emails.
      </p>
      <p className="small">
        <a href="/privacy">Privacy policy</a> · <a href="/terms">Terms</a>
      </p>
    </div>
  );
}
