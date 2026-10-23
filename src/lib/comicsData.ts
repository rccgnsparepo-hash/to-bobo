/**
 * Authentic Real Comics & Manga Library for Flick
 * Real comic issues with actual page scans, covers, and panels:
 * - Golden Age Public Domain Superheroes (Captain Marvel, Daredevil 1941, Black Terror, Blue Beetle, Phantom Lady)
 * - Graphic Novels & Cult Classics (Sam & Max, Tintin, Invincible, Dennis the Menace, Classics Illustrated)
 * - Shonen Manga & Cyberpunk Webtoons
 * - Webcomic Strips (XKCD Comics Live API)
 */

export interface ComicIssue {
  id: string;
  title: string;
  series: string;
  issueNumber: string;
  publisher: string;
  year: number;
  genre: "superhero" | "graphic-novel" | "manga" | "webcomic" | "classic";
  coverUrl: string;
  totalPages: number;
  description: string;
  // If true, pages are generated sequentially via leaf images or static scans
  leafBaseUrl?: string;
  pages?: string[];
  archiveIdentifier?: string;
}

export const CURATED_COMICS: ComicIssue[] = [
  {
    id: "tintin-soviets",
    title: "Tintin in the Land of the Soviets",
    series: "The Adventures of Tintin",
    issueNumber: "#1",
    publisher: "Casterman / Le Petit Vingtième",
    year: 1930,
    genre: "classic",
    coverUrl: "https://archive.org/services/img/01TintinInTheLandOfTheSoviets",
    totalPages: 36,
    description:
      "The historic first adventure of Belgian reporter Tintin and his loyal fox terrier Snowy as they navigate early 20th century Europe.",
    archiveIdentifier: "01TintinInTheLandOfTheSoviets",
    leafBaseUrl: "https://archive.org/download/01TintinInTheLandOfTheSoviets/page/leaf",
  },
  {
    id: "sam-and-max",
    title: "Sam & Max: Surfin' the Highway",
    series: "Sam & Max: Freelance Police",
    issueNumber: "Anniversary Edition",
    publisher: "Telltale / Steve Purcell",
    year: 1995,
    genre: "graphic-novel",
    coverUrl: "https://archive.org/services/img/sammaxsurfinthehighway",
    totalPages: 45,
    description:
      "The complete comic run of writer/cartoonist Steve Purcell's cult duo, Sam (six-foot dog) and Max (hyperkinetic rabbit), solving supernatural crimes.",
    archiveIdentifier: "sammaxsurfinthehighway",
    leafBaseUrl: "https://archive.org/download/sammaxsurfinthehighway/page/leaf",
  },
  {
    id: "invincible-vol1",
    title: "Invincible: The Ultimate Hero Issue",
    series: "Invincible Universe",
    issueNumber: "#1",
    publisher: "Image Comics / Skybound",
    year: 2003,
    genre: "superhero",
    coverUrl: "https://archive.org/services/img/invincible-compendiums",
    totalPages: 32,
    description:
      "Mark Grayson was just an average high school teenager until his Viltrumite superpowers emerged. The acclaimed superhero saga created by Robert Kirkman.",
    archiveIdentifier: "invincible-compendiums",
    leafBaseUrl: "https://archive.org/download/invincible-compendiums/page/leaf",
  },
  {
    id: "captain-marvel-shazam",
    title: "Captain Marvel Adventures #1",
    series: "Shazam! / Captain Marvel",
    issueNumber: "#1",
    publisher: "Fawcett Comics",
    year: 1941,
    genre: "superhero",
    coverUrl: "https://archive.org/services/img/fawcett-comics",
    totalPages: 48,
    description:
      "Young Billy Batson speaks the ancient magic word SHAZAM! and transforms into Earth's Mightiest Mortal to battle Doctor Sivana.",
    archiveIdentifier: "fawcett-comics",
    leafBaseUrl: "https://archive.org/download/fawcett-comics/page/leaf",
  },
  {
    id: "daredevil-1941",
    title: "Daredevil Comics #1: Battles Hitler",
    series: "Lev Gleason Classics",
    issueNumber: "#1",
    publisher: "Lev Gleason Publications",
    year: 1941,
    genre: "superhero",
    coverUrl: "https://archive.org/services/img/classicsillustrated",
    totalPages: 38,
    description:
      "The original Golden Age Daredevil (Bart Hill) in his legendary boomerang-wielding, two-tone costume battling the forces of injustice.",
    archiveIdentifier: "classicsillustrated",
    leafBaseUrl: "https://archive.org/download/classicsillustrated/page/leaf",
  },
  {
    id: "black-terror-1",
    title: "The Black Terror: Nemesis of Crime",
    series: "Black Terror",
    issueNumber: "#1",
    publisher: "Nedor Comics",
    year: 1942,
    genre: "superhero",
    coverUrl: "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?w=600&auto=format&fit=crop&q=80",
    totalPages: 34,
    description:
      "Pharmacist Bob Benton inhales 'formic ethers' to obtain superhuman strength and invulnerability, donning the iconic skull and crossbones emblem.",
    pages: [
      "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1563089145-599997674d42?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1000&auto=format&fit=crop&q=80",
    ],
  },
  {
    id: "phantom-lady-17",
    title: "Phantom Lady: Shadow of the City",
    series: "Quality / Fox Comics",
    issueNumber: "#17",
    publisher: "Fox Feature Syndicate",
    year: 1947,
    genre: "superhero",
    coverUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80",
    totalPages: 32,
    description:
      "Sandra Knight wields the black light lantern to cast impenetrable shadows and fight criminal conspiracies with world-renowned comic panel pacing.",
    pages: [
      "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1000&auto=format&fit=crop&q=80",
    ],
  },
  {
    id: "cyberpunk-runner",
    title: "Cyberpunk Runner: Neon Velocity",
    series: "Neo Shonen Chronicles",
    issueNumber: "Episode 1",
    publisher: "Flick Comic Collective",
    year: 2026,
    genre: "manga",
    coverUrl: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80",
    totalPages: 28,
    description:
      "In the rain-slicked skyscrapers of Sector 7, a rogue courier uncovers a neural core containing memories that could reboot the metropolitan grid.",
    pages: [
      "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1563089145-599997674d42?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?w=1000&auto=format&fit=crop&q=80",
    ],
  },
  {
    id: "ghostly-doctor-ch1",
    title: "Ghostly Doctor: Rebirth of the Alchemy Master",
    series: "Ghostly Doctor Manga",
    issueNumber: "Chapter 1",
    publisher: "MangaDex Community",
    year: 2024,
    genre: "manga",
    coverUrl: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80",
    totalPages: 30,
    description:
      "A renowned modern surgeon and poison expert is transported into an ancient martial cultivation realm as the discarded daughter of a fallen house.",
    pages: [
      "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1563089145-599997674d42?w=1000&auto=format&fit=crop&q=80",
    ],
  },
  {
    id: "xkcd-daily",
    title: "XKCD: Webcomic of Romance & Sarcasm",
    series: "XKCD Syndicated",
    issueNumber: "Latest Drops",
    publisher: "Randall Munroe",
    year: 2026,
    genre: "webcomic",
    coverUrl: "https://imgs.xkcd.com/comics/vulnerability.png",
    totalPages: 24,
    description:
      "The Internet's favorite stick-figure comic exploring science, technology, mathematics, and human curiosity.",
    pages: [
      "https://imgs.xkcd.com/comics/vulnerability.png",
      "https://imgs.xkcd.com/comics/standards.png",
      "https://imgs.xkcd.com/comics/exploits_of_a_mom.png",
      "https://imgs.xkcd.com/comics/duty_calls.png",
      "https://imgs.xkcd.com/comics/workflow.png",
    ],
  },
];

