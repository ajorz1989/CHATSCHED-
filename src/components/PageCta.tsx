import { Link } from "react-router-dom";

/**
 * Closing call to action for information pages (trust, security, roadmap and so
 * on), so a visitor who has finished reading always has a clear next step.
 * One primary action, one secondary.
 */
export default function PageCta({
  title = "Ready to reach local customers?",
  body = "Tell us your goal and budget and we'll plan the campaign, or browse local publishers and choose yourself.",
}: { title?: string; body?: string }) {
  return (
    <section aria-label="Next step" className="mt-14 mx-auto max-w-3xl px-5 pb-16">
      <div className="bg-billboard-yellow border-[3px] border-billboard-ink rounded-xl shadow-blockSm px-5 py-9 md:py-10 text-center">
        <h2 className="font-display text-2xl md:text-3xl mb-2">{title}</h2>
        <p className="text-billboard-ink/80 max-w-prose mx-auto mb-6">{body}</p>
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <Link to="/build-my-campaign" data-cta="page-cta-build" className="brand-button dark">Build my campaign →</Link>
          <Link to="/browse" data-cta="page-cta-browse" className="brand-button light">Browse publishers</Link>
        </div>
      </div>
    </section>
  );
}
