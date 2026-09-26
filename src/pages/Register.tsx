import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { isSupabaseConfigured } from "../lib/supabase";
import SetupNotice from "../components/SetupNotice";
import Seo from "../components/Seo";
import { useHoneypot } from "../hooks/useHoneypot";
import { getPublisherOnboardingChannels, isPublisherOnboardingChannel } from "../lib/channelRegistry";
import type { ChannelSlug } from "../lib/channelTypes";
import ChannelIcon from "../components/ChannelIcon";

type Role = "business" | "publisher";
const APPLY_CHANNEL_STORAGE_KEY = "mb_apply_channel";

export default function Register() {
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [role, setRole] = useState<Role>(searchParams.get("role") === "publisher" ? "publisher" : "business");
  const channelParam = searchParams.get("channel");
  // Which of the 12 channels a publisher is applying for — pre-filled if
  // they arrived via a channel page's "Apply as a creator" link (same
  // channelParam already used below to seed sessionStorage), otherwise
  // unset until they pick one. Only shown/required in the publisher path —
  // a business account isn't tied to any one channel.
  const [selectedChannel, setSelectedChannel] = useState<ChannelSlug | null>(
    channelParam && isPublisherOnboardingChannel(channelParam)
      ? (channelParam as ChannelSlug)
      : null,
  );

  // Carry a channel-page "Apply as a creator" click through to PublisherApply
  // once the user logs in — see that page's header comment for why this
  // can't just be a query param the whole way through.
  useEffect(() => {
    if (channelParam && isPublisherOnboardingChannel(channelParam)) {
      sessionStorage.setItem(APPLY_CHANNEL_STORAGE_KEY, channelParam);
    }
  }, [channelParam]);
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  // Phase 81 (Business Value Proposition & Opportunities Engine) —
  // controlled business-type taxonomy plus a dynamic opportunity-interest
  // multi-select generated from it. Business-only; a publisher's channel
  // choice above is the equivalent field on their side of signup.
  const [businessType, setBusinessType] = useState("");
  const [opportunityPreferences, setOpportunityPreferences] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — real users never see this field
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [acceptedLegalTerms, setAcceptedLegalTerms] = useState(false);
  const [done, setDone] = useState(false);
  const { isLikelyBot, wrapperProps } = useHoneypot();

  if (!isSupabaseConfigured) return <SetupNotice />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isLikelyBot(website)) return; // silently drop — no error, no signal to a bot
    if (!acceptedLegalTerms) { setError("You must accept the Terms of Service and Privacy Policy to create an account."); return; }
    if (role === "publisher" && !selectedChannel) { setError("Choose which channel you're applying for."); return; }
    setLoading(true);
    setError(null);
    // Store the final channel choice (picker selection, which may differ
    // from the channelParam this page loaded with) the same way the
    // existing useEffect stores channelParam — PublisherApply.tsx reads
    // this same key.
    if (role === "publisher" && selectedChannel) sessionStorage.setItem(APPLY_CHANNEL_STORAGE_KEY, selectedChannel);
    const { error } = await signUp(email, password, {
      full_name: fullName,
      company_name: role === "business" ? companyName : undefined,
      phone,
      role,
      business_type: role === "business" ? businessType : undefined,
      opportunity_preferences: role === "business" ? opportunityPreferences : undefined,
      terms_accepted_at: new Date().toISOString(),
      privacy_accepted_at: new Date().toISOString(),
    });
    setLoading(false);
    if (error) setError(error);
    else setDone(true);
  }

  async function handleGoogle() {
    if (!acceptedLegalTerms) {
      setError("You must accept the Terms of Service and Privacy Policy to continue with Google.");
      return;
    }
    setGoogleLoading(true);
    setError(null);
    const { error } = await signInWithGoogle();
    if (error) {
      setError(error);
      setGoogleLoading(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto px-5 py-24 text-center">
        <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-greenDeep text-billboard-greenDeep px-3 py-1.5 rounded mb-4">Account created</span>
        <h1 className="text-2xl md:text-3xl mb-3">Almost there.</h1>
        <p className="text-billboard-inkSoft mb-8">
          If your account needs email confirmation, check your inbox for a link. Otherwise, you're ready to log in now.
          {role === "publisher" && " Once you're in, you'll land straight on your application — a few more questions about your page and you're done."}
        </p>
        <button onClick={() => navigate("/login")} className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-ink text-billboard-paper font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition">
          Go to login →
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <Seo title="Create an Account · ChatSched" noindex />

      <div className="flex border-[3px] border-billboard-ink rounded overflow-hidden mb-6">
        <button
          type="button"
          onClick={() => setRole("business")}
          className={`flex-1 py-2.5 font-bold text-sm uppercase tracking-wide transition ${role === "business" ? "bg-billboard-yellow" : "bg-billboard-paper hover:bg-billboard-paper/60"}`}
        >
          I'm a business
        </button>
        <button
          type="button"
          onClick={() => setRole("publisher")}
          className={`flex-1 py-2.5 font-bold text-sm uppercase tracking-wide border-l-[3px] border-billboard-ink transition ${role === "publisher" ? "bg-billboard-green" : "bg-billboard-paper hover:bg-billboard-paper/60"}`}
        >
          I'm a publisher
        </button>
      </div>

      {role === "business" ? (
        <>
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Create account</span>
          <h1 className="text-3xl mb-2">Book your first campaign.</h1>
          <p className="text-billboard-inkSoft mb-8">Set up a business account to request publishers and track your campaigns.</p>
        </>
      ) : (
        <>
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-greenDeep text-billboard-greenDeep px-3 py-1.5 rounded mb-3">Publisher application</span>
          <h1 className="text-3xl mb-2">Join the ChatSched Publisher Network.</h1>
          <p className="text-billboard-inkSoft mb-4">Create your login here — you'll fill in your page details and apply on the next screen. Every application is reviewed by hand before it goes live.</p>
          <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 mb-4 text-sm">
            {[
              "Access to paid campaigns",
              "A verified profile",
              "Real campaign opportunities",
              "Professional support",
              "Secure, held payments",
              "A performance history that builds over time",
            ].map((benefit) => (
              <li key={benefit} className="flex items-start gap-1.5 text-billboard-inkSoft">
                <span className="text-billboard-greenDeep mt-0.5">✓</span> {benefit}
              </li>
            ))}
          </ul>
          <p className="font-semibold text-billboard-ink mb-8">You're not just listing a page — you're building your own media network.</p>
          <div className="mb-8">
            <label className="block text-sm font-semibold mb-2">Which live channel are you applying for?</label>
            <div className="grid grid-cols-3 gap-2">
              {getPublisherOnboardingChannels().map((ch) => (
                <button
                  key={ch.definition.slug}
                  type="button"
                  onClick={() => setSelectedChannel(ch.definition.slug)}
                  className={`text-center border-2 rounded px-2 py-3 transition ${
                    selectedChannel === ch.definition.slug
                      ? "border-billboard-greenDeep bg-billboard-green/10 font-semibold"
                      : "border-billboard-ink hover:bg-billboard-paperDim"
                  }`}
                >
                  <ChannelIcon slug={ch.definition.slug} size="sm" />
                  <span className="block text-[11px] leading-tight">{ch.definition.name}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="border-[3px] border-billboard-ink rounded p-6">
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1.5">Your name</label>
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
        </div>
        {role === "business" && (
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-1.5">Business name</label>
            <input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
          </div>
        )}
        {role === "business" && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1.5">Business type</label>
              <select required value={businessType} onChange={(e) => { setBusinessType(e.target.value); setOpportunityPreferences([]); }} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5">
                <option value="">Select your business type</option>
                <option>Educational Institution / School</option><option>Retail / SMME</option><option>Event Organizer</option><option>Corporate Brand</option><option>Venue Owner</option><option>Non-profit / Community Organisation</option><option>Sports Club / Organisation</option><option>Media / Publisher</option><option>Other</option>
              </select>
            </div>
            {businessType && <div className="mb-4">
              <label className="block text-sm font-semibold mb-1.5">What opportunities are you interested in?</label>
              <div className="grid sm:grid-cols-2 gap-2">
                {({
                  "Educational Institution / School": ["School Partnership", "Event Sponsorship", "Newsletter Sponsorship", "Sports Sponsorship"],
                  "Retail / SMME": ["Influencer Product Placement", "Social Media Promotion", "Local Event Sponsorship", "In-Venue Screen Display"],
                  "Event Organizer": ["Event Sponsorship", "Venue Display", "Radio / Podcast Spot", "Influencer Product Placement"],
                  "Corporate Brand": ["School Partnership", "Event Sponsorship", "Newsletter Sponsorship", "Radio / Podcast Spot", "Sports Sponsorship"],
                  "Venue Owner": ["In-Venue Screen Display", "Event Sponsorship", "Local Business Promotion"],
                  "Non-profit / Community Organisation": ["Community Sponsorship", "Newsletter Sponsorship", "Event Sponsorship"],
                  "Sports Club / Organisation": ["Sports Sponsorship", "Event Sponsorship", "In-Venue Screen Display"],
                  "Media / Publisher": ["Newsletter Sponsorship", "Radio / Podcast Spot", "Website Advertising"],
                  Other: ["Event Sponsorship", "Social Media Promotion", "Website Advertising"]
                } as Record<string,string[]>)[businessType].map((item) => <label key={item} className="flex items-center gap-2 border-2 border-billboard-ink/20 rounded p-2 text-xs"><input type="checkbox" checked={opportunityPreferences.includes(item)} onChange={(e) => setOpportunityPreferences(v => e.target.checked ? [...v, item] : v.filter(x => x !== item))} />{item}</label>)}
              </div>
            </div>}
          </>
        )}
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1.5">Mobile number{role === "business" ? " (WhatsApp works best)" : ""}</label>
          <input required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1.5">Email</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1.5">Password</label>
          <input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
          <p className="text-xs text-billboard-inkSoft mt-1">At least 8 characters.</p>
        </div>
        <div {...wrapperProps}>
          <label htmlFor="register-website">Leave this field empty</label>
          <input id="register-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>
        <label className="flex items-start gap-2 text-sm mb-4">
          <input type="checkbox" checked={acceptedLegalTerms} onChange={(e) => setAcceptedLegalTerms(e.target.checked)} className="mt-0.5" required />
          <span>I agree to the <Link to="/terms" className="font-semibold underline">Terms of Service</Link> and <Link to="/privacy" className="font-semibold underline">Privacy Policy</Link>.</span>
        </label>
        {error && <p className="text-billboard-red text-xs font-semibold mb-4">{error}</p>}
        <button
          type="submit"
          disabled={loading || !acceptedLegalTerms}
          className={`w-full border-[3px] border-billboard-ink font-bold py-3 rounded hover:-translate-y-0.5 transition disabled:opacity-60 ${role === "business" ? "bg-billboard-yellow" : "bg-billboard-green"}`}
        >
          {loading ? "Creating account…" : role === "business" ? "Create account" : "Continue to application"}
        </button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-billboard-paperDim" />
        <span className="text-[10px] font-mono uppercase text-billboard-inkSoft">or</span>
        <div className="flex-1 h-px bg-billboard-paperDim" />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={googleLoading || !acceptedLegalTerms}
        className="w-full flex items-center justify-center gap-2.5 border-2 border-billboard-ink font-semibold text-sm py-2.5 rounded hover:-translate-y-0.5 transition disabled:opacity-60 bg-white"
      >
        <svg width="16" height="16" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.96 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"/></svg>
        {googleLoading ? "Redirecting…" : "Continue with Google"}
      </button>

      <p className="text-sm text-billboard-inkSoft mt-5 text-center">
        Already have an account? <Link to="/login" className="font-semibold underline">Log in</Link>
      </p>
    </div>
  );
}
