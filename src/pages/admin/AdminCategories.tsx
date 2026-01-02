import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { adminApi, ScrapingSource, CategoryMapping } from '@/lib/adminApi';
import { CATEGORIES } from '@/lib/categories';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Save } from 'lucide-react';

interface MappingRow {
  external_category: string;
  internal_category: string;
}

export default function AdminCategories() {
  const [sources, setSources] = useState<ScrapingSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMappings, setLoadingMappings] = useState(false);
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

    const fetchMappings = async () => {
      setLoadingMappings(true);
      try {
        const data = await adminApi.getCategoryMappings(selectedSource);
        setMappings(data.map(m => ({
          external_category: m.external_category,
          internal_category: m.internal_category,
        })));
      } catch (error) {
        toast({
          title: 'Fel',
          description: error instanceof Error ? error.message : 'Kunde inte hämta mappningar',
          variant: 'destructive',
        });
      } finally {
        setLoadingMappings(false);
      }
    };

    fetchMappings();
  }, [selectedSource]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminApi.saveCategoryMappings(selectedSource, mappings);
      toast({ title: 'Mappningar sparade' });
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

  const handleRemove = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const handleMappingChange = (index: number, internal_category: string) => {
    setMappings(mappings.map((m, i) => 
      i === index ? { ...m, internal_category } : m
    ));
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
          <h1 className="text-3xl font-bold">Kategori-mappning</h1>
          <p className="text-muted-foreground">
            Mappa externa kategorier till interna kategorier
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Mappningar</CardTitle>
                <CardDescription>
                  Välj en källa och konfigurera hur dess kategorier mappas
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
          <CardContent>
            {sources.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Inga källor konfigurerade. Skapa en källa först.
              </p>
            ) : loadingMappings ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Add new mapping */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Extern kategori (t.ex. Elgitarr)"
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
                    Inga mappningar konfigurerade. Lägg till en extern kategori ovan.
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
                                <SelectTrigger className="w-[200px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CATEGORIES.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                      {cat.label}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value="other">Övrigt</SelectItem>
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
