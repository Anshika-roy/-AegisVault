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
    const { case_summary, client_state } = await req.json();

    if (!case_summary) {
      return new Response(JSON.stringify({ error: "case_summary is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Classify case domain via Groq
    interface Classification {
      domain: string;
      case_type: string;
      urgency: string;
      jurisdiction_notes: string;
    }
    let classification: Classification = { domain: "Commercial", case_type: "Default Analysis", urgency: "medium", jurisdiction_notes: "Requires formal jurisdiction review." };
    const classifyPrompt = `You are an Indian legal domain classifier. Given this case summary, determine the legal domain.

Case Summary: ${case_summary}
Client State: ${client_state || 'Not specified'}

Respond with ONLY valid JSON:
{
  "domain": "one of: Constitutional, Commercial, IP, Technology, Civil, Criminal",
  "case_type": "specific case type description",
  "urgency": "high/medium/low",
  "jurisdiction_notes": "relevant jurisdiction considerations"
}`;

    try {
      const classifyResponse = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: classifyPrompt }],
          temperature: 0.2,
          max_tokens: 512,
          response_format: { type: "json_object" },
        }),
      });
      if (classifyResponse.ok) {
        const classifyData = await classifyResponse.json();
        if (classifyData.choices && classifyData.choices[0]) {
          classification = JSON.parse(classifyData.choices[0].message.content);
        }
      }
    } catch (e) {
      console.error("Classification LLM error:", e);
    }

    // Step 2: Query court scores from database
    const authHeader = req.headers.get("Authorization");
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    
    // Use ANON KEY strictly to avoid Service Role usage per security review
    const supabaseOptions = authHeader ? { global: { headers: { Authorization: authHeader } } } : {};
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      supabaseOptions
    );

    let courts = null;
    if (classification.domain) {
      const filtered = await supabase.from("court_scores").select("*").eq("domain", classification.domain);
      if (filtered.data && filtered.data.length > 0) {
        courts = filtered.data;
      }
    }
    if (!courts) {
      const all = await supabase.from("court_scores").select("*");
      courts = all.data || [];
    }
    // Deduplicate by court_name (seed may have run multiple times)
    const seen = new Set<string>();
    courts = courts.filter((c: { court_name: string }) => {
      if (seen.has(c.court_name)) return false;
      seen.add(c.court_name);
      return true;
    });

    // Step 3: Calculate viability scores
    interface CourtScore {
      court_name: string;
      state: string;
      velocity_score: number;
      injunction_rate: number;
      pendency_days: number;
      domain: string;
    }

    interface RankedCourt extends CourtScore {
      viability_score: number;
      distance_penalty: number;
      is_local: boolean;
    }

    const rankedCourts: RankedCourt[] = (courts || []).map((court: CourtScore) => {
      const distancePenalty = court.state === client_state ? 0 : 0.3;
      const viabilityScore = (0.5 * court.velocity_score) + (0.3 * court.injunction_rate) - (0.2 * distancePenalty);

      return {
        court_name: court.court_name,
        state: court.state,
        domain: court.domain,
        velocity_score: court.velocity_score,
        injunction_rate: court.injunction_rate,
        pendency_days: court.pendency_days,
        viability_score: Math.round(viabilityScore * 100) / 100,
        is_local: court.state === client_state,
        distance_penalty: distancePenalty,
      };
    }).sort((a: RankedCourt, b: RankedCourt) => b.viability_score - a.viability_score);

    // Step 4: Generate reasoning via Groq
    const reasoningPrompt = `You are a legal strategist. Given these ranked courts, explain why each is recommended.

Case: ${case_summary}
Domain: ${classification.domain}
Client State: ${client_state || 'Not specified'}
Top Courts: ${JSON.stringify(rankedCourts.slice(0, 3))}

    Respond with ONLY valid JSON:
{
  "recommendations": [
    {
      "court_name": "court name",
      "rank": 1,
      "reasoning": "why this court is recommended",
      "pros": ["advantages"],
      "cons": ["disadvantages"],
      "estimated_timeline": "estimated resolution timeline"
    }
  ],
  "overall_strategy": "overall filing strategy recommendation"
}

CRITICAL FORMATTING INSTRUCTION: When referring to 'velocity_score' or 'injunction_rate' in your reasoning, pros, or cons, always format them as percentages (e.g., '55%' or '65/100') rather than decimals ('0.55' or '0.65').`;

    interface ReasoningResult {
      recommendations: Array<{
        court_name: string;
        rank: number;
        reasoning: string;
        pros: string[];
        cons: string[];
        estimated_timeline: string;
      }>;
      overall_strategy: string;
    }

    let reasoning: ReasoningResult = {
      recommendations: rankedCourts.slice(0, 3).map((c: RankedCourt, i: number) => ({
        court_name: c.court_name,
        rank: i + 1,
        reasoning: "Fallback reasoning. High viability score based on historical data.",
        pros: ["High velocity", "Good injunction rate"],
        cons: ["Distance penalty may apply"],
        estimated_timeline: "12-18 months"
      })),
      overall_strategy: "Consider local filing for convenience, or top-ranked court for speed."
    };

    try {
      const reasoningResponse = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: reasoningPrompt }],
          temperature: 0.3,
          max_tokens: 1536,
          response_format: { type: "json_object" },
        }),
      });

      if (reasoningResponse.ok) {
        const reasoningData = await reasoningResponse.json();
        if (reasoningData.choices && reasoningData.choices[0]) {
          reasoning = JSON.parse(reasoningData.choices[0].message.content);
        }
      }
    } catch (e) {
      console.error("Reasoning LLM error:", e);
    }

    const result = {
      classification,
      ranked_courts: rankedCourts,
      recommendations: reasoning.recommendations,
      overall_strategy: reasoning.overall_strategy,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: "An internal server error occurred." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
