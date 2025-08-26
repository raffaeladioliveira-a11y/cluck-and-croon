import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

export default function Profile() {
  const { user } = useAuthSession();
  const meta = (user?.user_metadata ?? {}) as Record<string, any>;
  const [displayName, setDisplayName] = useState<string>(meta.display_name || "");
  const [avatarEmoji, setAvatarEmoji] = useState<string>(meta.avatar_emoji || "🐔");
  const [avatarUrl, setAvatarUrl] = useState<string>(meta.avatar_url || "");

  if (!user) {
    return <div className="p-6">Faça login para ver seu perfil.</div>;
  }

  const handleSave = async () => {
    const { error } = await supabase.auth.updateUser({
      data: { display_name: displayName, avatar_emoji: avatarEmoji, avatar_url: avatarUrl },
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Perfil atualizado", description: "Suas informações foram salvas." });
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Meu perfil</h1>

      <label className="space-y-1 block">
        <span className="text-sm text-muted-foreground">Nome para exibição</span>
        <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Seu nome" />
      </label>

      <label className="space-y-1 block">
        <span className="text-sm text-muted-foreground">Avatar (emoji)</span>
        <Input value={avatarEmoji} onChange={e => setAvatarEmoji(e.target.value)} placeholder="🐔" />
      </label>

      <label className="space-y-1 block">
        <span className="text-sm text-muted-foreground">Avatar (URL opcional)</span>
        <Input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." />
      </label>

      <Button onClick={handleSave}>Salvar</Button>
    </div>
  );
}