import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getSupabaseAdminClient } from "../_shared/supabaseAdminClient.ts";

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST" }), { status: 405 });
    }

    const body = await req.json();
    const supabase = getSupabaseAdminClient();

    const orderId = body?.order_id;
    const restaurantId = body?.restaurant_id;
    if (!orderId) return new Response(JSON.stringify({ error: "Missing order_id" }), { status: 400 });
    if (!restaurantId) return new Response(JSON.stringify({ error: "Missing restaurant_id" }), { status: 400 });

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id,restaurant_id,status")
      .eq("id", orderId)
      .single();
    if (orderErr) throw orderErr;
    if (!order) return new Response(JSON.stringify({ error: "Order not found" }), { status: 404 });
    if (String(order.restaurant_id) !== String(restaurantId)) {
      return new Response(JSON.stringify({ error: "Restaurant mismatch" }), { status: 403 });
    }
    if (order.status !== "reserved") {
      return new Response(JSON.stringify({ error: `Order must be reserved to accept (current: ${order.status})` }), { status: 409 });
    }

    const { error: updateErr } = await supabase
      .from("orders")
      .update({ status: "accepted" })
      .eq("id", orderId);
    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});

