import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateClientId } from "@/utils/clientId";

export function useHeartbeat(roomCode: string | null) {
    const clientId = getOrCreateClientId();

    useEffect(() => {
        if (!roomCode) return;

        const interval = setInterval(async () => {
            try {
                await supabase
                    .from("room_participants")
                    .update({ last_seen: new Date().toISOString() })
                    .eq("room_code", roomCode)
                    .eq("client_id", clientId);
            } catch (err) {
                console.error("Erro ao enviar heartbeat:", err);
            }
        }, 15000);

        return () => clearInterval(interval);
    }, [roomCode, clientId]);
}
