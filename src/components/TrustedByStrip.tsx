import logoScanWorth from "../assets/logos/scanworth.png";
import logoVertex from "../assets/logos/vertex.png";
import logoWorldTravel from "../assets/logos/worldtravel.png";
import logoCIS from "../assets/logos/cis.png";
import logoInfoIcon from "../assets/logos/infoicon.png";
import { useReveal } from "../hooks/useReveal";

const TRUSTED_LOGOS = [
  { name: "ScanWorth", src: logoScanWorth },
  { name: "VA Sports", src: logoVertex },
  { name: "World Travel", src: logoWorldTravel },
  { name: "CIS", src: logoCIS },
  { name: "Idex & Cense", src: logoInfoIcon },
];

/** "Trusted by" logo strip — real businesses already using ChatSched. Shared by Home and the /for-businesses, /for-publishers landing pages. */
export default function TrustedByStrip({ heading = "Real businesses, already putting real pages to work." }: { heading?: string }) {
  const reveal = useReveal<HTMLDivElement>();
  return (
    <section className="py-16 bg-billboard-paperDim border-b-[3px] border-billboard-ink">
      <div className="max-w-6xl mx-auto px-5" ref={reveal.ref}>
        <div className={reveal.className}>
          <div className="text-center mb-10">
            <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">
              Who's already on the board
            </span>
            <h2 className="text-2xl md:text-3xl max-w-2xl mx-auto">{heading}</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {TRUSTED_LOGOS.map((logo) => (
              <div
                key={logo.name}
                className="flex items-center justify-center h-24 border-[3px] border-billboard-ink rounded-lg bg-white px-5 py-4 grayscale opacity-80 hover:grayscale-0 hover:opacity-100 hover:-translate-y-0.5 transition-all"
              >
                <img src={logo.src} alt={logo.name} className="max-h-full max-w-full object-contain" loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
