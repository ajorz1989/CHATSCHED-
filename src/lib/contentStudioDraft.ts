// A tiny one-shot handoff: AI Content Studio (marketingSuite/ContentStudio.tsx)
// writes the piece of generated copy a business picked into sessionStorage,
// then routes them to Browse to choose a creator to send it to. Whichever
// request form they land on (PublisherProfile.tsx's inline form for
// social-media, or ChannelRequestForm.tsx for the 4 request-flow channels)
// reads it once on mount to prefill the campaign message, then clears it —
// so it never leaks into a later, unrelated request.
const KEY = "mb_content_studio_draft";

export function setContentStudioDraft(text: string) {
  try {
    sessionStorage.setItem(KEY, text);
  } catch {
    // sessionStorage can throw in locked-down/private-browsing contexts —
    // losing the handoff isn't worth breaking the flow over.
  }
}

export function takeContentStudioDraft(): string | null {
  try {
    const value = sessionStorage.getItem(KEY);
    if (value) sessionStorage.removeItem(KEY);
    return value;
  } catch {
    return null;
  }
}
