import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";

type Person = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
};

/** Right-rail module: suggested people to follow. */
export default function RailSuggestions() {
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    supabase
      .from("profiles")
      .select("id, handle, display_name, avatar_url, bio")
      .neq("id", user.id)
      .limit(5)
      .then(({ data }) => {
        if (alive) setPeople((data ?? []) as Person[]);
      });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  if (people.length === 0) return null;
  return (
    <section>
      <h2 className="font-display text-sm mb-2 flex items-center gap-2 text-muted-foreground">
        <UserPlus className="w-4 h-4 text-snap" /> Suggested flickers
      </h2>
      <div className="card-glass rounded-2xl divide-y divide-border/60">
        {people.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-3 min-w-0">
            <Link to={`/u/${p.handle}`}>
              <Avatar url={p.avatar_url} name={p.display_name} size={36} />
            </Link>
            <div className="flex-1 min-w-0">
              <Link to={`/u/${p.handle}`} className="block text-sm font-semibold truncate">
                {p.display_name}
              </Link>
              <div className="text-xs text-muted-foreground truncate">@{p.handle}</div>
            </div>
            <Link to={`/u/${p.handle}`} className="text-[11px] font-bold text-snap shrink-0">
              View
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}