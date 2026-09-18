import { type ReactNode } from "react";

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

/**
 * Shared shell for the legal pages (Privacy Policy / POPIA, Terms &
 * Conditions) — a sticky in-page table of contents next to numbered
 * sections, using the same billboard-* tokens as the rest of the site.
 */
export default function LegalPageLayout({
  eyebrow,
  title,
  intro,
  lastUpdated,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  lastUpdated: string;
  sections: LegalSection[];
}) {
  return (
    <div className="max-w-5xl mx-auto px-5 py-16">
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">{eyebrow}</span>
      <h1 className="text-3xl md:text-4xl mb-4 max-w-2xl">{title}</h1>
      <p className="text-billboard-inkSoft max-w-2xl mb-2">{intro}</p>
      <p className="font-mono text-xs text-billboard-inkSoft mb-10">Last updated: {lastUpdated}</p>

      <div className="grid md:grid-cols-[220px_1fr] gap-10">
        <nav className="hidden md:block">
          <div className="sticky top-24 border-2 border-billboard-ink rounded p-4 bg-billboard-paperDim">
            <h2 className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft mb-3">On this page</h2>
            <ol className="space-y-2">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-xs font-semibold text-billboard-ink hover:text-billboard-greenDeep leading-snug block">
                    {i + 1}. {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <div className="space-y-12 min-w-0">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="font-display text-xl mb-3 flex items-baseline gap-2.5">
                <span className="text-billboard-yellowDeep" style={{ WebkitTextStroke: "1px #1A1712" }}>{String(i + 1).padStart(2, "0")}</span>
                {s.title}
              </h2>
              <div className="text-sm text-billboard-inkSoft leading-relaxed space-y-3 [&_strong]:text-billboard-ink [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_a]:underline [&_a]:font-semibold [&_a]:text-billboard-ink">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
