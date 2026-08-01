import { loadStripe, type Stripe } from "@stripe/stripe-js";

// The publishable key is safe to ship to the browser by design (it can
// only ever create payment methods/confirm intents you've already
// server-side authorized — it can't move money or read account data on
// its own). Unlike the secret key, it belongs in VITE_ env vars.
const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!publishableKey) {
    console.error("Missing VITE_STRIPE_PUBLISHABLE_KEY — check .env.local (and Vercel's env vars in production).");
    return Promise.resolve(null);
  }
  if (!stripePromise) stripePromise = loadStripe(publishableKey);
  return stripePromise;
}
