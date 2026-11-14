-- How the four reported received figures are computed from public.orders.
-- The Family Accounts screen does not use these fixed slices. It sums
-- public.orders.amount for whatever month range the header period selects.
-- Re-run this against the live database to confirm the slices with Shadrick.
-- Measured 2026-11-14: march_2026 = 7160.00, october_2026 = 500.00,
-- all_time = 76425.00, family_seated_orders = 11739.00.

with seated as (
  select distinct cid
  from public.family_accounts
  cross join lateral (values (slot_1), (slot_2), (slot_3), (slot_4), (slot_5)) as slot(cid)
  where coalesce(cid, '') <> ''
)
select
  round(sum(amount) filter (where date >= date '2026-03-01' and date < date '2026-04-01'), 2) as march_2026,
  round(sum(amount) filter (where date >= date '2026-10-01' and date < date '2026-11-01'), 2) as october_2026,
  round(sum(amount), 2) as all_time,
  round(sum(amount) filter (where cid in (select cid from seated)), 2) as family_seated_orders
from public.orders;
