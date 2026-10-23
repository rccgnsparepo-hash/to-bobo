import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

type Challenge = { id: string; title: string; prompt: string; for_date: string };

export default function ChallengesPage() {
  const [list, setList] = useState<Challenge[]>([]);
  useEffect(() => {
    supabase.from("daily_challenges").select("*").order("for_date", { ascending: false }).limit(30).then(({ data }) => setList((data ?? []) as Challenge[]));
  }, []);
  return (
    <div>
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-3">
        <h1 className="font-display text-2xl tracking-tight flex items-center gap-2"><Sparkles className="w-5 h-5 text-snap" /> Daily challenges</h1>
      </header>
      <div className="p-4 space-y-3">
        {list.length === 0 && <p className="text-muted-foreground text-center py-12">No challenges yet.</p>}
        {list.map((c) => (
          <div key={c.id} className="rounded-2xl border border-border p-5 bg-card/50">
            <p className="text-xs text-snap font-semibold uppercase tracking-wider mb-1">{c.for_date}</p>
            <h2 className="font-bold text-lg">{c.title}</h2>
            <p className="text-sm text-muted-foreground mt-2">{c.prompt}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
