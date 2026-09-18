import { Link } from "react-router-dom";
import Seo from "../components/Seo";

const STANDARDS: { title: string; desc: string }[] = [
  { title: "Truthful campaign claims", desc: "Whatever you ask a creator to say about your product or service should be true and something you can back up." },
  { title: "Legal product/service information", desc: "What you're advertising needs to be legal to sell and legal to advertise the way you're describing it." },
  { title: "Accurate pricing", desc: "Prices, discounts, and offers in a campaign brief should match what a customer will actually get." },
  { title: "Legitimate destination URLs", desc: "The link you ask a creator to share should go where you say it goes, and shouldn't be a redirect chain designed to obscure that." },
  { title: "Accurate campaign materials", desc: "Whatever you supply — brief text, images, claims — should be complete and correct before a creator starts working from it." },
  { title: "Compliance with advertising law", desc: "You're responsible for meeting the advertising and consumer-protection laws that apply to your business and category." },
  { title: "Never instruct a creator to break platform rules", desc: "Don't ask a creator to skip disclosure, use engagement-inflation tricks, or otherwise work around a platform's own policy." },
];

export default function BusinessStandards() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-16">
      <Seo title="Business Standards · ChatSched" description="What ChatSched expects from businesses running sponsored campaigns." />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">
        Trust centre
      </span>
      <h1 className="text-3xl md:text-4xl mb-3 max-w-xl">What ChatSched expects from every sponsored campaign — so publishers can say yes with confidence.</h1>
      <p className="text-billboard-inkSoft max-w-xl mb-12">
        Businesses are responsible for what they ask a creator to say and do. ChatSched's compliance checklist is
        there to help you prepare a campaign properly — it doesn't shift that responsibility.
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
