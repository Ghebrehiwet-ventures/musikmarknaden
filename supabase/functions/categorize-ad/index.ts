import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CATEGORIES = [
  { id: 'guitars-bass', label: 'Gitarrer & Basar', examples: 'Gitarrer (Fender, Gibson, Ibanez, Squier, Gretsch), basar (Warwick, Sandberg, Precision, Jazz Bass)' },
  { id: 'drums-percussion', label: 'Trummor & Slagverk', examples: 'Trummor (Pearl, Tama, DW), cymbaler (Zildjian, Sabian), percussion' },
  { id: 'keys-pianos', label: 'Keyboards & Pianon', examples: 'Piano, keyboard, elpiano, Rhodes, Wurlitzer, Yamaha, Roland' },
  { id: 'wind-brass', label: 'Blåsinstrument', examples: 'Saxofon, trumpet, klarinett, flöjt, dragspel' },
  { id: 'strings-other', label: 'Stränginstrument', examples: 'Fiol, cello, ukulele, mandolin' },
  { id: 'amplifiers', label: 'Förstärkare', examples: 'Gitarrförstärkare (Marshall, Vox, Fender, Mesa Boogie, Orange), basförstärkare (Ampeg, Markbass), Kemper, Helix' },
  { id: 'pedals-effects', label: 'Pedaler & Effekter', examples: 'Overdrive, delay, reverb, looper, wah (Boss, MXR, Strymon)' },
  { id: 'studio', label: 'Studio', examples: 'Mikrofoner (Shure, Neumann), ljudkort/interface (Focusrite, UA, RME), monitorer, preamps' },
  { id: 'dj-live', label: 'DJ & Live', examples: 'DJ-controller, turntables (Technics, Pioneer), PA-system, ljusutrustning' },
  { id: 'synth-modular', label: 'Synth & Modulärt', examples: 'Synthesizers (Moog, Korg, Roland, Nord), Eurorack, samplers (Elektron, MPC)' },
  { id: 'software-computers', label: 'Mjukvara & Datorer', examples: 'DAW, plugins, VST, datorer för musik' },
  { id: 'accessories-parts', label: 'Tillbehör & Delar', examples: 'Kablar, case, strängar, pickups, pedalboards' },
  { id: 'services', label: 'Tjänster', examples: 'Lektioner, replokaler, reparation, uthyrning' },
  { id: 'other', label: 'Övrigt', examples: 'Litteratur, noter, musikmemorabilia - ENDAST om det verkligen inte passar någon annan kategori' },
];

interface CategorizeRequest {
  title: string;
  description?: string;
  image_url?: string;
}

interface CategorizeResponse {
  category: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning?: string;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function categorizeWithAI(
  apiKey: string,
  title: string,
  description?: string,
  imageUrl?: string
): Promise<CategorizeResponse> {
  const categoryList = CATEGORIES.map((c) => `- ${c.id}: ${c.label} (${c.examples})`).join('\n');

  const systemPrompt = `Du är en expert på musikinstrument och studioutrustning. Din uppgift är att kategorisera produkter korrekt.

KATEGORIER:
${categoryList}

VIKTIGA REGLER (FÖLJ DESSA NOGGRANT):

1. GITARRER & BASAR (guitars-bass): Alla gitarrer och basar - Fender, Gibson, Ibanez, Squier, Warwick, Sandberg
2. TRUMMOR & SLAGVERK (drums-percussion): Trummor, trumset, cymbaler (Zildjian, Sabian), percussion
3. KEYBOARDS & PIANON (keys-pianos): Piano, keyboard, elpiano, Rhodes, Wurlitzer, Yamaha, Roland
4. BLÅSINSTRUMENT (wind-brass): Saxofon, trumpet, klarinett, flöjt, dragspel
5. STRÄNGINSTRUMENT (strings-other): Fiol, cello, ukulele, mandolin

6. FÖRSTÄRKARE (amplifiers): Gitarr/basförstärkare, Kemper, Helix, "combo", "head", "cab"
7. PEDALER & EFFEKTER (pedals-effects): Overdrive, delay, reverb, wah, looper (Boss, MXR, Strymon)
8. STUDIO (studio): Mikrofoner, ljudkort/interface, monitorer
9. DJ & LIVE (dj-live): DJ-controller, turntables, PA-system, ljusutrustning
10. SYNTH & MODULÄRT (synth-modular): Synthesizers, Eurorack, samplers (Elektron, MPC)

EXEMPEL PÅ KNEPIGA FALL:
- "Fender Stratocaster" = guitars-bass (gitarr)
- "Fender Twin Reverb" = amplifiers (gitarrförstärkare)
- "Nord Stage 3" = synth-modular (digital keyboard/synth)
- "Boss DS-1" = pedals-effects (distortionpedal)
- "Shure SM58" = studio (mikrofon)
- "Technics 1210" = dj-live (turntable)

VIKTIGT: Välj ALDRIG "other" om produkten uppenbart passar i en annan kategori. "other" är endast för saker som noter, böcker eller icke-musikrelaterat.

Svara ENDAST med ett JSON-objekt i detta format:
{"category": "category-id", "confidence": "high/medium/low", "reasoning": "kort förklaring"}`;

  const userContent: any[] = [
    {
      type: 'text',
      text: `Kategorisera denna produkt:\n\nTitel: ${title}${description ? `\nBeskrivning: ${description}` : ''}\n\nSvara med JSON.`,
    },
  ];

  // Add image if available and valid
  // Only include images from known valid sources
  if (
    imageUrl &&
    imageUrl.startsWith('http') &&
    !imageUrl.includes('example') &&
    (imageUrl.includes('musikborsen.se') || imageUrl.includes('cdn.') || imageUrl.includes('images.'))
  ) {
    userContent.push({
      type: 'image_url',
      image_url: { url: imageUrl },
    });
  }

  const requestBody = {
    model: 'google/gemini-2.5-flash',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    max_tokens: 200,
  };

  // Retry transient gateway failures (502/5xx/429)
  const maxAttempts = 3;
  let lastStatus = 0;
  let lastText = '';
  let content = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const data = await response.json();
      content = data.choices?.[0]?.message?.content || '';
      console.log('AI response:', content);
      break;
    }

