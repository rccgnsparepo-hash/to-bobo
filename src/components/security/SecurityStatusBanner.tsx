import { useEffect, useState } from "react";
import { ShieldAlert, Info, ChevronRight, X, Clock } from "lucide-react";
import { fetchAccountSecurityStanding, type AccountSecurityProfile } from "@/lib/securityService";
import { useAuth } from "@/lib/auth";

interface Props {
  onOpenInspector?: () => void;
}

export function SecurityStatusBanner({ onOpenInspector }: Props) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<AccountSecurityProfile | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    const identifier = user.id || user.email || "";
    fetchAccountSecurityStanding(identifier).then((p) => {
      if (p && (p.status === "restricted" || p.riskTier === "high")) {
        setProfile(p);
      }
    });
  }, [user]);

  if (!profile || dismissed) return null;

  return (
    <div className="w-full bg-gradient-to-r from-amber-500/15 via-zinc-900 to-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 text-xs text-amber-200">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-amber-300 mr-1.5">
              Provisional Safety Mode Active:
            </span>
            <span className="text-zinc-300">
              Account created with elevated registration density. Outbound direct messages are rate-limited ({profile.featureLimits.dmRateLimitPerMinute}/min) for 48 hours to protect community safety.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenInspector && (
            <button
              onClick={onOpenInspector}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Security Standing</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-zinc-400 hover:text-zinc-200 rounded-md transition-colors"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
