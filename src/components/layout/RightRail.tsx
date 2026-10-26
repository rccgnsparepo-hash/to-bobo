import RailProfileCard from "./rail/RailProfileCard";
import RailSuggestions from "./rail/RailSuggestions";
import RailNews from "./rail/RailNews";

/**
 * Secondary contextual column shown only on wide desktops (>=1280px).
 */
export function RightRail() {
  return (
    <aside className="hidden xl:block w-[320px] shrink-0 min-w-0 border-l border-border">
      <div className="sticky top-0 p-6 space-y-6">
        <RailProfileCard />
        <RailSuggestions />
        <RailNews />
      </div>
    </aside>
  );
}
export default RightRail;
