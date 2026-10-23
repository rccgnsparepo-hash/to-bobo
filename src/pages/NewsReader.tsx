import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, RotateCw } from "lucide-react";
import { motion } from "framer-motion";
import { marked } from "marked";
import DOMPurify from "dompurify";

function cleanReader(md: string): string {
  // Strip Jina reader header block (Title:/URL Source:/Published Time:/Markdown Content:) and tag-only lines
  let s = md.replace(/^Title:.*$/im, "")
    .replace(/^URL Source:.*$/im, "")
    .replace(/^Published Time:.*$/im, "")
    .replace(/^Markdown Content:\s*/im, "")
    .replace(/^Warning:.*$/gim, "")
    .replace(/^Image \d+:.*$/gim, "")
    .trim();
  // Drop lines that are only hashtags / metadata-ish noise
  const lines = s.split("\n").filter((l) => {
    const t = l.trim();
    if (!t) return true;
    if (/^#\w[\w-]*(?:\s*,\s*#\w[\w-]*)*$/.test(t)) return false;
    return true;
  });
  return lines.join("\n").trim();
}

export default function NewsReaderPage() {
  const [params] = useSearchParams();
  const url = params.get("u") ?? "";
  const title = params.get("t") ?? "Article";
  const source = params.get("s") ?? "";
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`https://r.jina.ai/${url}`, { headers: { "X-Return-Format": "markdown" } });
      if (!res.ok) throw new Error("Reader unavailable");
      const md = await res.text();
      setContent(cleanReader(md));
    } catch (e) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (url) load(); }, [url]);

  return (
    <>
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border px-3 py-3 flex items-center gap-2">
        <Link to="/news" className="p-2"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-snap font-bold truncate">{source}</div>
          <div className="text-sm font-semibold truncate">{title}</div>
        </div>
        <button onClick={load} className="p-2 text-muted-foreground" aria-label="Reload"><RotateCw className="w-4 h-4" /></button>
        <a href={url} target="_blank" rel="noreferrer" className="p-2 text-muted-foreground" aria-label="Open original"><ExternalLink className="w-4 h-4" /></a>
      </header>
      <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="px-5 py-6 pb-40 max-w-2xl mx-auto">
        <h1 className="font-display text-2xl mb-4 leading-tight">{title}</h1>
        {loading && (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-secondary rounded w-3/4" />
            <div className="h-4 bg-secondary rounded w-full" />
            <div className="h-4 bg-secondary rounded w-5/6" />
            <div className="h-48 bg-secondary rounded-2xl" />
            <div className="h-4 bg-secondary rounded w-full" />
          </div>
        )}
        {error && <p className="text-destructive">Couldn't load reader: {error}. <a className="underline text-snap" href={url} target="_blank" rel="noreferrer">Open original ↗</a></p>}
        {!loading && !error && content && (
          <div
            className="article-body text-foreground/90"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(content, { async: false }) as string) }}
          />
        )}
        {!loading && !error && !content && (
          <p className="text-muted-foreground">No readable content. <a className="underline text-snap" href={url} target="_blank" rel="noreferrer">Open original ↗</a></p>
        )}
      </motion.article>
    </>
  );
}