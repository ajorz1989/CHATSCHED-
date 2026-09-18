import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { SkeletonBlock } from "../components/Skeleton";

export default function OpportunityGate({ business, publisher }: { business: ReactNode; publisher: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const [publisherVerified, setPublisherVerified] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user || profile?.role !== "publisher") { setPublisherVerified(null); return; }
    let active = true;
    supabase.from("publishers").select("verified, status").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (active) setPublisherVerified(Boolean(data?.verified && data?.status === "approved"));
    });
    return () => { active = false; };
  }, [user, profile?.role]);

  if (loading || (profile?.role === "publisher" && publisherVerified === null)) return <SkeletonBlock className="h-64 max-w-3xl mx-auto mt-16" />;
  if (!user || !profile) return <Navigate to={`/opportunities/preview?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (profile.role === "business" && profile.business_verified) return <>{business}</>;
  if (profile.role === "publisher" && publisherVerified) return <>{publisher}</>;
  if (profile.role === "admin") return <Navigate to="/admin" replace />;
  return <Navigate to={`/opportunities/preview?next=${encodeURIComponent(location.pathname)}`} replace />;
}
