# Full Backfill av Beskrivningar

## Mål
Öka `backfillMissingDescriptions` limit till **100 per sync-körning** (justerat från 500 för att undvika timeout).

## Kostnad
- Engångskostnad: ~$5-7 (baserat på 3,357 annonser x $0.001-0.002/scrape)
- Löpande: ~$0.05-0.10/dag för nya annonser

## Ändringar (implementerade)

### Fil: `supabase/functions/sync-ads/index.ts`

1. **Limit**: 100 per körning (undviker timeout, 500 var för mycket)
2. **Sortering**: `order('created_at', { ascending: false })` - nyast först
3. **Delay**: 300ms mellan anrop
4. **Loggning**: Tydlig loggning för att följa progress

## Tidsplan
- Med ~3,380 annonser utan beskrivning = ~34 körningar = ~34 dagar
- Nyare annonser prioriteras (visas oftare för användare)

## Status
- ✅ Implementerat
- Synken körs dagligen och fyller automatiskt på beskrivningar
