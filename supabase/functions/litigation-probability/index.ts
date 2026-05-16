import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { assessLegalRisk } from "./risk-engine.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { case_facts, case_type, jurisdiction, relief_sought } = await req.json();

    if (!case_facts || typeof case_facts !== "string") {
      return new Response(JSON.stringify({ error: "case_facts is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = assessLegalRisk({
      caseFacts: case_facts.trim(),
      caseType: case_type || "",
      jurisdiction: jurisdiction || "",
      reliefSought: relief_sought || "",
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
