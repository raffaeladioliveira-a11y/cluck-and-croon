import { Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarnCard } from "@/components/BarnCard";
import { ChickenButton } from "@/components/ChickenButton";
import { toast } from "@/hooks/use-toast";

interface RoomCodeProps {
  roomCode: string;
}

export function RoomCode({ roomCode }: RoomCodeProps) {
  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      toast({
        title: "🐔 Código Copiado!",
        description: "O código do galinheiro foi copiado para a área de transferência",
      });
    } catch (err) {
      toast({
        title: "❌ Ops!",
        description: "Não foi possível copiar o código",
        variant: "destructive",
      });
    }
  };

  const shareRoomLink = async () => {
    const link = `${window.location.origin}/lobby/${roomCode}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: '🐔 Galinheiro Musical',
          text: `Venha cantar comigo no Galinheiro Musical!`,
          url: link
        });
      } else {
        await navigator.clipboard.writeText(link);
        toast({
          title: "🔗 Link Copiado!",
          description: "O link do galinheiro foi copiado para a área de transferência",
        });
      }
    } catch (err) {
      toast({
        title: "❌ Ops!",
        description: "Não foi possível compartilhar o link",
        variant: "destructive",
      });
    }
  };

  return (
    <BarnCard variant="golden" className="mb-8">
      <div className="text-center">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="text-6xl animate-chicken-walk">🏠</div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Código do Galinheiro</h2>
            <div className="flex items-center gap-2 justify-center">
              <span className="text-4xl font-bold font-mono tracking-wider text-white bg-white/20 px-4 py-2 rounded-lg">
                {roomCode}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={copyRoomCode}
                className="bg-white/20 border-white/30 hover:bg-white/30 text-white h-12 w-12"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-4">
          <ChickenButton variant="feather" size="lg" onClick={copyRoomCode}>
            <Copy className="w-5 h-5 mr-2" />
            Copiar Código
          </ChickenButton>
          
          <ChickenButton variant="corn" size="lg" onClick={shareRoomLink}>
            <Share2 className="w-5 h-5 mr-2" />
            Compartilhar Link
          </ChickenButton>
        </div>

        <p className="text-white/80 text-sm mt-4">
          Compartilhe este código com seus amigos para eles entrarem no galinheiro!
        </p>
      </div>
    </BarnCard>
  );
}