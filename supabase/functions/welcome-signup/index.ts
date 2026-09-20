// welcome-signup — fires after a new publisher or business profile row is
// created and sends two things:
//   1. A welcome email via Resend (role-specific copy).
//   2. An in-app notification row in the notifications table so the user
//      sees the prompt the moment they land on their dashboard.
//
// Trigger: called by the schema_welcome_notification_trigger.sql Postgres
// trigger via pg_net immediately after INSERT on profiles where role IN
// ('publisher', 'business'). Also callable client-side from Register.tsx
// as a belt-and-braces fallback.
//
// Security model: uses SUPABASE_SERVICE_ROLE_KEY because:
//   a) The DB trigger calls this with no user JWT at all.
//   b) The only write it performs is inserting a notification for the
//      user_id supplied in the body — it never reads or writes any other
//      user's data.
//   c) The request body is validated: user_id must be a valid UUID that
//      resolves to a real auth.users row, and role must be 'publisher' or
//      'business'. Anything else is rejected before any write happens.
//   d) This function is NOT exposed in CORS headers and is NOT called
//      directly from an anonymous browser context — it is called either
//      by the DB trigger (trusted server context) or by the logged-in
//      Register page (which supplies the user's own JWT and user_id).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const VALID_ROLES = ["publisher", "business"] as const;
type Role = typeof VALID_ROLES[number];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as {
      user_id?: string;
      role?: string;
      display_name?: string;
    };

    const { user_id, role, display_name } = body;

    // --- Input validation ---
    if (!user_id || typeof user_id !== "string") {
      return json({ error: "user_id is required" }, 400);
    }
    if (!role || !VALID_ROLES.includes(role as Role)) {
      return json({ error: "role must be 'publisher' or 'business'" }, 400);
    }

    const typedRole = role as Role;

    // Service-role client — see security model comment above.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the user_id actually exists in auth.users before doing anything.
    const { data: authData, error: authError } = await admin.auth.admin.getUserById(user_id);
    if (authError || !authData.user) {
      return json({ error: "User not found" }, 404);
    }
    const email = authData.user.email ?? null;
    const name = display_name?.trim() || email?.split("@")[0] || "there";

    const siteUrl = Deno.env.get("SITE_URL") || "https://chatsched.co.za";

    // --- Role-specific copy ---
    const isPublisher = typedRole === "publisher";

    const profilePath = isPublisher ? "/apply" : "/account";
    const profileLabel = isPublisher ? "Complete your publisher profile" : "Complete your business profile";
    const roleLabel = isPublisher ? "Publisher" : "Business";
    const dashboardPath = "/dashboard";

    // In-app notification (shows in the notification bell immediately)
    const notificationTitle = `Welcome to ChatSched, ${name}!`;
    const notificationBody = isPublisher
      ? "Your publisher account is ready. Complete your profile so businesses can discover and book you."
      : "Your business account is ready. Complete your profile so you can start browsing and booking publishers.";

    // Write in-app notification first — this is the most important part
    // because it's what the user sees the instant they open their dashboard.
    const { error: notifError } = await admin.from("notifications").insert({
      user_id,
      title: notificationTitle,
      body: notificationBody,
      link: profilePath,
      read_at: null,
    });

    if (notifError) {
      // Log but don't fail — the email send below is still worth attempting.
      console.error("welcome-signup: failed to insert notification", notifError);
    }

    // --- Email via Resend ---
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.warn("welcome-signup: RESEND_API_KEY not set, skipping email");
      return json({ notificationInserted: !notifError, emailSkipped: true });
    }

    if (!email) {
      console.warn("welcome-signup: no email address for user", user_id);
      return json({ notificationInserted: !notifError, emailSkipped: true });
    }

    const subject = `Welcome to ChatSched — let's get your ${roleLabel.toLowerCase()} profile ready`;
    const html = buildWelcomeEmail({
      name,
      roleLabel,
      isPublisher,
      profilePath,
      profileLabel,
      dashboardPath,
      siteUrl,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM") || "ChatSched <onboarding@resend.dev>",
        to: [email],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      console.error("welcome-signup: Resend error", await res.text());
      return json({ notificationInserted: !notifError, emailSent: false }, 502);
    }

    return json({ notificationInserted: !notifError, emailSent: true });
  } catch (err) {
    console.error("welcome-signup: unexpected error", err);
    return json({ error: "Unexpected error" }, 500);
  }
});

