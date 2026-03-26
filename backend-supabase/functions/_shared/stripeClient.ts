import Stripe from "https://esm.sh/stripe";

export function getStripeClient() {
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secretKey) throw new Error("Missing STRIPE_SECRET_KEY");

  // MVP: rely on the SDK default API version for simplicity.
  return new Stripe(secretKey);
}

