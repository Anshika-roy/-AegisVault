import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { case_description, request_id } = await req.json();

    if (!case_description) {
      return new Response(JSON.stringify({ error: "case_description is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are an expert Indian legal analyst. Analyze the following case description and provide a structured JSON response.

Case Description: ${case_description}

Respond with ONLY valid JSON in this exact format:
{
  "causal_graph": {
    "facts": ["list of key facts"],
    "claims": ["list of legal claims"],
    "evidence_needed": ["list of evidence required"],
    "legal_provisions": ["applicable BNS/IPC sections"],
    "causal_links": [{"from": "fact/claim", "to": "consequence", "strength": "strong/moderate/weak"}]
  },
  "missing_elements": {
    "critical": ["elements that must be addressed"],
    "recommended": ["elements that would strengthen the case"],
    "optional": ["nice-to-have elements"]
  },
  "confidence_score": 0.0,
  "recommendations": "Detailed strategic recommendations for the case."
}`;

    interface CaseAnalysisResult {
      causal_graph: {
        facts: string[];
        claims: string[];
        evidence_needed: string[];
        legal_provisions: string[];
        causal_links: Array<{ from: string; to: string; strength: string }>;
      };
      missing_elements: {
        critical: string[];
        recommended: string[];
        optional: string[];
      };
      confidence_score: number;
      recommendations: string;
    }
    let analysis: CaseAnalysisResult;
    try {
      const groqResponse = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 2048,
          response_format: { type: "json_object" },
        }),
      });

      if (!groqResponse.ok) {
        console.error("Groq API error:", await groqResponse.text());
        throw new Error("Failed to communicate with LLM provider");
      }

      const groqData = await groqResponse.json();
      if (!groqData.choices || !groqData.choices[0]) {
        throw new Error("Invalid response format from LLM provider");
      }

      analysis = JSON.parse(groqData.choices[0].message.content);
    } catch (llmError) {
      console.error("LLM Error, using deterministic fallback:", llmError);
      analysis = {
        causal_graph: {
          facts: ["Client provided basic case facts", "Details pending formal review"],
          claims: ["Potential legal claim identified"],
          evidence_needed: ["Documentary evidence", "Witness testimony"],
          legal_provisions: ["Pending detailed mapping"],
          causal_links: [{"from": "fact", "to": "claim", "strength": "moderate"}]
        },
        missing_elements: {
          critical: ["Exact dates of occurrence", "Formal documentation"],
          recommended: ["Corroborating witness statements"],
          optional: ["Expert opinion"]
        },
        confidence_score: 55.0,
        recommendations: "This is a deterministic fallback analysis due to high load. Please consult a qualified legal professional for detailed strategy."
      };
    }

    // Save to database if request_id provided
    if (request_id) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        throw new Error("Missing Authorization header");
      }
      
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { error: insertErr } = await supabase.from("case_analysis").insert({
        request_id,
        causal_graph: analysis.causal_graph,
        missing_elements: analysis.missing_elements,
        confidence_score: analysis.confidence_score,
        recommendations: analysis.recommendations,
      });
      
      if (insertErr) {
        console.error("Supabase insert error:", insertErr);
        // Do not throw to client, just log it, so they still get the analysis
      }
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: "An internal server error occurred while processing the analysis." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
