import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { computeMysteryBasket, computeRegularUnitOffer } from "../_shared/pricingEngine.js";

type PricingRule = {
  targetScope: "item" | "category" | "all";
  targetMenuItemId?: string | null;
  targetCategory?: string | null;
  appliesAfterTime: string; // "HH:MM"
  discountPercent: number;
  stopDiscountIfSoldThroughGtePercent?: number | null;
  enabled: boolean;
};

type InventorySnapshot = { quantityTotal: number; quantityRemaining: number };

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST" }), { status: 405 });
    }

    const body = await req.json();
    const now = body.now ? new Date(body.now) : new Date();
    const pricingRules = (body.pricingRules ?? []) as PricingRule[];

    const response: Record<string, unknown> = {};

    if (body.mode === "regular") {
      const offer = computeRegularUnitOffer({
        menuItemId: body.menuItemId,
        menuItemCategory: body.menuItemCategory,
        basePrice: body.basePrice,
        inventory: body.inventory as InventorySnapshot,
        pricingRules,
        now,
      });
      response.regularOffer = offer;
    }

    if (body.mode === "mystery") {
      const mystery = computeMysteryBasket({
        eligibleItems: body.eligibleItems,
        bundleSize: body.bundleSize,
        mysteryDiscountPercent: body.mysteryDiscountPercent,
      });
      response.mysteryBasket = mystery;
    }

    if (!response.regularOffer && !response.mysteryBasket) {
      return new Response(JSON.stringify({ error: "Invalid mode. Use 'regular' or 'mystery'." }), {
        status: 400,
      });
    }

    return new Response(JSON.stringify(response), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});

