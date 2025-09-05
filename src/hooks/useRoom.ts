/**
 * Created by rafaela on 30/08/25.
 */
// hooks/useRoom.ts
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useRoom(roomCode: string) {
    const [room, setRoom] = useState<any>(null);

    const fetchRoom = async () => {
        const { data, error } = await supabase
            .from("game_rooms")
            .select("*")
            .eq("code", roomCode)
            .single();
        if (!error) setRoom(data);
    };

    useEffect(() => {
        fetchRoom();
        const ch = supabase
            .channel(`room-${roomCode}`)
            .on("postgres_changes", {
                event: "*", schema: "public", table: "game_rooms", filter: `code=eq.${roomCode}`
            }, () => {
                fetchRoom();
            })
            .subscribe();
        return () => {
            supabase.removeChannel(ch);
        };
    }, [roomCode]);

    return { room, refetchRoom: fetchRoom };
}
