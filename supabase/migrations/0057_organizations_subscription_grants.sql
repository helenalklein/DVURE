-- Same gap 0056 fixed for the Connect columns, now for subscriptions —
-- create-subscription writes these via the admin client after Stripe
-- confirms a real subscription was created, and service_role has never
-- had update on them (0041 only ever granted select).
grant update (subscription_status, stripe_subscription_id)
  on organizations to service_role;
