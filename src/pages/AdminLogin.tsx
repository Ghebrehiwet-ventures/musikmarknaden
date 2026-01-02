import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useEffect } from 'react';
import { Loader2, Shield } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const { signIn, signUp, user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminRole();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user && isAdmin && !adminLoading) {
      navigate('/admin');
    }
  }, [user, isAdmin, adminLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = mode === 'login' 
        ? await signIn(email, password)
        : await signUp(email, password);

      if (error) {
        toast({
          title: 'Fel',
          description: error.message,
          variant: 'destructive',
        });
      } else if (mode === 'signup') {
        toast({
          title: 'Konto skapat',
          description: 'Kontakta en administratör för att få admin-rättigheter.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (user && !isAdmin && !adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle>Åtkomst nekad</CardTitle>
            <CardDescription>
              Du har inte admin-rättigheter. Kontakta en administratör om du behöver åtkomst.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/')}
            >
              Tillbaka till startsidan
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Shield className="w-12 h-12 mx-auto text-primary mb-4" />
          <CardTitle>Admin-portal</CardTitle>
          <CardDescription>
            Logga in för att hantera datakällor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-post</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Lösenord</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {mode === 'login' ? 'Logga in' : 'Skapa konto'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === 'login' ? (
              <>
                Inget konto?{' '}
                <button
                  onClick={() => setMode('signup')}
                  className="text-primary hover:underline"
                >
                  Skapa ett
                </button>
              </>
            ) : (
              <>
                Har redan konto?{' '}
                <button
                  onClick={() => setMode('login')}
                  className="text-primary hover:underline"
                >
                  Logga in
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
