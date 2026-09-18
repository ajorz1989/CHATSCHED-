import { useEffect, useState } from "react";
import { loadProfileTraction, type ProfileTraction } from "../lib/profileTraction";

export default function PublisherTractionPanel({ publisherId, totalRequests }: { publisherId: string; totalRequests: number }) {
  const [traction, setTraction] = useState<ProfileTraction | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadProfileTraction(publisherId).then((t) => { if (!cancelled) setTraction(t); });
    return () => { cancelled = true; };
  }, [publisherId]);

  return (
    <div className="border-[3px] border-billboard-ink rounded-lg p-6 bg-white mb-10">
      <h2 className="font-display text-lg mb-1">Your traction</h2>
      <p className="text-sm text-billboard-inkSoft mb-5">How many businesses have actually looked at your listing.</p>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <TractionStat label="Last 7 days" value={traction?.last7Days} />
        <TractionStat label="Last 30 days" value={traction?.last30Days} />
        <TractionStat label="All time" value={traction?.allTime} />
      </div>

      {traction && <Nudge views={traction.allTime} requests={totalRequests} />}
    </div>
  );
}

function TractionStat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="border-2 border-billboard-ink/15 rounded p-3 text-center">
      <div className="font-display text-2xl">{value === undefined ? "—" : value}</div>
      <div className="font-mono text-[10px] uppercase text-billboard-inkSoft mt-0.5">{label}</div>
    </div>
  );
}

function Nudge({ views, requests }: { views: number; requests: number }) {
  if (views === 0) {
    return (
      <div className="border-2 border-billboard-yellow bg-billboard-yellow/10 rounded p-4">
        <p className="text-sm font-semibold mb-1">No profile views yet</p>
        <p className="text-xs text-billboard-inkSoft">
          New listings take a little while to start showing up in search. In the meantime, a complete profile ranks better —
          make sure your bio, portfolio, and pricing are filled in, and{" "}
          <span className="font-semibold">connect a social account above</span> so your follower count is verified rather than self-reported.
        </p>
      </div>
    );
  }

  if (requests === 0) {
    return (
      <div className="border-2 border-billboard-yellow bg-billboard-yellow/10 rounded p-4">
        <p className="text-sm font-semibold mb-1">People are finding you, but nobody's sent a request yet</p>
        <p className="text-xs text-billboard-inkSoft">
          Worth checking: is your pricing clear and competitive for your category? Does your bio say exactly what a business gets?
          A short portfolio piece or an <span className="font-semibold">AI audience summary</span> (above, once you've connected a
          platform) tends to close the gap between a look and an actual request.
        </p>
      </div>
    );
  }

  const rate = Math.round((requests / views) * 100);
  return (
    <div className="border-2 border-billboard-green bg-[#EAF3EC] rounded p-4">
      <p className="text-sm font-semibold mb-1">
        {requests} request{requests === 1 ? "" : "s"} from {views} view{views === 1 ? "" : "s"}
        {rate > 0 ? ` — about ${rate}% of people who looked reached out.` : "."}
      </p>
      <p className="text-xs text-billboard-inkSoft">
        Keeping your availability and pricing current tends to convert better than a listing that looks stale.
      </p>
    </div>
  );
}
