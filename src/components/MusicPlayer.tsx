import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Volume2, VolumeX, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { GameState } from "@/hooks/useGameLogic";

interface MusicPlayerProps {
  songTitle: string;
  artist: string;
  audioUrl?: string;
  duration?: number;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
  autoPlay?: boolean;
  muted?: boolean;
  gameState?: GameState;
  roundKey?: string;
  className?: string;
  gameMode?: "mp3" | "spotify";
  spotifyTrackId?: string;
}

export const MusicPlayer = ({
    songTitle,
    artist,
    audioUrl,
    duration = 15,
    onTimeUpdate,
    onEnded,
    autoPlay = false,
    muted = false,
    gameState = "idle",
    roundKey = "",
    className,
    gameMode = "mp3",
    spotifyTrackId,
}: MusicPlayerProps) => {
  console.log('🎵 MusicPlayer props:', { gameMode, spotifyTrackId, gameState, songTitle, artist });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);
  const stopTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // NOVO: Função para liberar autoplay de uma vez
  const unlockAudio = async () => {
    const audio = audioRef.current;
    if (!audio || audioUnlocked) return;

    try {
      // Tentar reproduzir um som silencioso
      audio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IAAAAAEAAQAAQBoAAEAaAAABAAgAZGF0YQAAAAA=";
      audio.volume = 0;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;

      setAudioUnlocked(true);
      console.log('✅ Audio unlocked successfully');
    } catch (error) {
      console.log('⚠️ Audio unlock failed:', error);
    }
  };

  const teardownAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
    setAudioError(false);

    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }

    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  };

  const startSpotifyCountdown = () => {
    console.log('🕒 Starting Spotify countdown for', duration, 'seconds');
    setCurrentTime(0);
    setIsPlaying(true);

    let timeLeft = duration;
    const updateCountdown = () => {
      timeLeft -= 1;
      const elapsed = duration - timeLeft;
      setCurrentTime(elapsed);
      onTimeUpdate?.(elapsed);

      if (timeLeft <= 0) {
        console.log('🕒 Spotify countdown finished');
        setIsPlaying(false);
        setCurrentTime(duration);
        onEnded?.();
        return;
      }

      countdownTimerRef.current = setTimeout(updateCountdown, 1000);
    };

    countdownTimerRef.current = setTimeout(updateCountdown, 1000);
    stopTimerRef.current = setTimeout(() => {
      console.log('🕒 Spotify main timer finished');
      teardownAudio();
    }, duration * 1000);
  };

  const setupAndPlayAudio = async (audioSrc: string, shouldAutoPlay: boolean) => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    teardownAudio();
    audio.src = audioSrc;
    audio.currentTime = 0;
    audio.volume = isMuted ? 0 : volume;

    console.log('🔊 Volume settings:', { volume, isMuted, finalVolume: audio.volume });
    console.log('🎵 Audio source:', audioSrc);

    try {
      audio.load();

      if (shouldAutoPlay) {
        // MODIFICADO: Tentar autoplay, se falhar, não dar erro
        try {
          await audio.play();
          setIsPlaying(true);
          console.log('🎵 Audio playing automatically');
        } catch (playError) {
          console.log('⚠️ Autoplay failed, requires user interaction');
          setAudioError(false); // Não tratar como erro
        }

        const durationMs = duration * 1000;
        stopTimerRef.current = setTimeout(() => {
          teardownAudio();
        }, durationMs);
      }
    } catch (error) {
      console.error("🎵 Audio setup error:", error);
      setAudioError(true);
    }
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    // NOVO: Unlock audio na primeira interação
    if (!audioUnlocked) {
      await unlockAudio();
    }

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        await audio.play();
        setIsPlaying(true);
        setAudioError(false);
      }
    } catch (err) {
      console.error('Play error:', err);
      setAudioError(true);
    }
  };

  // Adicione esta função antes dos useEffect existentes:
  const unlockAudioAutomatically = async () => {
    if (audioUnlocked) return;

    try {
      // Para MP3, usar o elemento audio
      if (gameMode === "mp3" && audioRef.current) {
        const audio = audioRef.current;
        audio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IAAAAAEAAQAAQBoAAEAaAAABAAgAZGF0YQAAAAA=";
        audio.volume = 0;
        await audio.play();
        audio.pause();
      }

      setAudioUnlocked(true);
      console.log('✅ Audio unlocked automatically');
    } catch (error) {
      console.log('⚠️ Auto unlock failed:', error);
    }
  };

  // Effect principal para mudanças de estado
  useEffect(() => {
    console.log('🔄 Game state changed:', { gameState, gameMode, roundKey, audioUnlocked });

    if (gameState === "playing") {
      if (!audioUnlocked) {
        unlockAudioAutomatically();
      }
      if (gameMode === "mp3" && audioUrl) {
        console.log('🎵 Setting up MP3 audio');
        setupAndPlayAudio(audioUrl, autoPlay && audioUnlocked);
      } else if (gameMode === "spotify" && spotifyTrackId) {
        console.log('🎵 Starting Spotify mode with trackId:', spotifyTrackId);
        startSpotifyCountdown();
      }
    } else if (gameState !== "playing" && isPlaying) {
      console.log('🛑 Stopping audio due to game state change');
      teardownAudio();
    }
  }, [roundKey, gameState, audioUrl, autoPlay, gameMode, spotifyTrackId, audioUnlocked]);

  // Adicione este useEffect específico para Spotify:
  useEffect(() => {
    // No modo Spotify, não precisamos de unlock de áudio tradicional
    if (gameMode === "spotify" && gameState === "playing") {
      setAudioUnlocked(true);
    }
  }, [gameMode, gameState]);

  // Effect para eventos de áudio (apenas MP3)
  useEffect(() => {
    if (gameMode !== "mp3") return;
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const time = audio.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      onEnded?.();
    };
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [onTimeUpdate, onEnded, gameMode]);

  useEffect(() => {
    return () => {
      teardownAudio();
    };
  }, []);

  // ADICIONE ESTE NOVO useEffect AQUI:
  useEffect(() => {
    const handleUnlockAudio = () => {
      unlockAudio();
    };

    window.addEventListener('unlockAudio', handleUnlockAudio);
    return () => window.removeEventListener('unlockAudio', handleUnlockAudio);
  }, []);

  const progress = (currentTime / duration) * 100;

  return (
      <div className={cn("bg-white/10 rounded-lg p-3 sm:p-4 shadow-lg", className)} key={roundKey}>
        {/* Debug info - remover em produção */}
        {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-white/50 mb-2">
              Debug: {gameMode} | {gameState} | audioUnlocked: {audioUnlocked ? 'yes' : 'no'}
            </div>
        )}

        {/* MP3: elemento de áudio sempre presente */}
        {gameMode === "mp3" && (
            <audio
                ref={audioRef}
                preload="metadata"
                crossOrigin="anonymous"
                onClick={unlockAudio} // Unlock quando clicado
            />
        )}

        {/* SPOTIFY: iframe visível apenas quando tocando */}
        {gameMode === "spotify" && spotifyTrackId && gameState === "playing" && (
            <div className="w-full mb-3">
              <iframe
                  src={`https://open.spotify.com/embed/track/${spotifyTrackId}?utm_source=generator&theme=0`}
                  width="100%"
                  height="152"
                  frameBorder="0"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  style={{ borderRadius: '8px' }}
                  title={`Spotify player for ${songTitle}`}
              />
            </div>
        )}

        {/* Estado inicial */}
        {gameState === "idle" && (
            <div className="text-center py-2">
              <p className="text-white/80 text-sm sm:text-base">
                {!audioUnlocked ? (
                    <button
                        onClick={unlockAudio}
                        className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
                    >
                      🔊 Clique para liberar o som
                    </button>
                ) : (
                    <>Clique em "Iniciar Jogo" para começar! {gameMode === "spotify" && " (Modo Spotify)"}</>
                )}
              </p>
            </div>
        )}

        {/* Tocando - controles e barra */}
        {gameState === "playing" && (
            <div className="space-y-3">
              {/* Linha superior: controles + tempo */}
              <div className="flex items-center justify-between">
                {/* Controles MP3 */}
                {gameMode === "mp3" && (
                    <div className="flex items-center gap-2">
                      <Button
                          onClick={togglePlay}
                          size="sm"
                          className="bg-white/20 border-white/30 text-white h-8 w-8 p-0"
                      >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button
                          variant="outline"
                          size="sm"
                          className="bg-white/20 border-white/30 text-white h-8 w-8 p-0"
                          onClick={() => setIsMuted((m) => !m)}
                      >
                        {isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                      </Button>

                      {/* NOVO: Indicador de status do autoplay */}
                      {!audioUnlocked && (
                          <div className="text-xs text-red-400 ml-2">
                            Clique ▶ para ativar
                          </div>
                      )}
                    </div>
                )}

                {/* Indicador Spotify */}
                {gameMode === "spotify" && (
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">♫</span>
                      </div>
                      <span className="text-white/80 text-xs font-medium">Spotify</span>
                    </div>
                )}

                {/* Tempo */}
                <div className="text-white/90 font-medium text-sm">
                  {Math.ceil(currentTime)}s / {duration}s
                </div>
              </div>

              {/* Barra de progresso */}
              <div className="w-full">
                <Progress
                    value={progress}
                    className="h-2 bg-white/20"
                />
              </div>

              {/* Info da música */}
              {/*<div className="text-center">*/}
                {/*<p className="text-white/70 text-xs truncate">*/}
                  {/*{songTitle} - {artist}*/}
                {/*</p>*/}
              {/*</div>*/}
            </div>
        )}

        {/* Estados de resultado */}
        {(gameState === "reveal" || gameState === "transition") && (
            <div className="text-center py-2">
              <p className="text-white/80 text-sm">Aguarde a próxima música...</p>
            </div>
        )}
      </div>
  );
};