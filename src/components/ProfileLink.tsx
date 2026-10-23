import { Link } from "react-router-dom";
import { Avatar } from "./Avatar";

type Props = {
  url?: string | null;
  name?: string | null;
  handle?: string | null;
  size?: number;
  ring?: boolean;
  className?: string;
};

export function ProfileLink({ handle, ...rest }: Props) {
  if (!handle) return <Avatar {...rest} />;
  return (
    <Link to={`/u/${handle}`} onClick={(e) => e.stopPropagation()} className="shrink-0 inline-block">
      <Avatar {...rest} />
    </Link>
  );
}