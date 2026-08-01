// Shared CORS headers — every function in this project is called from
// the DVURE web app only, but the browser still needs an explicit
// preflight response before it'll send the real request.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