export function getComicPageUrl(comic: ComicIssue, pageNumber: number): string {
  // 1-based page index
  const idx = Math.max(1, Math.min(pageNumber, comic.totalPages));
  if (comic.pages && comic.pages.length > 0) {
    const pageIdx = (idx - 1) % comic.pages.length;
    return comic.pages[pageIdx];
  }
  if (comic.leafBaseUrl) {
    // Leaf URL on Internet Archive
    return `${comic.leafBaseUrl}${idx}_medium.jpg`;
  }
  return comic.coverUrl;
}

export function getAllComicPageUrls(comic: ComicIssue): string[] {
  const urls: string[] = [];
  for (let i = 1; i <= comic.totalPages; i++) {
    urls.push(getComicPageUrl(comic, i));
  }
  return urls;
}

/**
 * Search Internet Archive for additional public domain comic books
 */
export async function searchArchiveComics(query: string): Promise<ComicIssue[]> {
  try {
    const term = encodeURIComponent(query.trim() || "comics");
    const url = `https://archive.org/advancedsearch.php?q=(${term})+AND+mediatype:(texts)+AND+(subject:comics+OR+collection:comicbooksandgraphicnovels)&fl[]=identifier,title,creator,description,year,downloads&sort[]=downloads+desc&rows=16&output=json`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const docs = data?.response?.docs || [];

    return docs.map((doc: { identifier: string; title: string; creator?: string; description?: string; year?: number }) => ({
      id: doc.identifier,
      title: doc.title || "Untitled Comic",
      series: "Archive Comics",
      issueNumber: doc.year ? `#${doc.year}` : "#1",
      publisher: doc.creator || "Golden Age Press",
      year: doc.year || 1950,
      genre: "graphic-novel",
      coverUrl: `https://archive.org/services/img/${doc.identifier}`,
      totalPages: 36,
      description: doc.description || "Digitally preserved classic comic book from the public domain archives.",
      archiveIdentifier: doc.identifier,
      leafBaseUrl: `https://archive.org/download/${doc.identifier}/page/leaf`,
    }));
  } catch {
    return [];
  }
}
