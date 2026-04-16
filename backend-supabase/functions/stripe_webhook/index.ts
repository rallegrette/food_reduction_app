import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getSupabaseAdminClient } from "../_shared/supabaseAdminClient.ts";
import { getStripeClient } from "../_shared/stripeClient.ts";

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST" }), { status: 405 });
    }

    const signature = req.headers.get("stripe-signature") ?? "";
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      return new Response(JSON.stringify({ error: "Missing STRIPE_WEBHOOK_SECRET" }), { status: 500 });
    }

    // Read raw body for signature verification.
    const rawBody = await req.text();

    const stripe = getStripeClient();
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    const supabase = getSupabaseAdminClient();

    const eventType = event.type;

    if (eventType === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as any;

      const stripePaymentIntentId = paymentIntent.id;
      // Find the order via our reconciliation table.
      const { data: piRow, error: piErr } = await supabase
        .from("payment_intents")
        .select("order_id")
        .eq("stripe_payment_intent_id", stripePaymentIntentId)
        .single();
      if (piErr) throw piErr;
      if (!piRow?.order_id) {
        return new Response(JSON.stringify({ error: "Payment intent not linked to order" }), { status: 400 });
      }

      const { error: piUpdateErr } = await supabase.from("payment_intents").update({ status: "succeeded" }).eq("stripe_payment_intent_id", stripePaymentIntentId);
      if (piUpdateErr) throw piUpdateErr;
      const { error: orderUpdateErr } = await supabase
        .from("orders")
        .update({ payment_status: "succeeded", status: "paid" })
        .eq("id", piRow.order_id);
      if (orderUpdateErr) throw orderUpdateErr;

      // After payment succeeds, reserve inventory for the order.
      const { error: reserveErr } = await supabase.rpc("reserve_inventory_for_order", { p_order_id: piRow.order_id });
      if (reserveErr) {
        // Payment succeeded but we could not reserve stock; reject pickup.
        await supabase.from("orders").update({ status: "rejected" }).eq("id", piRow.order_id);
        // Keep payment_status as succeeded (money is captured); order is rejected for fulfillment.
      }

      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    if (eventType === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as any;
      const stripePaymentIntentId = paymentIntent.id;

      const { data: piRow, error: piErr } = await supabase
        .from("payment_intents")
        .select("order_id")
        .eq("stripe_payment_intent_id", stripePaymentIntentId)
        .single();
      if (piErr) throw piErr;

      if (piRow?.order_id) {
        const { error: failOrderErr } = await supabase
          .from("orders")
          .update({ payment_status: "failed", status: "cancelled" })
          .eq("id", piRow.order_id);
        if (failOrderErr) throw failOrderErr;
      }
      const { error: failPiErr } = await supabase
        .from("payment_intents")
        .update({ status: "failed" })
        .eq("stripe_payment_intent_id", stripePaymentIntentId);
      if (failPiErr) throw failPiErr;

      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    // For other events, acknowledge.
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400 });
  }
});

