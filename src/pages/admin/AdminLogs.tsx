import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { adminApi, SyncLog } from '@/lib/adminApi';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

export default function AdminLogs() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await adminApi.getSyncLogs();
        setLogs(data);
      } catch (error) {
        toast({
          title: 'Fel',
          description: error instanceof Error ? error.message : 'Kunde inte hämta loggar',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="outline" className="text-green-600 border-green-600">
            <CheckCircle className="w-3 h-3 mr-1" />
            Klar
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Misslyckad
          </Badge>
        );
      case 'running':
        return (
          <Badge variant="secondary">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Pågår
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            {status}
          </Badge>
        );
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
          <h1 className="text-3xl font-bold">Sync-logg</h1>
          <p className="text-muted-foreground">Historik över alla synkroniseringar</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Senaste synkroniseringar</CardTitle>
            <CardDescription>
              Visar de 100 senaste sync-körningarna
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Inga synkroniseringar har körts ännu.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Källa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Starttid</TableHead>
                    <TableHead>Tid</TableHead>
                    <TableHead className="text-right">Hittade</TableHead>
                    <TableHead className="text-right">Nya</TableHead>
                    <TableHead>Fel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">
                        {log.scraping_sources?.name || 'Okänd'}
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">
                            {format(new Date(log.started_at), 'yyyy-MM-dd HH:mm', { locale: sv })}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.started_at), { 
                              addSuffix: true, 
                              locale: sv 
                            })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.completed_at ? (
                          <span className="text-sm">
                            {Math.round(
                              (new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000
                            )}s
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{log.ads_found}</TableCell>
                      <TableCell className="text-right">{log.ads_new}</TableCell>
                      <TableCell>
                        {log.error_message ? (
                          <span className="text-sm text-destructive truncate max-w-[200px] block" title={log.error_message}>
                            {log.error_message}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
