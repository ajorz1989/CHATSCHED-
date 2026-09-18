import { describe, it, expect } from "vitest";
import { scanAndRedactMessage } from "./messageSafety";

describe("scanAndRedactMessage", () => {
  it("passes a clean message through unchanged", () => {
    const result = scanAndRedactMessage(
      "Loved the last campaign, keen to run another one in October."
    );
    expect(result).toEqual({
      body: "Loved the last campaign, keen to run another one in October.",
      flagged: false,
      flagReason: null,
    });
  });

  it("redacts a spaced SA mobile number and flags it", () => {
    const result = scanAndRedactMessage("Call me on 082 123 4567 to chat details.");
    expect(result.flagged).toBe(true);
    expect(result.flagReason).toBe("phone_number");
    expect(result.body).toBe("Call me on [contact details removed] to chat details.");
  });

  it("redacts a +27 formatted number", () => {
    const result = scanAndRedactMessage("+27821234567 is my number");
    expect(result.flagged).toBe(true);
    expect(result.flagReason).toBe("phone_number");
    expect(result.body).toBe("[contact details removed] is my number");
  });

  it("redacts a spelled-out phone number", () => {
    const result = scanAndRedactMessage(
      "My number is oh eight two one two three four five six seven, call anytime"
    );
    expect(result.flagged).toBe(true);
    expect(result.flagReason).toBe("phone_number");
    expect(result.body).toBe("My number is [contact details removed], call anytime");
  });

  it("redacts an email address and flags it", () => {
    const result = scanAndRedactMessage("Reach me at creator@example.co.za instead");
    expect(result.flagged).toBe(true);
    expect(result.flagReason).toBe("email");
    expect(result.body).toBe("Reach me at [contact details removed] instead");
  });

  it("redacts a spelled-out email address", () => {
    const result = scanAndRedactMessage("It's jane at example dot co dot za if easier");
    expect(result.flagged).toBe(true);
    expect(result.flagReason).toBe("email");
    expect(result.body).toBe("It's [contact details removed] if easier");
  });

  it("redacts a WhatsApp mention used as a messaging destination", () => {
    const result = scanAndRedactMessage("Let's just move this to WhatsApp");
    expect(result.flagged).toBe(true);
    expect(result.flagReason).toBe("external_platform");
    expect(result.body).toBe("Let's just move this to [contact details removed]");
  });

  it("does NOT flag WhatsApp Channel — that's a real Platform value here", () => {
    const result = scanAndRedactMessage("Happy to post this on my WhatsApp Channel next week");
    expect(result.flagged).toBe(false);
    expect(result.body).toBe("Happy to post this on my WhatsApp Channel next week");
  });

  it("redacts a Telegram mention", () => {
    const result = scanAndRedactMessage("I'm easier to reach on Telegram");
    expect(result.flagged).toBe(true);
    expect(result.flagReason).toBe("external_platform");
    expect(result.body).toBe("I'm easier to reach on [contact details removed]");
  });

  it("does not flag Instagram, Facebook, TikTok, or other campaign platforms", () => {
    const result = scanAndRedactMessage(
      "This campaign runs on Instagram, Facebook, TikTok, YouTube, LinkedIn and X"
    );
    expect(result.flagged).toBe(false);
  });

  it("reports email as the reason when a message matches both, and redacts both", () => {
    const result = scanAndRedactMessage("Email creator@example.com or call 0821234567");
    expect(result.flagged).toBe(true);
    expect(result.flagReason).toBe("email");
    expect(result.body).toBe(
      "Email [contact details removed] or call [contact details removed]"
    );
  });

  it("leaves ordinary numbers that aren't phone-shaped alone", () => {
    const result = scanAndRedactMessage("We can do R4500 for 3 posts across 2 weeks");
    expect(result.flagged).toBe(false);
    expect(result.body).toBe("We can do R4500 for 3 posts across 2 weeks");
  });

  it("leaves a short digit-word count alone (not a spelled-out phone number)", () => {
    const result = scanAndRedactMessage("Let's do one two three variations of the post");
    expect(result.flagged).toBe(false);
  });

  it("is safe to call twice in a row (regex lastIndex doesn't leak between calls)", () => {
    const first = scanAndRedactMessage("call 0821234567");
    const second = scanAndRedactMessage("call 0821234567");
    expect(first).toEqual(second);
  });
});
