import { useEffect, useRef, useState } from "react";
import { BarnCard } from "@/components/BarnCard";
import { ChickenAvatar } from "@/components/ChickenAvatar";
import { ChickenButton } from "@/components/ChickenButton";
import { Users } from "lucide-react";
import { loadProfile } from "@/utils/clientId";
import { useAuthSession } from "@/hooks/useAuthSession";
import { getOrCreateClientId } from "@/utils/clientId";
import { HostAlbumSelector } from "@/components/HostAlbumSelector";
import { HostMp3AlbumSelector } from "@/components/HostMp3AlbumSelector";
import { supabase } from "@/integrations/supabase/client";

interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  isReady: boolean;
  eggs?: number;
  client_id?: string;
}

interface PlayerListProps {
  players: Player[];
  currentClientId: string;
  onToggleReady?: () => void;
  roomCode: string;
  gameMode?: "mp3" | "spotify";
  selectedSpotifyAlbumId?: string | null;
  selectedMp3AlbumId?: string | null;
  roomStatus?: string;
  showAlbumSelectorForHost?: boolean;
  selectedGenre?: string | null;
}

/** Lê o game_mode da tabela key/value (key='game_mode') */
async function fetchGameModeKV(): Promise<"mp3" | "spotify"> {
  const { data, error } = await supabase
      .from("game_settings")
      .select("value")
      .eq("key", "game_mode")
      .maybeSingle();

  if (error) {
    console.warn("[PlayerList] game_mode read error:", error);
    return "mp3";
  }

  let raw = data?.value as any;
  let parsed: any = raw;

  try {
    if (typeof raw === "string" && /^".*"$/.test(raw)) {
      parsed = JSON.parse(raw);
    }
  } catch {
      /* ignore */
  }

  const mode = (parsed ?? raw ?? "").toString().toLowerCase();
  return mode === "spotify" ? "spotify" : "mp3";
}

/** Busca status, selected_spotify_album_id e selected_mp3_album_id da sala pela roomCode */
async function fetchRoomBasics(roomCode: string) {
  const { data, error } = await supabase
      .from("game_rooms")
      .select("status, selected_spotify_album_id, selected_mp3_album_id, winner_profile_id")
      .eq("room_code", roomCode)
      .maybeSingle();

  return {
    status: data?.status,
      selectedSpotify: data?.selected_spotify_album_id ?? null,
      selectedMp3: data?.selected_mp3_album_id ?? null,
      winnerId: data?.winner_profile_id ?? null,
};
}

