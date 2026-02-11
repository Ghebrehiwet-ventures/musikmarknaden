import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { adminApi, ScrapingSource, SourceCategoryInfo } from '@/lib/adminApi';
import { CATEGORIES } from '@/lib/categories';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Save, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

interface MappingRow {
  external_category: string;
  internal_category: string;
  count?: number;
  is_from_source?: boolean;
}

export default function AdminCategories() {
  const [sources, setSources] = useState<ScrapingSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [sourceCategories, setSourceCategories] = useState<SourceCategoryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [loadingSourceCategories, setLoadingSourceCategories] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newExternal, setNewExternal] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const fetchSources = async () => {
      try {
        const data = await adminApi.getSources();
        setSources(data);
        if (data.length > 0) {
          setSelectedSource(data[0].id);
        }
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

    fetchSources();
  }, []);

  useEffect(() => {
    if (!selectedSource) return;

    const fetchData = async () => {
      setLoadingMappings(true);
      setLoadingSourceCategories(true);

      try {
        // Fetch both mappings and source categories in parallel
        const [mappingsData, categoriesData] = await Promise.all([
          adminApi.getCategoryMappings(selectedSource),
          adminApi.getSourceCategories(selectedSource),
        ]);

        // Convert to MappingRow format
        const existingMappings = mappingsData.map(m => ({
          external_category: m.external_category,
          internal_category: m.internal_category,
        }));

        setMappings(existingMappings);
        setSourceCategories(categoriesData);
      } catch (error) {
        toast({
          title: 'Fel',
          description: error instanceof Error ? error.message : 'Kunde inte hämta data',
          variant: 'destructive',
        });
      } finally {
        setLoadingMappings(false);
        setLoadingSourceCategories(false);
      }
    };

    fetchData();
  }, [selectedSource]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminApi.saveCategoryMappings(selectedSource, mappings);
      toast({ title: 'Mappningar sparade' });
      // Refresh source categories to update is_mapped status
      const categoriesData = await adminApi.getSourceCategories(selectedSource);
      setSourceCategories(categoriesData);
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

  const handleAdd = () => {
    if (!newExternal.trim()) return;
    if (mappings.some(m => m.external_category.toLowerCase() === newExternal.toLowerCase())) {
      toast({
        title: 'Fel',
        description: 'Den kategorin finns redan',
        variant: 'destructive',
      });
      return;
    }
    setMappings([...mappings, { external_category: newExternal.trim(), internal_category: 'other' }]);
    setNewExternal('');
  };

  const suggestInternalCategory = (externalName: string): string => {
    const n = externalName.toLowerCase();
    if (/\bsynt(ar|er|e)?\b|synth|modulärt|eurorack/i.test(n)) return 'synth-modular';
    if (/\b(gitarr|bas|elgitarr|elbas|akustisk)\b/i.test(n)) return 'guitars-bass';
    if (/\b(trummor|slagverk|cymbal|percussion|drum)\b/i.test(n)) return 'drums-percussion';
    if (/\b(piano|keyboard|elpiano|klaviatur)\b/i.test(n)) return 'keys-pianos';
    if (/\b(blås|sax|trumpet|klarinett|flöjt|dragspel)\b/i.test(n)) return 'wind-brass';
    if (/\b(förstärkare|amp|combo)\b/i.test(n)) return 'amplifiers';
    if (/\b(pedal|effekt)\b/i.test(n)) return 'pedals-effects';
    if (/\b(studio|mikrofon|interface)\b/i.test(n)) return 'studio';
    if (/\b(dj|live|pa)\b/i.test(n)) return 'dj-live';
    if (/\b(tillbehör|delar|kabel|case)\b/i.test(n)) return 'accessories-parts';
    if (/\b(övrigt|other)\b/i.test(n)) return 'other';
    return 'other';
  };

  const handleAddFromSource = (sourceCategory: string) => {
    if (mappings.some(m => m.external_category.toLowerCase() === sourceCategory.toLowerCase())) {
      toast({
        title: 'Fel',
        description: 'Den kategorin finns redan i mappningen',
        variant: 'destructive',
      });
      return;
    }
    const suggested = suggestInternalCategory(sourceCategory);
    setMappings([...mappings, { external_category: sourceCategory, internal_category: suggested }]);
  };

  const handleRemove = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const handleMappingChange = (index: number, internal_category: string) => {
    setMappings(mappings.map((m, i) => 
      i === index ? { ...m, internal_category } : m
    ));
  };

  const refreshSourceCategories = async () => {
    if (!selectedSource) return;
    setLoadingSourceCategories(true);
    try {
      const categoriesData = await adminApi.getSourceCategories(selectedSource);
      setSourceCategories(categoriesData);
    } catch (error) {
      toast({
        title: 'Fel',
        description: error instanceof Error ? error.message : 'Kunde inte uppdatera',
        variant: 'destructive',
      });
    } finally {
      setLoadingSourceCategories(false);
    }
  };

  const unmappedCount = sourceCategories.filter(c => !c.is_mapped).length;
  const totalSourceCategories = sourceCategories.length;

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
          <h1 className="text-3xl font-bold">Kategori-mappning</h1>
          <p className="text-muted-foreground">
            Mappa externa kategorier till interna kategorier per källa
          </p>
        </div>

        {/* Source selector */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Välj källa</CardTitle>
                <CardDescription>
                  Välj en källa för att se och konfigurera kategori-mappningar
                </CardDescription>
              </div>
              <Select value={selectedSource} onValueChange={setSelectedSource}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Välj källa" />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((source) => (
                    <SelectItem key={source.id} value={source.id}>
                      {source.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
        </Card>

        {sources.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-muted-foreground text-center">
                Inga källor konfigurerade. Skapa en källa först.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Source categories (from database) */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Kategorier från källan
                      {unmappedCount > 0 && (
                        <Badge variant="destructive" className="ml-2">
                          {unmappedCount} omappade
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Unika source_category-värden från annonser. Mappa dessa till interna kategorier nedan – mappningarna används vid nästa synk och minskar antalet i Övrigt.
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={refreshSourceCategories} disabled={loadingSourceCategories}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loadingSourceCategories ? 'animate-spin' : ''}`} />
                    Uppdatera
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingSourceCategories ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : sourceCategories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Inga kategorier hittades.</p>
                    <p className="text-sm">Scrapern behöver spara source_category.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {sourceCategories.map((cat) => (
                      <div
                        key={cat.source_category}
                        className={`flex items-center justify-between p-2 rounded-md border ${
                          cat.is_mapped 
                            ? 'border-border bg-muted/30' 
                            : 'border-destructive/50 bg-destructive/10'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {cat.is_mapped ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-destructive" />
                          )}
                          <span className="font-medium">{cat.source_category}</span>
                          <Badge variant="secondary" className="text-xs">
                            {cat.count} annonser
                          </Badge>
                        </div>
                        {!cat.is_mapped && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddFromSource(cat.source_category)}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Lägg till
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Current mappings */}
            <Card>
              <CardHeader>
                <CardTitle>Konfigurerade mappningar</CardTitle>
                <CardDescription>
                  Externa kategorier → interna kategorier. Vid nästa sync används dessa (t.ex. &quot;Övrigt beg/vintage&quot; → Gitarrer & Basar) så att färre annonser hamnar i Övrigt.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingMappings ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Add new mapping manually */}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Extern kategori (manuell)"
                        value={newExternal}
                        onChange={(e) => setNewExternal(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                      />
                      <Button variant="outline" onClick={handleAdd}>
                        <Plus className="w-4 h-4 mr-2" />
                        Lägg till
                      </Button>
                    </div>

                    {/* Mappings table */}
                    {mappings.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        Inga mappningar konfigurerade. Klicka på "Lägg till" på en kategori från källan.
                      </p>
                    ) : (
                      <>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Extern kategori</TableHead>
                              <TableHead>Intern kategori</TableHead>
                              <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {mappings.map((mapping, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-medium">
                                  {mapping.external_category}
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={mapping.internal_category}
                                    onValueChange={(value) => handleMappingChange(index, value)}
                                  >
                                    <SelectTrigger className="w-[180px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {CATEGORIES.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.id}>
                                          {cat.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemove(index)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        <div className="flex justify-end">
                          <Button onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            <Save className="w-4 h-4 mr-2" />
                            Spara mappningar
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Reference: Internal categories */}
        <Card>
          <CardHeader>
            <CardTitle>Interna kategorier</CardTitle>
            <CardDescription>
              Dessa är de tillgängliga interna kategorierna i appen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <div
                  key={cat.id}
                  className="px-3 py-1 bg-muted rounded-md text-sm"
                >
                  {cat.label} <span className="text-muted-foreground">({cat.id})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
