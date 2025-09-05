/**
 * Created by rafaela on 30/08/25.
 */
// components/RankingBoard.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface RoomParticipant {
    user_id: string;
    display_name: string;
    avatar: string;
    current_eggs: number;
    correct_answers: number;
    avg_response_time: number;
}

export function RankingBoard({ roomCode, currentProfileId }: {
    roomCode: string; 
    currentProfileId?: string;
}) {
    const [rows, setRows] = useState<RoomParticipant[]>([]);

    const load = async () => {
        // First get the room ID from the code
        const { data: roomData } = await supabase
            .from("game_rooms")
            .select("id")
            .eq("code", roomCode)
            .single();

        if (!roomData) return;

        const { data } = await supabase
            .from("room_participants")
            .select("user_id, display_name, avatar, current_eggs, correct_answers, avg_response_time")
            .eq("room_id", roomData.id);
        
        const sorted = (data ?? []).sort((a, b) => (
            (b.current_eggs ?? 0) - (a.current_eggs ?? 0) ||
            (b.correct_answers ?? 0) - (a.correct_answers ?? 0) ||
            (a.avg_response_time ?? 1e9) - (b.avg_response_time ?? 1e9) ||
            (a.display_name || "").localeCompare(b.display_name || "")
        ));
        setRows(sorted);
    };

    useEffect(() => {
        load();
        const ch = supabase
            .channel(`rank-${roomCode}`)
            .on("postgres_changes", {
                event: "*", 
                schema: "public", 
                table: "room_participants"
            }, () => {
                load();
            })
            .subscribe();
        
        return () => {
            supabase.removeChannel(ch);
        };
    }, [roomCode]);

    return (
        <div className="bg-white/10 border border-white/20 rounded-xl p-4">
            <h3 className="text-white font-semibold mb-3">🏆 Ranking da rodada</h3>
            <ul className="space-y-2">
                {rows.map((p, i) => (
                    <li 
                        key={p.user_id}
                        className={`flex items-center justify-between px-3 py-2 rounded ${
                            p.user_id === currentProfileId ? 'bg-green-500/20' : 'bg-white/5'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <span className="w-6 text-white/90">{i + 1}º</span>
                            <span className="text-2xl">{p.avatar ?? "🐔"}</span>
                            <span className="text-white/90 text-sm">{p.display_name ?? p.user_id}</span>
                        </div>
                        <div className="flex items-center gap-4 text-white/80 text-sm">
                            <span>{p.current_eggs ?? 0} 🥚</span>
                            <span>✅ {p.correct_answers ?? 0}</span>
                            <span>⏱️ {p.avg_response_time ? `${Number(p.avg_response_time).toFixed(2)}s` : "—"}</span>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}