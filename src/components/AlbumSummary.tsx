/**
 * Created by rafaela on 12/09/25.
 */
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FolderOpen, Music } from "lucide-react";

interface AlbumInfo {
    id: string;
    name: string;
    artist_name?: string;
    cover_image_url?: string;
}

interface AlbumSummaryProps {
    albums: AlbumInfo[];
    maxVisible?: number;
    onAlbumClick?: (albumId: string) => void;
    showCovers?: boolean;
    compact?: boolean;
}

export function AlbumSummary({
    albums,
    maxVisible = 2,
    onAlbumClick,
    showCovers = false,
    compact = false
}: AlbumSummaryProps) {
    if (!albums || albums.length === 0) {
        return (
            <Badge variant="outline" className="text-xs">
                Nenhum álbum
            </Badge>
        );
    }

    const visibleAlbums = albums.slice(0, maxVisible);
    const hiddenCount = Math.max(0, albums.length - maxVisible);

    if (compact) {
        return (
            <div className="flex items-center gap-1">
                <FolderOpen className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
          {albums.length} álbum{albums.length !== 1 ? 's' : ''}
        </span>
            </div>
        );
    }

    return (
        <TooltipProvider>
            <div className="flex flex-wrap gap-1 max-w-64">
                {visibleAlbums.map((album) => (
                    <Tooltip key={album.id}>
                        <TooltipTrigger asChild>
                            <Badge
                                variant="outline"
                                className={`text-xs truncate max-w-24 ${
                  onAlbumClick ? 'cursor-pointer hover:bg-primary/10' : ''
                }`}
                                onClick={() => onAlbumClick?.(album.id)}
              >
                                {showCovers && album.cover_image_url && (
                                    <img
                                        src={album.cover_image_url}
                                        alt=""
                                        className="w-3 h-3 rounded-sm mr-1"
                                    />
                                )}
                                {album.name}
                            </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                            <div className="text-sm">
                                <p className="font-medium">{album.name}</p>
                                {album.artist_name && (
                                    <p className="text-muted-foreground">{album.artist_name}</p>
                                )}
                            </div>
                        </TooltipContent>
                    </Tooltip>
                ))}

                {hiddenCount > 0 && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Badge variant="secondary" className="text-xs">
                                +{hiddenCount}
                            </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                            <div className="max-w-48">
                                <p className="text-sm font-medium mb-1">Outros álbuns:</p>
                                <div className="space-y-1">
                                    {albums.slice(maxVisible).map((album) => (
                                        <p key={album.id} className="text-xs text-muted-foreground">
                                            {album.name}
                                            {album.artist_name && ` - ${album.artist_name}`}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>
        </TooltipProvider>
    );
}

// ============= COMPONENTE DE ESTATÍSTICAS DE ÁLBUNS =============

interface AlbumStatsProps {
    albumId: string;
    className?: string;
}

export function AlbumStats({ albumId, className = "" }: AlbumStatsProps) {
    const [stats, setStats] = React.useState({
        songCount: 0,
        totalDuration: 0,
        avgDifficulty: 0
    });

    const loadStats = async () => {
        try {
            const { data, error } = await supabase
                .from('album_songs')
                .select(`
          songs (
            duration_seconds,
            difficulty_level
          )
        `)
                .eq('album_id', albumId);

            if (error) throw error;

            const songs = data?.map(item => item.songs).filter(Boolean) || [];
            const songCount = songs.length;
            const totalDuration = songs.reduce((sum, song) => sum + (song.duration_seconds || 0), 0);
            const avgDifficulty = songCount > 0
                ? songs.reduce((sum, song) => sum + (song.difficulty_level || 1), 0) / songCount
                : 0;

            setStats({
                songCount,
                totalDuration,
                avgDifficulty: Math.round(avgDifficulty * 10) / 10
            });
        } catch (error) {
            console.error('Erro ao carregar estatísticas do álbum:', error);
        }
    };

    React.useEffect(() => {
        loadStats();
    }, [albumId]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getDifficultyLabel = (level: number) => {
        if (level <= 1.3) return { emoji: '🐣', label: 'Fácil' };
        if (level <= 2.3) return { emoji: '🐔', label: 'Médio' };
        return { emoji: '🐓', label: 'Difícil' };
    };

    const difficulty = getDifficultyLabel(stats.avgDifficulty);

    return (
        <div className={`flex items-center gap-3 text-sm ${className}`}>
            <Badge variant="outline" className="text-xs">
                <Music className="w-3 h-3 mr-1" />
                {stats.songCount} música{stats.songCount !== 1 ? 's' : ''}
            </Badge>

            {stats.totalDuration > 0 && (
                <Badge variant="outline" className="text-xs">
                    ⏱️ {formatDuration(stats.totalDuration)}
                </Badge>
            )}

            {stats.avgDifficulty > 0 && (
                <Badge variant="outline" className="text-xs">
                    {difficulty.emoji} {difficulty.label}
                </Badge>
            )}
        </div>
    );
}