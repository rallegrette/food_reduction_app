-- FlexBite MVP schema (Supabase/Postgres)

-- NOTE: This repo scaffolds schema + backend code for Supabase conventions.
-- You will need to apply these migrations to your Supabase project (SQL editor).

-- Extensions
create extension if not exists "pgcrypto";

-- Helper: enums (kept as text for MVP simplicity; see statuses table)

-- Restaurants
create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  name text not null,
  created_at timestamptz not null default now(),
  stripe_connected_account_id text,
  constraint restaurants_owner_user_id_fkey
    foreign key (owner_user_id) references auth.users (id) on delete cascade
);

create index if not exists restaurants_owner_user_id_idx on public.restaurants(owner_user_id);

-- Restaurant settings (toggles: regular/mystery/both)
create table if not exists public.restaurant_settings (
  restaurant_id uuid primary key,
  regular_enabled boolean not null default true,
  mystery_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint restaurant_settings_restaurant_id_fkey
    foreign key (restaurant_id) references public.restaurants (id) on delete cascade
);

-- Menu items
create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  name text not null,
  category text not null default 'other',
  base_price numeric(10,2) not null check (base_price >= 0),
  created_at timestamptz not null default now(),
  constraint menu_items_restaurant_id_fkey
    foreign key (restaurant_id) references public.restaurants (id) on delete cascade
);

create index if not exists menu_items_restaurant_id_idx on public.menu_items(restaurant_id);
create index if not exists menu_items_restaurant_category_idx on public.menu_items(restaurant_id, category);

-- Daily inventory per menu item
create table if not exists public.inventory_units (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  menu_item_id uuid not null,
  inventory_date date not null,
  quantity_total integer not null check (quantity_total >= 0),
  quantity_remaining integer not null check (quantity_remaining >= 0),
  created_at timestamptz not null default now(),
  constraint inventory_units_restaurant_id_fkey
    foreign key (restaurant_id) references public.restaurants (id) on delete cascade,
  constraint inventory_units_menu_item_id_fkey
    foreign key (menu_item_id) references public.menu_items (id) on delete cascade,
  constraint inventory_units_unique_day_item unique (restaurant_id, menu_item_id, inventory_date)
);

create index if not exists inventory_units_restaurant_date_idx on public.inventory_units(restaurant_id, inventory_date);
create index if not exists inventory_units_menu_item_idx on public.inventory_units(menu_item_id);

-- Time-based pricing rules for regular deals
create table if not exists public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  enabled boolean not null default true,
  -- Scope: apply to an individual menu item or a category or all
  target_scope text not null check (target_scope in ('item', 'category', 'all')),
  target_menu_item_id uuid,
  target_category text,
  applies_after_time time without time zone not null,
  discount_percent numeric(5,2) not null check (discount_percent >= 0 and discount_percent <= 100),
  -- Optional: stop applying discounts once sold-through is high enough
  stop_discount_if_sold_through_gte_percent numeric(5,2),
  created_at timestamptz not null default now(),
  constraint pricing_rules_restaurant_id_fkey
    foreign key (restaurant_id) references public.restaurants (id) on delete cascade,
  constraint pricing_rules_target_menu_item_id_fkey
    foreign key (target_menu_item_id) references public.menu_items (id) on delete cascade
);

create index if not exists pricing_rules_restaurant_enabled_idx on public.pricing_rules(restaurant_id, enabled);
create index if not exists pricing_rules_restaurant_target_idx on public.pricing_rules(restaurant_id, target_scope, applies_after_time);

-- Mystery baskets (bundle configuration)
create table if not exists public.mystery_baskets (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  name text,
  bundle_size integer not null check (bundle_size > 0),
  mystery_discount_percent numeric(5,2) not null check (mystery_discount_percent >= 0 and mystery_discount_percent <= 100),
  created_at timestamptz not null default now(),
  constraint mystery_baskets_restaurant_id_fkey
    foreign key (restaurant_id) references public.restaurants (id) on delete cascade
);

create index if not exists mystery_baskets_restaurant_idx on public.mystery_baskets(restaurant_id);

-- Allowed eligible items for a mystery basket (selection pool)
create table if not exists public.mystery_basket_items (
  id uuid primary key default gen_random_uuid(),
  mystery_basket_id uuid not null,
  menu_item_id uuid not null,
  created_at timestamptz not null default now(),
  constraint mystery_basket_items_mystery_basket_id_fkey
    foreign key (mystery_basket_id) references public.mystery_baskets (id) on delete cascade,
  constraint mystery_basket_items_menu_item_id_fkey
    foreign key (menu_item_id) references public.menu_items (id) on delete cascade,
  constraint mystery_basket_items_unique unique (mystery_basket_id, menu_item_id)
);

create index if not exists mystery_basket_items_basket_idx on public.mystery_basket_items(mystery_basket_id);

-- Orders (pickup-only)
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  status text not null check (status in ('pending_payment','paid','reserved','accepted','rejected','completed','cancelled')),
  payment_status text not null default 'pending' check (payment_status in ('pending','requires_payment_method','succeeded','failed','canceled')),
  deal_type text not null check (deal_type in ('regular','mystery')),
  pickup_window_start timestamptz,
  pickup_window_end timestamptz,
  -- Snapshot totals for reconciliation
  subtotal_amount numeric(10,2) not null default 0,
  discount_amount numeric(10,2) not null default 0,
  total_amount numeric(10,2) not null default 0,
  constraint orders_restaurant_id_fkey
    foreign key (restaurant_id) references public.restaurants (id) on delete cascade,
  constraint orders_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade
);

create index if not exists orders_restaurant_status_idx on public.orders(restaurant_id, status);
create index if not exists orders_user_created_idx on public.orders(user_id, created_at desc);

-- Order line items (item snapshot + effective pricing)
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  menu_item_id uuid not null,
  quantity integer not null check (quantity > 0),
  base_price numeric(10,2) not null check (base_price >= 0),
  effective_unit_price numeric(10,2) not null check (effective_unit_price >= 0),
  created_at timestamptz not null default now(),
  constraint order_items_order_id_fkey
    foreign key (order_id) references public.orders (id) on delete cascade,
  constraint order_items_menu_item_id_fkey
    foreign key (menu_item_id) references public.menu_items (id) on delete cascade
);

create index if not exists order_items_order_id_idx on public.order_items(order_id);

-- Stripe payment intent reconciliation
create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique,
  stripe_payment_intent_id text not null unique,
  amount numeric(10,2) not null,
  currency text not null default 'usd',
  status text not null default 'requires_payment_method',
  created_at timestamptz not null default now(),
  constraint payment_intents_order_id_fkey
    foreign key (order_id) references public.orders (id) on delete cascade
);

-- MVP analytics-friendly audit timestamps can be added later

