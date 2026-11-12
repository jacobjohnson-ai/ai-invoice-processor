-- AI Invoice Processor: invoices table
-- Run once in the Supabase SQL Editor.

create table public.invoices (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  file_name      text,
  vendor         text,
  invoice_number text,
  invoice_date   date,
  due_date       date,
  currency       text not null default 'USD',
  subtotal       numeric(12,2),
  tax            numeric(12,2) not null default 0,
  total          numeric(12,2),
  line_items     jsonb not null default '[]',
  flags          jsonb not null default '[]',
  status         text not null default 'ready'
                 check (status in ('ready','needs_review','needs_approval','duplicate','approved','rejected','paid')),
  is_sample      boolean not null default false,
  is_public      boolean not null default false,   -- demo history rows anyone can see
  decided_at     timestamptz
);
create index invoices_vendor_idx on public.invoices (lower(vendor));

-- Row-level security: the public demo can read; only the Worker (service key) can add or change rows
alter table public.invoices enable row level security;
-- Visitors only see the demo history. Uploads are returned to the person who uploaded them, never listed publicly.
create policy "public can read demo history" on public.invoices for select to anon, authenticated using (is_public);
grant select on public.invoices to anon, authenticated;
grant select, insert, update on public.invoices to service_role;

-- Invoice history for the demo (a fictional company's past bills).
-- Sample 3 on the site is a re-sent copy of BOS-19977, so it gets flagged as a duplicate.
insert into public.invoices (created_at, file_name, vendor, invoice_number, invoice_date, due_date, subtotal, tax, total, line_items, status, decided_at, is_public) values
 (now() - interval '36 days', 'brightline-bos-19977.pdf', 'Brightline Office Supply', 'BOS-19977', '2026-10-06', '2026-11-05', 364.50, 19.32, 383.82,
  '[{"description":"Copy paper, 10-ream case","quantity":5,"unit_price":42.5,"amount":212.5},{"description":"Shipping boxes, pack of 25","quantity":4,"unit_price":38,"amount":152}]', 'paid', now() - interval '20 days', true),
 (now() - interval '30 days', 'cloudvault-oct.pdf', 'CloudVault Backup', 'CV-88213', '2026-10-01', '2026-10-31', 240.00, 0, 240.00,
  '[{"description":"Business backup plan, 2 TB, monthly","quantity":1,"unit_price":240,"amount":240}]', 'paid', now() - interval '18 days', true),
 (now() - interval '24 days', 'ridgeway-rit-7688.pdf', 'Ridgeway IT Services', 'RIT-7688', '2026-10-15', '2026-11-14', 1140.00, 68.40, 1208.40,
  '[{"description":"On-site support, hourly","quantity":12,"unit_price":95,"amount":1140}]', 'paid', now() - interval '10 days', true),
 (now() - interval '15 days', 'metro-power-oct.pdf', 'Metro Power & Light', '4410-2299-10', '2026-10-25', '2026-11-20', 612.37, 0, 612.37,
  '[{"description":"Electric service, Oct 2026","quantity":1,"unit_price":612.37,"amount":612.37}]', 'approved', now() - interval '6 days', true),
 (now() - interval '9 days', 'swiftship-nov.pdf', 'SwiftShip Logistics', 'SS-55102', '2026-11-02', '2026-11-16', 1875.60, 0, 1875.60,
  '[{"description":"Ground shipping, October volume","quantity":1,"unit_price":1875.6,"amount":1875.6}]', 'ready', null, true);
