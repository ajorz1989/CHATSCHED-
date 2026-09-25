import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { SkeletonBlock } from "../components/Skeleton";
import { hasUsableBusinessSubscription, hasUsablePublisherSubscription } from "../lib/subscriptionGate";
import { BUSINESS_SUBSCRIPTION_PRICE, PUBLISHER_SUBSCRIPTION_PRICE } from "../lib/constants";
import { formatCurrency } from "../lib/currency";

type AccessState = "loading" | "allowed" | "activation" | "verification";

function AccessRequired({
  role,
  kind,
}: {
  role: "business" | "publisher";
  kind: "activation" | "verification";
}) {
  const isBusiness = role === "business";
  const activationPrice = isBusiness ? BUSINESS_SUBSCRIPTION_PRICE : PUBLISHER_SUBSCRIPTION_PRICE;

  if (kind === "verification") {
    return (
      <div className="max-w-2xl mx-auto px-5 py-16">
        <section className="border-[3px] border-billboard-ink rounded-xl p-7 md:p-9 bg-billboard-paperDim">
          <span className="inline-block font-mono text-[10px] font-bold uppercase tracking-wider border-2 border-billboard-ink px-3 py-1.5 rounded bg-white mb-4">
            {isBusiness ? "Business verification required" : "Publisher approval required"}
          </span>
          <h1 className="font-display text-3xl md:text-4xl mb-3">
            Your {isBusiness ? "business" : "publisher"} account isn't ready for Opportunities yet.
          </h1>
          <p className="text-billboard-inkSoft mb-6">
            {isBusiness
              ? "ChatSched requires a verified business account before you can publish or respond to live advertising opportunities. This protects the marketplace from spam and unverified campaign briefs."
              : "ChatSched requires an approved and verified publisher profile before you can access live opportunities. This helps keep the opportunity feed limited to eligible media supply."}
          </p>
          <Link
            to={isBusiness ? "/account" : "/apply"}
            className="inline-flex border-[3px] border-billboard-ink bg-billboard-ink text-white font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition"
          >
            {isBusiness ? "Review my account →" : "Complete publisher application →"}
          </Link>
        </section>
      </div>
    );
  }

  const activationLink = isBusiness ? "/activation-fee-info" : "/account#activation";

  return (
    <div className="max-w-2xl mx-auto px-5 py-16">
      <section className="border-[3px] border-billboard-ink rounded-xl overflow-hidden shadow-blockSm">
        <div className="bg-billboard-yellow p-7 md:p-9">
          <span className="inline-block font-mono text-[10px] font-bold uppercase tracking-wider border-2 border-billboard-ink px-3 py-1.5 rounded bg-white mb-4">
            Activation required
          </span>
          <h1 className="font-display text-3xl md:text-4xl mb-3">
            Activate your account to access Opportunities.
          </h1>
          <p className="text-billboard-ink/80 mb-6">
            The Opportunities workspace involves real advertising briefs, publisher proposals and campaign bookings.
            A once-off {formatCurrency(activationPrice)} activation fee unlocks this part of ChatSched for your {isBusiness ? "business" : "publisher"} account.
          </p>
          <Link
            to={activationLink}
            className="inline-flex border-[3px] border-billboard-ink bg-billboard-ink text-white font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition"
          >
            Why activation is required & Activate →
          </Link>
        </div>

        <div className="bg-white p-7 md:p-9">
          <h2 className="font-display text-xl mb-4">What activation unlocks</h2>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            {(
              isBusiness
                ? [
                    "Access the live Opportunities workspace",
                    "Publish structured advertising briefs",
                    "Review publisher proposals",
                    "Move accepted opportunities into booking",
                  ]
                : [
                    "Access the live Opportunities feed",
                    "See relevant matched briefs",
                    "Submit proposals and pricing",
                    "Track your opportunity applications",
                  ]
            ).map((item) => (
              <div key={item} className="border-2 border-billboard-ink/20 rounded-lg p-3">
                <span className="text-billboard-green font-bold mr-2">✓</span>
                {item}
              </div>
            ))}
          </div>
          <p className="text-xs text-billboard-inkSoft mt-5">
            Activation is once-off — there is no recurring renewal for this access.
          </p>
        </div>
      </section>
    </div>
  );
}

export default function OpportunityGate({ business, publisher }: { business: ReactNode; publisher: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const [businessActivated, setBusinessActivated] = useState<boolean | null>(null);
  const [publisherVerified, setPublisherVerified] = useState<boolean | null>(null);
  const [publisherActivated, setPublisherActivated] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user || profile?.role !== "business") {
      setBusinessActivated(null);
      return;
    }

    let active = true;
    hasUsableBusinessSubscription(user.id).then((usable) => {
      if (active) setBusinessActivated(usable);
    });

    return () => {
      active = false;
    };
  }, [user, profile?.role]);

  useEffect(() => {
    if (!user || profile?.role !== "publisher") {
      setPublisherVerified(null);
      setPublisherActivated(null);
      return;
    }

    let active = true;

    Promise.all([
      supabase
        .from("publishers")
        .select("verified, status")
        .eq("user_id", user.id)
        .maybeSingle(),
      hasUsablePublisherSubscription(user.id),
    ]).then(([publisherResult, activated]) => {
      if (!active) return;
      setPublisherVerified(Boolean(
        publisherResult.data?.verified && publisherResult.data?.status === "approved",
      ));
      setPublisherActivated(activated);
    });

    return () => {
      active = false;
    };
  }, [user, profile?.role]);

  const waitingForRoleCheck =
    loading ||
    (profile?.role === "business" && businessActivated === null) ||
    (profile?.role === "publisher" && (publisherVerified === null || publisherActivated === null));

  if (waitingForRoleCheck) {
    return <SkeletonBlock className="h-64 max-w-3xl mx-auto mt-16" />;
  }

  if (!user || !profile) {
    return <Navigate to={`/opportunities?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (profile.role === "admin") {
    return (
      <div className="space-y-10">
        <section>
          <div className="max-w-3xl mx-auto px-4 pt-8 pb-2">
            <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-billboard-inkSoft">
              Admin · Business opportunities
            </span>
          </div>
          {business}
        </section>
        <section className="border-t-[3px] border-billboard-ink pt-8">
          <div className="max-w-3xl mx-auto px-4 pb-2">
            <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-billboard-inkSoft">
              Admin · Publisher opportunities
            </span>
          </div>
          {publisher}
        </section>
      </div>
    );
  }

  if (profile.role === "business") {
    if (!profile.business_verified) return <AccessRequired role="business" kind="verification" />;
    if (!businessActivated) return <AccessRequired role="business" kind="activation" />;
    return <>{business}</>;
  }

  if (profile.role === "publisher") {
    if (!publisherVerified) return <AccessRequired role="publisher" kind="verification" />;
    if (!publisherActivated) return <AccessRequired role="publisher" kind="activation" />;
    return <>{publisher}</>;
  }

  return <Navigate to="/login" replace />;
}
