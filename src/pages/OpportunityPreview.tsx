import { Link } from "react-router-dom";
import Seo from "../components/Seo";

export default function OpportunityPreview() {
  return <div className="max-w-3xl mx-auto px-5 py-16">
    <Seo title="ChatSched Opportunities" description="Verified advertising and sponsorship opportunities on ChatSched." noindex />
    <div className="border-[3px] border-billboard-ink rounded p-6 md:p-10 bg-white">
      <span className="inline-block font-mono text-xs font-semibold uppercase border-2 border-billboard-greenDeep text-billboard-greenDeep px-3 py-1.5 rounded mb-4">Verified members only</span>
      <h1 className="text-3xl md:text-4xl mb-3">Find advertising opportunities — or post what you need.</h1>
      <p className="text-billboard-inkSoft text-base leading-7 mb-6">ChatSched Opportunities connects verified businesses with approved, verified publishers for targeted sponsorships, advertising placements and campaign briefs. Contact details stay private and proposals remain inside ChatSched.</p>
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <div className="border-2 border-billboard-ink rounded p-4"><strong>Businesses</strong><p className="text-sm text-billboard-inkSoft mt-1">Post a brief for school partnerships, venue displays, newsletters, influencer placements, radio, podcasts and more.</p></div>
        <div className="border-2 border-billboard-ink rounded p-4"><strong>Publishers</strong><p className="text-sm text-billboard-inkSoft mt-1">Browse relevant briefs and submit proposals without exposing your private contact details.</p></div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link to="/register?role=business" className="border-[3px] border-billboard-ink bg-billboard-yellow font-bold px-5 py-3 rounded">Create business account</Link>
        <Link to="/register?role=publisher" className="border-[3px] border-billboard-ink bg-billboard-green text-white font-bold px-5 py-3 rounded">Join as publisher</Link>
        <Link to="/login?next=%2Fopportunities" className="border-2 border-billboard-ink font-semibold px-5 py-3 rounded">Log in</Link>
      </div>
      <p className="text-xs text-billboard-inkSoft mt-6">Access opens after the relevant verification checks are complete.</p>
    </div>
  </div>;
}
