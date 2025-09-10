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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);
  const stopTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const unlockAudio = async () => {
    const audio = audioRef.current;
    if (!audio || audioUnlocked) return;

    try {
      audio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IAAAAAEAAQAAQBoAAEAaAAABAAgAZGF0YQAAAAA=";
      audio.volume = 0;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      setAudioUnlocked(true);
    } catch (error) {
      // Silent fail
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
    setCurrentTime(0);
    setIsPlaying(true);

    let timeLeft = duration;
    const updateCountdown = () => {
      timeLeft -= 1;
      const elapsed = duration - timeLeft;
      setCurrentTime(elapsed);
      onTimeUpdate?.(elapsed);

      if (timeLeft <= 0) {
        setIsPlaying(false);
        setCurrentTime(duration);
        onEnded?.();
        return;
      }

      countdownTimerRef.current = setTimeout(updateCountdown, 1000);
    };

    countdownTimerRef.current = setTimeout(updateCountdown, 1000);
    stopTimerRef.current = setTimeout(() => {
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

    try {
      audio.load();

      if (shouldAutoPlay) {
        try {
          await audio.play();
          setIsPlaying(true);
        } catch (playError) {
          setAudioError(false);
        }

        const durationMs = duration * 1000;
        stopTimerRef.current = setTimeout(() => {
          teardownAudio();
        }, durationMs);
      }
    } catch (error) {
      setAudioError(true);
    }
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

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
      setAudioError(true);
    }
  };

  const unlockAudioAutomatically = async () => {
    if (audioUnlocked) return;

    try {
      if (gameMode === "mp3" && audioRef.current) {
        const audio = audioRef.current;
        audio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IAAAAAEAAQAAQBoAAEAaAAABAAgAZGF0YQAAAAA=";
        audio.volume = 0;
        await audio.play();
        audio.pause();
      }

      setAudioUnlocked(true);
    } catch (error) {
      // Silent fail
    }
  };

  useEffect(() => {
    if (gameState === "playing") {
      if (!audioUnlocked) {
        unlockAudioAutomatically();
      }
      if (gameMode === "mp3" && audioUrl) {
        setupAndPlayAudio(audioUrl, autoPlay && audioUnlocked);
      } else if (gameMode === "spotify" && spotifyTrackId) {
        startSpotifyCountdown();
      }
    } else if (gameState !== "playing" && isPlaying) {
      teardownAudio();
    }
  }, [roundKey, gameState, audioUrl, autoPlay, gameMode, spotifyTrackId, audioUnlocked]);

  useEffect(() => {
    if (gameMode === "spotify" && gameState === "playing") {
      setAudioUnlocked(true);
    }
  }, [gameMode, gameState]);

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

  useEffect(() => {
    const handleUnlockAudio = () => {
      unlockAudio();
    };

    window.addEventListener('unlockAudio', handleUnlockAudio);
    return () => window.removeEventListener('unlockAudio', handleUnlockAudio);
  }, []);

  const progress = (currentTime / duration) * 100;

  return (
      <div className={cn("relative overflow-hidden", className)}>
        {/* Background com gradiente moderno */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-blue-800/20 to-indigo-900/30 backdrop-blur-sm" />
        <div className="absolute inset-0 bg-black/10" />

        {/* Conteúdo */}
        <div className="relative z-10 p-4 sm:p-6">
          {/* MP3: elemento de áudio sempre presente */}
          {gameMode === "mp3" && (
              <audio
                  ref={audioRef}
                  preload="metadata"
                  crossOrigin="anonymous"
                  onClick={unlockAudio}
              />
          )}

          {/* SPOTIFY: iframe com estilo melhorado */}
          {gameMode === "spotify" && spotifyTrackId && gameState === "playing" && (
              <div className="w-full mb-4 rounded-xl overflow-hidden shadow-lg">
                <iframe
                    src={`https://open.spotify.com/embed/track/${spotifyTrackId}?utm_source=generator&theme=0`}
                    width="100%"
                    height="152"
                    frameBorder="0"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    title={`Spotify player for ${songTitle}`}
                />
              </div>
          )}

          {/* Estado inicial */}
          {gameState === "idle" && (
              <div className="text-center py-8">
                <div className="mb-4">
                  <div className="w-16 h-16 mx-auto bg-white/10 rounded-full flex items-center justify-center mb-3">
                    <Play className="w-8 h-8 text-white/70" />
                  </div>
                </div>
                <p className="text-white/80 text-sm sm:text-base">
                  {!audioUnlocked ? (
                      <button
                          onClick={unlockAudio}
                          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 px-6 py-3 rounded-full transition-all duration-300 transform hover:scale-105 shadow-lg"
                      >
                        🔊 Clique para liberar o som
                      </button>
                  ) : (
                      <span className="text-white/60">
                  Aguardando início do jogo...
                        {gameMode === "spotify" && (
                            <span className="block text-xs mt-1 text-green-400">Modo Spotify Ativo</span>
                        )}
                </span>
                  )}
                </p>
              </div>
          )}

          {/* Tocando - layout moderno */}
          {gameState === "playing" && (
              <div className="space-y-4">
                {/* Header com título da música */}
                {/*<div className="text-center">*/}
                  {/*<h3 className="text-lg sm:text-xl font-bold text-white mb-1">*/}
                    {/*GUESS THE SONG!*/}
                  {/*</h3>*/}
                  {/*<p className="text-white/60 text-sm">*/}
                    {/*{songTitle && artist ? `${songTitle} - ${artist}` : "Descubra qual é a música"}*/}
                  {/*</p>*/}
                {/*</div>*/}

                {/* Controles principais */}
                <div className="flex items-center justify-between">
                  {/* Controles MP3 */}
                  {gameMode === "mp3" && (
                      <div className="flex items-center gap-2">
                        <Button
                            onClick={togglePlay}
                            size="sm"
                            className="bg-white/20 hover:bg-white/30 border-white/30 text-white h-8 w-8 p-0 rounded-full transition-all duration-300 hover:scale-110 shadow-lg"
                        >
                          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-white/10 hover:bg-white/20 border-white/20 text-white h-8 w-8 p-0 rounded-full"
                            onClick={() => setIsMuted((m) => !m)}
                        >
                          {isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                        </Button>

                        {!audioUnlocked && (
                            <div className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded-full">
                              Clique ▶ para ativar
                            </div>
                        )}
                      </div>
                  )}

                  {/* Indicador Spotify melhorado */}
                  {gameMode === "spotify" && (
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg">
                          <span className="text-white text-lg font-bold">♫</span>
                        </div>
                        <div>
                          <span className="text-white font-medium text-sm">Spotify Mode</span>
                          <div className="text-green-400 text-xs">Reproduzindo via Spotify</div>
                        </div>
                      </div>
                  )}

                  {/* Timer moderno */}
                  {/*<div className="text-right">*/}
                    {/*<div className="bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm">*/}
                      {/*<div className="text-white font-bold text-lg">*/}
                        {/*{Math.ceil(duration - currentTime)}*/}
                      {/*</div>*/}
                      {/*<div className="text-white/60 text-xs">segundos</div>*/}
                    {/*</div>*/}
                  {/*</div>*/}
                </div>

                {/* Barra de progresso melhorada */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-white/60">
                    <span>{Math.floor(currentTime)}s</span>
                    <span>{duration}s</span>
                  </div>
                  <div className="relative">
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div
                          className="h-full bg-gradient-to-r from-blue-400 to-purple-500 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${progress}%` }}
                      />
                    </div>
                    {/* Pulse effect no progresso */}
                    <div
                        className="absolute top-0 h-2 w-1 bg-white rounded-full shadow-lg transition-all duration-300"
                        style={{ left: `${progress}%`, transform: 'translateX(-50%)' }}
                    />
                  </div>
                </div>
              </div>
          )}

          {/* Estados de resultado */}
          {(gameState === "reveal" || gameState === "transition") && (
              <div className="text-center py-6">
                <div className="w-12 h-12 mx-auto bg-white/10 rounded-full flex items-center justify-center mb-3">
                  <Pause className="w-6 h-6 text-white/70" />
                </div>
                <p className="text-white/60 text-sm">Preparando próxima música...</p>
              </div>
          )}
        </div>
      </div>
  );
};