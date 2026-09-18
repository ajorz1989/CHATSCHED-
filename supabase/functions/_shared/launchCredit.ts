// Forfeits whatever launch credit a business has left, when an admin
// revokes their ChatSched Business activation (cancel-subscription).
// Product decision, not an engineering default: the credit was a welcome
// incentive tied to being an activated member, not money that survives a
// revoked membership. Confirmed directly rather than assumed — see
// PHASE20's delivery notes for how this was raised and decided.
//
// Was also called automatically from payfast-notify and
// expire-subscription-grace-periods when membership was still a monthly
// subscription with a lapse lifecycle (past_due -> grace_period ->
// suspended). Both of those call sites and that whole lifecycle are gone
// as of schema_phase86_once_off_activation_pricing.sql (item 10) — a
// once-off activation fee has no recurring payment left to lapse from, so
// cancel-subscription (now an admin-only revoke action) is the only
// remaining caller.
//
// deno-lint-ignore no-explicit-any
export async function forfeitBusinessLaunchCredit(admin: any, businessId: string): Promise<void> {
  const { data: credit, error } = await admin
    .from("business_launch_credits")
    .select("id, remaining")
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) {
    console.error("forfeitBusinessLaunchCredit: lookup failed", { businessId, error });
    return;
  }
  // No row (never earned the activation credit, or the payment that
  // would have granted it never completed) or already at zero (already
  // forfeited, or fully spent) — nothing to do either way. Not an error
  // case, just a no-op.
  if (!credit || Number(credit.remaining) <= 0) return;

  const { error: updateError } = await admin
    .from("business_launch_credits")
    .update({ remaining: 0, updated_at: new Date().toISOString() })
    .eq("id", credit.id);

  if (updateError) {
    console.error("forfeitBusinessLaunchCredit: update failed", { businessId, error: updateError });
  }
}
