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
  const [avatarEmoji, setAvatarEmoji] = useState("🐔");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const chickenAvatars = ["🐔", "🐓", "🐣", "🐤", "🐥", "🏵️🐔", "👑🐓", "🌟🐥", "💎🐤", "🎵🐣"];

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }

    if (user) {
      // Carrega dados do perfil
      setDisplayName(user.user_metadata?.display_name || user.email || "");
      setAvatarEmoji(user.user_metadata?.avatar_emoji || "🐔");
      setAvatarUrl(user.user_metadata?.avatar_url || "");
    }
  }, [user, loading, navigate]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          display_name: displayName,
          avatar_emoji: avatarEmoji,
          avatar_url: avatarUrl
        }
      });

      if (error) throw error;

      toast({
        title: "🐔 Perfil Atualizado!",
        description: "Suas informações foram salvas com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "❌ Erro ao Salvar",
        description: error.message,
        variant: "destructive",
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
            🐔 Meu Perfil
          </h1>
          <p className="text-lg text-muted-foreground">
            Configure sua galinha como preferir
          </p>
        </div>

        <BarnCard variant="coop">
          <div className="space-y-6">
            {/* Avatar Preview */}
            <div className="text-center">
              <div className="mb-4">
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt="Avatar" 
                    className="h-20 w-20 rounded-full object-cover mx-auto"
                  />
                ) : (
                  <ChickenAvatar emoji={avatarEmoji} size="xl" animated />
                )}
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

            {/* Avatar Emoji Selection */}
            <div>
              <Label className="block mb-3">Avatar Emoji</Label>
              <div className="grid grid-cols-5 gap-2">
                {chickenAvatars.map((emoji) => (
                  <ChickenAvatar
                    key={emoji}
                    emoji={emoji}
                    size="md"
                    animated
                    className={`cursor-pointer transition-all duration-200 ${
                      avatarEmoji === emoji 
                        ? 'transform scale-110 ring-2 ring-primary' 
                        : 'hover:scale-105 opacity-70'
                    }`}
                    onClick={() => setAvatarEmoji(emoji)}
                  />
                ))}
              </div>
            </div>

            {/* Avatar URL */}
            <div>
              <Label htmlFor="avatarUrl">Avatar URL (opcional)</Label>
              <Input
                id="avatarUrl"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://exemplo.com/minha-foto.jpg"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Se preenchido, será usado no lugar do emoji
              </p>
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
                {saving ? "Salvando..." : "💾 Salvar Perfil"}
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