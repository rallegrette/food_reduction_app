-- Add currency column to orders (used by Stripe PaymentIntent creation)

alter table public.orders
  add column if not exists currency text not null default 'usd';

