import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChickenButton } from "@/components/ChickenButton";
import { BarnCard } from "@/components/BarnCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({
    username: "",
    password: ""
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Buscar usuário admin no banco
      const { data: adminUser, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('username', credentials.username)
        .single();

      if (error || !adminUser) {
        toast({
          title: "❌ Acesso Negado",
          description: "Usuário não encontrado",
          variant: "destructive",
        });
        return;
      }

      // Verificar senha (em produção use bcrypt.compare)
      // Por enquanto verificação simples
      const isValidPassword = credentials.password === "galinha123";
      
      if (!isValidPassword) {
        toast({
          title: "❌ Acesso Negado", 
          description: "Senha incorreta",
          variant: "destructive",
        });
        return;
      }

      // Salvar estado de admin no localStorage
      localStorage.setItem('adminAuth', JSON.stringify({
        isAuthenticated: true,
        user: adminUser.display_name,
        userId: adminUser.id,
        loginTime: Date.now()
      }));

      toast({
        title: "🚜 Bem-vindo, Fazendeiro!",
        description: "Acesso autorizado à Central do Galinheiro",
      });

      navigate('/admin/dashboard');
    } catch (error: any) {
      toast({
        title: "❌ Erro no Sistema",
        description: "Erro ao verificar credenciais",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-sky flex items-center justify-center p-4">
      <BarnCard variant="coop" className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4 animate-chicken-walk">🚜</div>
          <h1 className="text-2xl font-bold text-barn-brown mb-2">
            Central do Fazendeiro
          </h1>
          <p className="text-muted-foreground">
            Acesso restrito aos administradores do galinheiro
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Label htmlFor="username" className="text-barn-brown font-medium">
              Nome de Usuário
            </Label>
            <Input
              id="username"
              type="text"
              placeholder="Digite seu usuário"
              value={credentials.username}
              onChange={(e) => setCredentials(prev => ({...prev, username: e.target.value}))}
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-barn-brown font-medium">
              Senha
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Digite sua senha"
              value={credentials.password}
              onChange={(e) => setCredentials(prev => ({...prev, password: e.target.value}))}
              className="mt-1"
              required
            />
          </div>

          <ChickenButton
            type="submit"
            variant="barn"
            size="lg"
            className="w-full"
            chickenStyle="bounce"
          >
            🚜 Entrar na Central
          </ChickenButton>
        </form>

        {/* Login hint */}
        <div className="mt-6 p-3 bg-primary/10 rounded-lg border border-primary/20">
          <p className="text-xs text-muted-foreground text-center">
            <strong>Demonstração:</strong><br />
            Usuário: fazendeiro<br />
            Senha: galinha123
          </p>
        </div>

        {/* Back to game */}
        <div className="mt-4 text-center">
          <ChickenButton
            variant="egg"
            size="md"
            onClick={() => navigate('/')}
            className="text-sm"
          >
            🏠 Voltar ao Galinheiro
          </ChickenButton>
        </div>
      </BarnCard>
    </div>
  );
}