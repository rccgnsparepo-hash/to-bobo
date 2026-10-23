import { Suspense, lazy, useEffect, useState } from "react";

const RailProfileCard = lazy(() => import("./rail/RailProfileCard"));
const RailSuggestions = lazy(() => import("./rail/RailSuggestions"));
const RailNews = lazy(() => import("./rail/RailNews"));

function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card-glass rounded-2xl p-3 space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-3 rounded bg-secondary/70" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

/**
 * Secondary contextual column shown only on wide desktops (>=1280px).
 * Modules are code-split and mounted after the first paint / idle time so
 * they never compete with the feed for initial load.
 */
export function RightRail() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    }).requestIdleCallback;
    if (ric) {
      const id = ric(() => setReady(true), { timeout: 1500 });
      return () => (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(id);
    }
    const t = setTimeout(() => setReady(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <aside className="hidden xl:block w-[320px] shrink-0 min-w-0 border-l border-border">
      <div className="sticky top-0 p-6 space-y-6">
        {ready ? (
          <>
            <Suspense fallback={<Skeleton rows={2} />}>
              <RailProfileCard />
            </Suspense>
            <Suspense fallback={<Skeleton rows={4} />}>
              <RailSuggestions />
            </Suspense>
            <Suspense fallback={<Skeleton rows={4} />}>
              <RailNews />
            </Suspense>
          </>
        ) : (
          <>
            <Skeleton rows={2} />
            <Skeleton rows={4} />
          </>
        )}
      </div>
    </aside>
  );
}
