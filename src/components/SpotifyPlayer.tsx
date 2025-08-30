import { useEffect, useState, useRef } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface SpotifyPlayerProps {
  trackId: string;
  autoPlay?: boolean;
  duration?: number; // in seconds
  onTrackEnd?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  volume?: number;
  muted?: boolean;
  showControls?: boolean;
  className?: string;
}

export function SpotifyPlayer({
  trackId,
  autoPlay = false,
  duration = 15,
  onTrackEnd,
  onTimeUpdate,
  volume = 80,
  muted = false,
  showControls = true,
  className = ""
}: SpotifyPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playerVolume, setPlayerVolume] = useState(volume);
  const [isMuted, setIsMuted] = useState(muted);
  const [isReady, setIsReady] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const startTimeRef = useRef<number>(0);

  const embedUrl = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`;

  useEffect(() => {
    // Clean up timer on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (autoPlay && isReady) {
      handlePlay();
    }
  }, [autoPlay, isReady]);

  useEffect(() => {
    // Reset when track changes
    setCurrentTime(0);
    setIsPlaying(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [trackId]);

  const handlePlay = () => {
    if (!isPlaying) {
      setIsPlaying(true);
      startTimeRef.current = Date.now() - (currentTime * 1000);
      
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = (now - startTimeRef.current) / 1000;
        
        if (elapsed >= duration) {
          setCurrentTime(duration);
          setIsPlaying(false);
          clearInterval(timerRef.current!);
          onTrackEnd?.();
        } else {
          setCurrentTime(elapsed);
          onTimeUpdate?.(elapsed);
        }
      }, 100);
    }
  };

  const handlePause = () => {
    setIsPlaying(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const handleSeek = (value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    
    if (isPlaying) {
      startTimeRef.current = Date.now() - (newTime * 1000);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`spotify-player ${className}`}>
      {/* Spotify Embed (hidden, used for preview) */}
      <iframe
        ref={iframeRef}
        src={embedUrl}
        width="100%"
        height="152"
        frameBorder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        onLoad={() => setIsReady(true)}
        style={{ display: 'none' }} // Hide the actual Spotify player
      />

      {/* Custom Controls */}
      {showControls && (
        <div className="flex flex-col gap-4 p-4 bg-card rounded-lg border">
          {/* Progress Bar */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground min-w-[35px]">
              {formatTime(currentTime)}
            </span>
            <Slider
              value={[currentTime]}
              max={duration}
              step={0.1}
              onValueChange={handleSeek}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground min-w-[35px]">
              {formatTime(duration)}
            </span>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={isPlaying ? handlePause : handlePlay}
              disabled={!isReady}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>

            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </Button>
              <Slider
                value={[isMuted ? 0 : playerVolume]}
                max={100}
                step={1}
                onValueChange={(value) => {
                  setPlayerVolume(value[0]);
                  setIsMuted(value[0] === 0);
                }}
                className="w-20"
              />
            </div>
          </div>
        </div>
      )}

      {/* Track Info */}
      <div className="text-center text-sm text-muted-foreground mt-2">
        <span>Reproduzindo via Spotify</span>
      </div>
    </div>
  );
}