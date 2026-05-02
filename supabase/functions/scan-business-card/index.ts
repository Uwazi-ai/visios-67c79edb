// Business card OCR via Lovable AI Gateway (Gemini vision).
// Auth required (verify_jwt = true, the platform default).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const SYSTEM_PROMPT = `You are a precise business-card OCR. Extract contact information from the supplied business card image.
Return ONLY a single JSON object with these exact keys (use null for any field not present, never invent data):
{ "name": string|null, "title": string|null, "company": string|null, "email": string|null, "phone": string|null, "website": string|null, "linkedin": string|null, "address": string|null, "notes": string|null }
- "notes" is a one-line summary of anything else on the card (slogans, secondary services).
- Phone numbers should keep their original format including country code if shown.
- For LinkedIn, return the full URL when present, otherwise the handle prefixed with https://linkedin.com/in/.
- No markdown, no backticks, no explanation. JSON only.`;

interface ParsedCard {
  name: string | null;
  title: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  linkedin: string | null;
  address: string | null;
  notes: string | null;
}

function safeParseJson(raw: string): ParsedCard | null {
  if (!raw) return null;
  // Strip code fences if model added any
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```\s*$/i, "").trim();
  try {
    const obj = JSON.parse(cleaned) as Record<string, unknown>;
    const out: ParsedCard = {
      name: (obj.name as string) || null,
      title: (obj.title as string) || null,
      company: (obj.company as string) || null,
      email: (obj.email as string) || null,
      phone: (obj.phone as string) || null,
      website: (obj.website as string) || null,
      linkedin: (obj.linkedin as string) || null,
      address: (obj.address as string) || null,
      notes: (obj.notes as string) || null,
    };
    return out;
  } catch {
    // Try to find a JSON object substring
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as ParsedCard;
      } catch { return null; }
    }
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null) as { image?: string } | null;
    const imageDataUrl = body?.image;
    if (!imageDataUrl || typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
      return new Response(JSON.stringify({ error: "image (data URL) is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the contact details from this business card." },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      const status = aiResp.status === 429 ? 429 : aiResp.status === 402 ? 402 : 500;
      return new Response(JSON.stringify({ error: "AI request failed", detail: errText.slice(0, 400) }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const aiJson = await aiResp.json();
    const raw = aiJson?.choices?.[0]?.message?.content as string | undefined;
    const parsed = safeParseJson(raw ?? "");
    if (!parsed) {
      return new Response(JSON.stringify({ error: "Could not parse card", raw: (raw ?? "").slice(0, 500) }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ data: parsed }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
