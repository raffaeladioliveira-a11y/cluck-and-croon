import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
    SelectValue,
} from "@/components/ui/select";

type Genre = { id: string; name: string };
type Album = { id: string; album_name: string; artist_name: string };

export function WinnerAlbumSelector({ roomCode }: { roomCode: string }) {
    const [genres, setGenres] = useState<Genre[]>([]);
    const [albums, setAlbums] = useState<Album[]>([]);
    const [genreId, setGenreId] = useState<string>("");
    const [albumId, setAlbumId] = useState<string>("");

    // Carrega gêneros
    useEffect(() => {
        let mounted = true;
        (async () => {
            const { data, error } = await supabase
                .from("genres")
                .select("id, name")
                .order("name");
            if (!error && mounted) setGenres((data as Genre[]) ?? []);
        })();
        return () => {
            mounted = false;
        };
    }, []);

    // Carrega álbuns por gênero
    useEffect(() => {
        let mounted = true;
        if (!genreId) {
            setAlbums([]);
            setAlbumId("");
            return;
        }
        (async () => {
            const { data, error } = await supabase
                .from("spotify_albums")
                .select("id, album_name, artist_name")
                .eq("genre_id", genreId)
                .order("album_name");
            if (!error && mounted) setAlbums((data as Album[]) ?? []);
        })();
        return () => {
            mounted = false;
        };
    }, [genreId]);

    const confirm = async () => {
        if (!roomCode || !genreId || !albumId) return;

        const { data, error } = await supabase.rpc("apply_next_album_and_reset", {
            p_room_code: roomCode,
            p_album_id: albumId,
            p_genre_id: genreId,
        });

        if (error) {
            console.error("apply_next_album_and_reset error:", error);
            alert(`Erro ao definir álbum: ${error.message}`);
            return;
        }

        console.log("apply_next_album_and_reset OK:", data);
        alert("Álbum definido! A sala voltou ao lobby para iniciar a próxima partida.");
    };

    return (
        <div className="bg-white/10 border border-white/20 rounded-xl p-4">
            <h3 className="text-white font-semibold mb-3">👑 Você venceu! Escolha o próximo álbum</h3>

            <div className="grid md:grid-cols-2 gap-3">
                <Select value={genreId} onValueChange={setGenreId}>
                    <SelectTrigger className="bg-white/10 text-white border-white/20">
                        <SelectValue placeholder="Filtrar por gênero" />
                    </SelectTrigger>
                    <SelectContent>
                        {genres.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                                {g.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select
                    value={albumId}
                    onValueChange={setAlbumId}
                    disabled={!genreId || albums.length === 0}
                >
                    <SelectTrigger className="bg-white/10 text-white border-white/20">
                        <SelectValue placeholder="Escolher álbum" />
                    </SelectTrigger>
                    <SelectContent>
                        {albums.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                                {a.artist_name} — {a.album_name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <Button
                onClick={confirm}
                disabled={!genreId || !albumId}
                className="mt-4 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-60"
            >
                Definir álbum
            </Button>
        </div>
    );
}
