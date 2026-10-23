import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";

/** Right-rail module: the signed-in user's mini profile card. */
export default function RailProfileCard() {
  const { profile } = useAuth();
  if (!profile) return null;
  return (
    <Link to="/profile" className="flex items-center gap-3 p-3 rounded-2xl card-glass">
      <Avatar url={profile.avatar_url} name={profile.display_name} size={44} />
      <div className="min-w-0">
        <div className="font-semibold text-sm truncate">{profile.display_name}</div>
        <div className="text-xs text-muted-foreground truncate">@{profile.handle}</div>
      </div>
    </Link>
  );
}