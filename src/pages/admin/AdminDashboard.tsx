import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { adminApi, ScrapingSource, StatsOverview } from '@/lib/adminApi';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Database, TrendingUp, Clock, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

export default function AdminDashboard() {
  const [sources, setSources] = useState<ScrapingSource[]>([]);
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const { toast } = useToast();

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
  }, []);

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
