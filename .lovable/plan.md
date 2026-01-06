# Full Backfill av Beskrivningar

## Mål
Öka `backfillMissingDescriptions` limit från 30 till **500 per sync-körning** så att alla 3,357 annonser utan beskrivning fylls i inom ~7 dagar automatiskt.

## Kostnad
- Engångskostnad: ~$5-7 (baserat på 3,357 annonser x $0.001-0.002/scrape)
- Löpande: ~$0.05-0.10/dag för nya annonser

## Ändringar

### Fil 1: `supabase/functions/sync-ads/index.ts`

**Ändring 1 - Rad 775:**
Öka limit för `backfillMissingDescriptions` från 30 till 500:
```typescript
// FÖRE:
const descBackfillResult = await backfillMissingDescriptions(supabase, supabaseUrl, 30);

// EFTER:
const descBackfillResult = await backfillMissingDescriptions(supabase, supabaseUrl, 500);
```

**Ändring 2 - Rad 480-487:**
Uppdatera funktionen att prioritera nyare annonser (desc först):
```typescript
// FÖRE:
async function backfillMissingDescriptions(supabase: any, supabaseUrl: string, limit: number = 30): Promise<{ backfilled: number; failed: number }> {
  const { data: adsWithoutDesc, error } = await supabase
    .from('ad_listings_cache')
    .select('id, ad_url, title')
    .eq('is_active', true)
    .or('description.is.null,description.eq.')
    .limit(limit);

// EFTER:
async function backfillMissingDescriptions(supabase: any, supabaseUrl: string, limit: number = 500): Promise<{ backfilled: number; failed: number }> {
  const { data: adsWithoutDesc, error } = await supabase
    .from('ad_listings_cache')
    .select('id, ad_url, title')
    .eq('is_active', true)
    .or('description.is.null,description.eq.')
    .order('created_at', { ascending: false })  // Nyast först
    .limit(limit);
```

**Ändring 3 - Rad 516:**
Minska delay för snabbare backfill (rate limit är ok med 300ms):
```typescript
// FÖRE:
await delay(500);

// EFTER:
await delay(300);
```

## Tidsplan
- Varje sync-körning processar upp till 500 annonser
- Med ~3,357 annonser utan beskrivning = ~7 körningar = ~7 dagar
- Nyare annonser prioriteras (visas oftare för användare)

## Resultat efter implementation
- Beskrivningar laddas DIREKT (0ms) för alla annonser med ifylld description
- Automatisk backfill - ingen manuell körning behövs
- Progress syns i sync_logs (descriptionsBackfilled per körning)

## Kritiska filer för implementation
- `supabase/functions/sync-ads/index.ts` - Huvudfil att ändra (limit + sortering + delay)
