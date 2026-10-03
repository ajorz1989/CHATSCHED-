import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import SetupNotice from "./SetupNotice";
import { SkeletonBlock, SkeletonLine } from "./Skeleton";

export default function RequireAuth({ children, role }: { children: ReactNode; role?: "admin" | "business" | "publisher" }) {
  const { user, profile, loading, aal } = useAuth();
  const location = useLocation();

  // A business that created its own publisher listing (activated-business
  // feature) may enter publisher-only routes — earnings, relationships —
  // for that listing. undefined = not checked yet / not needed.
  const needsListingCheck = role === "publisher" && profile?.role === "business" && !!user;
  const [ownsBusinessListing, setOwnsBusinessListing] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    if (!needsListingCheck || !user) return;
    let cancelled = false;
    supabase
      .from("publishers")
      .select("id")
      .eq("user_id", user.id)
      .eq("creation_source", "business")
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setOwnsBusinessListing(!!data); });
    return () => { cancelled = true; };
  }, [needsListingCheck, user]);

  if (!isSupabaseConfigured) return <SetupNotice />;

  if (loading) {
    return (
      <div className="max-w-md mx-auto px-5 py-24" aria-busy="true" aria-label="Checking your session">
        <SkeletonLine className="w-1/2 h-6 mb-4 mx-auto" />
        <SkeletonBlock className="h-24" />
      </div>
    );
  }
  if (!user) {
    const next = `${location.pathname}${location.search}`;
    const qs = next && next !== "/login" ? `?next=${encodeURIComponent(next)}` : "";
    return <Navigate to={`/login${qs}`} replace />;
  }
  // Admins are platform operators: they may enter business/publisher routes without changing their stored role.
  if (needsListingCheck && ownsBusinessListing === undefined) {
    return (
      <div className="max-w-md mx-auto px-5 py-24" aria-busy="true" aria-label="Checking your access">
        <SkeletonLine className="w-1/2 h-6 mb-4 mx-auto" />
        <SkeletonBlock className="h-24" />
      </div>
    );
  }
  const businessListingOwner = needsListingCheck && ownsBusinessListing === true;
  if (role && profile?.role !== role && profile?.role !== "admin" && !businessListingOwner) return <Navigate to="/" replace />;

  // Admin controls request approvals, payment confirmation, and payout
  // sign-off for the whole marketplace — one compromised password
  // shouldn't be enough on its own. MFA is mandatory for this role, not
  // optional: no verified factor yet sends them to enroll one; a verified
  // factor this session hasn't cleared sends them to verify it. Both
  // pages carry `next` so they land back here once done, not on a
  // separate "welcome" screen.
  if (role === "admin") {
    const next = `${location.pathname}${location.search}`;
    const qs = `?next=${encodeURIComponent(next)}`;
    if (aal.current === "aal1" && aal.next === "aal1") {
      return <Navigate to={`/mfa-setup${qs}`} replace />;
    }
    if (aal.current !== aal.next) {
      return <Navigate to={`/mfa-verify${qs}`} replace />;
    }
  }

  return <>{children}</>;
}
