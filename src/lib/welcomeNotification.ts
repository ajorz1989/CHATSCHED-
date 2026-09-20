// welcomeNotification.ts
//
// Calls the welcome-signup Edge Function from the client side immediately
// after a new publisher or business account is created.
//
// This is a belt-and-braces fallback alongside the DB trigger. The trigger
// fires automatically on every profile INSERT, so in normal operation this
// client-side call is a no-op duplicate — the Edge Function is idempotent
// for in-app notifications (it inserts a single row and returns; duplicate
// calls within the same session are unlikely in practice). If the trigger
// hasn't been applied yet (e.g. local dev without migrations run), this
// ensures the welcome notification still fires.
//
// Usage (in Register.tsx, after the profile row is confirmed created):
//
//   import { sendWelcomeNotification } from "../lib/welcomeNotification";
//   await sendWelcomeNotification({ userId, role, displayName });
//
// Errors are caught and logged — a failed welcome notification must never
// block or surface an error to the user during registration.

import { supabase } from "./supabase";

interface WelcomePayload {
  userId: string;
  role: "publisher" | "business";
  displayName?: string;
}

/**
 * Fire-and-forget welcome notification after signup.
 * Safe to call without awaiting if you don't need the result.
 */
export async function sendWelcomeNotification({
  userId,
  role,
  displayName,
}: WelcomePayload): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("welcome-signup", {
      body: {
        user_id: userId,
        role,
        display_name: displayName ?? "",
      },
    });

    if (error) {
      // Not a user-facing error — log only.
      console.warn("welcomeNotification: edge function returned error", error);
    }
  } catch (err) {
    // Network failure, function not deployed, etc. — never surface to user.
    console.warn("welcomeNotification: call failed", err);
  }
}
