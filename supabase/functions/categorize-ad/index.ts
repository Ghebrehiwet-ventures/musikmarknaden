import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CATEGORIES = [
  { id: 'instrument', label: 'Instrument', examples: 'Gitarrer (Fender, Gibson, G&L, PRS, Ibanez, Squier, Gretsch), basar (Warwick, Sandberg, Spector), trummor (Pearl, Tama, DW), keyboards (Yamaha, Roland), blåsinstrument, stråkinstrument' },
  { id: 'amplifiers', label: 'Förstärkare', examples: 'Gitarrförstärkare (Marshall, Vox, Fender, Mesa Boogie, Orange, Blackstar), basförstärkare (Ampeg, Markbass, Aguilar), Kemper, Quad Cortex, Neural DSP, Line 6 Helix' },
  { id: 'pedals-effects', label: 'Pedaler & Effekter', examples: 'Overdrive, distortion, fuzz, delay, reverb, looper, wah (Boss, MXR, Strymon, Eventide, TC Electronic, Walrus, JHS, EHX, Keeley)' },
  { id: 'studio', label: 'Studio', examples: 'Mikrofoner (Shure SM57/58, Neumann, AKG, Rode), ljudkort/interface (Focusrite, Universal Audio, RME, MOTU), mixerbord, studiomonitorer (Genelec, Adam, KRK, Yamaha HS), kompressorer, preamps' },
  { id: 'dj-live', label: 'DJ & Live', examples: 'DJ-controller, turntables (Technics, Pioneer CDJ), PA-system (QSC, RCF, JBL), aktiva högtalare, ljusutrustning, DMX, moving heads' },
  { id: 'synth-modular', label: 'Synth & Modulärt', examples: 'Synthesizers (Moog, Korg, Roland Juno/Jupiter, Nord, Sequential Prophet, Arturia), Eurorack-moduler, sequencers, samplers (Elektron, MPC), analoga och digitala syntar' },
  { id: 'software-computers', label: 'Mjukvara & Datorer', examples: 'DAW-programvara, plugins, VST, datorer för musik' },
  { id: 'accessories-parts', label: 'Tillbehör & Delar', examples: 'Kablar, case/väskor, stativ, strängar, plektrum, gitarrem, pedalboards, pickups (Seymour Duncan, DiMarzio, EMG), reservdelar' },
  { id: 'services', label: 'Tjänster', examples: 'Lektioner, replokaler, reparationstjänster, uthyrning, sökes-annonser för musiker' },
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

async function categorizeWithAI(
  apiKey: string,
  title: string,
  description?: string,
  imageUrl?: string
): Promise<CategorizeResponse> {
  const categoryList = CATEGORIES.map(c => 
    `- ${c.id}: ${c.label} (${c.examples})`
  ).join('\n');

  const systemPrompt = `Du är en expert på musikinstrument och studioutrustning. Din uppgift är att kategorisera produkter korrekt.

KATEGORIER:
${categoryList}

VIKTIGA REGLER (FÖLJ DESSA NOGGRANT):

1. INSTRUMENT (gitarrer, basar, trummor, etc.):
   - Alla gitarrer: Fender, Gibson, G&L, PRS, Ibanez, Schecter, ESP, Squier, Gretsch, Rickenbacker, Taylor, Martin
   - Alla basar: Precision, Jazz Bass, Warwick, Sandberg, Spector, Stingray, Höfner
   - Alla trummor: Pearl, Tama, DW, Sonor, Mapex, Ludwig, cymbaler (Zildjian, Sabian, Meinl)
   - Keyboards som spelar ljud: Rhodes, Wurlitzer, Clavinet
   - Blås- och stråkinstrument

2. FÖRSTÄRKARE (separata enheter som förstärker ljud):
   - Gitarrförstärkare: Marshall, Vox, Fender (Twin, Deluxe, Bassman), Mesa Boogie, Orange, Blackstar, Engl
   - Basförstärkare: Ampeg, Markbass, Aguilar, Hartke, Gallien-Krueger
   - Digitala: Kemper, Line 6 Helix, Fractal Axe-FX, Neural DSP Quad Cortex
   - "Combo", "topteil", "topp", "head", "cabinet", "cab" = förstärkare

3. PEDALER & EFFEKTER:
   - Alla fotpedaler: overdrive, distortion, fuzz, delay, reverb, chorus, wah, looper
   - Märken: Boss, MXR, Strymon, Eventide, TC Electronic, Walrus, JHS, EHX

4. SYNTH & MODULÄRT (INTE instrument):
   - Synthesizers: Moog, Korg (Minilogue, Prologue), Roland (Juno, Jupiter), Nord, Prophet, Arturia
   - Eurorack och modulärt
   - Samplers: Elektron (Digitakt, Octatrack), MPC, Maschine

5. STUDIO:
   - Mikrofoner: Shure SM57/58, Neumann, AKG, Rode
   - Ljudkort/interface: Focusrite Scarlett, Universal Audio Apollo, RME
   - Monitorer: Genelec, Adam, Yamaha HS, KRK

6. DJ & LIVE:
   - DJ-utrustning: CDJ, controller, turntables (Technics, Pioneer)
   - PA-system, aktiva högtalare
   - Ljusutrustning

EXEMPEL PÅ KNEPIGA FALL:
- "Fender Stratocaster" = instrument (gitarr)
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
      text: `Kategorisera denna produkt:

Titel: ${title}${description ? `\nBeskrivning: ${description}` : ''}

Svara med JSON.`
    }
  ];

  // Add image if available and valid
  // Only include images from known valid sources
  if (imageUrl && 
      imageUrl.startsWith('http') && 
      !imageUrl.includes('example') &&
      (imageUrl.includes('musikborsen.se') || 
       imageUrl.includes('cdn.') ||
       imageUrl.includes('images.'))) {
    userContent.push({
      type: 'image_url',
      image_url: { url: imageUrl }
    });
  }

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('AI Gateway error:', response.status, error);
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  console.log('AI response:', content);

  // Parse JSON from response
  try {
    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || 
                      content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr.trim());
      
      // Validate category
      const validCategories = CATEGORIES.map(c => c.id);
      if (validCategories.includes(parsed.category)) {
        return {
          category: parsed.category,
          confidence: parsed.confidence || 'medium',
          reasoning: parsed.reasoning,
        };
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
      return new Response(
        JSON.stringify({ error: 'Title is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Categorizing: "${title}"`);

    const result = await categorizeWithAI(lovableApiKey, title, description, image_url);

    console.log(`Category: ${result.category} (${result.confidence})`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Categorize error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
