import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Volume2, VolumeX, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface MusicPlayerProps {
  songTitle: string;
  artist: string;
  audioUrl?: string;
  duration?: number;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
  autoPlay?: boolean;
  className?: string;
}

export const MusicPlayer = ({
  songTitle,
  artist,
  audioUrl,
  duration = 15,
  onTimeUpdate,
  onEnded,
  autoPlay = false,
  className
}: MusicPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // URLs de músicas de exemplo (Creative Commons)
  const defaultAudioUrl = audioUrl || "https://www.soundjay.com/misc/sounds/magic-chime-02.mp3";

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Set initial volume
    audio.volume = volume;

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

    const handleLoadedData = () => {
      if (autoPlay) {
        togglePlay();
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadeddata', handleLoadedData);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadeddata', handleLoadedData);
    };
  }, [autoPlay, onTimeUpdate, onEnded, volume]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        await audio.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Erro ao reproduzir áudio:', error);
      // Fallback: simular reprodução
      simulatePlayback();
    }
  };

  // Simulação de reprodução quando não há áudio real
  const simulatePlayback = () => {
    setIsPlaying(true);
    const interval = setInterval(() => {
      setCurrentTime(prev => {
        if (prev >= duration) {
          clearInterval(interval);
          setIsPlaying(false);
          onEnded?.();
          return 0;
        }
        onTimeUpdate?.(prev + 1);
        return prev + 1;
      });
    }, 1000);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = newVolume;
      setVolume(newVolume);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = (currentTime / duration) * 100;

  return (
    <div className={cn("bg-white/20 rounded-lg p-6 border border-white/30", className)}>
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={defaultAudioUrl}
        muted={isMuted}
        preload="metadata"
      />

      {/* Song Info */}
      <div className="text-center mb-4">
        <div className="text-6xl mb-3 animate-chicken-walk">🎵</div>
        <h3 className="text-xl font-bold text-white mb-1">{songTitle}</h3>
        <p className="text-white/80">{artist}</p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <Button
          variant="outline"
          size="icon"
          onClick={togglePlay}
          className="bg-white/20 hover:bg-white/30 border-white/30 text-white h-12 w-12"
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-1" />}
        </Button>
        
        <div className="text-white/90 font-medium text-lg">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={toggleMute}
          className="bg-white/20 hover:bg-white/30 border-white/30 text-white"
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <Progress value={progress} className="h-3 bg-white/20" />
      </div>

      {/* Instructions */}
      <p className="text-xs text-white/70 text-center">
        🎧 Ouça atentamente os {duration} segundos da música
      </p>

      {/* Quiz Hint */}
      <div className="mt-4 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
          <span className="animate-egg-bounce">🎯</span>
          <span className="text-white/90 text-sm font-medium">
            Quem é o intérprete desta música?
          </span>
        </div>
      </div>
    </div>
  );
};