import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getSupabaseAdminClient } from "../_shared/supabaseAdminClient.ts";
import { getStripeClient } from "../_shared/stripeClient.ts";

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST" }), { status: 405 });
    }

    const body = await req.json();
    const orderId = body?.order_id;
    if (!orderId) {
      return new Response(JSON.stringify({ error: "Missing order_id" }), { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const stripe = getStripeClient();

    // Read order snapshot totals + restaurant info.
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, restaurant_id, total_amount, currency")
      .eq("id", orderId)
      .single();

    if (orderError) throw orderError;
    if (!order) {
      return new Response(JSON.stringify({ error: "Order not found" }), { status: 404 });
    }

    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id, stripe_connected_account_id")
      .eq("id", order.restaurant_id)
      .single();

    if (restaurantError) throw restaurantError;
    if (!restaurant?.stripe_connected_account_id) {
      return new Response(JSON.stringify({ error: "Restaurant not connected to Stripe" }), { status: 400 });
    }

    const feePercent = Number(Deno.env.get("FLEXBITE_FEE_PERCENT") ?? "10");

    const totalAmount = Number(order.total_amount);
    const currency = String(order.currency ?? "usd");

    // Stripe expects integer cents.
    const amountCents = Math.round(totalAmount * 100);
    const applicationFeeCents = Math.round((amountCents * feePercent) / 100);

    const idempotencyKey = `order:${orderId}:payment_intent`;

    // Create a PaymentIntent that sends the payout to the connected restaurant account.
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency,
        // Ensure immediate charge once client confirms.
        capture_method: "automatic",
        automatic_payment_methods: { enabled: true },
        application_fee_amount: applicationFeeCents,
        transfer_data: { destination: restaurant.stripe_connected_account_id },
        metadata: {
          order_id: String(orderId),
          restaurant_id: String(restaurant.id),
          fee_percent: String(feePercent),
        },
      },
      { idempotencyKey }
    );

    // Store reconciliation record if not already present.
    await supabase.from("payment_intents").upsert(
      {
        order_id: orderId,
        stripe_payment_intent_id: paymentIntent.id,
        amount: totalAmount,
        currency,
        status: paymentIntent.status,
      },
      { onConflict: "order_id" }
    );

    // Mark order as pending_payment. (The webhook will set paid/succeeded.)
    await supabase
      .from("orders")
      .update({ payment_status: "pending" })
      .eq("id", orderId);

    return new Response(JSON.stringify({ client_secret: paymentIntent.client_secret, payment_intent_id: paymentIntent.id }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});

