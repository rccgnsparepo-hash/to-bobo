import { Link } from "react-router-dom";
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <Link to="/" className="inline-block mt-6 px-4 py-2 rounded-full bg-snap text-snap-foreground font-bold">Go home</Link>
      </div>
    </div>
  );
}
