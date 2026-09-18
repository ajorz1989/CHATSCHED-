import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { SkeletonRows } from "../components/Skeleton";
import { formatCurrency } from "../lib/currency";
import { PUBLISHER_SHARE } from "../lib/constants";
import Seo from "../components/Seo";
import type { BusinessRelationship } from "../lib/types";

/**
 * /publisher/relationships — pivot brief section 30. Same "paid means
 * worked with" scoping as the business side (my_business_relationships(),
 * schema_phase67). No "Invite/Request Repeat Campaign" action here —
 * that would mean a publisher messaging a business directly, which is
 * exactly the direct-contact path Phase 3's message safety work exists
 * to keep off this platform. A publisher can see who's a repeat client;
 * asking for more work stays the business's or ChatSched's move, not a
 * button that opens contact with someone who hasn't requested it.
 */
export default function PublisherRelationships() {
  const { user } = useAuth();
  const [relationships, setRelationships] = useState<BusinessRelationship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .rpc("my_business_relationships")
      .then(({ data }) => {
        setRelationships((data ?? []) as BusinessRelationship[]);
        setLoading(false);
      });
  }, [user]);

  if (loading) return <SkeletonRows count={4} />;

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <Seo title="Businesses you've worked with" description="Your campaign history with businesses on ChatSched." />
      <h1 className="font-display text-2xl mb-1.5">Businesses you've worked with</h1>
      <p className="text-billboard-inkSoft text-sm mb-6">Every business you've completed a paid campaign for.</p>

      {relationships.length === 0 ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded p-10 text-center text-billboard-inkSoft">
          No completed campaigns yet — once a campaign is paid and finished, the business shows up here.
        </div>
      ) : (
        <div className="space-y-3">
          {relationships.map((rel) => (
            <div key={rel.business_id} className="border-[3px] border-billboard-ink rounded p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display text-base">{rel.business_name}</p>
                <p className="text-xs text-billboard-inkSoft">
                  {rel.campaign_count} campaign{rel.campaign_count === 1 ? "" : "s"}
                  {rel.campaign_count > 1 && " · Repeat client"}
                  {rel.last_campaign_at && ` · last ${new Date(rel.last_campaign_at).toLocaleDateString("en-ZA")}`}
                </p>
              </div>
              {/* rel.total_spent is the raw gross booking amount
                  (schema_phase99) — apply PUBLISHER_SHARE here, same
                  pattern AdminAnalytics.tsx uses, rather than ever having
                  SQL do commission math with its own copy of the rate. */}
              <p className="font-display text-base">{formatCurrency(Number(rel.total_spent) * PUBLISHER_SHARE, { cents: true })} earned</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
