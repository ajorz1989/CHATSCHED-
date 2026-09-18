import { supabase } from "./supabase";
import type { Profile, Publisher, PublisherRequest, ChannelRequest } from "./types";
import type { ChecklistItem } from "../components/OnboardingChecklist";

// Shared by both checklists' "verified" item — there was previously no
// self-service way to trigger a fresh confirmation email if the original
// was lost, expired, or spam-filtered (see DASHBOARD_UX_AUDIT.md #4).
async function resendVerificationEmail(email: string | null | undefined) {
  if (!email) throw new Error("No email on file");
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) throw error;
}

export function computeBusinessChecklist(
  profile: Profile | null,
  requests: PublisherRequest[],
  channelRequests: ChannelRequest[],
  email?: string | null
): ChecklistItem[] {
  const profileComplete = !!(profile?.full_name && profile?.phone && profile?.industry);
  const hasSentRequest = requests.length > 0 || channelRequests.length > 0;
  const hasPaid =
    requests.some((r) => r.payments?.some((p) => p.status === "paid")) ||
    channelRequests.some((r) => ["paid", "live", "completed"].includes(r.status));

  return [
    {
      id: "profile",
      label: "Complete your business profile",
      hint: "Add your name, phone number and industry so publishers know who they're working with.",
      done: profileComplete,
    },
    {
      id: "verified",
      label: "Verify your email",
      hint: "Confirm the email on your account — check your inbox for the link.",
      done: !!profile?.email_verified,
      onAction: email ? () => resendVerificationEmail(email) : undefined,
      onActionLabel: "Resend email",
    },
    {
      id: "first-request",
      label: "Send your first campaign request",
      hint: "Browse publishers and request a placement that fits your audience.",
      done: hasSentRequest,
      actionLabel: "Browse publishers",
      actionTo: "/browse",
    },
    {
      id: "first-payment",
      label: "Complete your first payment",
      hint: "Once a publisher approves, pay to lock in your placement.",
      done: hasPaid,
    },
  ];
}

export function computePublisherChecklist(
  publisher: Publisher | null,
  isRequestFlowChannel: boolean,
  requests: PublisherRequest[],
  channelRequests: ChannelRequest[],
  connectedPlatformCount: number
): ChecklistItem[] {
  if (!publisher) return [];

  const profileComplete = !!(publisher.bio?.trim() && publisher.audience?.trim() && publisher.mobile_number);
  const verified = publisher.email_verified || publisher.phone_verified;
  const hasReceivedRequest = requests.length > 0 || channelRequests.length > 0;

  const items: ChecklistItem[] = [
    {
      id: "profile",
      label: "Complete your profile",
      hint: "Add a bio, describe your audience, and add a contact number.",
      done: profileComplete,
    },
    {
      id: "verified",
      label: "Verify your account",
      hint: "Confirm your email or phone number so businesses can trust your listing.",
      done: verified,
      onAction: !verified && publisher.email ? () => resendVerificationEmail(publisher.email) : undefined,
      onActionLabel: "Resend email",
    },
    {
      id: "social-connect",
      label: "Connect a social account",
      hint: "Import real follower numbers instead of typing them in — it also tends to speed up admin review.",
      done: connectedPlatformCount > 0,
    },
  ];

  // Format selection only applies where the concept exists — social media
  // creators pick placement types, request-flow channels pick ad formats.
  // Everyone else (no format concept for their channel) skips this item
  // rather than showing a checklist step that can never be completed.
  if (publisher.channel_slug === "social-media") {
    items.push({
      id: "formats",
      label: "Choose your placement types",
      hint: "Story, feed post, Reel — tell businesses what you actually offer.",
      done: !!publisher.placement_types && publisher.placement_types.length > 0,
    });
  } else if (isRequestFlowChannel) {
    items.push({
      id: "formats",
      label: "Choose the ad formats you accept",
      hint: "Businesses only see formats you've said you're willing to run.",
      done: !!publisher.accepted_ad_formats && publisher.accepted_ad_formats.length > 0,
    });
  }

  items.push({
    id: "first-request",
    label: "Receive your first request",
    hint: "Once you're approved and listed, businesses can find and request you.",
    done: hasReceivedRequest,
  });

  // Responding is only ever the publisher's own action on the request-flow
  // channels — on the original requests flow, status changes are admin-
  // driven, so "did you respond" wouldn't measure anything real about this
  // publisher (same scoping ResponseTimeBadge already uses).
  if (isRequestFlowChannel) {
    items.push({
      id: "responded",
      label: "Respond to a request",
      hint: "Approve or decline your first campaign request.",
      done: channelRequests.some((r) => r.responded_at != null),
    });
  } else {
    items.push({
      id: "reviewed",
      label: "Earn your first review",
      hint: "Complete a campaign to start building your rating.",
      done: publisher.reviews > 0,
    });
  }

  return items;
}
