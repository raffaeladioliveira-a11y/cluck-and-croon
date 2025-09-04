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
      <div className={cn("bg-white/10 rounded-2xl p-6 shadow-lg", className)} key={roundKey}>
        {/* MP3: usa <audio> */}
        {gameMode === "mp3" && (
            <audio ref={audioRef} preload="metadata" crossOrigin="anonymous" />
        )}

        {/* SPOTIFY: usa embed */}
        {gameMode === "spotify" && spotifyTrackId && gameState === "playing" && (
            <iframe
                src={`https://open.spotify.com/embed/track/${spotifyTrackId}?utm_source=generator&theme=0`}
                width="100%"
                height="80"
                frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                allowFullScreen
            ></iframe>
        )}

        {/* Estado inicial */}
        {gameState === "idle" && (
            <div className="text-center">
              <div className="text-6xl mb-3 animate-bounce">🐔</div>
              <h3 className="text-xl font-bold text-white mb-1">Adivinhe quem está cacarejando</h3>
              <p className="text-white/80">Clique em "Iniciar Jogo" para começar!</p>
            </div>
        )}

        {/* Tocando */}
        {gameState === "playing" && (
            <>
            <div className="text-center mb-4">
              <div className="text-6xl mb-3 animate-bounce">🐔</div>
              <h3 className="text-xl font-bold text-white mb-1">
                {gameMode === "mp3" ? "🎵 Música Misteriosa" : songTitle}
              </h3>
              {gameMode === "spotify" && (
                  <p className="text-white/80">{artist}</p>
              )}
            </div>

            {gameMode === "mp3" && (
                <>
                <div className="flex items-center justify-center gap-4 mb-4">
                  <Button onClick={togglePlay} className="bg-white/20 border-white/30 text-white">
                    {isPlaying ? <Pause /> : <Play />}
                  </Button>
                  <div className="text-white/90 font-medium text-lg">
                    {currentTime.toFixed(0)}s / {duration}s
                  </div>
                  <Button
                      variant="outline"
                      size="sm"
                      className="bg-white/20 border-white/30 text-white"
                      onClick={() => setIsMuted((m) => !m)}
                  >
                    {isMuted ? <VolumeX /> : <Volume2 />}
                  </Button>
                </div>
                <Progress value={progress} className="h-3 bg-white/20" />
                </>
            )}

            {gameMode === "spotify" && (
                <p className="text-xs text-white/70 text-center mt-2">🎧 Tocando via Spotify</p>
            )}
            </>
        )}
      </div>
  );
};
