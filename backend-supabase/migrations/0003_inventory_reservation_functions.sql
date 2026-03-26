-- Inventory reservation/release functions for FlexBite MVP.
--
-- Reservation strategy:
-- - Reserve inventory only after Stripe payment succeeds (see stripe_webhook).
-- - Reservation decrements inventory_units.quantity_remaining for today's inventory_date.
-- - Releasing inventory adds it back when a restaurant rejects an order.

create or replace function public.reserve_inventory_for_order(p_order_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_restaurant_id uuid;
  v_today date := current_date;
  rec record;
  updated_count int;
begin
  select o.restaurant_id into v_restaurant_id from public.orders o where o.id = p_order_id;
  if v_restaurant_id is null then
    raise exception 'Order not found: %', p_order_id;
  end if;

  -- Lock inventory rows to prevent concurrent oversell.
  -- We lock per menu item in the order.
  for rec in
    select oi.menu_item_id, oi.quantity
    from public.order_items oi
    where oi.order_id = p_order_id
  loop
    -- Attempt reservation only if enough stock is available.
    update public.inventory_units iu
      set quantity_remaining = iu.quantity_remaining - rec.quantity
    where iu.restaurant_id = v_restaurant_id
      and iu.menu_item_id = rec.menu_item_id
      and iu.inventory_date = v_today
      and iu.quantity_remaining >= rec.quantity;

    get diagnostics updated_count = row_count;
    if updated_count = 0 then
      -- No inventory row matched (or not enough quantity).
      -- Raise to let caller mark order as rejected.
      raise exception 'Insufficient inventory for item % (need % units)', rec.menu_item_id, rec.quantity;
    end if;
  end loop;

  update public.orders
    set status = 'reserved'
  where id = p_order_id
    and status in ('paid','pending_payment');
end;
$$;

create or replace function public.release_inventory_for_order(p_order_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_restaurant_id uuid;
  v_today date := current_date;
  rec record;
begin
  select o.restaurant_id into v_restaurant_id from public.orders o where o.id = p_order_id;
  if v_restaurant_id is null then
    raise exception 'Order not found: %', p_order_id;
  end if;

  for rec in
    select oi.menu_item_id, oi.quantity
    from public.order_items oi
    where oi.order_id = p_order_id
  loop
    update public.inventory_units iu
      set quantity_remaining = iu.quantity_remaining + rec.quantity
    where iu.restaurant_id = v_restaurant_id
      and iu.menu_item_id = rec.menu_item_id
      and iu.inventory_date = v_today;

    -- If inventory row doesn't exist for today, do nothing (inventory can be created later).
  end loop;

  update public.orders
    set status = 'rejected'
  where id = p_order_id;
end;
$$;

