import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateClientId } from '@/utils/clientId';

export function useHeartbeat(roomCode: string) {
    const clientId = useRef(getOrCreateClientId());

    useEffect(() => {
        if (!roomCode) return;

        const updatePresence = async () => {
            try {
                // PRIMEIRO: Buscar o UUID da sala
                const { data: room, error: roomError } = await supabase
                    .from('game_rooms')
                    .select('id')
                    .eq('room_code', roomCode)
                    .maybeSingle();

                if (roomError) {
                    console.error('Erro ao buscar room:', roomError);
                    return;
                }

                if (!room?.id) {
                    console.error('Room não encontrada para código:', roomCode);
                    return;
                }

                console.log('Atualizando presença para room UUID:', room.id);

                // SEGUNDO: Usar o UUID para atualizar
                const { error: updateError } = await supabase
                    .from('room_participants')
                    .update({ last_seen: new Date().toISOString() })
                    .eq('room_id', room.id)
                    .eq('client_id', clientId.current);

                if (updateError) {
                    console.error('Erro ao atualizar presença:', updateError);
                }
            } catch (error) {
                console.error('Erro geral no heartbeat:', error);
            }
        };

        const interval = setInterval(updatePresence, 10000); // Aumentar para 10s
        updatePresence(); // Executar imediatamente

        return () => clearInterval(interval);
    }, [roomCode]);
}