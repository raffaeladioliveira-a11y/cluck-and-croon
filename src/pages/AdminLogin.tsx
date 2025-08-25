import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Login simples para demonstração
    if (credentials.username === "fazendeiro" && credentials.password === "galinha123") {
      // Salvar estado de admin no localStorage
      localStorage.setItem('adminAuth', JSON.stringify({
        isAuthenticated: true,
        user: 'Fazendeiro Silva',
        loginTime: Date.now()
      }));

      toast({
        title: "🚜 Bem-vindo, Fazendeiro!",
        description: "Acesso autorizado à Central do Galinheiro",
      });

      navigate('/admin/dashboard');
    } else {
      toast({
        title: "❌ Acesso Negado",
        description: "Usuário ou senha incorretos. Tente: fazendeiro / galinha123",
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