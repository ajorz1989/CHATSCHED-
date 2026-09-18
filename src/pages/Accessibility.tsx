import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { CONTACT_EMAIL } from "../lib/constants";

const IN_PLACE = [
  { title: "Keyboard operable", body: "Interactive elements — forms, the FAQ accordion, filters, menus — are built on standard HTML controls that work with a keyboard, not custom widgets that only respond to a mouse." },
  { title: "Respects reduced motion", body: "Animations and reveal effects check for prefers-reduced-motion and switch themselves off for anyone who has that set at the system level." },
  { title: "Labelled for screen readers", body: "Interactive elements and status changes carry ARIA labels and roles where a visual cue alone (colour, an icon) wouldn't be enough on its own." },
  { title: "Alt text on images", body: "Images carry descriptive alt text rather than being left blank or filled with a filename." },
  { title: "Works in more than one language", body: "The interface is available in English, Afrikaans, isiZulu, and isiXhosa, not just the language it happened to be built in." },
];

export default function Accessibility() {
  return (
    <div>
      <Seo title="Accessibility · ChatSched" description="What ChatSched does today to be usable with a keyboard, a screen reader, or reduced motion — and how to report something that isn't working." />

      <section className="bg-billboard-yellow border-b-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink bg-billboard-paper px-3 py-1.5 rounded mb-4">Accessibility</span>
          <h1 className="text-3xl md:text-4xl mb-5">Built to be usable, not just to look right.</h1>
          <p className="text-lg text-billboard-inkSoft max-w-xl">This isn't a certification — it's a plain account of what's actually in place today, and where there's still work to do.</p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-5 py-16">
        <h2 className="font-display text-xl mb-6">What's in place</h2>
        <div className="grid sm:grid-cols-2 gap-5">
          {IN_PLACE.map((p) => (
            <div key={p.title} className="border-[3px] border-billboard-ink rounded p-5">
              <h3 className="font-bold mb-1.5">{p.title}</h3>
              <p className="text-sm text-billboard-inkSoft">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-billboard-paperDim border-y-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <h2 className="font-display text-xl mb-3">Where we're still improving</h2>
          <p className="text-billboard-inkSoft">There's no formal WCAG audit behind this page yet — what's listed above reflects deliberate choices made while building, not a completed compliance review. If something doesn't work with the tools you use to browse, that's a real gap worth knowing about, not an edge case to work around.</p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-5 py-16">
        <div className="border-[3px] border-billboard-ink rounded p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-bold text-lg mb-1">Something not working for you?</h2>
            <p className="text-sm text-billboard-inkSoft">Tell us what happened and what you were trying to do — reach us at {CONTACT_EMAIL} or use the <Link to="/contact" className="underline">contact form</Link>.</p>
          </div>
          <a href={`mailto:${CONTACT_EMAIL}?subject=Accessibility%20issue`} className="inline-block bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition shrink-0 text-center">
            Report an issue →
          </a>
        </div>
      </section>
    </div>
  );
}
