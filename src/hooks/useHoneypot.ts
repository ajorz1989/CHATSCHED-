import { useRef } from "react";

// Two lightweight, invisible-to-real-users bot signals for public forms
// (Contact, Register) that don't need a CAPTCHA or a backend change:
//   1. A honeypot field real users never see or fill in — if it has a
//      value, whatever submitted the form isn't a person.
//   2. A minimum time between the form mounting and being submitted —
//      catches the class of bot that fills every field and posts
//      instantly, faster than any human could.
// Both public insert policies this protects (contact_messages, and the
// business/publisher signup flow) previously had no protection at all.
const MIN_FILL_SECONDS = 2;

export function useHoneypot() {
  const mountedAt = useRef(Date.now());

  function isLikelyBot(honeypotValue: string): boolean {
    if (honeypotValue.trim() !== "") return true;
    const elapsedSeconds = (Date.now() - mountedAt.current) / 1000;
    return elapsedSeconds < MIN_FILL_SECONDS;
  }

  // Visually hidden from real users (off-screen, not display:none —
  // display:none is skipped by some bots) and out of the tab order.
  // Spread onto a wrapper div around the actual <input>.
  const wrapperProps = {
    "aria-hidden": true as const,
    style: { position: "absolute" as const, left: "-9999px", top: "-9999px", height: 0, width: 0, overflow: "hidden" as const },
  };

  return { isLikelyBot, wrapperProps };
}
