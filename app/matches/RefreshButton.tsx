"use client";

import { useActionState } from "react";
import { refreshNow, type RefreshResult } from "@/app/actions";

export function RefreshButton() {
  const [result, action, pending] = useActionState<RefreshResult, FormData>(refreshNow, null);
  return (
    <div className="refresh">
      <form action={action}>
        <button disabled={pending}>{pending ? "Refreshing…" : "Refresh now"}</button>
      </form>
      {result && !pending && (
        <div className={result.ok ? "card small" : "card small warn"}>
          <strong>{result.summary}</strong>
          {result.notes.length > 0 && (
            <ul>
              {result.notes.map((n) => <li key={n}>{n}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
