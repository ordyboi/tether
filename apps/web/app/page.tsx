import Link from "next/link";

const directions = [
  {
    href: "/1",
    name: "Trailhead",
    tagline: "Warm, playful, illustrated",
    description:
      "Bright, rounded, emoji-forward. Leans into the fun of a group hangout — friendly colour, big touch targets, characterful markers.",
  },
  {
    href: "/2",
    name: "Transit",
    tagline: "Structured, utilitarian, data-dense",
    description:
      "Card-based bottom sheets, clear hierarchy, dark-mode-first. Optimised for scanning a roster fast and trusting the numbers.",
  },
  {
    href: "/3",
    name: "Atlas",
    tagline: "Minimal, native, translucent",
    description:
      "Full-bleed map, frosted glass chrome, restrained colour. Feels like it ships in the OS rather than sitting on top of it.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm uppercase tracking-widest text-neutral-500 mb-3">
          Tether · Phase 0
        </p>
        <h1 className="text-3xl font-semibold mb-2">Design directions</h1>
        <p className="text-neutral-400 mb-12 max-w-xl">
          Three independent takes on the same product, built against the same
          mocked room and roster. Open each, walk the journey, then pick one
          to refine into the real design system.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          {directions.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="group rounded-2xl border border-neutral-800 bg-neutral-900 p-6 transition hover:border-neutral-600 hover:bg-neutral-850"
            >
              <div className="text-xs font-mono text-neutral-500 mb-4">
                {d.href}
              </div>
              <h2 className="text-xl font-semibold mb-1 group-hover:text-white">
                {d.name}
              </h2>
              <p className="text-sm text-neutral-400 mb-3">{d.tagline}</p>
              <p className="text-sm text-neutral-500 leading-relaxed">
                {d.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
