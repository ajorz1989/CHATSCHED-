import type { ReactNode } from 'react';
import { SchedyScene } from './SchedyScene';

// Default copy comes from SCHEDY-GUIDE.md (plain words, light local slang).
// Every string is overridable so you can feed it from i18next: title={t('schedy.notFound.title')}.

type Common = { children?: ReactNode; title?: string; message?: string; className?: string };
type BookedProps = Common & { /** The artwork says BOOKED, so this must only be passed once a booking is really confirmed. */ confirmed: true };

/** Use on the catch-all route. Renders an h1. */
export function SchedyNotFound({ title = 'Page not found', message = "Eish, we can't find that page. Try the home page or browse publishers.", ...rest }: Common) {
  return <SchedyScene scene="notFound" headingLevel="h1" title={title} message={message} {...rest} />;
}

/** Empty list of opportunities (business or publisher side). */
export function SchedyEmptyOpportunities({ title = 'No opportunities yet', message = 'Eish, nothing here yet. Post an opportunity and publishers can apply.', ...rest }: Common) {
  return <SchedyScene scene="emptyOpportunities" title={title} message={message} {...rest} />;
}

/** Empty list of campaigns. */
export function SchedyEmptyCampaigns({ title = 'No campaigns yet', message = "Nothing booked yet. Start a campaign and it will show up here.", ...rest }: Common) {
  return <SchedyScene scene="emptyCampaigns" title={title} message={message} {...rest} />;
}

/**
 * Only render this once the booking is really confirmed (the `confirmed` prop makes you say so).
 * A request that is merely sent is not a booking: use <SchedySticker name="sharp" /> for that.
 * Do not use it on payment, dispute or trust pages (keep those plain).
 */
export function SchedyBookedSuccess({ title = 'Booked', message = "Sharp! That's booked. You can follow it from your campaign page.", confirmed: _confirmed, ...rest }: BookedProps) {
  return <SchedyScene scene="successBooked" title={title} message={message} {...rest} />;
}
