-- ChatSched — Phase 43 schema additions
-- Run once in the Supabase SQL editor, AFTER every prior schema_phase*.sql.
--
-- "Recently viewed" for businesses (and creators, who can browse too),
-- reusing publisher_profile_views (Phase 37) rather than building a
-- second tracking table — that table already logs exactly this event
-- (a registered, non-owner, non-admin view of a full profile), it just
-- couldn't be read back by the viewer themselves yet. Phase 37's existing
-- SELECT policy only let the publisher who OWNS a listing see who viewed
-- it (in aggregate); this adds the complementary direction — a viewer
-- reading their own browsing history, same as browser history, not a new
-- privacy surface. The "no business can see another business's views of
-- the same listing" guarantee from Phase 37 is untouched: this policy
-- only ever exposes rows where viewer_id = auth.uid().

create policy "publisher_profile_views_select_own_viewed"
  on public.publisher_profile_views for select
  using (auth.uid() = viewer_id);
