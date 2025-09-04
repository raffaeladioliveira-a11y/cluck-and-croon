import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthSession } from "@/hooks/useAuthSession";
import { supabase } from "@/integrations/supabase/client";
import { ChickenButton } from "@/components/ChickenButton";
import { BarnCard } from "@/components/BarnCard";
import { ChickenAvatar } from "@/components/ChickenAvatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

export default function Profile() {
  const navigate = useNavigate();
  const { user, loading } = useAuthSession();

  const [displayName, setDisplayName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("/avatars/avatar1.jpg");
  const [saving, setSaving] = useState(false);

  const chickenAvatars = [
    "/avatars/avatar1.jpg",
    "/avatars/avatar2.webp",
    "/avatars/avatar3.webp",
    "/avatars/avatar4.jpg",
    "/avatars/avatar5.webp",
    "/avatars/avatar6.webp",
    "/avatars/avatar7.webp",
    "/avatars/avatar8.jpg",
    "/avatars/avatar9.jpg",
    "/avatars/avatar10.jpg",
    "/avatars/avatar11.webp",
    "/avatars/avatar12.webp",
    "/avatars/avatar13.webp",
    "/avatars/avatar14.webp",
    "/avatars/avatar15.webp",
    "/avatars/avatar16.webp",
    "/avatars/avatar17.webp",
    "/avatars/avatar18.gif",
    "/avatars/avatar19.webp",
    "/avatars/avatar20.webp",
    "/avatars/avatar21.webp",
    "/avatars/avatar22.webp",
    "/avatars/avatar23.webp",
    "/avatars/avatar24.webp",
    "/avatars/avatar25.webp",
    "/avatars/avatar26.webp",
    "/avatars/avatar27.webp",
    "/avatars/avatar28.webp",
    "/avatars/avatar29.webp",
    "/avatars/avatar30.webp",
  ];


  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }

    if (user) {
      // Carrega dados do perfil - prioriza avatar_url
      setDisplayName(user.user_metadata?.display_name || user.email || "");
      setSelectedAvatar(user.user_metadata?.avatar_url || "/avatars/avatar1.jpg");
    }
  }, [user, loading, navigate]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // Tenta salvar no Supabase Auth
      const { error } = await supabase.auth.updateUser({
        data: {
          display_name: displayName,
          avatar_url: selectedAvatar
        }
      });

      if (error) {
        // Se der erro 403, use uma abordagem alternativa
        if (error.message?.includes('403') || error.status === 403) {
          console.warn("Erro 403 no Supabase Auth, usando tabela de perfis...");

          // Tenta salvar em uma tabela profiles separada
          const { error: profileError } = await supabase
              .from('profiles')
              .upsert({
                id: user.id,
                display_name: displayName,
                avatar_url: selectedAvatar,
                updated_at: new Date().toISOString()
              });

          if (profileError) {
            throw profileError;
          }
        } else {
          throw error;
        }
      }

      toast({
        title: "Perfil Atualizado!",
        description: "Suas informações foram salvas com sucesso",
      });

    } catch (error: any) {
      console.error("Erro ao salvar perfil:", error);

      // Como último recurso, salva localmente
      toast({
        title: "Salvando Localmente",
        description: "Usando armazenamento local devido a limitações do servidor",
        variant: "default",
      });

      localStorage.setItem('userProfile', JSON.stringify({
        display_name: displayName,
        avatar_url: selectedAvatar,
        user_id: user.id,
        updated_at: new Date().toISOString()
      }));

      toast({
        title: "Perfil Salvo",
        description: "Suas preferências foram salvas no dispositivo",
      });

    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
        <div className="min-h-screen bg-gradient-sky flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl animate-chicken-walk mb-4">🐔</div>
            <p className="text-xl text-muted-foreground">Carregando perfil...</p>
          </div>
        </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
      <div className="min-h-screen bg-gradient-sky p-4">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4 text-transparent bg-gradient-sunrise bg-clip-text">
              Meu Perfil
            </h1>
            <p className="text-lg text-muted-foreground">
              Configure sua galinha como preferir
            </p>
          </div>

          <BarnCard variant="coop">
            <div className="space-y-6">
              {/* Avatar Preview */}
              <div className="text-center">
                <div className="mb-2 inline-block">
                  <ChickenAvatar emoji={selectedAvatar} size="xl" animated />
                </div>
                <p className="text-sm text-muted-foreground">Prévia do seu avatar</p>
              </div>

              {/* Display Name */}
              <div>
                <Label htmlFor="displayName">Nome de Exibição</Label>
                <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Seu nome no galinheiro"
                    className="mt-1"
                />
              </div>

              {/* Avatar Selection */}
              <div>
                <Label className="block mb-3">Escolha seu Avatar</Label>
                <div className="grid grid-cols-5 gap-2">
                  {chickenAvatars.map((avatarPath) => (
                      <ChickenAvatar
                          key={avatarPath}
                          emoji={avatarPath}
                          size="md"
                          animated
                          className={`cursor-pointer transition-all duration-200 ${
                      selectedAvatar === avatarPath
                        ? 'transform scale-110 ring-2 ring-primary'
                        : 'hover:scale-105 opacity-70'
                    }`}
                          onClick={() => setSelectedAvatar(avatarPath)}
                      />
                  ))}
                </div>
              </div>

              {/* Email (readonly) */}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                    id="email"
                    value={user.email || ""}
                    disabled
                    className="mt-1 bg-muted"
                />
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <ChickenButton
                    onClick={handleSave}
                    disabled={saving}
                    variant="corn"
                    size="lg"
                    className="w-full"
                >
                  {saving ? "Salvando..." : "Salvar Perfil"}
                </ChickenButton>

                <ChickenButton
                    onClick={() => navigate('/')}
                    variant="feather"
                    size="md"
                    className="w-full"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao Galinheiro
                </ChickenButton>
              </div>
            </div>
          </BarnCard>
        </div>
      </div>
  );
}