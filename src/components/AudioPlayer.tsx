/**
 * Created by rafaela on 10/09/25.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, VolumeX, RotateCcw, Square } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

interface AudioPlayerProps {
    audioUrl: string;
    songTitle: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
    audioUrl,
    songTitle,
    size = 'sm',
    className = ''
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(0.7);
    const audioRef = useRef<HTMLAudioElement>(null);

    // Verificar se é um arquivo MP3 válido
    const isValidMp3 = audioUrl && (audioUrl.includes('.mp3') || audioUrl.includes('audio/mpeg'));

    // Limpar estado quando a URL muda
    useEffect(() => {
        setCurrentTime(0);
        setIsPlaying(false);
        setHasError(false);
        setDuration(0);
    }, [audioUrl]);

    // Configurar eventos do áudio
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateProgress = () => {
            setCurrentTime(audio.currentTime);
        };

        const handleLoadStart = () => {
            setIsLoading(true);
            setHasError(false);
        };

        const handleLoadedMetadata = () => {
            setDuration(audio.duration || 0);
            setIsLoading(false);
        };

        const handleCanPlay = () => {
            setIsLoading(false);
        };

        const handleError = (e: Event) => {
            console.error('Erro no áudio:', e);
            setHasError(true);
            setIsLoading(false);
            setIsPlaying(false);
            toast({
                title: "Erro no áudio",
                description: `Não foi possível reproduzir "${songTitle}"`,
                variant: "destructive",
            });
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
            toast({
                title: "Música finalizada",
                description: `"${songTitle}" terminou de tocar`,
            });
        };

        const handlePause = () => setIsPlaying(false);
        const handlePlay = () => setIsPlaying(true);

        audio.addEventListener('timeupdate', updateProgress);
        audio.addEventListener('loadstart', handleLoadStart);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('canplay', handleCanPlay);
        audio.addEventListener('error', handleError);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('play', handlePlay);

        return () => {
            audio.removeEventListener('timeupdate', updateProgress);
            audio.removeEventListener('loadstart', handleLoadStart);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('error', handleError);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('play', handlePlay);
        };
    }, [songTitle]);

    const togglePlayPause = async () => {
        const audio = audioRef.current;
        if (!audio || hasError || !isValidMp3) return;

        try {
            if (isPlaying) {
                audio.pause();
            } else {
                // Configurar volume antes de tocar
                audio.volume = volume;
                await audio.play();
                toast({
                    title: "Reproduzindo",
                    description: `"${songTitle}"`,
                });
            }
        } catch (error) {
            console.error('Erro ao reproduzir:', error);
            setHasError(true);
            toast({
                title: "Erro de reprodução",
                description: "Não foi possível reproduzir o áudio",
                variant: "destructive",
            });
        }
    };

    const stopAudio = () => {
        const audio = audioRef.current;
        if (!audio) return;

        audio.pause();
        audio.currentTime = 0;
        setCurrentTime(0);
        setIsPlaying(false);
    };

    const toggleMute = () => {
        const audio = audioRef.current;
        if (!audio) return;

        audio.muted = !audio.muted;
        setIsMuted(audio.muted);
    };

    const restart = () => {
        const audio = audioRef.current;
        if (!audio) return;

        audio.currentTime = 0;
        setCurrentTime(0);
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        const progressBar = e.currentTarget;
        if (!audio || !progressBar || duration === 0) return;

        const rect = progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        const newTime = percentage * duration;

        audio.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Diferentes tamanhos de componente
    const sizeConfig = {
        sm: {
            buttonSize: 'icon' as const,
            iconSize: 'w-3 h-3',
            showProgress: false,
            showTime: false,
            showTitle: false,
            showStop: false,
            showVolume: false
        },
        md: {
            buttonSize: 'sm' as const,
            iconSize: 'w-4 h-4',
            showProgress: true,
            showTime: true,
            showTitle: false,
            showStop: true,
            showVolume: true
        },
        lg: {
            buttonSize: 'default' as const,
            iconSize: 'w-5 h-5',
            showProgress: true,
            showTime: true,
            showTitle: true,
            showStop: true,
            showVolume: true
        }
    };

    const config = sizeConfig[size];

    if (!isValidMp3) {
        return (
            <Button variant="outline" size={config.buttonSize} disabled className={className}>
                <VolumeX className={config.iconSize} />
            </Button>
        );
    }

    return (
        <div className={`audio-player ${className}`}>
            <audio
                ref={audioRef}
                src={audioUrl}
                preload="metadata"
            />

            <div className={`flex items-center gap-2 ${size === 'lg' ? 'flex-col' : ''}`}>
                {/* Título da música (apenas no tamanho lg) */}
                {config.showTitle && (
                    <div className="text-sm font-medium text-center mb-2 truncate max-w-64">
                        {songTitle}
                    </div>
                )}

                {/* Controles principais */}
                <div className="flex items-center gap-1">
                    <Button
                        variant="outline"
                        size={config.buttonSize}
                        onClick={togglePlayPause}
                        disabled={isLoading || hasError}
                        className="relative"
                    >
                        {isLoading ? (
                            <div className={`${config.iconSize} animate-spin border-2 border-current border-t-transparent rounded-full`} />
                        ) : isPlaying ? (
                            <Pause className={config.iconSize} />
                        ) : (
                            <Play className={config.iconSize} />
                        )}
                    </Button>

                    {config.showStop && (
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={stopAudio}
                            disabled={isLoading || hasError}
                            className="h-8 w-8"
                        >
                            <Square className="w-3 h-3" />
                        </Button>
                    )}

                    {config.showStop && (
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={restart}
                            disabled={isLoading || hasError}
                            className="h-8 w-8"
                        >
                            <RotateCcw className="w-3 h-3" />
                        </Button>
                    )}

                    {config.showVolume && (
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={toggleMute}
                            disabled={isLoading || hasError}
                            className="h-8 w-8"
                        >
                            {isMuted ? (
                                <VolumeX className="w-3 h-3" />
                            ) : (
                                <Volume2 className="w-3 h-3" />
                            )}
                        </Button>
                    )}
                </div>

                {/* Barra de progresso e tempo */}
                {config.showProgress && duration > 0 && (
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        {/* Tempo atual */}
                        {config.showTime && (
                            <div className="text-xs text-muted-foreground tabular-nums min-w-10">
                                {formatTime(currentTime)}
                            </div>
                        )}

                        {/* Barra de progresso clicável */}
                        <div
                            className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-20 cursor-pointer hover:bg-muted/80"
                            onClick={handleProgressClick}
                        >
                            <div
                                className="h-full bg-primary transition-all duration-100"
                                style={{
                  width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%'
                }}
                            />
                        </div>

                        {/* Duração total */}
                        {config.showTime && (
                            <div className="text-xs text-muted-foreground tabular-nums min-w-10">
                                {formatTime(duration)}
                            </div>
                        )}
                    </div>
                )}

                {/* Status badges (apenas no tamanho lg) */}
                {size === 'lg' && (
                    <div className="flex gap-1 mt-2">
                        {isPlaying && (
                            <Badge variant="secondary" className="text-xs">
                                🎵 Reproduzindo
                            </Badge>
                        )}
                        {hasError && (
                            <Badge variant="destructive" className="text-xs">
                                ❌ Erro
                            </Badge>
                        )}
                        {!isValidMp3 && (
                            <Badge variant="outline" className="text-xs">
                                🚫 Apenas MP3
                            </Badge>
                        )}
                        {duration > 0 && (
                            <Badge variant="outline" className="text-xs">
                                ⏱️ {formatTime(duration)}
                            </Badge>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};