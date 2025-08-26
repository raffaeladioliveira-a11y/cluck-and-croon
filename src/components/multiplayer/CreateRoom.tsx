import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarnCard } from "@/components/BarnCard";
import { ChickenButton } from "@/components/ChickenButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateClientId, saveProfile } from "@/utils/clientId";

interface CreateRoomProps {
  playerName: string;
  selectedAvatar: string;
  onPlayerNameChange: (name: string) => void;
  onAvatarChange: (avatar: string) => void;
}

export function CreateRoom({
  playerName,
  selectedAvatar,
}: CreateRoomProps) {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      toast({
        title: "🐔 Ops!",
        description: "Você precisa dar um nome para sua galinha primeiro!",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const clientId = getOrCreateClientId();

      // Salva a identidade escolhida antes de criar a sala
      saveProfile({ displayName: playerName, avatar: selectedAvatar });

      // ✅ Use a RPC (não faça insert direto em game_rooms)
      const { data, error } = await supabase.rpc("create_room_with_host", {
        p_display_name: playerName,
        p_avatar: selectedAvatar,
        p_client_id: clientId,
      });

      // Log técnico pra depurar na Network/Console
      console.log("[create_room_with_host] data:", data, "error:", error);

      if (error) {
        const e: any = error;
        const tech =
          [e.code && `code: ${e.code}`, e.message && `msg: ${e.message}`, e.hint && `hint: ${e.hint}`, e.details && `details: ${e.details}`]
            .filter(Boolean)
            .join(" | ");

        console.error("[create_room_with_host] ERROR:", { code: e.code, message: e.message, hint: e.hint, details: e.details });

        toast({
          title: "❌ Erro ao criar o galinheiro",
          description: tech || "Não foi possível criar o galinheiro. Veja o console/Network para detalhes.",
          variant: "destructive",
        });
        return;
      }

      const newRoomCode = typeof data === "string" ? data.trim().toUpperCase() : "";

      if (!/^[A-Z0-9]{6}$/.test(newRoomCode)) {
        console.error("[create_room_with_host] retorno inválido:", data);
        toast({
          title: "❌ Erro",
          description: "A RPC não retornou um código de 6 caracteres (A-Z/0-9).",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "🏠 Galinheiro Criado!",
        description: `Código: ${newRoomCode}. Redirecionando...`,
      });

      // ✅ navega somente com code válido
      navigate(`/lobby/${newRoomCode}`);
    } catch (err: any) {
      console.error("[create_room_with_host] EXCEPTION:", err);
      toast({
        title: "❌ Erro inesperado",
        description: err?.message || String(err),
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <BarnCard variant="coop" animated className="group">
      <div className="text-center">
        <div className="text-6xl mb-4 group-hover:animate-chicken-walk">🏠</div>
        <h3 className="text-2xl font-bold mb-4 text-barn-brown">Criar Galinheiro</h3>
        <p className="text-muted-foreground mb-6">
          Seja o fazendeiro e crie um novo galinheiro para seus amigos se juntarem!
        </p>

        {/* (Opcional) Campos extras aqui se quiser editar nome/avatar neste card */}
        {/* <Label className="block mb-2">Nome</Label>
        <Input value={playerName} onChange={(e)=>onPlayerNameChange(e.target.value)} /> */}

        <ChickenButton
          variant="barn"
          size="lg"
          className="w-full group"
          chickenStyle="bounce"
          onClick={handleCreateRoom}
          disabled={isCreating}
        >
          {isCreating ? "🔄 Criando..." : "🏠 Criar Novo Galinheiro"}
        </ChickenButton>
      </div>
    </BarnCard>
  );
}
