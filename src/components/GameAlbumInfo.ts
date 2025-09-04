/**
 * Created by rafaela on 02/09/25.
 */
import { BarnCard } from "@/components/BarnCard";
import { Music, Album } from "lucide-react";

interface GameAlbumInfoProps {
    albumInfo?: {
        name: string;
        artist: string;
        genre: string;
        coverImage?: string;
    } | null;
    gameMode: "mp3" | "spotify";
    className?: string;
}

export function GameAlbumInfo({ albumInfo, gameMode, className }: GameAlbumInfoProps) {
    if (!albumInfo) return null;

    return (
        <BarnCard variant="nest" className={`mb-4 ${className}`}>
    <div className="flex items-center gap-3">
    <div className="flex-shrink-0">
    {albumInfo.coverImage ? (
        <img
            src={albumInfo.coverImage}
    alt={albumInfo.name}
    className="w-12 h-12 rounded object-cover"
        />
) : (
        <div className="w-12 h-12 rounded bg-primary/20 flex items-center justify-center">
        <Album className="w-6 h-6 text-primary" />
            </div>
    )}
    </div>

    <div className="flex-grow min-w-0">
    <div className="flex items-center gap-2 mb-1">
    <Music className="w-4 h-4 text-primary flex-shrink-0" />
    <span className="text-sm font-medium text-primary">
        Álbum Especial
    </span>
    </div>

    <h4 className="font-bold text-primary text-sm truncate">
        {albumInfo.name}
    </h4>

    <p className="text-xs text-muted-foreground truncate">
        {albumInfo.artist} • {albumInfo.genre}
    </p>
    </div>

    <div className="flex-shrink-0">
    <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
    {gameMode === "mp3" ? "MP3" : "Spotify"}
    </span>
    </div>
    </div>
    </BarnCard>
);
}