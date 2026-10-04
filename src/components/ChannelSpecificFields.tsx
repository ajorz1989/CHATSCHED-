/**
 * The channel-specific onboarding questions (podcast downloads, restaurant
 * covers, event attendance...) shared by the publisher application wizard and
 * the business listing creator. Pure presentation over the shared FormState in
 * src/lib/channelOnboardingForm.ts.
 */
import type { ChannelSlug } from "../lib/channelTypes";
import { getChannelBySlug } from "../lib/channelRegistry";
import type { SocialMediaPlatform } from "../lib/channelOnboardingSchemas";
import {
  type FormState, 
  SOCIAL_MEDIA_PLATFORMS, SOCIAL_MEDIA_PLATFORM_LABELS, getSelectedSocialPlatforms,
} from "../lib/channelOnboardingForm";

export const inputClass = "w-full border-2 border-billboard-ink rounded px-3 py-2.5";
export const labelClass = "block text-sm font-semibold mb-1.5";

/** "Which formats do you offer?" - businesses can only request formats ticked here. */
export function AdFormatsPicker({ channelSlug, form, update }: {
  channelSlug: ChannelSlug;
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const ch = getChannelBySlug(channelSlug)?.definition;
  if (!ch || !ch.advertisingMethods || ch.advertisingMethods.length === 0) return null;
  const toggle = (label: string) =>
    update("adFormats", form.adFormats.includes(label) ? form.adFormats.filter((x) => x !== label) : [...form.adFormats, label]);
  return (
    <div>
      <label className={labelClass}>Which {ch.name.toLowerCase()} formats do you offer?</label>
      <p className="text-xs text-billboard-inkSoft mb-2">Check off everything you're willing to run — businesses will only be able to request formats you've selected here.</p>
      <div className="flex flex-wrap gap-2">
        {ch.advertisingMethods.map((m) => (
          <button
            type="button" key={m.id} onClick={() => toggle(m.label)}
            title={m.description}
            className={`text-sm font-semibold px-3 py-1.5 rounded border-2 border-billboard-ink transition ${form.adFormats.includes(m.label) ? "bg-billboard-green" : "bg-billboard-paper"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChannelSpecificFields({
  channelSlug, form, update,
}: {
  channelSlug: ChannelSlug;
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const getSelectedSocialVerificationPlatforms = () => getSelectedSocialPlatforms(form);

  function setSocialPrimary(platform: string) {
    update("smPrimaryPlatform", platform);
    update("smSecondaryPlatforms", form.smSecondaryPlatforms.filter((value) => value !== platform));
  }

  function toggleSocialSecondary(platform: SocialMediaPlatform) {
    if (platform === form.smPrimaryPlatform) return;
    update(
      "smSecondaryPlatforms",
      form.smSecondaryPlatforms.includes(platform)
        ? form.smSecondaryPlatforms.filter((value) => value !== platform)
        : [...form.smSecondaryPlatforms, platform],
    );
  }

  function updateSocialVerificationLink(platform: SocialMediaPlatform, value: string) {
    update("smSocialLinks", { ...form.smSocialLinks, [platform]: value });
  }

  return (
    <>
          {/* Channel-specific questions — every channel now has a typed
              schema (channelOnboardingSchemas.ts). See
              CHANNEL_UPDATES_AUDIT.md for the session history of which
              three came first. */}
          {channelSlug === "podcast" && (
            <div className="border-t-2 border-billboard-paperDim pt-4 space-y-4">
              <p className="text-xs font-mono uppercase text-billboard-inkSoft">Podcast specifics</p>
              <div>
                <label className={labelClass}>Average downloads per episode</label>
                <input type="number" min={0} value={form.podcastDownloads} onChange={(e) => update("podcastDownloads", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>How often do you publish?</label>
                <select value={form.podcastFrequency} onChange={(e) => update("podcastFrequency", e.target.value)} className={inputClass}>
                  <option value="">Select…</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every two weeks</option>
                  <option value="monthly">Monthly</option>
                  <option value="irregular">Irregular</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Average episode length (minutes)</label>
                <input type="number" min={0} value={form.podcastEpisodeLength} onChange={(e) => update("podcastEpisodeLength", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Hosting platform</label>
                <input placeholder="e.g. Spotify, Apple Podcasts" value={form.podcastHostingPlatform} onChange={(e) => update("podcastHostingPlatform", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Ad slots you offer</label>
                <div className="flex flex-wrap gap-2">
                  {(["pre-roll", "mid-roll", "post-roll"] as const).map((slot) => (
                    <button type="button" key={slot} onClick={() => update("podcastAdSlots", form.podcastAdSlots.includes(slot) ? form.podcastAdSlots.filter((s) => s !== slot) : [...form.podcastAdSlots, slot])}
                      className={`text-sm font-semibold px-3 py-1.5 rounded border-2 border-billboard-ink transition ${form.podcastAdSlots.includes(slot) ? "bg-billboard-green" : "bg-billboard-paper"}`}>
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Where are most of your listeners? <span className="font-normal text-billboard-inkSoft">(comma-separated)</span></label>
                <input placeholder="e.g. Gauteng, Western Cape" value={form.podcastRegions} onChange={(e) => update("podcastRegions", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Show link <span className="font-normal text-billboard-inkSoft">(RSS feed or your show's page on Spotify/Apple — lets buyers actually listen before booking)</span></label>
                <input placeholder="https://open.spotify.com/show/..." value={form.podcastShowUrl} onChange={(e) => update("podcastShowUrl", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>When do most people actually listen? <span className="font-normal text-billboard-inkSoft">(optional)</span></label>
                <input placeholder="e.g. Tuesday evenings, weekend mornings" value={form.podcastPeakTimes} onChange={(e) => update("podcastPeakTimes", e.target.value)} className={inputClass} />
              </div>
            </div>
          )}

          {channelSlug === "informal-retail" && (
            <div className="border-t-2 border-billboard-paperDim pt-4 space-y-4">
              <p className="text-xs font-mono uppercase text-billboard-inkSoft">Shop specifics</p>
              <div>
                <label className={labelClass}>Estimated daily customers</label>
                <input type="number" min={0} value={form.retailFootTraffic} onChange={(e) => update("retailFootTraffic", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Trading hours</label>
                <input placeholder="e.g. 06:00–20:00, 7 days" value={form.retailTradingHours} onChange={(e) => update("retailTradingHours", e.target.value)} className={inputClass} />
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={form.retailHasTill} onChange={(e) => update("retailHasTill", e.target.checked)} />
                We have an electronic till (needed for till-slip sponsorship)
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={form.retailHasWhatsapp} onChange={(e) => update("retailHasWhatsapp", e.target.checked)} />
                We have a WhatsApp broadcast list for regulars
              </label>
              {form.retailHasWhatsapp && (
                <div>
                  <label className={labelClass}>Roughly how many people on it?</label>
                  <input type="number" min={0} value={form.retailWhatsappSize} onChange={(e) => update("retailWhatsappSize", e.target.value)} className={inputClass} />
                </div>
              )}
              <div>
                <label className={labelClass}>Nearby landmark <span className="font-normal text-billboard-inkSoft">(helps us find you)</span></label>
                <input placeholder="e.g. opposite Shoprite on Voortrekker Rd" value={form.retailLandmark} onChange={(e) => update("retailLandmark", e.target.value)} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Lowest price (R)</label>
                  <input type="number" min={0} value={form.retailPriceMin} onChange={(e) => update("retailPriceMin", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Highest price (R)</label>
                  <input type="number" min={0} value={form.retailPriceMax} onChange={(e) => update("retailPriceMax", e.target.value)} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>When's your busiest time of day? <span className="font-normal text-billboard-inkSoft">(optional)</span></label>
                <input placeholder="e.g. after school, 16:00–18:00" value={form.retailPeakHours} onChange={(e) => update("retailPeakHours", e.target.value)} className={inputClass} />
              </div>
            </div>
          )}

          {channelSlug === "sports" && (
            <div className="border-t-2 border-billboard-paperDim pt-4 space-y-4">
              <p className="text-xs font-mono uppercase text-billboard-inkSoft">Team/league specifics</p>
              <div>
                <label className={labelClass}>Sport</label>
                <input value={form.sportsSport} onChange={(e) => update("sportsSport", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Competition level</label>
                <select value={form.sportsLevel} onChange={(e) => update("sportsLevel", e.target.value)} className={inputClass}>
                  <option value="">Select…</option>
                  <option value="school">School</option>
                  <option value="amateur">Amateur</option>
                  <option value="semi-professional">Semi-professional</option>
                  <option value="professional">Professional</option>
                  <option value="university">University</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>League / competition name</label>
                <input value={form.sportsLeague} onChange={(e) => update("sportsLeague", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Current season</label>
                <input placeholder="e.g. 2026 or 2026/27" value={form.sportsSeason} onChange={(e) => update("sportsSeason", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Squad size</label>
                <input type="number" min={0} value={form.sportsSquadSize} onChange={(e) => update("sportsSquadSize", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Average matchday attendance <span className="font-normal text-billboard-inkSoft">(optional)</span></label>
                <input type="number" min={0} value={form.sportsAttendance} onChange={(e) => update("sportsAttendance", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Home venue</label>
                <input value={form.sportsVenue} onChange={(e) => update("sportsVenue", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Your role, for sponsorship authority</label>
                <select value={form.sportsAuthorityRole} onChange={(e) => update("sportsAuthorityRole", e.target.value)} className={inputClass}>
                  <option value="">Select…</option>
                  <option value="owner">Owner</option>
                  <option value="administrator">Administrator</option>
                  <option value="sponsorship_manager">Sponsorship manager</option>
                </select>
              </div>
            </div>
          )}

          {channelSlug === "social-media" && (
            <div className="border-t-2 border-billboard-paperDim pt-4 space-y-4">
              <p className="text-xs font-mono uppercase text-billboard-inkSoft">Page/profile specifics</p>
              <div>
                <label className={labelClass}>Primary platform</label>
                <select value={form.smPrimaryPlatform} onChange={(e) => setSocialPrimary(e.target.value)} className={inputClass}>
                  <option value="">Select…</option>
                  {SOCIAL_MEDIA_PLATFORMS.map((platform) => (
                    <option key={platform} value={platform}>{SOCIAL_MEDIA_PLATFORM_LABELS[platform]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Other platforms <span className="font-normal text-billboard-inkSoft">(optional)</span></label>
                <div className="flex flex-wrap gap-2">
                  {SOCIAL_MEDIA_PLATFORMS.filter((platform) => platform !== form.smPrimaryPlatform).map((platform) => (
                    <button
                      type="button"
                      key={platform}
                      onClick={() => toggleSocialSecondary(platform)}
                      aria-pressed={form.smSecondaryPlatforms.includes(platform)}
                      className={`text-sm font-semibold px-3 py-1.5 rounded border-2 border-billboard-ink transition ${
                        form.smSecondaryPlatforms.includes(platform) ? "bg-billboard-green text-white" : "bg-billboard-paper"
                      }`}
                    >
                      {SOCIAL_MEDIA_PLATFORM_LABELS[platform]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-2 border-billboard-ink rounded-lg p-4 bg-billboard-yellow/20">
                <label className={labelClass}>Social profile links for verification</label>
                <p className="text-xs text-billboard-inkSoft mb-3">
                  Submit the public profile URL for your primary platform and for every additional platform you select above. ChatSched uses these links for manual verification; they are kept private from the public publisher profile.
                </p>
                {getSelectedSocialVerificationPlatforms().length === 0 ? (
                  <p className="text-sm text-billboard-red font-semibold">Choose your primary platform above to add your verification link.</p>
                ) : (
                  <div className="space-y-3">
                    {getSelectedSocialVerificationPlatforms().map((platform) => (
                      <div key={platform}>
                        <label className="block text-xs font-semibold mb-1.5">
                          {SOCIAL_MEDIA_PLATFORM_LABELS[platform]} profile URL
                        </label>
                        <input
                          type="url"
                          inputMode="url"
                          placeholder={platform === "whatsapp_channel" ? "https://whatsapp.com/channel/..." : `https://${platform}.com/your-profile`}
                          value={form.smSocialLinks[platform] ?? ""}
                          onChange={(e) => updateSocialVerificationLink(platform, e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className={labelClass}>Follower counts <span className="font-normal text-billboard-inkSoft">(e.g. instagram:3400, facebook:1200)</span></label>
                <input placeholder="platform:count, platform:count" value={form.smFollowerCounts} onChange={(e) => update("smFollowerCounts", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Best-performing content format</label>
                <select value={form.smBestFormat} onChange={(e) => update("smBestFormat", e.target.value)} className={inputClass}>
                  <option value="">Select…</option>
                  <option value="static_post">Static post</option>
                  <option value="story">Story</option>
                  <option value="reel_or_short">Reel/Short</option>
                  <option value="carousel">Carousel</option>
                  <option value="live">Live</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Posts per week</label>
                <input type="number" min={0} value={form.smPostsPerWeek} onChange={(e) => update("smPostsPerWeek", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Where is most of your audience?</label>
                <input placeholder="e.g. South Africa" value={form.smAudienceCountry} onChange={(e) => update("smAudienceCountry", e.target.value)} className={inputClass} />
              </div>
            </div>
          )}

          {channelSlug === "website" && (
            <div className="border-t-2 border-billboard-paperDim pt-4 space-y-4">
              <p className="text-xs font-mono uppercase text-billboard-inkSoft">Website specifics</p>
              <div>
                <label className={labelClass}>Domain</label>
                <input placeholder="e.g. example.co.za" value={form.webDomain} onChange={(e) => update("webDomain", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Monthly unique visitors</label>
                <input type="number" min={0} value={form.webMonthlyVisitors} onChange={(e) => update("webMonthlyVisitors", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Niche</label>
                <input placeholder="e.g. parenting, personal finance" value={form.webNiche} onChange={(e) => update("webNiche", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>CMS</label>
                <input placeholder="e.g. WordPress, Ghost" value={form.webCms} onChange={(e) => update("webCms", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Placements you offer</label>
                <div className="flex flex-wrap gap-2">
                  {(["banner", "in_article", "sponsored_post", "newsletter_mention", "popup"] as const).map((p) => (
                    <button type="button" key={p} onClick={() => update("webPlacements", form.webPlacements.includes(p) ? form.webPlacements.filter((x) => x !== p) : [...form.webPlacements, p])}
                      className={`text-sm font-semibold px-3 py-1.5 rounded border-2 border-billboard-ink transition ${form.webPlacements.includes(p) ? "bg-billboard-green" : "bg-billboard-paper"}`}>
                      {p.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Average session duration (seconds) <span className="font-normal text-billboard-inkSoft">(optional)</span></label>
                <input type="number" min={0} value={form.webAvgSessionSeconds} onChange={(e) => update("webAvgSessionSeconds", e.target.value)} className={inputClass} />
              </div>
            </div>
          )}

          {channelSlug === "influencer" && (
            <div className="border-t-2 border-billboard-paperDim pt-4 space-y-4">
              <p className="text-xs font-mono uppercase text-billboard-inkSoft">Creator specifics</p>
              <div>
                <label className={labelClass}>Primary platform</label>
                <select value={form.infPrimaryPlatform} onChange={(e) => update("infPrimaryPlatform", e.target.value)} className={inputClass}>
                  <option value="">Select…</option>
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="whatsapp_channel">WhatsApp Channel</option>
                  <option value="youtube">YouTube</option>
                  <option value="x">X</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Niche</label>
                <select value={form.infNiche} onChange={(e) => update("infNiche", e.target.value)} className={inputClass}>
                  <option value="">Select…</option>
                  <option value="fashion_beauty">Fashion & Beauty</option>
                  <option value="food">Food</option>
                  <option value="fitness_health">Fitness & Health</option>
                  <option value="tech">Tech</option>
                  <option value="finance">Finance</option>
                  <option value="parenting">Parenting</option>
                  <option value="travel">Travel</option>
                  <option value="comedy_entertainment">Comedy & Entertainment</option>
                  <option value="gaming">Gaming</option>
                  <option value="general_lifestyle">General lifestyle</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Content formats you offer</label>
                <div className="flex flex-wrap gap-2">
                  {(["video", "reel", "post", "story_set", "livestream", "blog_post"] as const).map((f) => (
                    <button type="button" key={f} onClick={() => update("infContentFormats", form.infContentFormats.includes(f) ? form.infContentFormats.filter((x) => x !== f) : [...form.infContentFormats, f])}
                      className={`text-sm font-semibold px-3 py-1.5 rounded border-2 border-billboard-ink transition ${form.infContentFormats.includes(f) ? "bg-billboard-green" : "bg-billboard-paper"}`}>
                      {f.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Average engagement rate (%)</label>
                <input type="number" min={0} step="0.1" value={form.infEngagementRate} onChange={(e) => update("infEngagementRate", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Past brand collaborations <span className="font-normal text-billboard-inkSoft">(count)</span></label>
                <input type="number" min={0} value={form.infPastCollabs} onChange={(e) => update("infPastCollabs", e.target.value)} className={inputClass} />
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={form.infOffersUsageRights} onChange={(e) => update("infOffersUsageRights", e.target.checked)} />
                I can license my content for the brand's own use beyond the original post
              </label>
            </div>
          )}

          {channelSlug === "radio" && (
            <div className="border-t-2 border-billboard-paperDim pt-4 space-y-4">
              <p className="text-xs font-mono uppercase text-billboard-inkSoft">Station specifics</p>
              <div>
                <label className={labelClass}>Station name</label>
                <input value={form.radioStationName} onChange={(e) => update("radioStationName", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Frequency or stream</label>
                <input placeholder="e.g. 94.5 FM, or a stream URL" value={form.radioFrequency} onChange={(e) => update("radioFrequency", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Coverage area</label>
                <input placeholder="e.g. Cape Town metro" value={form.radioCoverageArea} onChange={(e) => update("radioCoverageArea", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Broadcast languages <span className="font-normal text-billboard-inkSoft">(comma-separated)</span></label>
                <input placeholder="e.g. isiXhosa, English" value={form.radioLanguages} onChange={(e) => update("radioLanguages", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Ad slot lengths you offer</label>
                <div className="flex flex-wrap gap-2">
                  {(["15", "30", "60"] as const).map((s) => (
                    <button type="button" key={s} onClick={() => update("radioSlotLengths", form.radioSlotLengths.includes(s) ? form.radioSlotLengths.filter((x) => x !== s) : [...form.radioSlotLengths, s])}
                      className={`text-sm font-semibold px-3 py-1.5 rounded border-2 border-billboard-ink transition ${form.radioSlotLengths.includes(s) ? "bg-billboard-green" : "bg-billboard-paper"}`}>
                      {s}s
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={form.radioShowSponsorship} onChange={(e) => update("radioShowSponsorship", e.target.checked)} />
                We offer named show/timeslot sponsorship, not just rotation spots
              </label>
              <div>
                <label className={labelClass}>ICASA licence number <span className="font-normal text-billboard-inkSoft">(optional — speeds up approval)</span></label>
                <input value={form.radioIcasaLicence} onChange={(e) => update("radioIcasaLicence", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Peak listening hours <span className="font-normal text-billboard-inkSoft">(optional)</span></label>
                <input placeholder="e.g. 06:00–09:00 drive time" value={form.radioPeakTimes} onChange={(e) => update("radioPeakTimes", e.target.value)} className={inputClass} />
              </div>
            </div>
          )}

          {channelSlug === "events" && (
            <div className="border-t-2 border-billboard-paperDim pt-4 space-y-4">
              <p className="text-xs font-mono uppercase text-billboard-inkSoft">Event specifics</p>
              <div>
                <label className={labelClass}>Event name</label>
                <input value={form.eventsName} onChange={(e) => update("eventsName", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Event type</label>
                <select value={form.eventsType} onChange={(e) => update("eventsType", e.target.value)} className={inputClass}>
                  <option value="">Select…</option>
                  <option value="conference">Conference</option>
                  <option value="tournament">Tournament</option>
                  <option value="festival">Festival</option>
                  <option value="concert">Concert</option>
                  <option value="trade_show">Trade show</option>
                  <option value="community_gathering">Community gathering</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Frequency</label>
                <select value={form.eventsFrequency} onChange={(e) => update("eventsFrequency", e.target.value)} className={inputClass}>
                  <option value="">Select…</option>
                  <option value="one_off">One-off</option>
                  <option value="annual">Annual</option>
                  <option value="recurring_other">Recurring (other)</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Typical attendance</label>
                <input type="number" min={0} value={form.eventsAttendance} onChange={(e) => update("eventsAttendance", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Next event date <span className="font-normal text-billboard-inkSoft">(optional)</span></label>
                <input type="date" value={form.eventsNextDate} onChange={(e) => update("eventsNextDate", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Sponsorship tiers you offer <span className="font-normal text-billboard-inkSoft">(comma-separated)</span></label>
                <input placeholder="e.g. Bronze, Silver, Gold, Headline" value={form.eventsTiers} onChange={(e) => update("eventsTiers", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Venue city</label>
                <input value={form.eventsVenueCity} onChange={(e) => update("eventsVenueCity", e.target.value)} className={inputClass} />
              </div>
            </div>
          )}

          {channelSlug === "community" && (
            <div className="border-t-2 border-billboard-paperDim pt-4 space-y-4">
              <p className="text-xs font-mono uppercase text-billboard-inkSoft">Group specifics</p>
              <div>
                <label className={labelClass}>Group type</label>
                <select value={form.commGroupType} onChange={(e) => update("commGroupType", e.target.value)} className={inputClass}>
                  <option value="">Select…</option>
                  <option value="neighbourhood_association">Neighbourhood association</option>
                  <option value="hobby_or_interest_group">Hobby/interest group</option>
                  <option value="professional_network">Professional network</option>
                  <option value="club">Club</option>
                  <option value="religious_or_faith_group">Religious/faith group</option>
                  <option value="school_or_alumni_group">School/alumni group</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Member count</label>
                <input type="number" min={0} value={form.commMemberCount} onChange={(e) => update("commMemberCount", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>How do you reach members?</label>
                <div className="flex flex-wrap gap-2">
                  {(["newsletter", "whatsapp_group", "facebook_group", "in_person_meetings", "sms_list"] as const).map((c) => (
                    <button type="button" key={c} onClick={() => update("commReachChannels", form.commReachChannels.includes(c) ? form.commReachChannels.filter((x) => x !== c) : [...form.commReachChannels, c])}
                      className={`text-sm font-semibold px-3 py-1.5 rounded border-2 border-billboard-ink transition ${form.commReachChannels.includes(c) ? "bg-billboard-green" : "bg-billboard-paper"}`}>
                      {c.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Newsletter/update frequency</label>
                <select value={form.commNewsletterFrequency} onChange={(e) => update("commNewsletterFrequency", e.target.value)} className={inputClass}>
                  <option value="">Select…</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every two weeks</option>
                  <option value="monthly">Monthly</option>
                  <option value="irregular">Irregular</option>
                  <option value="none">We don't send regular updates</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Geographic area</label>
                <input placeholder="e.g. Sandton, Stellenbosch" value={form.commGeographicArea} onChange={(e) => update("commGeographicArea", e.target.value)} className={inputClass} />
              </div>
            </div>
          )}

          {channelSlug === "transport" && (
            <div className="border-t-2 border-billboard-paperDim pt-4 space-y-4">
              <p className="text-xs font-mono uppercase text-billboard-inkSoft">Fleet specifics</p>
              <div>
                <label className={labelClass}>Operator type</label>
                <select value={form.transOperatorType} onChange={(e) => update("transOperatorType", e.target.value)} className={inputClass}>
                  <option value="">Select…</option>
                  <option value="individual_owner">Individual owner</option>
                  <option value="taxi_association">Taxi association</option>
                  <option value="fleet_operator">Fleet operator</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Number of vehicles</label>
                <input type="number" min={0} value={form.transVehicleCount} onChange={(e) => update("transVehicleCount", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Routes covered <span className="font-normal text-billboard-inkSoft">(comma-separated)</span></label>
                <input placeholder="e.g. Khayelitsha to Cape Town CBD" value={form.transRoutes} onChange={(e) => update("transRoutes", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Estimated daily passengers <span className="font-normal text-billboard-inkSoft">(optional)</span></label>
                <input type="number" min={0} value={form.transDailyPassengers} onChange={(e) => update("transDailyPassengers", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Placement types available</label>
                <div className="flex flex-wrap gap-2">
                  {(["interior_sticker", "exterior_branding", "rank_screen", "headrest_placement", "qr_code_deal"] as const).map((p) => (
                    <button type="button" key={p} onClick={() => update("transPlacements", form.transPlacements.includes(p) ? form.transPlacements.filter((x) => x !== p) : [...form.transPlacements, p])}
                      className={`text-sm font-semibold px-3 py-1.5 rounded border-2 border-billboard-ink transition ${form.transPlacements.includes(p) ? "bg-billboard-green" : "bg-billboard-paper"}`}>
                      {p.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Primary taxi rank <span className="font-normal text-billboard-inkSoft">(if any)</span></label>
                <input value={form.transPrimaryRank} onChange={(e) => update("transPrimaryRank", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Peak operating hours <span className="font-normal text-billboard-inkSoft">(optional)</span></label>
                <input placeholder="e.g. 05:30–08:00 and 16:00–19:00" value={form.transPeakHours} onChange={(e) => update("transPeakHours", e.target.value)} className={inputClass} />
              </div>
            </div>
          )}

          {channelSlug === "associations" && (
            <div className="border-t-2 border-billboard-paperDim pt-4 space-y-4">
              <p className="text-xs font-mono uppercase text-billboard-inkSoft">Association specifics</p>
              <div>
                <label className={labelClass}>Association type</label>
                <select value={form.assocType} onChange={(e) => update("assocType", e.target.value)} className={inputClass}>
                  <option value="">Select…</option>
                  <option value="chamber_of_commerce">Chamber of commerce</option>
                  <option value="industry_body">Industry body</option>
                  <option value="networking_group">Networking group</option>
                  <option value="trade_union">Trade union</option>
                  <option value="professional_body">Professional body</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Member count</label>
                <input type="number" min={0} value={form.assocMemberCount} onChange={(e) => update("assocMemberCount", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Sectors represented <span className="font-normal text-billboard-inkSoft">(comma-separated)</span></label>
                <input placeholder="e.g. construction, hospitality" value={form.assocSectors} onChange={(e) => update("assocSectors", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>How do you reach members?</label>
                <div className="flex flex-wrap gap-2">
                  {(["newsletter", "whatsapp_group", "facebook_group", "in_person_meetings", "sms_list"] as const).map((c) => (
                    <button type="button" key={c} onClick={() => update("assocReachChannels", form.assocReachChannels.includes(c) ? form.assocReachChannels.filter((x) => x !== c) : [...form.assocReachChannels, c])}
                      className={`text-sm font-semibold px-3 py-1.5 rounded border-2 border-billboard-ink transition ${form.assocReachChannels.includes(c) ? "bg-billboard-green" : "bg-billboard-paper"}`}>
                      {c.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={form.assocHasDirectory} onChange={(e) => update("assocHasDirectory", e.target.checked)} />
                We have a member directory (needed for directory-listing sponsorship)
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={form.assocHostsEvents} onChange={(e) => update("assocHostsEvents", e.target.checked)} />
                We host regular conferences/webinars
              </label>
            </div>
          )}

          {channelSlug === "restaurants" && (
            <div className="border-t-2 border-billboard-paperDim pt-4 space-y-4">
              <p className="text-xs font-mono uppercase text-billboard-inkSoft">Venue specifics</p>
              <div>
                <label className={labelClass}>Venue type</label>
                <select value={form.restVenueType} onChange={(e) => update("restVenueType", e.target.value)} className={inputClass}>
                  <option value="">Select…</option>
                  <option value="sit_down_restaurant">Sit-down restaurant</option>
                  <option value="cafe">Café</option>
                  <option value="quick_service">Quick service</option>
                  <option value="bar_or_pub">Bar/pub</option>
                  <option value="food_truck_or_stall">Food truck/stall</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Seating capacity <span className="font-normal text-billboard-inkSoft">(leave blank if no fixed seating)</span></label>
                <input type="number" min={0} value={form.restSeatingCapacity} onChange={(e) => update("restSeatingCapacity", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Estimated daily covers <span className="font-normal text-billboard-inkSoft">(customers served)</span></label>
                <input type="number" min={0} value={form.restDailyCovers} onChange={(e) => update("restDailyCovers", e.target.value)} className={inputClass} />
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={form.restHasDigitalMenu} onChange={(e) => update("restHasDigitalMenu", e.target.checked)} />
                We have a digital menu/screen (needed for digital-menu sponsorship)
              </label>
              <div>
                <label className={labelClass}>Placement types available</label>
                <div className="flex flex-wrap gap-2">
                  {(["menu_sponsorship", "table_card", "receipt_or_qr", "loyalty_card", "digital_menu_screen", "waiting_area_screen"] as const).map((p) => (
                    <button type="button" key={p} onClick={() => update("restPlacements", form.restPlacements.includes(p) ? form.restPlacements.filter((x) => x !== p) : [...form.restPlacements, p])}
                      className={`text-sm font-semibold px-3 py-1.5 rounded border-2 border-billboard-ink transition ${form.restPlacements.includes(p) ? "bg-billboard-green" : "bg-billboard-paper"}`}>
                      {p.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Cuisine type</label>
                <input placeholder="e.g. Italian, Traditional South African" value={form.restCuisineType} onChange={(e) => update("restCuisineType", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Peak service times <span className="font-normal text-billboard-inkSoft">(optional)</span></label>
                <input placeholder="e.g. lunch 12–14:00, weekend brunch" value={form.restPeakTimes} onChange={(e) => update("restPeakTimes", e.target.value)} className={inputClass} />
              </div>
            </div>
          )}
          {channelSlug === "in-venue-screens" && (
            <div className="border-t-2 border-billboard-paperDim pt-4 space-y-4">
              <p className="text-xs font-mono uppercase text-billboard-inkSoft">Venue &amp; screen specifics</p>
              <div>
                <label className={labelClass}>Venue type</label>
                <select value={form.venueScreensVenueType} onChange={(e) => update("venueScreensVenueType", e.target.value)} className={inputClass}>
                  <option value="">Select…</option>
                  <option value="nightclub">Nightclub</option>
                  <option value="bar_or_pub">Bar/pub</option>
                  <option value="restaurant_or_cafe">Restaurant/café</option>
                  <option value="gym_or_fitness">Gym/fitness centre</option>
                  <option value="laundromat">Laundromat</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Number of screens</label>
                <input type="number" min={1} value={form.venueScreensCount} onChange={(e) => update("venueScreensCount", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Screen type</label>
                <select value={form.venueScreensType} onChange={(e) => update("venueScreensType", e.target.value)} className={inputClass}>
                  <option value="">Select…</option>
                  <option value="tv">TV</option>
                  <option value="projector">Projector</option>
                  <option value="led_wall">LED wall</option>
                  <option value="digital_signage_display">Digital signage display</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Foot traffic tier</label>
                <select value={form.venueScreensFootTrafficTier} onChange={(e) => update("venueScreensFootTrafficTier", e.target.value)} className={inputClass}>
                  <option value="">Select…</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="peak_nights_only">Peak nights only</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Estimated footfall per night</label>
                <input type="number" min={0} value={form.venueScreensFootfallPerNight} onChange={(e) => update("venueScreensFootfallPerNight", e.target.value)} className={inputClass} />
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={form.venueScreensHasSound} onChange={(e) => update("venueScreensHasSound", e.target.checked)} />
                Our screen(s) can also play audio
              </label>
              <div>
                <label className={labelClass}>Peak times or days</label>
                <input placeholder="e.g. Friday & Saturday nights" value={form.venueScreensPeakTimes} onChange={(e) => update("venueScreensPeakTimes", e.target.value)} className={inputClass} />
              </div>
            </div>
          )}
    </>
  );
}
