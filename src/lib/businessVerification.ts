export type BusinessVerificationLevel = "bronze" | "silver" | "gold" | null;

export function computeVerificationLevel(business: {
  email_verified: boolean;
  phone_verified: boolean;
  business_verified: boolean;
}): BusinessVerificationLevel {
  if (business.business_verified) return "gold";
  if (business.phone_verified && business.email_verified) return "silver";
  if (business.email_verified) return "bronze";
  return null;
}

export const VERIFICATION_META: Record<Exclude<BusinessVerificationLevel, null>, { label: string; ringCount: number }> = {
  bronze: { label: "Bronze Verified", ringCount: 1 },
  silver: { label: "Silver Verified", ringCount: 2 },
  gold: { label: "Gold Verified", ringCount: 3 },
};
