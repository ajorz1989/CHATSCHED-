import { useEffect } from "react";

/**
 * GA4 page changes are handled by Google's enhanced measurement for browser
 * history events. Keeping this component available avoids breaking any older
 * imports while preventing duplicate manual page_view events in the SPA.
 */
export default function AnalyticsListener() {
  useEffect(() => undefined, []);
  return null;
}
