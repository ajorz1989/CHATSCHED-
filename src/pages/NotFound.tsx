import { Link } from "react-router-dom";
import { whatsappLink } from "../lib/constants";
import Seo from "../components/Seo";
import { SchedyNotFound } from "../components/schedy";

/**
 * The catch-all 404 route (App.tsx). Schedy's 404 scene carries the h1 and
 * message as live text; the illustration is decorative. Marked noindex so a
 * mistyped URL is never indexed. (Previously this reused ComingSoon, whose
 * "on the roadmap" copy was untrue for a genuine dead link.)
 */
export default function NotFound() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-16">
      <Seo title="Page not found — ChatSched" noindex />
      <SchedyNotFound
        title="Page not found."
        message="Eish, that link's broken or the page has moved. Try the directory, or reach us on WhatsApp if you were looking for something specific."
      >
        <Link to="/browse" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-3 rounded hover:-translate-x-0.5 hover:-translate-y-0.5 transition">Browse Publishers</Link>
        <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border-[3px] border-billboard-greenDeep bg-billboard-green text-white font-bold px-5 py-3 rounded hover:-translate-x-0.5 hover:-translate-y-0.5 transition">WhatsApp us</a>
      </SchedyNotFound>
    </div>
  );
}
