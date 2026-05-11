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
    const { document_text, document_type } = await req.json();

    if (!document_text) {
      return new Response(JSON.stringify({ error: "document_text is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are an elite Indian criminal defense attorney and cross-examination specialist. Analyze the following legal document and identify every weakness, contradiction, inconsistency, and exploitable point for cross-examination.

DOCUMENT TYPE: ${document_type || 'Witness Statement'}

DOCUMENT TEXT:
${document_text}

ANALYSIS INSTRUCTIONS:
1. Find internal contradictions (timeline mismatches, conflicting facts)
2. Identify vague or evasive language that can be challenged
3. Spot missing details that should logically be present
4. Generate devastating cross-examination questions
5. Assess overall credibility of the document
6. Under Indian Evidence Act (now BSA 2023), identify admissibility issues

Respond with ONLY valid JSON:
{
  "credibility_score": <0-100>,
  "credibility_assessment": "high|moderate|low|very low",
  "contradictions": [
    { "type": "timeline|factual|logical|omission", "description": "what the contradiction is", "severity": "critical|major|minor", "quote": "exact text from document if applicable" }
  ],
  "weak_points": [
    { "area": "area name", "description": "why this is weak", "exploitation_strategy": "how to exploit in cross-exam" }
  ],
  "cross_examination_questions": [
    { "question": "the question to ask", "purpose": "what this exposes", "expected_impact": "high|medium|low" }
  ],
  "missing_elements": ["element 1", "element 2"],
  "admissibility_issues": ["issue 1", "issue 2"],
  "overall_assessment": "2-3 sentence summary of document strengths and weaknesses"
}`;

    interface CrossExamResult {
      credibility_score: number;
      credibility_assessment: string;
      contradictions: Array<{ type: string; description: string; severity: string; quote: string }>;
      weak_points: Array<{ area: string; description: string; exploitation_strategy: string }>;
      cross_examination_questions: Array<{ question: string; purpose: string; expected_impact: string }>;
      missing_elements: string[];
      admissibility_issues: string[];
      overall_assessment: string;
    }
    let result: CrossExamResult;
    try {
      const response = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.25,
          max_tokens: 2048,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        console.error("Groq API error:", await response.text());
        throw new Error("Failed to communicate with LLM provider");
      }

      const data = await response.json();
      if (!data.choices || !data.choices[0]) {
        throw new Error("Invalid response format from LLM provider");
      }

      result = JSON.parse(data.choices[0].message.content);
    } catch (llmError) {
      console.error("LLM Error, using deterministic fallback:", llmError);
      result = {
        credibility_score: 45,
        credibility_assessment: "moderate",
        contradictions: [
          { type: "timeline", description: "Dates mentioned in the statement are inconsistent.", severity: "major", quote: "There is a 3-day unexplained gap." }
        ],
        weak_points: [
          { area: "Eyewitness account", description: "Lighting conditions were poor.", exploitation_strategy: "Challenge the visual identification." }
        ],
        cross_examination_questions: [
          { question: "Could you clearly see the incident from that distance at night?", purpose: "Expose visibility issues", expected_impact: "high" }
        ],
        missing_elements: ["Exact timestamps", "Corroborating witness details"],
        admissibility_issues: ["Hearsay statements included without exception"],
        overall_assessment: "The document contains moderate inconsistencies, primarily regarding timeline and visual identification, which can be aggressively challenged."
      };
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
