-- Phase 100: ChatSched Tools catalogue
--
-- Renumbered from schema_phase98_chatsched_tools.sql (built against the
-- Layer 1 zip) after this Layer 2 zip turned up schema_phase98_cross_party_
-- contact_completeness.sql and schema_phase99_fix_stale_commission_rate.sql
-- already occupying those numbers — exactly the concurrent-session
-- collision PHASE9_CAMPAIGN_PACKAGES_DELIVERY.md already described
-- happening once before in this same thread. No content from the original
-- phase98 draft changed, only the number and this note — re-checked that
-- phase98/99 don't touch anything this migration also touches (they're
-- about channel_requests contact fields and a commission-rate function;
-- this migration adds three new tables and touches nothing existing).
--
-- Everything below is otherwise unchanged from the Layer 1 delivery.
-- See PHASE100_CHATSCHED_TOOLS_DELIVERY.md for the full reasoning.
--
-- Implements the database layer of the "ChatSched Tools" master
-- implementation prompt (uploaded as ChatSched_Layer1_Updated_Product.zip's
-- companion brief) — an admin-managed catalogue of practical business
-- tools, positioned as a fourth pillar alongside Marketplace / Agency /
-- Network. Per that brief's own Sections 3, 7 and 31: the database is the
-- source of truth for which tools exist, their status, category, pricing
-- and ordering — the frontend must not carry a second, conflicting
-- catalogue (the exact channels.active vs feature-flag drift already
-- flagged as finding C-01 in CHATSCHED_LAYER1_UPDATED_AUDIT.md). `tools`
-- therefore follows the same small-reference-table shape as
-- `public.channels` (schema_phase74): a slug primary key, public read of
-- publishable rows, admin-only write — not the heavier
-- inventory_owners/entitlements model the brief sketches in Section 7,
-- most of which doesn't apply yet (see the entitlements note below).
--
-- Checked against the existing codebase before writing anything, per the
-- brief's own Section 30/33 instruction to inspect existing architecture
-- first:
--   - A real "Marketing Suite" already exists (7 modules under
--     src/components/marketingSuite/: Match, Reach Planner, Content
--     Studio, Caption Writer, Campaign Builder, Campaign Tracker, ROI
--     Calculator — rendered inside the logged-in Dashboard), plus four
--     public standalone entry points (AudienceFinder, ReachChecker,
--     BudgetCalculator, MediaKit pages). These are real, shipped features
--     with working backends, not concepts — the Layer 1 audit's own
--     finding H-06 explicitly recommends "package as ChatSched Tools /
--     Marketing Suite".
--   - "WhatsApp AI Receptionist", "Quote Engine", "Booking Engine",
--     "Review Recovery" and "Smart Offers" — all suggested as example
--     catalogue entries in the brief's own Section 14 — have **no**
--     backend/entitlement/billing code anywhere in this repository. The
--     audit's discrepancy matrix (Section 5) and finding H-06 mark them
--     ROADMAP, not live, and say explicitly not to market them as live
--     tools until real service code exists. The brief's own Section 14
--     instruction — "Only mark tools as active if the backend
--     implementation actually exists... If they don't exist yet, create
--     them as coming_soon" — is followed literally below: those five ship
--     as coming_soon with no price, so the public /tools page can offer a
--     waitlist per the brief's Section 24, not a purchase button for
--     something that doesn't exist. This also necessarily excludes
--     "ChatSched WhatsApp Growth" from Section 14's example list — see
--     this project's recorded strategic pivot away from WhatsApp entirely.
--   - "ChatSched Lead Capture" (also suggested in Section 14) is excluded
--     rather than seeded coming_soon: the audit explicitly positions the
--     real public-form-submit/agency-leads pipeline as ChatSched's own
--     acquisition workflow, not a product to sell back to businesses as a
--     tool. Nothing here prevents adding it later as its own tool row if
--     that framing changes.
--   - EarningsEstimator.tsx (a real, shipped page) is deliberately left
--     unseeded: it's a publisher-facing earnings estimate, not a
--     business-facing growth tool, and the brief's whole positioning
--     ("Tools to help your business get more customers") is business-side.
--     A future Publisher Tools catalogue is a reasonable place for it, not
--     this table.
--
-- Deliberately not created (Section 7's own "only if actually needed"):
--   - tool_entitlements — every seeded active tool below is either a free
--     public page (no login) or bundled into the existing Business
--     activation/subscription already enforced elsewhere in this schema
--     (schema_phase55/71/73/86). Nothing here is separately sold per-tool
--     yet, so there is no entitlement state to store. Add this table when
--     the first standalone-paid tool ships, not before.
--   - tool_usage — no analytics pipeline currently reads/writes anything
--     resembling per-tool usage events; adding the table now would be an
--     unused stub.
--
-- No updated_at trigger, matching content_studio_subscriptions and
-- similar small admin-managed tables elsewhere in this schema — admin
-- UI is expected to set updated_at explicitly on write.

-- ---------------------------------------------------------------------
-- tools
-- ---------------------------------------------------------------------

create table public.tools (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  short_description text not null,
  description text not null default '',
  category text not null check (category in ('get_customers', 'convert', 'keep_customers', 'advertise', 'measure')),
  tool_type text not null default 'native' check (tool_type in ('native', 'integrated', 'white_label', 'service')),
  icon text,
  image_url text,
  badge text,
  status text not null default 'draft' check (status in ('draft', 'coming_soon', 'active', 'paused', 'archived')),
  featured boolean not null default false,
  sort_order integer not null default 0,
  cta_label text not null default 'View Tool',
  cta_url text,
  -- requires_auth drives whether a tool's CTA can send someone straight to
  -- the tool (public standalone pages) or must route through /login first
  -- (the Marketing Suite modules, which only render inside the logged-in
  -- Dashboard today — see the module-level comment in MarketingSuite.tsx).
  requires_auth boolean not null default false,
  pricing_model text not null default 'tbd' check (pricing_model in ('free', 'included', 'paid_once', 'paid_monthly', 'paid_annual', 'custom', 'tbd')),
  setup_price numeric(10, 2),
  monthly_price numeric(10, 2),
  annual_price numeric(10, 2),
  target_customer text,
  provider_name text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tools is
  'Admin-managed catalogue for "ChatSched Tools" (practical business-growth
   tools, distinct from advertising inventory in public.channels). Only
   status=active tools belong in the main public catalogue; coming_soon
   may appear in a separate "on the way" section; draft/archived are never
   public. Backend reality (does a working service exist?) must be verified
   before a row is set to active — see CHATSCHED_LAYER1_UPDATED_AUDIT.md
   Section 5 for the audit this table''s seed data is based on. requires_auth
   distinguishes free public pages from tools that only exist inside the
   logged-in Dashboard (Marketing Suite) — the public /tools page uses it
   to decide whether a CTA can go straight to cta_url or should route
   through /login first.';

create index tools_status_idx on public.tools(status);
create index tools_category_idx on public.tools(category);
create index tools_featured_idx on public.tools(featured) where featured = true;

alter table public.tools enable row level security;

-- Same visibility shape as public.channels (schema_phase74): the catalogue
-- itself isn't sensitive. Unlike channels, tools has draft/archived states
-- that must never be publicly queryable, so this is a status filter rather
-- than channels' unconditional `using (true)`.
create policy "tools_select_public" on public.tools for select
  using (status in ('active', 'coming_soon'));

create policy "tools_admin_all" on public.tools for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- tool_features / tool_benefits / tool_faqs
-- ---------------------------------------------------------------------
-- Same three-table shape for all: admin-authored supporting content for a
-- tool's detail page, one row per bullet, ordered by sort_order.

create table public.tool_features (
  id uuid primary key default gen_random_uuid(),
  tool_slug text not null references public.tools(slug) on delete cascade,
  title text not null,
  description text not null default '',
  sort_order integer not null default 0
);

create table public.tool_benefits (
  id uuid primary key default gen_random_uuid(),
  tool_slug text not null references public.tools(slug) on delete cascade,
  title text not null,
  description text not null default '',
  sort_order integer not null default 0
);

create table public.tool_faqs (
  id uuid primary key default gen_random_uuid(),
  tool_slug text not null references public.tools(slug) on delete cascade,
  question text not null,
  answer text not null,
  sort_order integer not null default 0
);

create index tool_features_tool_slug_idx on public.tool_features(tool_slug);
create index tool_benefits_tool_slug_idx on public.tool_benefits(tool_slug);
create index tool_faqs_tool_slug_idx on public.tool_faqs(tool_slug);

alter table public.tool_features enable row level security;
alter table public.tool_benefits enable row level security;
alter table public.tool_faqs enable row level security;

-- Public may read a child row only if its parent tool is itself publicly
-- visible; admin can read/write everything regardless of parent status
-- (so a draft tool's content can be authored before it's ever public).
create policy "tool_features_select_public" on public.tool_features for select
  using (exists (select 1 from public.tools t where t.slug = tool_slug and t.status in ('active', 'coming_soon')));
create policy "tool_features_admin_all" on public.tool_features for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "tool_benefits_select_public" on public.tool_benefits for select
  using (exists (select 1 from public.tools t where t.slug = tool_slug and t.status in ('active', 'coming_soon')));
create policy "tool_benefits_admin_all" on public.tool_benefits for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "tool_faqs_select_public" on public.tool_faqs for select
  using (exists (select 1 from public.tools t where t.slug = tool_slug and t.status in ('active', 'coming_soon')));
create policy "tool_faqs_admin_all" on public.tool_faqs for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Seed: real tools only, status set from the Layer 1 audit's ground truth
-- ---------------------------------------------------------------------

insert into public.tools (slug, name, short_description, description, category, tool_type, status, featured, sort_order, cta_label, cta_url, requires_auth, pricing_model, target_customer, provider_name, published_at) values
  ('audience-finder', 'Audience Finder', 'Describe your business — get ranked publishers to reach your customers.',
   'Type a plain-language description of your business and get a ranked shortlist of ChatSched publishers whose audience actually fits, instead of browsing the full directory blind.',
   'get_customers', 'native', 'active', true, 0, 'Use Tool', '/audience-finder', false, 'free', 'Any business planning its first (or next) campaign', 'ChatSched', now()),

  ('reach-planner', 'Reach Planner', 'A guided wizard to plan and schedule advertising across ChatSched channels.',
   'Walks a business through picking channels, timing and budget for a campaign, and hands the plan straight into Build My Campaign. The deeper guided version lives in your Dashboard; try the quick public estimate first.',
   'advertise', 'native', 'active', true, 1, 'Use Tool', '/reach-checker', false, 'included', 'Businesses planning a multi-channel campaign', 'ChatSched', now()),

  ('content-studio', 'Content Studio', 'Turn a photo or a brief into 9 ready-to-post formats.',
   'Upload a product photo or describe your promotion and get back a set of ready-to-use creative formats sized for the channels you advertise on.',
   'advertise', 'native', 'active', false, 2, 'Use Tool', '/dashboard?tool=content', true, 'included', 'Businesses without an in-house designer', 'ChatSched', now()),

  ('caption-writer', 'Caption Writer', 'Turn a promotion brief into ready-to-use captions.',
   'Describe an offer or promotion once and get channel-appropriate copy back, instead of writing a new caption by hand for every placement.',
   'advertise', 'native', 'active', false, 3, 'Use Tool', '/dashboard?tool=captions', true, 'included', 'Businesses running frequent promotions', 'ChatSched', now()),

  ('campaign-builder', 'Campaign Builder', 'Turn a plain-language brief into a scored, ready-to-submit campaign.',
   'Describe what you want to advertise and to whom, and get a structured campaign brief back with a completeness/quality score before it goes to a publisher or the ChatSched team.',
   'advertise', 'native', 'active', true, 4, 'Use Tool', '/dashboard?tool=builder', true, 'included', 'Businesses building their first self-serve campaign', 'ChatSched', now()),

  ('media-kit', 'Media Kit', 'Create a professional media/advertising kit for your business.',
   'Puts together the assets a publisher or partner needs to say yes quickly — business summary, offer details and creative in one place.',
   'advertise', 'native', 'active', false, 5, 'Use Tool', '/media-kit', false, 'free', 'Businesses applying to publishers or partners', 'ChatSched', now()),

  ('roi-calculator', 'ROI Calculator', 'Budget in, estimated reach and return out.',
   'A quick estimate of what a given advertising budget is likely to return, so you can size a campaign before you commit spend. Try the public estimate, or the full calculator in your Dashboard once you have real campaign data to plug in.',
   'measure', 'native', 'active', true, 6, 'Use Tool', '/budget-calculator', false, 'free', 'Businesses sizing a campaign budget', 'ChatSched', now()),

  ('campaign-tracker', 'Campaign Tracker', 'Real tracking links for clicks, visits, leads and conversions.',
   'Every campaign gets its own tracking link, so you can see clicks, visits, leads and conversions per placement instead of guessing which channel actually worked.',
   'measure', 'native', 'active', false, 7, 'Use Tool', '/dashboard?tool=tracking', true, 'included', 'Businesses running more than one active placement', 'ChatSched', now())
on conflict (slug) do nothing;

-- Seed: roadmap tools — explicitly coming_soon, no pricing, no cta_url.
-- These map to Section 14 examples with no backend anywhere in this
-- repository (audit finding H-06). Do not flip any of these to active
-- without first shipping real entitlement/billing/service code and
-- updating this comment to say what changed and where.

insert into public.tools (slug, name, short_description, category, tool_type, status, sort_order, cta_label, pricing_model, target_customer) values
  ('ai-receptionist', 'ChatSched AI Receptionist', 'Answer common customer questions and help customers take the next step.', 'convert', 'native', 'coming_soon', 10, 'Join Waitlist', 'tbd', 'Businesses fielding repetitive customer questions'),
  ('quote-engine', 'ChatSched Quote Engine', 'Create and send professional quotes faster.', 'convert', 'native', 'coming_soon', 11, 'Join Waitlist', 'tbd', 'Service businesses that quote before every job'),
  ('booking-engine', 'ChatSched Booking Engine', 'Turn enquiries into bookings.', 'convert', 'native', 'coming_soon', 12, 'Join Waitlist', 'tbd', 'Appointment- and reservation-based businesses'),
  ('review-recovery', 'ChatSched Review Recovery', 'Request reviews and identify unhappy customers early.', 'keep_customers', 'native', 'coming_soon', 13, 'Join Waitlist', 'tbd', 'Businesses that depend on repeat custom and reviews'),
  ('smart-offers', 'ChatSched Smart Offers', 'Create targeted offers for existing customers.', 'keep_customers', 'native', 'coming_soon', 14, 'Join Waitlist', 'tbd', 'Businesses with an existing customer list')
on conflict (slug) do nothing;
