/**
 * Created by rafaela on 30/08/25.
 */
// components/RankingBoard.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function RankingBoard({ roomCode, currentProfileId }:{
    roomCode: string; currentProfileId?: string;
}) {
    const [rows, setRows] = useState<any[]>([]);

    const load = async () => {
        const { data } = await supabase
            .from("room_participants")
            .select("profile_id, display_name, avatar, eggs, correct_answers, avg_response_time")
            .eq("room_code", roomCode);
        const sorted = (data ?? []).sort((a,b) => (
            (b.eggs??0) - (a.eggs??0) ||
            (b.correct_answers??0) - (a.correct_answers??0) ||
            (a.avg_response_time??1e9) - (b.avg_response_time??1e9) ||
            (a.display_name||"").localeCompare(b.display_name||"")
        ));
        setRows(sorted);
    };

    useEffect(() => {
        load();
        const ch = supabase
            .channel(`rank-${roomCode}`)
            .on("postgres_changes", {
                event: "*", schema: "public", table: "room_participants", filter: `room_code=eq.${roomCode}`
            }, load)
            .subscribe();
        return () => supabase.removeChannel(ch);
    }, [roomCode]);

    return (
        <div className="bg-white/10 border border-white/20 rounded-xl p-4">
        <h3 className="text-white font-semibold mb-3">🏆 Ranking da rodada</h3>
    <ul className="space-y-2">
        {rows.map((p, i) => (
            <li key={p.profile_id}
    className={`flex items-center justify-between px-3 py-2 rounded ${p.profile_id===currentProfileId?'bg-green-500/20':'bg-white/5'}`}>
    <div className="flex items-center gap-2">
    <span className="w-6 text-white/90">{i+1}º</span>
    <span className="text-2xl">{p.avatar ?? "🐔"}</span>
    <span className="text-white/90 text-sm">{p.display_name ?? p.profile_id}</span>
    </div>
    <div className="flex items-center gap-4 text-white/80 text-sm">
    <span>{p.eggs ?? 0} 🥚</span>
    <span>✅ {p.correct_answers ?? 0}</span>
    <span>⏱️ {p.avg_response_time ? `${p.avg_response_time.toFixed(2)}s` : "—"}</span>
    </div>
    </li>
))}
    </ul>
    </div>
);
}
