import { Link } from "react-router-dom";
import Seo from "../components/Seo";

const STANDARDS: { title: string; desc: string }[] = [
  { title: "Disclosure expectations", desc: "Apply the disclosure method required for the campaign's platform before you publish — see /campaigns/:id/compliance on each active campaign for exactly what's required." },
  { title: "Truthful representation", desc: "Represent the product, service, or offer the way the campaign brief describes it. Don't add claims the business didn't ask for or can't back up." },
  { title: "No fake engagement", desc: "No purchased followers, bots, engagement pods, or anything designed to make a metric look bigger than it is." },
  { title: "No fraudulent metrics", desc: "Numbers you report to ChatSched or a business — followers, reach, engagement — should be real and current." },
  { title: "No deceptive advertising", desc: "Don't publish content designed to mislead the audience about what it is or who paid for it." },
  { title: "Campaign completion", desc: "Publish what was agreed, in the timeframe agreed. If something changes, raise it before the deadline, not after." },
  { title: "Proof submission", desc: "Submit real publication proof — the actual public URL or evidence of the actual post — through the campaign's compliance page." },
  { title: "No off-platform payment requests", desc: "Payment runs through ChatSched. Don't ask a business to pay you directly outside the platform." },
  { title: "No bypassing ChatSched", desc: "Don't arrange a booking with a business off-platform to avoid ChatSched's fees or protections — both sides lose payment-hold and dispute protection if something goes wrong." },
  { title: "Respect for platform rules", desc: "ChatSched's checklist is guidance, not a substitute for the platform's own current policy — you're responsible for following it." },
];

export default function CreatorStandards() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-16">
      <Seo title="Creator Standards · ChatSched" description="What ChatSched expects from creators and publishers running sponsored campaigns." />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">
        Trust centre
      </span>
      <h1 className="text-3xl md:text-4xl mb-3 max-w-xl">What ChatSched expects from every publisher — so businesses can book with confidence.</h1>
      <p className="text-billboard-inkSoft max-w-xl mb-12">
        What ChatSched expects from a creator running a paid campaign. Falling short of these can affect your
        standing on ChatSched and, separately, may put you at odds with the platform you're publishing to.
      </p>

      <div className="space-y-3">
        {STANDARDS.map((s) => (
          <div key={s.title} className="border-[3px] border-billboard-ink rounded p-4 bg-white">
            <h3 className="font-display text-sm mb-1">{s.title}</h3>
            <p className="text-sm text-billboard-inkSoft">{s.desc}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-billboard-inkSoft mt-10">
        See also the <Link to="/compliance" className="text-billboard-greenDeep underline transition-colors hover:text-billboard-ink">Compliance Centre</Link> for
        platform-specific requirements, and the <Link to="/trust" className="text-billboard-greenDeep underline transition-colors hover:text-billboard-ink">Trust Centre</Link> for
        verification levels and how disputes work.
      </p>
    </div>
  );
}
