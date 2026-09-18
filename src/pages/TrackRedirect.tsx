import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getOrCreateVisitorId, utmTaggedUrl } from "../lib/campaignTracking";
import Seo from "../components/Seo";

/**
 * chatsched.com/t/:slug — the public redirect a campaign's tracking URL
 * actually points to. Logs a 'click' (server-side, inside
 * resolve_campaign_link()) and forwards to the business's real destination
 * with UTM params attached, or shows a plain "not active" message for an
 * unknown/paused/archived slug rather than a broken redirect.
 */
export default function TrackRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<"loading" | "not-found" | "redirecting">("loading");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!slug) {
        setState("not-found");
        return;
      }
      const { data, error } = await supabase.rpc("resolve_campaign_link", {
        p_slug: slug,
        p_referrer: document.referrer || null,
        p_visitor_id: getOrCreateVisitorId(),
      });
      if (cancelled) return;

      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row?.destination_url) {
        setState("not-found");
        return;
      }

      setState("redirecting");
      const target = utmTaggedUrl({
        destination_url: row.destination_url,
        utm_source: row.utm_source,
        utm_medium: row.utm_medium,
        utm_campaign: row.utm_campaign,
        utm_content: row.utm_content,
      });
      window.location.replace(target);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state === "not-found") {
    return (
      <div className="max-w-md mx-auto px-5 py-24 text-center">
        <Seo title="Link not active · ChatSched" noindex />
        <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-4">
          Link not active
        </span>
        <h1 className="text-2xl mb-3">This tracking link isn't live anymore.</h1>
        <p className="text-billboard-inkSoft mb-7">
          It may have been paused or removed by whoever created it. If you were expecting this to go somewhere, it's
          worth checking with them for an updated link.
        </p>
        <Link to="/" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition">
          Go to ChatSched
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-5 py-24 text-center">
      <Seo title="Redirecting… · ChatSched" noindex />
      <div className="inline-block w-8 h-8 border-[3px] border-billboard-ink border-t-transparent rounded-full animate-spin mb-5" />
      <p className="text-billboard-inkSoft">Taking you there…</p>
    </div>
  );
}
