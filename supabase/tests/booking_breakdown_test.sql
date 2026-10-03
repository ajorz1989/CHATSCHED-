-- Pins public.booking_breakdown() to the same numbers as src/lib/fees.test.ts.
-- Run in the Supabase SQL editor after schema_phase113. Raises on mismatch.
do $$
declare b record;
begin
  select * into b from public.booking_breakdown(29900);
  assert b.total_due_cents = 32900, 'R299 total due';
  assert b.commission_cents = 3588, 'R299 commission';
  assert b.creator_payout_cents = 26312, 'R299 creator payout';
  assert b.booking_fee_cents = 3000, 'R299 fee is R30';

  select * into b from public.booking_breakdown(50000);
  assert b.booking_fee_cents = 5000, 'R500 fee is R50';
  assert b.total_due_cents = 55000, 'R500 total due';
  assert b.creator_payout_cents = 44000, 'R500 creator payout';

  select * into b from public.booking_breakdown(49999);
  assert b.booking_fee_cents = 3000, 'R499.99 fee is R30';
  raise notice 'booking_breakdown OK';
end $$;
