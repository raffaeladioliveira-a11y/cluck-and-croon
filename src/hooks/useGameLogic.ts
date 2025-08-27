import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getOrCreateClientId, loadProfile } from '@/utils/clientId';

export interface Song {
  id: string;
  title: string;
  artist: string;
  preview_url?: string;
  audio_file_url?: string;
  duration_seconds: number;
}

export interface GameQuestion {
  song: Song & { audioUrl?: string };
  options: string[];
  correctAnswer: number;
}

export interface PlayerFace {
  id: string;
  name: string;
  avatar: string;
}

export type GameState = 'idle' | 'playing' | 'reveal' | 'transition' | 'finished';
type AnswersByOption = Record<number, PlayerFace[]>;

function getAudioUrl(song: Song): string {
  if (song.audio_file_url && song.audio_file_url.trim() !== '') return song.audio_file_url;
  if (song.preview_url && song.preview_url.trim() !== '') return song.preview_url;
  return 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav';
}

export const useGameLogic = (roomCode: string, sessionId?: string) => {
  const { toast } = useToast();

  // identidade local
  const clientId = useRef(getOrCreateClientId());
  const profile  = useRef(loadProfile()); // { displayName, avatar }

  // estado principal
  const [isLoading, setIsLoading] = useState(true);
  const [gameState, setGameState] = useState<GameState>('idle');
  const [currentRound, setCurrentRound] = useState(1);
  const [timeLeft, setTimeLeft] = useState(15);
  const [currentQuestion, setCurrentQuestion] = useState<GameQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [playerEggs, setPlayerEggs] = useState(0);
  const [answerTime, setAnswerTime] = useState<number | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [isHost, setIsHost] = useState(false);

  const [currentSettings, setCurrentSettings] = useState({
    eggs_per_correct: 10,
    speed_bonus: 5,
    time_per_question: 15,
    song_duration: 15,
  });

  // avatares por alternativa
  const [answersByOption, setAnswersByOption] = useState<AnswersByOption>({});

  // timers
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef  = useRef<NodeJS.Timeout | null>(null);

  // canal realtime
  const gameChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const clearTimers = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timeoutRef.current)  { clearTimeout(timeoutRef.current);   timeoutRef.current  = null; }
  }, []);

  const startRoundTimer = useCallback((duration: number) => {
    clearTimers();
    setTimeLeft(duration);
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearTimers();
          setGameState('reveal');
          if (isHost) {
            timeoutRef.current = setTimeout(() => {
              setGameState('transition'); // host dispara próxima
            }, 3000);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearTimers, isHost]);

  // ---- dados
  const fetchRandomSongs = async (): Promise<Song[]> => {
    const { data, error } = await supabase
        .from('songs')
        .select('id,title,artist,preview_url,audio_file_url,duration_seconds')
        .eq('is_active', true)
        .limit(20);
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Sem músicas ativas.');
    return data;
  };

  const buildQuestion = async (): Promise<GameQuestion> => {
    const songs = await fetchRandomSongs();
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    const correct = shuffled[0];
    const titles = shuffled.map(s => s.title);

    const opts: string[] = [];
    for (let i = 0; i < Math.min(4, titles.length); i++) opts.push(titles[i]);
    while (opts.length < 4) {
      const r = shuffled[Math.floor(Math.random() * shuffled.length)];
      opts.push(`${r.title} (Alt ${opts.length})`);
    }
    const shuffledOptions = opts.sort(() => Math.random() - 0.5);
    const correctIndex = shuffledOptions.indexOf(correct.title);

    return {
      song: { ...correct, audioUrl: getAudioUrl(correct), duration_seconds: currentSettings.song_duration },
      options: shuffledOptions,
      correctAnswer: correctIndex,
    };
  };

  // ---- broadcast helpers
  const broadcastRoundStart = useCallback(async (q: GameQuestion, round: number) => {
    if (!sessionId || !gameChannelRef.current) return;

    const payload = {
      question: q,
      round,
      settings: currentSettings,
      startedAt: Date.now(),
    };

    await gameChannelRef.current.send({
      type: 'broadcast',
      event: 'ROUND_START',
      payload,
    });

    // aplica no host também
    setCurrentQuestion(q);
    setCurrentRound(round);
    setSelectedAnswer(null);
    setAnswersByOption({});
    setGameState('playing');
    startRoundTimer(currentSettings.time_per_question);
  }, [currentSettings, sessionId, startRoundTimer]);

  const broadcastEndOfRound = useCallback(async (roomCode: string, playerEggs: number, sessionId: string) => {
    if (!sessionId || !gameChannelRef.current) return;

    await gameChannelRef.current.send({
      type: 'broadcast',
      event: 'ROUND_COMPLETE',
      payload: {
        roomCode,
        playerEggs,
        sessionId,
        completed: true
      }
    });
  }, []);

  const broadcastAnswer = useCallback(async (answerIndex: number) => {
    if (!sessionId || !gameChannelRef.current) return;
    await gameChannelRef.current.send({
      type: 'broadcast',
      event: 'ANSWER',
      payload: {
        answerIndex,
        participantId: clientId.current,
        name: profile.current.displayName || 'Jogador',
        avatar: profile.current.avatar || '🐔',
      },
    });
  }, [sessionId]);

  // ---- ações públicas
  const startFirstRound = useCallback(async () => {
    setAudioUnlocked(true);

    if (sessionId && isHost) {
      try {
        const q = await buildQuestion();
        await broadcastRoundStart(q, 1);
      } catch (e) {
        console.error('[host] erro ao iniciar 1ª rodada:', e);
        toast({ title: 'Erro', description: 'Não foi possível iniciar a rodada.', variant: 'destructive' });
      }
      return;
    }

    // fallback single-player (sem sid)
    setGameState('playing');
    startRoundTimer(currentSettings.time_per_question);
  }, [sessionId, isHost, startRoundTimer, currentSettings.time_per_question, broadcastRoundStart, toast]);

  const handleAnswerSelect = useCallback((idx: number) => {
    if (gameState !== 'playing' || selectedAnswer !== null) return;

    setSelectedAnswer(idx);
    setAnswerTime(currentSettings.time_per_question - timeLeft);

    if (currentQuestion && idx === currentQuestion.correctAnswer) {
      const base  = currentSettings.eggs_per_correct;
      const bonus = timeLeft > (currentSettings.time_per_question * 0.8) ? currentSettings.speed_bonus : 0;
      setPlayerEggs(e => e + base + bonus);
    }

    // avatar local
    setAnswersByOption(prev => {
      const next = { ...prev };
      const list = next[idx] ? [...next[idx]] : [];
      if (!list.find(p => p.id === clientId.current)) {
        list.push({ id: clientId.current, name: profile.current.displayName || 'Jogador', avatar: profile.current.avatar || '🐔' });
      }
      next[idx] = list;
      return next;
    });

    broadcastAnswer(idx);
  }, [gameState, selectedAnswer, currentSettings, timeLeft, currentQuestion, broadcastAnswer]);

  // ---- inicialização (carrega config + liga Realtime + descobre host)
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        // carrega configurações (opcional)
        const { data, error } = await supabase.from('game_settings').select('key,value');
        if (!error && data) {
          const s: any = {};
          data.forEach(row => { s[row.key] = parseInt(String(row.value), 10); });
          if (!cancelled) {
            setCurrentSettings(prev => ({ ...prev, ...s }));
          }
        }
      } catch {
          // usa defaults silenciosamente
      }

      // se houver sessão, conecta no canal e descobre se sou host
      if (sessionId) {
        try {
          const ch = supabase.channel(`game:${sessionId}`, {
            config: { broadcast: { ack: true }, presence: { key: clientId.current } }
          });

          ch.on('broadcast', { event: 'ROUND_START' }, (msg) => {
            const { question, round, settings, startedAt } = msg.payload as {
              question: GameQuestion; round: number; settings: typeof currentSettings; startedAt: number;
            };

            setCurrentQuestion(question);
            setCurrentRound(round);
            setCurrentSettings(settings);
            setSelectedAnswer(null);
            setAnswersByOption({});
            setGameState('playing');

            const elapsed = Math.floor((Date.now() - startedAt) / 1000);
            const duration = settings.time_per_question;
            const remaining = Math.max(1, duration - elapsed);
            startRoundTimer(remaining);
          });

          ch.on('broadcast', { event: 'ANSWER' }, (msg) => {
            const { answerIndex, participantId, name, avatar } = msg.payload as {
              answerIndex: number; participantId: string; name: string; avatar: string;
            };
            setAnswersByOption(prev => {
              const next = { ...prev };
              const list = next[answerIndex] ? [...next[answerIndex]] : [];
              if (!list.find(p => p.id === participantId)) {
                list.push({ id: participantId, name, avatar });
              }
              next[answerIndex] = list;
              return next;
            });
          });

          ch.on('broadcast', { event: 'ROUND_COMPLETE' }, (msg) => {
            const { roomCode, sessionId } = msg.payload as {
              roomCode: string; sessionId: string;
            };
            console.log('[realtime] Round complete, redirecting to lobby...');
            const navigateEvent = new CustomEvent("navigateToRoundLobby", {
              detail: { roomCode, playerEggs, sessionId }
            });
            window.dispatchEvent(navigateEvent);
          });

          ch.subscribe((status) => {
            console.log('[realtime] game channel status:', status);
          });

          gameChannelRef.current = ch;

          // tenta descobrir se sou host
          try {
            const { data: room } = await supabase
                .from('game_rooms')
                .select('id')
                .eq('room_code', roomCode)
                .maybeSingle();

            if (room?.id) {
              const { data: me } = await supabase
                  .from('room_participants')
                  .select('is_host,client_id')
                  .eq('room_id', room.id)
                  .eq('client_id', clientId.current)
                  .maybeSingle();

              if (!cancelled) setIsHost(!!me?.is_host);
            }
          } catch {
              /* ok */
          }
        } catch (e) {
          console.error('[realtime] erro ao iniciar canal:', e);
        }
      }

      if (!cancelled) setIsLoading(false);
    };

    init();

    return () => {
      cancelled = true;
      clearTimers();
      if (gameChannelRef.current) supabase.removeChannel(gameChannelRef.current);
    };
  }, [sessionId, roomCode, clearTimers, startRoundTimer]);

  // próxima rodada (host)
  useEffect(() => {
    if (!sessionId || !isHost) return;
    if (gameState !== 'transition') return;

    (async () => {
      try {
        const nextRound = currentRound + 1;
        if (nextRound > 10) {
          // Ao final da 10ª pergunta, host dispara evento para todos redirecionarem
          console.log('[host] Fim das 10 perguntas, enviando broadcast para redirecionar todos');
          await broadcastEndOfRound(roomCode, playerEggs, sessionId);
          
          // Host também precisa ser redirecionado
          setTimeout(() => {
            const navigateEvent = new CustomEvent("navigateToRoundLobby", {
              detail: { roomCode, playerEggs, sessionId }
            });
            window.dispatchEvent(navigateEvent);
          }, 1000);
          return;
        }
        const q = await buildQuestion();
        await broadcastRoundStart(q, nextRound);
      } catch (err) {
        console.error('[host] erro ao iniciar próxima rodada:', err);
        toast({ title: 'Erro', description: 'Falha ao iniciar a próxima rodada.', variant: 'destructive' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, roomCode, playerEggs, sessionId, broadcastEndOfRound]);



  return {
    // estado
    isLoading,
    gameState,
    currentRound,
    timeLeft,
    selectedAnswer,
    showResults: gameState === 'reveal',
    currentQuestion,
    gameStarted: gameState !== 'idle',

    // áudio
    audioUnlocked,

    // ações
    handleAnswerSelect,
    startFirstRound,

    // placar próprio
    playerEggs,
    answerTime,
    currentSettings,

    // sync
    isHost,
    answersByOption,
  };
};
