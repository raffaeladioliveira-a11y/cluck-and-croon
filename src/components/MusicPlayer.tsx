import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Volume2, VolumeX, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { GameState } from "@/hooks/useGameLogic";

interface MusicPlayerProps {
  songTitle: string;
  artist: string;
  audioUrl?: string; // MP3 ou Spotify embed url
  duration?: number;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
  autoPlay?: boolean;
  muted?: boolean;
  gameState?: GameState;
  roundKey?: string;
  className?: string;

  /** NOVO: modo do jogo */
  gameMode?: "mp3" | "spotify";
  /** NOVO: id da track Spotify (se gameMode=spotify) */
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const stopTimerRef = useRef<NodeJS.Timeout | null>(null);

  const teardownAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    audio.removeAttribute("src");
    audio.load();
    setIsPlaying(false);
    setCurrentTime(0);
    setAudioError(false);

    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  };

  const setupAndPlayAudio = async (audioSrc: string, shouldAutoPlay: boolean) => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    teardownAudio();
    audio.src = audioSrc;
    audio.currentTime = 0;
    audio.volume = isMuted ? 0 : volume;

    try {
      audio.load();
      if (shouldAutoPlay) {
        await audio.play();
        setIsPlaying(true);

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
    if (!audio || audioError) return;
    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        await audio.play();
        setIsPlaying(true);
      }
    } catch (err) {
      setAudioError(true);
    }
  };

  useEffect(() => {
    if (gameMode !== "mp3") return;
    const audio = audioRef.current;
    if (!audio) return;

    if (gameState === "playing" && audioUrl) {
      setupAndPlayAudio(audioUrl, autoPlay || false);
    } else if (gameState !== "playing" && isPlaying) {
      teardownAudio();
    }
  }, [roundKey, gameState, audioUrl, autoPlay, gameMode]);

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

  const progress = (currentTime / duration) * 100;

  return (
      <div className={cn("bg-white/10 rounded-lg p-3 sm:p-4 shadow-lg", className)} key={roundKey}>
        {/* MP3: usa <audio> */}
        {gameMode === "mp3" && (
            <audio ref={audioRef} preload="metadata" crossOrigin="anonymous" />
        )}

        {/* SPOTIFY: usa embed - escondido mas funcional */}
        {gameMode === "spotify" && spotifyTrackId && gameState === "playing" && (
            <div className="hidden">
              <iframe
                  src={`https://open.spotify.com/embed/track/${spotifyTrackId}?utm_source=generator&theme=0`}
                  width="100%"
                  height="80"
                  frameBorder="0"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  allowFullScreen
              ></iframe>
            </div>
        )}

        {/* Estado inicial - compacto */}
        {gameState === "idle" && (
            <div className="text-center py-2">
              <p className="text-white/80 text-sm sm:text-base">Clique em "Iniciar Jogo" para começar!</p>
            </div>
        )}

        {/* Tocando - apenas controles e barra */}
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
                    </div>
                )}

                {/* Placeholder para Spotify */}
                {gameMode === "spotify" && (
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">♪</span>
                      </div>
                      <span className="text-white/80 text-xs">Spotify</span>
                    </div>
                )}

                {/* Tempo */}
                <div className="text-white/90 font-medium text-sm">
                  {gameMode === "mp3" ? (
                      `${currentTime.toFixed(0)}s / ${duration}s`
                  ) : (
                      `${duration}s`
                  )}
                </div>
              </div>

              {/* Barra de progresso */}
              <div className="w-full">
                <Progress
                    value={gameMode === "mp3" ? progress : ((duration - currentTime) / duration) * 100}
                    className="h-2 bg-white/20"
                />
              </div>

              {/* Info da música - apenas para Spotify e bem pequena */}
              {gameMode === "spotify" && (
                  <div className="text-center">
                    <p className="text-white/70 text-xs truncate">{songTitle} - {artist}</p>
                  </div>
              )}
            </div>
        )}

        {/* Estados de resultado - mantém compacto */}
        {(gameState === "reveal" || gameState === "transition") && (
            <div className="text-center py-2">
              <p className="text-white/80 text-sm">Aguarde a próxima música...</p>
            </div>
        )}
      </div>
  );
};