export function PlayerList({
    players,
    currentClientId,
    onToggleReady,
    roomCode,
    gameMode: gameModeProp,
    selectedSpotifyAlbumId: selectedSpotifyFromProp,
    selectedMp3AlbumId: selectedMp3FromProp,
    roomStatus: roomStatusProp,
    showAlbumSelectorForHost = true,
}: PlayerListProps) {

  console.log("PlayerList - roomCode recebido:", roomCode);
  console.log("PlayerList - tipo:", typeof roomCode);
  const currentPlayer = players.find((p) => p.client_id === currentClientId);
  const isCurrentPlayerHost = currentPlayer?.isHost || false;
  const isCurrentPlayerReady = currentPlayer?.isReady || false;

  console.log("DEBUG currentPlayer:", currentPlayer);
  console.log("DEBUG isCurrentPlayerHost:", isCurrentPlayerHost);

  const { user } = useAuthSession();
  const clientId = useRef(getOrCreateClientId());
  const avatarUrl = (user?.user_metadata?.avatar_url as string) || "";

  // estados locais que garantem funcionamento mesmo sem props do pai
  const [gameMode, setGameMode] = useState<"mp3" | "spotify">(gameModeProp ?? "mp3");
  const [roomStatus, setRoomStatus] = useState<string | undefined>(roomStatusProp);
  const [selectedSpotifyAlbumId, setSelectedSpotifyAlbumId] = useState<string | null | undefined>(
      selectedSpotifyFromProp
  );
  const [selectedMp3AlbumId, setSelectedMp3AlbumId] = useState<string | null | undefined>(
      selectedMp3FromProp
  );

  // Se o pai NÃO passou gameMode/status/selected, buscamos no Supabase
  useEffect(() => {
    let mounted = true;

    (async () => {
      // gameMode: se não veio do pai, ler do KV
      if (!gameModeProp) {
        const mode = await fetchGameModeKV();
        if (mounted) setGameMode(mode);
      } else {
        setGameMode(gameModeProp);
      }

      // status/albums: se não vieram do pai, buscar da sala
      if (roomStatusProp === undefined || selectedSpotifyFromProp === undefined || selectedMp3FromProp === undefined) {
        const { status, selectedSpotify, selectedMp3 } = await fetchRoomBasics(roomCode);
        if (mounted) {
          if (roomStatusProp === undefined) setRoomStatus(status);
          if (selectedSpotifyFromProp === undefined) setSelectedSpotifyAlbumId(selectedSpotify);
          if (selectedMp3FromProp === undefined) setSelectedMp3AlbumId(selectedMp3);
        }
      } else {
        setRoomStatus(roomStatusProp);
        setSelectedSpotifyAlbumId(selectedSpotifyFromProp);
        setSelectedMp3AlbumId(selectedMp3FromProp);
      }
    })();

    // realtime leve: ouvir mudanças básicas da sala (status/albums)
    const ch = supabase
        .channel(`playerlist-room:${roomCode}`)
        .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "game_rooms", filter: `room_code=eq.${roomCode}` },
            (payload) => {
              const r: any = payload.new;
              if (roomStatusProp === undefined) setRoomStatus(r?.status);
              if (selectedSpotifyFromProp === undefined) setSelectedSpotifyAlbumId(r?.selected_spotify_album_id ?? null);
              if (selectedMp3FromProp === undefined) setSelectedMp3AlbumId(r?.selected_mp3_album_id ?? null);
            }
        )
        .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, gameModeProp, roomStatusProp, selectedSpotifyFromProp, selectedMp3FromProp]);

  if (players.length === 0) {
    return (
        <BarnCard variant="nest" className="text-center">
          <div className="text-4xl sm:text-6xl mb-4 animate-chicken-walk">🐔</div>
          <h3 className="text-lg sm:text-xl font-semibold mb-2">Aguardando Galinhas...</h3>
          <p className="text-sm sm:text-base text-muted-foreground px-2">
            Compartilhe o código para que outros jogadores se juntem!
          </p>
        </BarnCard>
    );
  }

  // Lógica para mostrar seletor de álbum Spotify
  const shouldShowSpotifyAlbumSelector =
      showAlbumSelectorForHost &&
      isCurrentPlayerHost &&
      gameMode === "spotify" &&
      !selectedSpotifyAlbumId &&
      (roomStatus ? ["lobby", "album_selection"].includes(roomStatus) : true);

  // Lógica para mostrar seletor de álbum MP3
  const shouldShowMp3AlbumSelector =
      showAlbumSelectorForHost &&
      isCurrentPlayerHost &&
      gameMode === "mp3" &&
      !selectedMp3AlbumId &&
      (roomStatus ? ["lobby", "album_selection"].includes(roomStatus) : true);

  console.log("shouldShowSpotifyAlbumSelector:", shouldShowSpotifyAlbumSelector);
  console.log("shouldShowMp3AlbumSelector:", shouldShowMp3AlbumSelector);

  return (
      <BarnCard variant="coop" className="mb-4 sm:mb-8 bg-glass">
        <div className="px-2 sm:px-4">
          {/* Header com título responsivo */}
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-barn-brown flex-shrink-0" />
            <h3 className="text-lg sm:text-2xl font-bold text-barn-brown leading-tight">
              <span className="block sm:hidden">Galinhas ({players.length})</span>
              <span className="hidden sm:block">Galinhas no Galinheiro ({players.length})</span>
            </h3>
          </div>

          {/* Grid de jogadores - responsivo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {players.map((player) => {
              const isCurrentPlayer = player.client_id === currentClientId;

              return (
                  <div key={player.id}>
                    <div
                        className={`p-3 sm:p-4 rounded-lg transition-all ${
                    player.isHost
                      ? "bg-gradient-sunrise border-2 border-yellow-400"
                      : "bg-barn-wood/20"
                  }`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        {/* Avatar responsivo */}
                        <div className="flex-shrink-0">
                          {user && player.client_id === clientId.current ? (
                              avatarUrl ? (
                                  <img
                                      src={avatarUrl}
                                      alt="Seu Avatar"
                                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-white"
                                  />
                              ) : player.avatar?.startsWith("/") ? (
                              <img
                                  src={player.avatar}
                                  alt="Seu Avatar"
                                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-white"
                              />
                          ) : (
                              <ChickenAvatar emoji={player.avatar} size="sm" className="border-2 border-white" />
                          )
                          ) : player.avatar?.startsWith("/") ? (
                          <img
                              src={player.avatar}
                              alt={player.name}
                              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-white"
                          />
                          ) : (
                          <ChickenAvatar emoji={player.avatar} size="sm" className="border-2 border-white" />
                          )}
                        </div>

                        {/* Info do jogador */}
                        <div className="flex-grow min-w-0">
                          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                            <span className="font-medium text-base sm:text-lg truncate max-w-[120px] sm:max-w-none">
                              {player.name}
                            </span>

                            {/* Badges responsivas */}
                            {player.isHost && (
                                <span className="text-xs sm:text-sm px-1.5 sm:px-2 py-0.5 sm:py-1 bg-yellow-400 text-yellow-900 rounded-full font-bold whitespace-nowrap">
                              <span className="sm:hidden">👑</span>
                              <span className="hidden sm:inline">👑 HOST</span>
                            </span>
                            )}

                            {!player.isHost && (
                                <span
                                    className={`text-xs sm:text-sm px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-bold whitespace-nowrap ${
                              player.isReady ? "bg-green-400 text-green-900" : "bg-orange-400 text-orange-900"
                            }`}
                                >
                              <span className="sm:hidden">
                                {player.isReady ? "✅" : "⏳"}
                              </span>
                              <span className="hidden sm:inline">
                                {player.isReady ? "✅ PRONTA" : "⏳ AGUARDANDO"}
                              </span>
                            </span>
                            )}

                            {isCurrentPlayer && (
                                <span className="text-primary font-bold text-xs sm:text-sm whitespace-nowrap">
                                VOCÊ
                              </span>
                            )}
                          </div>

                          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                            {player.eggs || 0} 🥚 ovos
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
              );
            })}
          </div>

          {/* Botão Ready para não-hosts - responsivo */}
          {!isCurrentPlayerHost && onToggleReady && (
              <div className="mt-4 sm:mt-6 text-center">
                <ChickenButton
                    variant={isCurrentPlayerReady ? "feather" : "corn"}
                    size="md"
                    onClick={onToggleReady}
                    className="w-full sm:w-auto sm:min-w-[200px] px-4 py-3 text-sm sm:text-base"
                >
                  <span className="sm:hidden">
                    {isCurrentPlayerReady ? "⏳ Não Pronta" : "✅ Pronta"}
                  </span>
                  <span className="hidden sm:inline">
                    {isCurrentPlayerReady ? "⏳ Marcar como Não Pronta" : "✅ Marcar como Pronta"}
                  </span>
                </ChickenButton>
              </div>
          )}

          {/* Info sobre limite de jogadores */}
          {players.length < 10 && (
              <div className="mt-4 sm:mt-6 text-center p-3 sm:p-4 bg-white/30 rounded-lg">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  <span className="sm:hidden">💡 Até 10 galinhas!</span>
                  <span className="hidden sm:inline">💡 Podem participar até 10 galinhas neste galinheiro!</span>
                </p>
              </div>
          )}

          {/* SELETOR DE ÁLBUM PARA HOST - SPOTIFY */}
          {shouldShowSpotifyAlbumSelector && (
              <div className="mt-6 sm:mt-8">
                <HostAlbumSelector roomCode={roomCode} />
              </div>
          )}

          {/* SELETOR DE ÁLBUM PARA HOST - MP3 */}
          {shouldShowMp3AlbumSelector && (
              <div className="mt-6 sm:mt-8">
                <HostMp3AlbumSelector roomCode={roomCode} />
              </div>
          )}
        </div>
      </BarnCard>
  );
}