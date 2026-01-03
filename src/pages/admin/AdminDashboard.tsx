import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { adminApi, ScrapingSource, StatsOverview } from '@/lib/adminApi';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Database, TrendingUp, Clock, CheckCircle, XCircle, Sparkles, Play } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

export default function AdminDashboard() {
  const [sources, setSources] = useState<ScrapingSource[]>([]);
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [categorizing, setCategorizing] = useState(false);
  const [categorizationProgress, setCategorizationProgress] = useState<{
    processed: number;
    updated: number;
    remaining: number;
    failed: number;
    skippedLow: number;
    stillOther: number;
  } | null>(null);
  const [otherCount, setOtherCount] = useState<number>(0);
  const { toast } = useToast();

  const fetchOtherCount = async () => {
    const { count } = await supabase
      .from('ad_listings_cache')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'other')
      .eq('is_active', true);

    const next = count || 0;
    setOtherCount(next);
    return next;
  };

  const fetchData = async () => {
    try {
      const [sourcesData, statsData] = await Promise.all([
        adminApi.getSources(),
        adminApi.getStats(),
      ]);
      setSources(sourcesData);
      setStats(statsData);
    } catch (error) {
      toast({
        title: 'Fel',
        description: error instanceof Error ? error.message : 'Kunde inte hämta data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchOtherCount();
  }, []);

  const handleRunAICategorization = async () => {
    setCategorizing(true);
    setCategorizationProgress({ processed: 0, updated: 0, remaining: otherCount, failed: 0, skippedLow: 0, stillOther: 0 });

    let cursor: string | null = null;
    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalFailed = 0;
    let totalSkippedLow = 0;
    let totalStillOther = 0;

    try {
      // Kör tills backend säger att den är klar, men bryt om det tar orimligt länge.
      const startedAt = Date.now();
      const MAX_RUNTIME_MS = 8 * 60 * 1000; // 8 minuter per körning

      while (Date.now() - startedAt < MAX_RUNTIME_MS) {
        const result = await adminApi.runBatchCategorize({
          category: 'other',
          limit: 100,
          cursor: cursor || undefined,
        });

        totalProcessed += result.processed;
        totalUpdated += result.updated;
        totalFailed += result.failed;
        totalSkippedLow += result.skipped_low_confidence ?? 0;
        totalStillOther += result.skipped_still_other ?? 0;
        cursor = result.next_cursor;

        // Update progress
        const newRemaining = Math.max(0, otherCount - totalUpdated);
        setCategorizationProgress({
          processed: totalProcessed,
          updated: totalUpdated,
          remaining: newRemaining,
          failed: totalFailed,
          skippedLow: totalSkippedLow,
          stillOther: totalStillOther,
        });

        if (result.completed || !cursor) {
          const finalOtherCount = await fetchOtherCount();
          toast({
            title: 'AI-kategorisering klar',
            description: `Uppdaterade ${totalUpdated}. Kvar i Övrigt: ${finalOtherCount}.`,
          });
          break;
        }

        // Small delay between batches
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      // Refresh stats
      fetchData();
    } catch (error) {
      toast({
        title: 'AI-kategorisering misslyckades',
        description: error instanceof Error ? error.message : 'Ett fel uppstod',
        variant: 'destructive',
      });
    } finally {
      setCategorizing(false);
    }
  };

  const handleSync = async (sourceId: string) => {
    setSyncing(sourceId);
    try {
      const result = await adminApi.triggerSync(sourceId);
      toast({
        title: 'Sync klar',
        description: `Hittade ${result.ads_found || 0} annonser`,
      });
      fetchData();
    } catch (error) {
      toast({
        title: 'Sync misslyckades',
        description: error instanceof Error ? error.message : 'Ett fel uppstod',
        variant: 'destructive',
      });
    } finally {
      setSyncing(null);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Översikt över datakällor och annonser</p>
        </div>

        {/* Stats cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Totalt annonser</CardTitle>
              <Database className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_ads.toLocaleString() || 0}</div>
              <p className="text-xs text-muted-foreground">aktiva annonser i databasen</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Aktiva källor</CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {sources.filter(s => s.is_active).length}
              </div>
              <p className="text-xs text-muted-foreground">
                av {sources.length} totalt
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Per källa</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {Object.entries(stats?.by_source || {}).map(([name, count]) => (
                  <div key={name} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{name}</span>
                    <span className="font-medium">{count.toLocaleString()}</span>
                  </div>
                ))}
                {Object.keys(stats?.by_source || {}).length === 0 && (
                  <p className="text-xs text-muted-foreground">Inga annonser ännu</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Categorization */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <CardTitle>AI-kategorisering</CardTitle>
              </div>
              <div className="text-2xl font-bold text-primary">{otherCount}</div>
            </div>
            <CardDescription>
              {otherCount > 0 
                ? `${otherCount} annonser ligger i "Övrigt" och kan kategoriseras med AI`
                : 'Alla annonser är kategoriserade!'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {categorizationProgress && (
              <div className="mb-4 p-3 bg-muted rounded-lg">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mb-2">
                    <span>Bearbetade: {categorizationProgress.processed}</span>
                    <span>Uppdaterade: {categorizationProgress.updated}</span>
                    <span>Ej ändrade (AI sa Övrigt): {categorizationProgress.stillOther}</span>
                    <span>Low confidence: {categorizationProgress.skippedLow}</span>
                    <span>Fel: {categorizationProgress.failed}</span>
                    <span>Kvar (ca): ~{categorizationProgress.remaining}</span>
                  </div>
                <div className="w-full bg-background rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.min(100, (categorizationProgress.updated / Math.max(1, otherCount)) * 100)}%` 
                    }}
                  />
                </div>
              </div>
            )}
            <Button
              onClick={handleRunAICategorization}
              disabled={categorizing || otherCount === 0}
              className="w-full"
            >
              {categorizing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Kör AI-kategorisering...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Kör AI-kategorisering på "Övrigt"
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Sources status */}
        <Card>
          <CardHeader>
            <CardTitle>Datakällor</CardTitle>
            <CardDescription>Status och snabbåtgärder för alla källor</CardDescription>
          </CardHeader>
          <CardContent>
            {sources.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Inga datakällor konfigurerade ännu. Gå till Datakällor för att lägga till en.
              </p>
            ) : (
              <div className="space-y-4">
                {sources.map((source) => (
                  <div 
                    key={source.id} 
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${source.is_active ? 'bg-green-500' : 'bg-muted'}`} />
                      <div>
                        <h3 className="font-medium">{source.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {source.last_sync_at ? (
                            <>
                              Senast synkad {formatDistanceToNow(new Date(source.last_sync_at), { 
                                addSuffix: true, 
                                locale: sv 
                              })}
                              {' • '}
                              {source.last_sync_status === 'success' ? (
                                <span className="text-green-600 inline-flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" /> {source.last_sync_count} annonser
                                </span>
                              ) : (
                                <span className="text-destructive inline-flex items-center gap-1">
                                  <XCircle className="w-3 h-3" /> Misslyckades
                                </span>
                              )}
                            </>
                          ) : (
                            'Aldrig synkad'
                          )}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(source.id)}
                      disabled={syncing === source.id || !source.is_active}
                    >
                      {syncing === source.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Synka nu
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