function buildWelcomeEmail(opts: {
  name: string;
  roleLabel: string;
  isPublisher: boolean;
  profilePath: string;
  profileLabel: string;
  dashboardPath: string;
  siteUrl: string;
}): string {
  const { name, roleLabel, isPublisher, profilePath, profileLabel, dashboardPath, siteUrl } = opts;

  const accentColour = isPublisher ? "#F5C842" : "#2E7D52"; // yellow for publishers, green for businesses
  const profileUrl = `${siteUrl}${profilePath}`;
  const dashboardUrl = `${siteUrl}${dashboardPath}`;

  const whatNextItems = isPublisher
    ? [
        "Add your social pages, website, podcast or radio slot details.",
        "Set your pricing and availability so businesses can see what\u2019s on offer.",
        "Submit for review \u2014 our team checks every publisher before they go live.",
      ]
    : [
        "Add your business name, category and location.",
        "Browse publishers in your area and category.",
        "Send your first feature request \u2014 no ad account, no minimum spend.",
      ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Welcome to ChatSched</title>
</head>
<body style="margin:0;padding:0;background:#F7F4EF;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1A1712;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F4EF;padding:32px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFCF5;border:3px solid #1A1712;border-radius:4px;overflow:hidden;">

      <!-- Header bar -->
      <tr>
        <td style="background:${accentColour};border-bottom:3px solid #1A1712;padding:20px 28px;">
          <span style="font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#1A1712;letter-spacing:-0.5px;">CHATSCHED</span>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:32px 28px 24px;">

          <!-- Congratulations -->
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:bold;line-height:1.25;">Congratulations, ${escapeHtml(name)}! &#127881;</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4A4235;">
            You\u2019ve successfully signed up as a <strong>ChatSched ${escapeHtml(roleLabel)}</strong>.
            ${isPublisher
              ? "You\u2019re now part of a growing network of local South African publishers and creators connecting businesses with real, trusted audiences."
              : "You\u2019re now part of a growing network of South African businesses reaching real, local audiences directly \u2014 no ad platforms, no bidding, no guesswork."
            }
          </p>

          <!-- Divider -->
          <div style="border-top:2px solid #1A1712;opacity:0.1;margin:0 0 24px;"></div>

          <!-- Profile incomplete alert -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8DC;border:2px solid #1A1712;border-radius:4px;margin-bottom:24px;">
            <tr>
              <td style="padding:16px 20px;">
                <p style="margin:0 0 6px;font-size:13px;font-family:monospace;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;color:#7A6E5A;">&#9888;&#65039; Profile incomplete</p>
                <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#1A1712;">
                  ${isPublisher
                    ? "Your publisher profile is not yet visible to businesses. Complete your profile so you can start receiving feature requests and earning."
                    : "Your business profile is incomplete. Finishing it takes less than two minutes and unlocks browsing, bookings, and your full dashboard."
                  }
                </p>
                <a href="${profileUrl}" style="display:inline-block;background:${accentColour};border:2px solid #1A1712;border-radius:3px;padding:10px 20px;font-size:14px;font-weight:bold;color:#1A1712;text-decoration:none;">
                  ${escapeHtml(profileLabel)} &rarr;
                </a>
              </td>
            </tr>
          </table>

          <!-- What to do next -->
          <h2 style="margin:0 0 12px;font-size:16px;font-weight:bold;">What to do next</h2>
          <ol style="margin:0 0 24px;padding-left:20px;color:#4A4235;font-size:14px;line-height:1.7;">
            ${whatNextItems.map((item) => `<li style="margin-bottom:4px;">${escapeHtml(item)}</li>`).join("\n")}
          </ol>

          <!-- Secondary CTA -->
          <p style="margin:0 0 4px;font-size:14px;color:#4A4235;">
            Once your profile is complete, head to your dashboard to get started.
          </p>
          <a href="${dashboardUrl}" style="display:inline-block;margin-top:8px;border:2px solid #1A1712;border-radius:3px;padding:10px 20px;font-size:14px;font-weight:bold;color:#1A1712;text-decoration:none;background:#FFFCF5;">
            Go to dashboard &rarr;
          </a>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#F7F4EF;border-top:2px solid #1A1712;padding:16px 28px;">
          <p style="margin:0;font-size:12px;color:#7A6E5A;line-height:1.5;">
            You\u2019re receiving this because you just signed up for ChatSched.
            Questions? Reply to this email or visit
            <a href="${siteUrl}/help" style="color:#1A1712;">chatsched.co.za/help</a>.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
