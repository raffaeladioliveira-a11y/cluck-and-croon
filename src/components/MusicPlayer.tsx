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

  // URLs de músicas de exemplo com fallbacks mais confiáveis
  const audioSources = [
    "https://commondatastorage.googleapis.com/codeskulptor-demos/DDR_assets/Kangaroo_MusiQue_-_The_Neverwritten_Role_Playing_Game.mp3",
    "https://commondatastorage.googleapis.com/codeskulptor-assets/week7-button.m4a",
    "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav"
  ];
  
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
  const [hasAudioError, setHasAudioError] = useState(false);
  const defaultAudioUrl = audioUrl || audioSources[currentSourceIndex];

  // Simulação de reprodução quando não há áudio real
  const simulatePlayback = () => {
    console.log('🎵 MusicPlayer: Iniciando simulação de reprodução');
    setIsPlaying(true);
    setCurrentTime(0);
    
    const interval = setInterval(() => {
      setCurrentTime(prev => {
        const newTime = prev + 1;
        if (newTime >= duration) {
          console.log('🎵 MusicPlayer: Simulação concluída');
          clearInterval(interval);
          setIsPlaying(false);
          onEnded?.();
          return 0;
        }
        onTimeUpdate?.(newTime);
        return newTime;
      });
    }, 1000);
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) {
      console.log('🎵 MusicPlayer: Elemento de áudio não encontrado, simulando reprodução');
      simulatePlayback();
      return;
    }

    console.log('🎵 MusicPlayer: Toggle play - Estado atual:', isPlaying);

    try {
      if (isPlaying) {
        console.log('🎵 MusicPlayer: Pausando áudio');
        audio.pause();
        setIsPlaying(false);
      } else {
        console.log('🎵 MusicPlayer: Tentando reproduzir áudio');
        
        // Verificar se o áudio está carregado
        if (audio.readyState < 2 || hasAudioError) {
          console.log('🎵 MusicPlayer: Áudio não carregado ou com erro, simulando reprodução');
          simulatePlayback();
          return;
        }
        
        // Tentar reproduzir
        await audio.play();
        console.log('🎵 MusicPlayer: Áudio reproduzindo com sucesso');
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('🎵 MusicPlayer: Erro ao reproduzir áudio:', error);
      console.log('🎵 MusicPlayer: Iniciando simulação como fallback');
      simulatePlayback();
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    console.log('🎵 MusicPlayer: Carregando áudio:', defaultAudioUrl);

    // Set initial volume
    audio.volume = volume;

    const handleTimeUpdate = () => {
      const time = audio.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    };

    const handleEnded = () => {
      console.log('🎵 MusicPlayer: Áudio terminou');
      setIsPlaying(false);
      setCurrentTime(0);
      onEnded?.();
    };

    const handleLoadedData = () => {
      console.log('🎵 MusicPlayer: Áudio carregado com sucesso');
      setHasAudioError(false);
      if (autoPlay) {
        console.log('🎵 MusicPlayer: Iniciando reprodução automática');
        togglePlay();
      }
    };

    const handleError = (error: Event) => {
      console.error('🎵 MusicPlayer: Erro ao carregar áudio:', error);
      setHasAudioError(true);
      
      // Tentar próxima URL se disponível
      if (currentSourceIndex < audioSources.length - 1) {
        console.log('🎵 MusicPlayer: Tentando próxima fonte de áudio...');
        setCurrentSourceIndex(prev => prev + 1);
      } else {
        console.log('🎵 MusicPlayer: Todas as fontes falharam, iniciando simulação');
        if (autoPlay) {
          simulatePlayback();
        }
      }
    };

    const handleCanPlay = () => {
      console.log('🎵 MusicPlayer: Áudio pronto para reprodução');
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [autoPlay, onTimeUpdate, onEnded, volume, currentSourceIndex]);


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
        crossOrigin="anonymous"
      />

      {/* Debug info */}
      {hasAudioError && (
        <div className="mb-4 p-2 bg-red-500/20 rounded border border-red-500/30">
          <p className="text-xs text-white/90 text-center">
            ⚠️ Simulando reprodução (áudio indisponível)
          </p>
        </div>
      )}

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
        {isPlaying && (
          <span className="block text-green-300 mt-1">
            {hasAudioError ? "🔄 Simulação ativa" : "🎵 Reproduzindo"}
          </span>
        )}
      </p>

      {/* Quiz Hint */}
      <div className="mt-4 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
          <span className="animate-egg-bounce">🎯</span>
          <span className="text-white/90 text-sm font-medium">
            Qual é o título desta música?
          </span>
        </div>
      </div>
    </div>
  );
};