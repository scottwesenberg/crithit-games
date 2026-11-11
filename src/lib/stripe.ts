import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  console.warn(
    "[stripe] STRIPE_SECRET_KEY is not set. Checkout and webhook routes will fail until it's configured in .env."
  );
}

/** True only when STRIPE_SECRET_KEY looks like a real Stripe key (not unset or an example placeholder). */
export function isStripeConfigured() {
  return /^sk_(test|live)_[A-Za-z0-9]{10,}$/.test(process.env.STRIPE_SECRET_KEY ?? "");
}

export const stripe = new Stripe(secretKey ?? "sk_test_placeholder", {
  apiVersion: "2024-06-20",
});
