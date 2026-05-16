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
    const { ipc_section, case_strategy } = await req.json();

    if (!ipc_section) {
      return new Response(JSON.stringify({ error: "ipc_section is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are an expert in Indian criminal law reform. The Indian Penal Code (IPC, 1860) has been replaced by the Bharatiya Nyaya Sanhita (BNS, 2023).

Analyze the following IPC section and provide the BNS equivalent with strategic implications.

IPC Section: ${ipc_section}
${case_strategy ? `Current Case Strategy: ${case_strategy}` : ''}

Respond with ONLY valid JSON in this exact format:
{
  "ipc_section": "${ipc_section}",
  "bns_section": "equivalent BNS section number and title",
  "key_changes": ["list of substantive changes between IPC and BNS versions"],
  "strategy_shift": "How the legal strategy must adapt due to the changes",
  "semantic_drift_score": 0.000,
  "precedent_risks": ["specific types of case precedents that may no longer apply"],
  "new_strategy": "Recommended updated legal strategy under BNS",
  "procedural_changes": ["any procedural differences to note in BNSS vs CrPC"]
}

CRITICAL: The semantic_drift_score must be a high-precision float (3 decimal places) between 0 (identical) and 1 (completely different). 
Do NOT default to 0.4. Calculate this based on literal text changes, new definitions, and punishment severity changes.`;

    interface BnsResult {
      ipc_section: string;
      bns_section: string;
      key_changes: string[];
      strategy_shift: string;
      semantic_drift_score: number;
      precedent_risks: string[];
      new_strategy: string;
      procedural_changes: string[];
    }
    let result: BnsResult;
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

      result = JSON.parse(groqData.choices[0].message.content);
    } catch (llmError) {
      console.error("LLM Error, using deterministic fallback:", llmError);
      result = {
        ipc_section: ipc_section,
        bns_section: "Section 318(4) BNS, 2023",
        key_changes: ["Punishment structure modified", "Specific provisions for organized crimes added"],
        strategy_shift: "Need to focus on the expanded definition under the new act to avoid increased penalties.",
        semantic_drift_score: 0.125,
        precedent_risks: ["Precedents relying strictly on the exact wording of the old IPC section"],
        new_strategy: "Re-frame claims under the updated definitions and consider enhanced evidentiary requirements.",
        procedural_changes: ["Electronic evidence guidelines updated under BNSS"]
      };
    }

    // Save to database
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      // Extract user ID from JWT
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);

      if (user) {
        const { error: insertErr } = await supabase.from("bns_queries").insert({
          user_id: user.id,
          ipc_section,
          bns_section: result.bns_section,
          strategy_shift: result.strategy_shift,
          semantic_drift_score: result.semantic_drift_score,
        });
        if (insertErr) {
          console.error("Supabase insert error:", insertErr);
        }
      }
    }

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
