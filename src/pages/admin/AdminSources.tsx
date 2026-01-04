import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { adminApi, ScrapingSource } from '@/lib/adminApi';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Pencil, Trash2, RefreshCw, Eye, ExternalLink, ImageOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

const SOURCE_TYPES = [
  { value: 'firecrawl_list', label: 'Firecrawl (listsida)' },
  { value: 'firecrawl_crawl', label: 'Firecrawl (crawl)' },
];

interface PreviewProduct {
  title: string;
  ad_url: string;
  price_text: string | null;
  price_amount: number | null;
  location: string;
  image_url: string;
  category: string;
}

export default function AdminSources() {
  const [sources, setSources] = useState<ScrapingSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewProducts, setPreviewProducts] = useState<PreviewProduct[]>([]);
  const [previewSourceName, setPreviewSourceName] = useState('');
  const [editingSource, setEditingSource] = useState<Partial<ScrapingSource> | null>(null);
  const { toast } = useToast();

  const fetchSources = async () => {
    try {
      const data = await adminApi.getSources();
      setSources(data);
    } catch (error) {
      toast({
        title: 'Fel',
        description: error instanceof Error ? error.message : 'Kunde inte hämta källor',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const handleSave = async () => {
    if (!editingSource?.name || !editingSource?.base_url || !editingSource?.scrape_url || !editingSource?.source_type) {
      toast({
        title: 'Fel',
        description: 'Alla fält måste fyllas i',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      if (editingSource.id) {
        await adminApi.updateSource(editingSource as ScrapingSource);
        toast({ title: 'Källa uppdaterad' });
      } else {
        await adminApi.createSource(editingSource);
        toast({ title: 'Källa skapad' });
      }
      setDialogOpen(false);
      setEditingSource(null);
      fetchSources();
    } catch (error) {
      toast({
        title: 'Fel',
        description: error instanceof Error ? error.message : 'Kunde inte spara',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Är du säker på att du vill ta bort denna källa?')) return;

    try {
      await adminApi.deleteSource(id);
      toast({ title: 'Källa borttagen' });
      fetchSources();
    } catch (error) {
      toast({
        title: 'Fel',
        description: error instanceof Error ? error.message : 'Kunde inte ta bort',
        variant: 'destructive',
      });
    }
  };

  const handleToggle = async (id: string, is_active: boolean) => {
    try {
      await adminApi.toggleSource(id, is_active);
      fetchSources();
    } catch (error) {
      toast({
        title: 'Fel',
        description: error instanceof Error ? error.message : 'Kunde inte ändra status',
        variant: 'destructive',
      });
    }
  };

  const handleSync = async (id: string) => {
    setSyncing(id);
    try {
      const result = await adminApi.triggerSync(id);
      toast({
        title: 'Sync klar',
        description: `Hittade ${result.ads_found || 0} annonser`,
      });
      fetchSources();
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

  const handlePreview = async (id: string) => {
    setPreviewing(id);
    try {
      const result = await adminApi.previewSource(id);
      setPreviewProducts(result.products);
      setPreviewSourceName(result.source_name);
      setPreviewDialogOpen(true);
    } catch (error) {
      toast({
        title: 'Preview misslyckades',
        description: error instanceof Error ? error.message : 'Ett fel uppstod',
        variant: 'destructive',
      });
    } finally {
      setPreviewing(null);
    }
  };
  const openCreateDialog = () => {
    setEditingSource({
      name: '',
      base_url: '',
      scrape_url: '',
      source_type: 'firecrawl_list',
      is_active: true,
      config: {},
    });
    setDialogOpen(true);
  };

  const openEditDialog = (source: ScrapingSource) => {
    setEditingSource({ ...source });
    setDialogOpen(true);
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Datakällor</h1>
            <p className="text-muted-foreground">Hantera sajter som skrapas</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Lägg till källa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingSource?.id ? 'Redigera källa' : 'Lägg till källa'}
                </DialogTitle>
                <DialogDescription>
                  Konfigurera en datakälla för att skrapa annonser
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Namn</Label>
                  <Input
                    id="name"
                    value={editingSource?.name || ''}
                    onChange={(e) => setEditingSource(s => ({ ...s, name: e.target.value }))}
                    placeholder="Musikbörsen"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="base_url">Bas-URL</Label>
                  <Input
                    id="base_url"
                    value={editingSource?.base_url || ''}
                    onChange={(e) => setEditingSource(s => ({ ...s, base_url: e.target.value }))}
                    placeholder="https://musikborsen.se"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scrape_url">Skrapnings-URL</Label>
                  <Input
                    id="scrape_url"
                    value={editingSource?.scrape_url || ''}
                    onChange={(e) => setEditingSource(s => ({ ...s, scrape_url: e.target.value }))}
                    placeholder="https://musikborsen.se/begagnat/"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source_type">Skrapningstyp</Label>
                  <Select
                    value={editingSource?.source_type}
                    onValueChange={(value) => setEditingSource(s => ({ ...s, source_type: value as ScrapingSource['source_type'] }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Aktiv</Label>
                  <Switch
                    id="is_active"
                    checked={editingSource?.is_active ?? true}
                    onCheckedChange={(checked) => setEditingSource(s => ({ ...s, is_active: checked }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Avbryt
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingSource?.id ? 'Spara' : 'Skapa'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Konfigurerade källor</CardTitle>
            <CardDescription>
              Klicka på en källa för att redigera den
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sources.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Inga källor konfigurerade. Klicka på "Lägg till källa" för att komma igång.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Namn</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Senaste sync</TableHead>
                    <TableHead>Annonser</TableHead>
                    <TableHead className="text-right">Åtgärder</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((source) => (
                    <TableRow key={source.id}>
                      <TableCell>
                        <Switch
                          checked={source.is_active}
                          onCheckedChange={(checked) => handleToggle(source.id, checked)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{source.name}</TableCell>
                      <TableCell>
                        {SOURCE_TYPES.find(t => t.value === source.source_type)?.label}
                      </TableCell>
                      <TableCell>
                        {source.last_sync_at ? (
                          <span className={source.last_sync_status === 'success' ? 'text-green-600' : 'text-destructive'}>
                            {formatDistanceToNow(new Date(source.last_sync_at), { 
                              addSuffix: true, 
                              locale: sv 
                            })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Aldrig</span>
                        )}
                      </TableCell>
                      <TableCell>{source.ad_count}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePreview(source.id)}
                            disabled={previewing === source.id}
                            title="Preview"
                          >
                            {previewing === source.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSync(source.id)}
                            disabled={syncing === source.id || !source.is_active}
                            title="Synka"
                          >
                            {syncing === source.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(source)}
                            title="Redigera"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(source.id)}
                            title="Ta bort"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Preview Dialog */}
        <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Preview: {previewSourceName}</DialogTitle>
              <DialogDescription>
                Visar {previewProducts.length} exempel-annonser. Granska att titel, pris, bild och kategori ser korrekta ut.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {previewProducts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Inga produkter hittades. Kontrollera att parsern är korrekt konfigurerad.
                </p>
              ) : (
                <div className="grid gap-4">
                  {previewProducts.map((product, idx) => (
                    <div key={idx} className="flex gap-4 p-4 border rounded-lg">
                      <div className="w-24 h-24 flex-shrink-0 bg-muted rounded overflow-hidden">
                        {product.image_url ? (
                          <img 
                            src={product.image_url} 
                            alt={product.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`w-full h-full flex items-center justify-center ${product.image_url ? 'hidden' : ''}`}>
                          <ImageOff className="w-8 h-8 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium truncate">{product.title}</h4>
                          <a 
                            href={product.ad_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex-shrink-0 text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground space-y-1">
                          <p><strong>Pris:</strong> {product.price_text || 'Saknas'}</p>
                          <p><strong>Kategori:</strong> {product.category}</p>
                          <p><strong>Plats:</strong> {product.location || 'Saknas'}</p>
                        </div>
                        {!product.image_url && (
                          <p className="mt-2 text-xs text-destructive">⚠️ Ingen bild hittades</p>
                        )}
                        {!product.price_text && (
                          <p className="mt-1 text-xs text-amber-600">⚠️ Pris saknas</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
                Stäng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
