# Backfill av Beskrivningar

## Arkitektur (implementerad)

### Separat Edge Function: `backfill-descriptions`
- **Limit**: 50 annonser per körning
- **Parallellisering**: 10 parallella scrapes via `Promise.all()`
- **Körtid**: ~5-10 sekunder per batch (50 ads)
- **Cron**: Varje hel timme (`0 * * * *`)

### sync-ads (rensat)
- Hanterar **endast** nya annonser från källor
- Beskrivnings-backfill borttagen - körs separat

## Tidsplan
- 50 ads/timme × 24 timmar = **1,200 ads/dag**
- ~3,380 annonser utan beskrivning = **~3 dagar** att slutföra

## Status
- ✅ `backfill-descriptions` skapad och deployad
- ✅ Cron-jobb schemalagt (varje timme)
- ✅ `sync-ads` uppdaterad (backfill borttagen)
