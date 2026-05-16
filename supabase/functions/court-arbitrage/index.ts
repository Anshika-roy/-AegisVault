import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { analyzeJurisdiction, DEFAULT_COURTS } from "./jurisdiction-engine.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { case_summary, client_state } = await req.json();

    if (!case_summary || typeof case_summary !== "string") {
      return new Response(JSON.stringify({ error: "case_summary is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseOptions = authHeader ? { global: { headers: { Authorization: authHeader } } } : {};
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      supabaseOptions,
    );

    const { data, error } = await supabase
      .from("court_scores")
      .select("court_name,state,velocity_score,injunction_rate,pendency_days,domain");

    if (error) {
      console.error("Court score query failed, using deterministic fallback:", error);
    }

    const result = analyzeJurisdiction({
      caseSummary: case_summary.trim(),
      clientState: client_state || null,
      courts: data && data.length > 0 ? data : DEFAULT_COURTS,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: "An internal server error occurred." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
