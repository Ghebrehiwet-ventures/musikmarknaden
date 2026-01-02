import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CATEGORIES = [
  { id: 'instrument', label: 'Instrument', examples: 'Gitarrer (Fender, Gibson, Ibanez), basar, trummor, keyboards, piano, saxofon, violin, ukulele, mandolin' },
  { id: 'amplifiers', label: 'Förstärkare', examples: 'Gitarrförstärkare, basförstärkare, toppar, kabinett (Marshall, Vox, Mesa Boogie, Orange, Ampeg)' },
  { id: 'pedals-effects', label: 'Pedaler & Effekter', examples: 'Effektpedaler, overdrive, distortion, delay, reverb, looper, multieffekter (Boss, MXR, Strymon)' },
  { id: 'studio', label: 'Studio', examples: 'Mikrofoner (Shure, Neumann), ljudkort, audio interface, mixerbord, studiomonitorer, kompressorer' },
  { id: 'dj-live', label: 'DJ & Live', examples: 'DJ-controller, turntables, CDJ, PA-system, aktiva högtalare, ljusutrustning, DMX, moving heads' },
  { id: 'synth-modular', label: 'Synth & Modulärt', examples: 'Synthesizers (Moog, Korg, Roland), Eurorack-moduler, sequencers, samplers (Elektron, MPC)' },
  { id: 'software-computers', label: 'Mjukvara & Datorer', examples: 'DAW-programvara, plugins, VST, datorer för musik, ljudkort (software)' },
  { id: 'accessories-parts', label: 'Tillbehör & Delar', examples: 'Kablar, case, stativ, strängar, plektrum, gitarrem, pedalboards, pickups, reservdelar' },
  { id: 'services', label: 'Tjänster', examples: 'Lektioner, replokaler, reparationstjänster, uthyrning' },
  { id: 'other', label: 'Övrigt', examples: 'Allt som inte passar in i andra kategorier' },
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

VIKTIGA REGLER:
1. Gitarrer, basar, trummor, keyboards, blåsinstrument = instrument (INTE förstärkare!)
2. "G&L", "Fender", "Gibson", "Ibanez" är gitarrmärken = instrument
3. Förstärkare är separata enheter som förstärker ljud (Marshall, Vox, Ampeg toppar/kabinett)
4. DJ-utrustning inkluderar turntables, controllers, CDJ - men INTE vanliga gitarrer
5. Synth/synthesizers är en egen kategori, inte instrument
6. Om du är osäker, välj den mest troliga kategorin baserat på produktnamn

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
