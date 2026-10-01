import { useAuth } from "./useAuth";

/**
 * Where a "Post an opportunity" call-to-action should lead for the current
 * visitor, so it never makes them detour through the explainer page:
 *  - logged-out        -> business sign-up
 *  - business / admin  -> the opportunities workspace
 *  - publisher, or an account whose profile is still loading -> the explainer
 *    page (a publisher can't post briefs, and sending a logged-in user to the
 *    sign-up form would be wrong)
 */
export function usePostOpportunityHref(): string {
  const { user, profile } = useAuth();
  if (!user) return "/register?role=business";
  if (profile?.role === "business" || profile?.role === "admin") return "/opportunities/feed";
  return "/opportunities";
}