    lastStatus = response.status;
    lastText = await response.text().catch(() => '');
    console.error('AI Gateway error:', lastStatus, lastText);

    // Surface billing/rate-limit clearly
    if (lastStatus === 402 || lastStatus === 429) {
      throw new Error(`AI Gateway error: ${lastStatus}`);
    }

    // Retry on transient 5xx
    const isTransient = lastStatus >= 500;
    if (!isTransient || attempt === maxAttempts) {
      throw new Error(`AI Gateway error: ${lastStatus}`);
    }

    await delay(400 * attempt);
  }

  if (!content) {
    throw new Error(`AI Gateway error: ${lastStatus || 500}`);
  }

  // Label to ID mapping for tolerant parsing
  const labelToId: Record<string, string> = {};
  const synonyms: Record<string, string> = {
    'instrument': 'guitars-bass',
    'instruments': 'guitars-bass',
    'gitarr': 'guitars-bass',
    'guitars': 'guitars-bass',
    'bas': 'guitars-bass',
    'bass': 'guitars-bass',
    'trummor': 'drums-percussion',
    'drums': 'drums-percussion',
    'percussion': 'drums-percussion',
    'piano': 'keys-pianos',
    'keyboard': 'keys-pianos',
    'keyboards': 'keys-pianos',
    'blås': 'wind-brass',
    'stränginstrument': 'strings-other',
    'förstärkare': 'amplifiers',
    'amplifier': 'amplifiers',
    'amp': 'amplifiers',
    'amps': 'amplifiers',
    'pedaler': 'pedals-effects',
    'pedals': 'pedals-effects',
    'effekter': 'pedals-effects',
    'effects': 'pedals-effects',
    'pedal': 'pedals-effects',
    'synth': 'synth-modular',
    'synthesizer': 'synth-modular',
    'modulärt': 'synth-modular',
    'modular': 'synth-modular',
    'studio': 'studio',
    'recording': 'studio',
    'mikrofon': 'studio',
    'dj': 'dj-live',
    'live': 'dj-live',
    'pa': 'dj-live',
    'tillbehör': 'accessories-parts',
    'accessories': 'accessories-parts',
    'delar': 'accessories-parts',
    'parts': 'accessories-parts',
    'mjukvara': 'software-computers',
    'software': 'software-computers',
    'datorer': 'software-computers',
    'computers': 'software-computers',
    'tjänster': 'services',
    'services': 'services',
    'övrigt': 'other',
    'other': 'other',
  };

  for (const c of CATEGORIES) {
    labelToId[c.label.toLowerCase()] = c.id;
    labelToId[c.id.toLowerCase()] = c.id;
  }

  // Parse JSON from response
  try {
    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || 
                      content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr.trim());
      
      // Try to resolve category from various formats
      let resolvedCategory: string | null = null;
      const rawCategory = (parsed.category || '').toLowerCase().trim();
      
      // 1. Direct match with valid categories
      const validCategories = CATEGORIES.map(c => c.id);
      if (validCategories.includes(rawCategory)) {
        resolvedCategory = rawCategory;
      }
      // 2. Match by label
      else if (labelToId[rawCategory]) {
        resolvedCategory = labelToId[rawCategory];
      }
      // 3. Match by synonyms
      else if (synonyms[rawCategory]) {
        resolvedCategory = synonyms[rawCategory];
      }
      // 4. Partial match (e.g., "Instrument" -> "instrument")
      else {
        for (const c of CATEGORIES) {
          if (rawCategory.includes(c.id) || c.id.includes(rawCategory)) {
            resolvedCategory = c.id;
            break;
          }
        }
      }

      if (resolvedCategory) {
        console.log(`Resolved category: "${rawCategory}" -> "${resolvedCategory}"`);
        return {
          category: resolvedCategory,
          confidence: parsed.confidence || 'medium',
          reasoning: parsed.reasoning,
        };
      } else {
        console.warn(`Could not resolve category: "${rawCategory}"`);
      }
    }
  } catch (e) {
    console.error('Failed to parse AI response:', e);
  }

  // Fallback
  return { category: 'other', confidence: 'low', reasoning: 'Could not parse AI response' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const body: CategorizeRequest = await req.json();
    const { title, description, image_url } = body;

    if (!title) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Categorizing: "${title}"`);

    const result = await categorizeWithAI(lovableApiKey, title, description, image_url);

    console.log(`Category: ${result.category} (${result.confidence})`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Categorize error:', error);

    // Bubble up rate-limit / billing as their real status so callers can retry/backoff
    if (msg.includes('AI Gateway error: 429')) {
      return new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (msg.includes('AI Gateway error: 402')) {
      return new Response(JSON.stringify({ error: 'Payment required for AI usage.' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (msg.includes('AI Gateway error: 502')) {
      return new Response(JSON.stringify({ error: 'AI service temporarily unavailable (502). Please retry.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
