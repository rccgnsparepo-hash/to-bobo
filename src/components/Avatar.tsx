import { cn } from "@/lib/utils";

type Props = {
  url?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  ring?: boolean;
};

export function Avatar({ url, name, size = 44, className, ring }: Props) {
  const initial = (name?.[0] ?? "?").toUpperCase();
  return (
    <div
      className={cn(
        "rounded-full overflow-hidden grid place-items-center font-bold bg-snap text-snap-foreground shrink-0",
        ring && "ring-2 ring-snap/60",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}