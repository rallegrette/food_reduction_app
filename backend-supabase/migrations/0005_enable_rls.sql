-- Enable Row Level Security on all public tables.

alter table public.restaurants enable row level security;
alter table public.restaurant_settings enable row level security;
alter table public.menu_items enable row level security;
alter table public.inventory_units enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.mystery_baskets enable row level security;
alter table public.mystery_basket_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_intents enable row level security;

-- Restaurants: owners can manage their own; anyone authenticated can read (for browsing deals).
create policy "restaurants_select_authenticated"
  on public.restaurants for select
  to authenticated
  using (true);

create policy "restaurants_insert_owner"
  on public.restaurants for insert
  to authenticated
  with check (owner_user_id = auth.uid());

create policy "restaurants_update_owner"
  on public.restaurants for update
  to authenticated
  using (owner_user_id = auth.uid());

create policy "restaurants_delete_owner"
  on public.restaurants for delete
  to authenticated
  using (owner_user_id = auth.uid());

-- Restaurant settings: owner can manage; anyone authenticated can read.
create policy "restaurant_settings_select_authenticated"
  on public.restaurant_settings for select
  to authenticated
  using (true);

create policy "restaurant_settings_insert_owner"
  on public.restaurant_settings for insert
  to authenticated
  with check (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_user_id = auth.uid())
  );

create policy "restaurant_settings_update_owner"
  on public.restaurant_settings for update
  to authenticated
  using (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_user_id = auth.uid())
  );

-- Menu items: readable by all authenticated; writable by restaurant owner.
create policy "menu_items_select_authenticated"
  on public.menu_items for select
  to authenticated
  using (true);

create policy "menu_items_insert_owner"
  on public.menu_items for insert
  to authenticated
  with check (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_user_id = auth.uid())
  );

create policy "menu_items_update_owner"
  on public.menu_items for update
  to authenticated
  using (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_user_id = auth.uid())
  );

create policy "menu_items_delete_owner"
  on public.menu_items for delete
  to authenticated
  using (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_user_id = auth.uid())
  );

-- Inventory units: readable by all authenticated; writable by restaurant owner.
create policy "inventory_units_select_authenticated"
  on public.inventory_units for select
  to authenticated
  using (true);

create policy "inventory_units_insert_owner"
  on public.inventory_units for insert
  to authenticated
  with check (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_user_id = auth.uid())
  );

create policy "inventory_units_update_owner"
  on public.inventory_units for update
  to authenticated
  using (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_user_id = auth.uid())
  );

-- Pricing rules: readable by all authenticated; writable by restaurant owner.
create policy "pricing_rules_select_authenticated"
  on public.pricing_rules for select
  to authenticated
  using (true);

create policy "pricing_rules_insert_owner"
  on public.pricing_rules for insert
  to authenticated
  with check (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_user_id = auth.uid())
  );

create policy "pricing_rules_update_owner"
  on public.pricing_rules for update
  to authenticated
  using (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_user_id = auth.uid())
  );

create policy "pricing_rules_delete_owner"
  on public.pricing_rules for delete
  to authenticated
  using (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_user_id = auth.uid())
  );

-- Mystery baskets: readable by all authenticated; writable by restaurant owner.
create policy "mystery_baskets_select_authenticated"
  on public.mystery_baskets for select
  to authenticated
  using (true);

create policy "mystery_baskets_insert_owner"
  on public.mystery_baskets for insert
  to authenticated
  with check (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_user_id = auth.uid())
  );

create policy "mystery_baskets_update_owner"
  on public.mystery_baskets for update
  to authenticated
  using (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_user_id = auth.uid())
  );

create policy "mystery_baskets_delete_owner"
  on public.mystery_baskets for delete
  to authenticated
  using (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_user_id = auth.uid())
  );

-- Mystery basket items: readable by all authenticated; writable by basket's restaurant owner.
create policy "mystery_basket_items_select_authenticated"
  on public.mystery_basket_items for select
  to authenticated
  using (true);

create policy "mystery_basket_items_insert_owner"
  on public.mystery_basket_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.mystery_baskets mb
      join public.restaurants r on r.id = mb.restaurant_id
      where mb.id = mystery_basket_id and r.owner_user_id = auth.uid()
    )
  );

create policy "mystery_basket_items_delete_owner"
  on public.mystery_basket_items for delete
  to authenticated
  using (
    exists (
      select 1 from public.mystery_baskets mb
      join public.restaurants r on r.id = mb.restaurant_id
      where mb.id = mystery_basket_id and r.owner_user_id = auth.uid()
    )
  );

-- Orders: consumers see their own; restaurant owners see orders for their restaurant.
create policy "orders_select_consumer"
  on public.orders for select
  to authenticated
  using (user_id = auth.uid());

create policy "orders_select_restaurant_owner"
  on public.orders for select
  to authenticated
  using (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_user_id = auth.uid())
  );

-- Order items: visible if the parent order is visible.
create policy "order_items_select_consumer"
  on public.order_items for select
  to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

create policy "order_items_select_restaurant_owner"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      join public.restaurants r on r.id = o.restaurant_id
      where o.id = order_id and r.owner_user_id = auth.uid()
    )
  );

-- Payment intents: only visible to the order's consumer.
create policy "payment_intents_select_consumer"
  on public.payment_intents for select
  to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

-- Service role (used by Edge Functions) bypasses RLS by default, so no
-- explicit policies are needed for server-side writes.
