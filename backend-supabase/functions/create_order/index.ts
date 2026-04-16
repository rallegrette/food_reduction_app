import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getSupabaseAdminClient } from "../_shared/supabaseAdminClient.ts";
import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { computeMysteryBasket, computeRegularUnitOffer } from "../_shared/pricingEngine.js";

type RegularOrderItemInput = { menu_item_id: string; quantity: number };

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST" }), { status: 405 });
    }

    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const body = await req.json();
    const supabase = getSupabaseAdminClient();

    const restaurantId = body?.restaurant_id;
    const mode = body?.mode; // "regular" | "mystery"

    if (!restaurantId) return new Response(JSON.stringify({ error: "Missing restaurant_id" }), { status: 400 });
    if (mode !== "regular" && mode !== "mystery") {
      return new Response(JSON.stringify({ error: "mode must be 'regular' or 'mystery'" }), { status: 400 });
    }

    const pickupWindowStart = body?.pickup_window_start ?? null;
    const pickupWindowEnd = body?.pickup_window_end ?? null;
    const currency = String(body?.currency ?? "usd");

    const now = new Date();

    let orderDealType: "regular" | "mystery" = mode;
    let subtotalAmount = 0;
    let discountAmount = 0;
    let totalAmount = 0;
    /** @type {Array<{menu_item_id:string, quantity:number, base_price:number, effective_unit_price:number}>} */
    let orderItems = [];

    // Load pricing rules once for regular offers
    const { data: pricingRulesRows } = await supabase
      .from("pricing_rules")
      .select("*")
      .eq("restaurant_id", restaurantId);

    const pricingRules = (pricingRulesRows ?? []).map((r: any) => ({
      targetScope: r.target_scope,
      targetMenuItemId: r.target_menu_item_id,
      targetCategory: r.target_category,
      appliesAfterTime: r.applies_after_time?.slice(0, 5) ?? r.applies_after_time,
      discountPercent: Number(r.discount_percent),
      stopDiscountIfSoldThroughGtePercent: r.stop_discount_if_sold_through_gte_percent == null ? null : Number(r.stop_discount_if_sold_through_gte_percent),
      enabled: r.enabled,
    }));

    if (mode === "regular") {
      const items = (body?.items ?? []) as RegularOrderItemInput[];
      if (!Array.isArray(items) || items.length === 0) {
        return new Response(JSON.stringify({ error: "Missing items for regular mode" }), { status: 400 });
      }

      const inventoryDate = now.toISOString().slice(0, 10); // YYYY-MM-DD

      const menuItemIds = items.map((i) => i.menu_item_id);

      const { data: menuItemsRows, error: menuItemsErr } = await supabase
        .from("menu_items")
        .select("id,name,category,base_price")
        .eq("restaurant_id", restaurantId)
        .in("id", menuItemIds);
      if (menuItemsErr) throw menuItemsErr;

      const { data: invRows, error: invErr } = await supabase
        .from("inventory_units")
        .select("menu_item_id,quantity_total,quantity_remaining")
        .eq("restaurant_id", restaurantId)
        .eq("inventory_date", inventoryDate)
        .in("menu_item_id", menuItemIds);
      if (invErr) throw invErr;

      const menuById: Record<string, any> = {};
      for (const mi of menuItemsRows ?? []) menuById[String(mi.id)] = mi;

      const invByItemId: Record<string, any> = {};
      for (const inv of invRows ?? []) invByItemId[String(inv.menu_item_id)] = inv;

      // Compute price for each requested item
      for (const it of items) {
        const quantity = Number(it.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) continue;

        const menu = menuById[it.menu_item_id];
        if (!menu) {
          return new Response(JSON.stringify({ error: `Invalid menu_item_id: ${it.menu_item_id}` }), { status: 400 });
        }

        const inv = invByItemId[it.menu_item_id];
        const inventorySnapshot = {
          quantityTotal: Number(inv?.quantity_total ?? 0),
          quantityRemaining: Number(inv?.quantity_remaining ?? 0),
        };

        if (inventorySnapshot.quantityRemaining < quantity) {
          return new Response(JSON.stringify({ error: `Insufficient inventory for ${it.menu_item_id}` }), { status: 409 });
        }

        const offer = computeRegularUnitOffer({
          menuItemId: it.menu_item_id,
          menuItemCategory: String(menu.category),
          basePrice: Number(menu.base_price),
          inventory: inventorySnapshot,
          pricingRules,
          now,
        });

        if (!offer.available) {
          return new Response(JSON.stringify({ error: `Item not available: ${it.menu_item_id}` }), { status: 409 });
        }

        const basePrice = Number(menu.base_price);
        const effectiveUnitPrice = offer.effectiveUnitPrice;

        subtotalAmount += basePrice * quantity;
        discountAmount += (basePrice - effectiveUnitPrice) * quantity;
        totalAmount += effectiveUnitPrice * quantity;

        orderItems.push({
          menu_item_id: it.menu_item_id,
          quantity,
          base_price: basePrice,
          effective_unit_price: effectiveUnitPrice,
        });
      }

      if (orderItems.length === 0) {
        return new Response(JSON.stringify({ error: "No valid items in order" }), { status: 400 });
      }
    }

    if (mode === "mystery") {
      const mysteryBasketId = body?.mystery_basket_id;
      if (!mysteryBasketId) {
        return new Response(JSON.stringify({ error: "Missing mystery_basket_id" }), { status: 400 });
      }

      const { data: basket, error: basketErr } = await supabase
        .from("mystery_baskets")
        .select("id,bundle_size,mystery_discount_percent")
        .eq("restaurant_id", restaurantId)
        .eq("id", mysteryBasketId)
        .single();
      if (basketErr) throw basketErr;
      if (!basket) return new Response(JSON.stringify({ error: "Mystery basket not found" }), { status: 404 });

      const { data: eligibleRows, error: eligibleErr } = await supabase
        .from("mystery_basket_items")
        .select("menu_item_id")
        .eq("mystery_basket_id", mysteryBasketId);
      if (eligibleErr) throw eligibleErr;

      const eligibleMenuItemIds = (eligibleRows ?? []).map((r: any) => String(r.menu_item_id));

      const today = now.toISOString().slice(0, 10);
      const { data: menuItemsRows, error: menuItemsErr } = await supabase
        .from("menu_items")
        .select("id,category,base_price")
        .eq("restaurant_id", restaurantId)
        .in("id", eligibleMenuItemIds);
      if (menuItemsErr) throw menuItemsErr;

      const { data: invRows, error: invErr } = await supabase
        .from("inventory_units")
        .select("menu_item_id,quantity_total,quantity_remaining")
        .eq("restaurant_id", restaurantId)
        .eq("inventory_date", today)
        .in("menu_item_id", eligibleMenuItemIds);
      if (invErr) throw invErr;

      const menuById: Record<string, any> = {};
      for (const mi of menuItemsRows ?? []) menuById[String(mi.id)] = mi;
      const invByItemId: Record<string, any> = {};
      for (const inv of invRows ?? []) invByItemId[String(inv.menu_item_id)] = inv;

      const eligibleItems = eligibleMenuItemIds
        .map((menuItemId) => {
          const menu = menuById[menuItemId];
          if (!menu) return null;
          const inv = invByItemId[menuItemId];
          return {
            menuItemId,
            menuItemCategory: String(menu.category),
            basePrice: Number(menu.base_price),
            inventory: {
              quantityTotal: Number(inv?.quantity_total ?? 0),
              quantityRemaining: Number(inv?.quantity_remaining ?? 0),
            },
          };
        })
        .filter(Boolean);

      const basketResult = computeMysteryBasket({
        eligibleItems,
        bundleSize: Number(basket.bundle_size),
        mysteryDiscountPercent: Number(basket.mystery_discount_percent),
      });

      // Ensure we got a full bundle
      const bundleQty = basketResult.lineItems.reduce((s, li) => s + li.quantity, 0);
      if (bundleQty < Number(basket.bundle_size)) {
        return new Response(JSON.stringify({ error: "Not enough inventory for mystery basket" }), { status: 409 });
      }

      subtotalAmount = basketResult.subtotalAmount;
      discountAmount = basketResult.discountAmount;
      totalAmount = basketResult.totalAmount;

      orderItems = basketResult.lineItems.map((li) => ({
        menu_item_id: li.menuItemId,
        quantity: li.quantity,
        base_price: li.basePrice,
        effective_unit_price: li.effectiveUnitPrice,
      }));
    }

    // Create order (reservation happens after payment succeeds)
    const { data: createdOrder, error: orderErr } = await supabase
      .from("orders")
      .insert({
        restaurant_id: restaurantId,
        user_id: userId,
        status: "pending_payment",
        payment_status: "pending",
        deal_type: orderDealType,
        pickup_window_start: pickupWindowStart,
        pickup_window_end: pickupWindowEnd,
        subtotal_amount: subtotalAmount,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        currency,
      })
      .select("*")
      .single();
    if (orderErr) throw orderErr;
    if (!createdOrder?.id) throw new Error("Failed to create order");

    for (const oi of orderItems) {
      const { error: lineErr } = await supabase.from("order_items").insert({
        order_id: createdOrder.id,
        menu_item_id: oi.menu_item_id,
        quantity: oi.quantity,
        base_price: oi.base_price,
        effective_unit_price: oi.effective_unit_price,
      });
      if (lineErr) throw lineErr;
    }

    return new Response(JSON.stringify({ order_id: createdOrder.id, total_amount: totalAmount, currency, status: createdOrder.status }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});

