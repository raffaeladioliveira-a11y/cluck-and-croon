import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChickenButton } from "@/components/ChickenButton";
import { BarnCard } from "@/components/BarnCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: ''
  });

  useEffect(() => {
    // Verificar se usuário já está logado
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/');
      }
    };
    
    checkAuth();

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        toast({
          title: "🐔 Bem-vindo ao Galinheiro!",
          description: "Login realizado com sucesso!",
        });
        navigate('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    });

    if (error) {
      toast({
        title: "❌ Erro no Login",
        description: error.message,
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: formData.displayName
        }
      }
    });

    if (error) {
      toast({
        title: "❌ Erro no Cadastro",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "🥚 Conta Criada!",
        description: "Verifique seu email para confirmar a conta",
      });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-sky p-4 flex items-center justify-center">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-transparent bg-gradient-sunrise bg-clip-text">
            🐔 Galinheiro Musical
          </h1>
          <p className="text-xl text-muted-foreground">
            Entre no galinheiro e comece a cantar!
          </p>
        </div>

        <BarnCard variant="coop">
          <Tabs value={isLogin ? "login" : "signup"} onValueChange={(value) => setIsLogin(value === "login")}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="galinha@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({...prev, email: e.target.value}))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({...prev, password: e.target.value}))}
                    required
                  />
                </div>

                <ChickenButton 
                  type="submit" 
                  className="w-full" 
                  variant="barn"
                  disabled={loading}
                >
                  {loading ? "Entrando..." : "🚪 Entrar no Galinheiro"}
                </ChickenButton>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <Label htmlFor="displayName">Nome da Galinha</Label>
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="Galinha Cacarejá"
                    value={formData.displayName}
                    onChange={(e) => setFormData(prev => ({...prev, displayName: e.target.value}))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="galinha@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({...prev, email: e.target.value}))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({...prev, password: e.target.value}))}
                    required
                  />
                </div>

                <ChickenButton 
                  type="submit" 
                  className="w-full" 
                  variant="corn"
                  disabled={loading}
                >
                  {loading ? "Criando..." : "🥚 Criar Conta"}
                </ChickenButton>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center">
            <ChickenButton 
              variant="feather" 
              onClick={() => navigate('/')}
              className="text-sm"
            >
              🏠 Voltar ao Início
            </ChickenButton>
          </div>
        </BarnCard>

        {/* Floating Animation Elements */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-20 right-10 animate-feather-float text-xl opacity-20">🪶</div>
          <div className="absolute bottom-40 left-10 animate-egg-bounce text-2xl opacity-10">🌽</div>
          <div className="absolute top-1/3 left-20 animate-chicken-walk text-2xl opacity-15">🐣</div>
        </div>
      </div>
    </div>
  );
}