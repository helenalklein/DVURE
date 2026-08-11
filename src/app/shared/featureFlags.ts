// Independent (unrepped) model signup and casting is real, working
// architecture (model_profiles with no agency, the independent-model
// branch of invoice_line_items/payments) — deliberately held back from
// the MVP pilot rather than removed. No vetting/curation pipeline
// exists yet for someone signing up with no agency behind them, which
// is a real quality-control risk for a brand's first impression of the
// platform. Revisit in Phase 2, after the pilot, once there's a real
// vetting flow to gate it with. Flip this back to true to re-enable
// every existing entry point (login screen self-signup, "Add
// Independent Model" in Model Board) without rebuilding anything.
export const INDEPENDENT_MODELS_ENABLED = false;
