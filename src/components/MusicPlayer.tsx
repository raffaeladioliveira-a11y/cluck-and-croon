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
  gameState = 'idle',
  roundKey = '',
  className
}: MusicPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const stopTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Robust audio control with cleanup
  const teardownAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    console.log('🎵 Teardown audio');
    audio.pause();
    audio.currentTime = 0;
    audio.removeAttribute('src');
    audio.load(); // Flush buffer
    setIsPlaying(false);
    setCurrentTime(0);
    setAudioError(false);
    
    // Clear duration timer
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  };

  const setupAndPlayAudio = async (audioSrc: string, shouldAutoPlay: boolean) => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    console.log('🎵 Setup audio:', { audioSrc, shouldAutoPlay, gameState });
    
    // Clean previous audio
    teardownAudio();
    
    // Set new source
    audio.src = audioSrc;
    audio.currentTime = 0;
    audio.volume = isMuted ? 0 : volume;
    
    try {
      await audio.load();
      
      if (shouldAutoPlay) {
        await audio.play();
        setIsPlaying(true);
        
        // Set duration timer to cut audio exactly at specified duration
        const durationMs = duration * 1000;
        stopTimerRef.current = setTimeout(() => {
          console.log('🎵 Duration timer: stopping audio');
          teardownAudio();
        }, durationMs);
      }
    } catch (error) {
      console.error('🎵 Audio setup error:', error);
      setAudioError(true);
    }
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || audioError) {
      console.log('🎵 No audio element or error state');
      return;
    }

    console.log('🎵 Toggle play:', { isPlaying, gameState });

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
        if (stopTimerRef.current) {
          clearTimeout(stopTimerRef.current);
          stopTimerRef.current = null;
        }
      } else {
        await audio.play();
        setIsPlaying(true);
        
        // Reset duration timer on manual play
        const durationMs = duration * 1000;
        stopTimerRef.current = setTimeout(() => {
          console.log('🎵 Manual play timer: stopping audio');
          teardownAudio();
        }, durationMs);
      }
    } catch (error) {
      console.error('🎵 Play error:', error);
      setAudioError(true);
    }
  };

  // Effect to handle round changes and audio control
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    console.log('🎵 Round effect:', { roundKey, gameState, autoPlay, audioUrl });

    // Setup audio when entering playing state
    if (gameState === 'playing' && audioUrl) {
      setupAndPlayAudio(audioUrl, autoPlay || false);
    } 
    // Cleanup when leaving playing state
    else if (gameState !== 'playing' && isPlaying) {
      teardownAudio();
    }

    // Cleanup function for round change
    return () => {
      if (gameState === 'transition') {
        teardownAudio();
      }
    };
  }, [roundKey, gameState, audioUrl, autoPlay]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const time = audio.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    };

    const handleEnded = () => {
      console.log('🎵 Audio ended naturally');
      setIsPlaying(false);
      setCurrentTime(0);
      onEnded?.();
    };

    const handleError = (error: Event) => {
      console.error('🎵 Audio error:', error);
      setAudioError(true);
      setIsPlaying(false);
    };

    const handleLoadedData = () => {
      console.log('🎵 Audio loaded successfully');
      setAudioError(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('loadeddata', handleLoadedData);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('loadeddata', handleLoadedData);
    };
  }, [onTimeUpdate, onEnded]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      teardownAudio();
    };
  }, []);


  const toggleMute = () => {
    const audio = audioRef.current;
    if (audio) {
      const newMuted = !isMuted;
      audio.muted = newMuted;
      audio.volume = newMuted ? 0 : volume;
      setIsMuted(newMuted);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = newVolume;
      setVolume(newVolume);
      if (newVolume > 0 && isMuted) {
        setIsMuted(false);
        audio.muted = false;
      }
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = (currentTime / duration) * 100;

  return (
    <div className={cn("bg-white/20 rounded-lg p-6 border border-white/30", className)} key={roundKey}>
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        preload="metadata"
        crossOrigin="anonymous"
      />

      {/* Error/Status info */}
      {audioError && (
        <div className="mb-4 p-2 bg-red-500/20 rounded border border-red-500/30">
          <p className="text-xs text-white/90 text-center">
            ⚠️ Erro no áudio (URL pode estar indisponível)
          </p>
        </div>
      )}

      {gameState === 'idle' && (
        <div className="text-center">
          <div className="text-6xl mb-3 animate-chicken-walk">🎵</div>
          <h3 className="text-xl font-bold text-white mb-1">Música Misteriosa</h3>
          <p className="text-white/80">🤔 Que música será esta?</p>
          <p className="text-sm text-white/60 mt-2">
            Clique em "Iniciar Jogo" para começar!
          </p>
        </div>
      )}

      {gameState === 'playing' && (
        <>
          {/* Song Info - Hidden in Game Mode */}
          <div className="text-center mb-4">
            <div className="text-6xl mb-3 animate-chicken-walk">🎵</div>
            <h3 className="text-xl font-bold text-white mb-1">Música Misteriosa</h3>
            <p className="text-white/80">🤔 Que música será esta?</p>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <Button
              variant="outline"
              size="icon"
              onClick={togglePlay}
              className="bg-white/20 hover:bg-white/30 border-white/30 text-white h-12 w-12"
              disabled={audioError}
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
                🎵 Reproduzindo
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
        </>
      )}

      {gameState === 'reveal' && (
        <div className="text-center">
          <div className="text-6xl mb-3">🎵</div>
          <h3 className="text-xl font-bold text-white mb-1">Resposta Revelada!</h3>
          <p className="text-white/80">Próxima música em instantes...</p>
        </div>
      )}

      {gameState === 'transition' && (
        <div className="text-center">
          <div className="text-6xl mb-3 animate-chicken-walk">🔄</div>
          <h3 className="text-xl font-bold text-white mb-1">Preparando próxima música...</h3>
          <p className="text-white/80">Aguarde um momento</p>
        </div>
      )}

      {gameState === 'finished' && (
        <div className="text-center">
          <div className="text-6xl mb-3">🏁</div>
          <h3 className="text-xl font-bold text-white mb-1">Jogo Finalizado!</h3>
          <p className="text-white/80">Parabéns por completar todas as rodadas!</p>
        </div>
      )}
    </div>
  );
};