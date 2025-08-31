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

  // NOVOS CAMPOS (para Spotify)
  spotify_track_id?: string;
  embed_url?: string;
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

/* ----------------------------- HELPERS SPOTIFY ----------------------------- */

async function getGameMode(): Promise<'mp3' | 'spotify'> {
  // tabela key/value: key='game_mode', value='"spotify"' ou '"mp3"'
  const { data, error } = await supabase
      .from('game_settings')
      .select('value')
      .eq('key', 'game_mode')
      .maybeSingle();

  if (error) {
    console.warn('[useGameLogic] game_mode fallback mp3 (erro ao ler game_settings)', error);
    return 'mp3';
  }

  const raw = data?.value;
  // value costuma vir como string JSON com aspas: "\"spotify\"" → normalizar
  const normalized =
      typeof raw === 'string' ? raw.replaceAll('"', '') : 'mp3';

  return normalized === 'spotify' ? 'spotify' : 'mp3';
}

async function getRoomByCode(roomCode: string) {
  const { data, error } = await supabase
      .from('game_rooms')
      .select(
          'id, room_code, status, selected_spotify_album_id, selected_genre_id, next_genre_id'
      )
      .eq('room_code', roomCode)
      .maybeSingle();

  if (error) throw error;
  return data;
}

/** Busca outras músicas do mesmo gênero para usar como opções incorretas (Spotify) */
async function getOtherSpotifyTracksFromGenre(genreId: string, excludeTrackId: string, limit: number = 10): Promise<string[]> {
  const { data: tracks, error } = await supabase
      .from('spotify_tracks')
      .select('track_name, spotify_albums!inner(genre_id)')
      .eq('spotify_albums.genre_id', genreId)
      .neq('id', excludeTrackId)
      .limit(limit);

  if (error || !tracks) return [];
  return tracks.map(t => t.track_name);
}

/** Busca outras músicas do mesmo gênero para usar como opções incorretas (MP3) */
async function getOtherMP3TracksFromGenre(genreId: string, excludeSongId: string, limit: number = 10): Promise<string[]> {
  const { data: songs, error } = await supabase
      .from('songs')
      .select('title')
      .eq('genre_id', genreId)
      .neq('id', excludeSongId)
      .limit(limit);

  if (error || !songs) return [];
  return songs.map(s => s.title);
}

/** Sorteia UMA faixa do Spotify, priorizando:
 * 1) Álbum escolhido (selected_spotify_album_id)
 * 2) Qualquer álbum do gênero (selected_genre_id ou next_genre_id)
 * Retorna track + nome do artista via join em spotify_albums
 */
async function pickOneSpotifyTrack(room: any): Promise<{
  id: string; // uuid (id da track)
  track_name: string;
  duration_ms: number;
  embed_url?: string;
  spotify_track_id?: string;
  artist_name?: string;
  genre_id?: string;
} | null> {
  // 1) pelo álbum escolhido
  if (room?.selected_spotify_album_id) {
    const { data: tracks, error } = await supabase
        .from('spotify_tracks')
        .select(
            'id, spotify_track_id, track_name, duration_ms, embed_url, spotify_album_id, spotify_albums!inner(artist_name, genre_id)'
        )
        .eq('spotify_album_id', room.selected_spotify_album_id);

    if (!error && tracks && tracks.length > 0) {
      const rnd = Math.floor(Math.random() * tracks.length);
      const t = tracks[rnd];
      return {
        id: t.id,
        track_name: t.track_name,
        duration_ms: t.duration_ms,
        embed_url: t.embed_url || (t.spotify_track_id ? `https://open.spotify.com/embed/track/${t.spotify_track_id}?utm_source=generator&theme=0` : undefined),
        spotify_track_id: t.spotify_track_id,
        artist_name: (t as any)?.spotify_albums?.artist_name,
          genre_id: (t as any)?.spotify_albums?.genre_id,
    };
    }
  }

  // 2) pelo gênero selecionado
  const genreId = room?.selected_genre_id || room?.next_genre_id;
  if (genreId) {
    const { data: tracks, error } = await supabase
        .from('spotify_tracks')
        .select(
            'id, spotify_track_id, track_name, duration_ms, embed_url, spotify_album_id, spotify_albums!inner(id, genre_id, artist_name)'
        )
        .eq('spotify_albums.genre_id', genreId);

    if (!error && tracks && tracks.length > 0) {
      const rnd = Math.floor(Math.random() * tracks.length);
      const t = tracks[rnd];
      return {
        id: t.id,
        track_name: t.track_name,
        duration_ms: t.duration_ms,
        embed_url: t.embed_url || (t.spotify_track_id ? `https://open.spotify.com/embed/track/${t.spotify_track_id}?utm_source=generator&theme=0` : undefined),
        spotify_track_id: t.spotify_track_id,
        artist_name: (t as any)?.spotify_albums?.artist_name,
          genre_id: (t as any)?.spotify_albums?.genre_id,
    };
    }
  }

  return null;
}

/** Gera opções com músicas reais do mesmo gênero */
async function buildOptionsFromGenre(
    correctTitle: string,
    genreId: string,
    excludeId: string,
    mode: 'mp3' | 'spotify'
): Promise<string[]> {
  const options = [correctTitle];

  // Busca outras músicas do mesmo gênero
  const otherTracks = mode === 'spotify'
      ? await getOtherSpotifyTracksFromGenre(genreId, excludeId, 10)
      : await getOtherMP3TracksFromGenre(genreId, excludeId, 10);

  // Se temos outras músicas do gênero, usa elas
  if (otherTracks.length >= 3) {
    // Embaralha e pega 3 opções incorretas
    const shuffled = otherTracks.sort(() => Math.random() - 0.5);
    options.push(...shuffled.slice(0, 3));
  } else {
    // Fallback: gera opções baseadas no título (como estava antes)
    console.warn(`[buildOptionsFromGenre] Poucas músicas do gênero (${otherTracks.length}), usando fallback`);
    const fallbackOptions = [`${correctTitle} (Remix)`, `${correctTitle} (Live)`, `${correctTitle} (Acoustic)`];
    options.push(...fallbackOptions.slice(0, 3));
  }

  // Embaralha todas as opções para randomizar a posição da resposta correta
  return options.sort(() => Math.random() - 0.5);
}

/** Gera 3 alternativas extras a partir do próprio pool de faixas (fallback antigo).
 * Mantido como backup se buildOptionsFromGenre falhar */
function buildOptionsFromTitles(correctTitle: string, poolTitles: string[] = []): string[] {
  const set = new Set<string>([correctTitle]);
  while (set.size < 4) {
    const fallbackTitle =
        poolTitles[Math.floor(Math.random() * Math.max(1, poolTitles.length))] ||
        `${correctTitle} (Alt ${set.size})`;
    set.add(fallbackTitle);
  }
  return Array.from(set).sort(() => Math.random() - 0.5);
}

/* ----------------------------- HOOK PRINCIPAL ------------------------------ */

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
  const [players, setPlayers] = useState<PlayerFace[] & { eggs: number }[]>([]);
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
  const [activeGenre, setActiveGenre] = useState<{ id: string; name: string; emoji: string; description?: string } | null>(null);

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

  /* ---------------------- BUSCA DE PERGUNTA (SPOTIFY/MP3) ---------------------- */

  /** Busca músicas MP3 respeitando seu edge function de gênero (flow atual) */
  const fetchSongsWithGenre = async (): Promise<Song[]> => {
    try {
      const { data: response, error } = await supabase.functions.invoke('game-manager', {
        body: {
          action: 'getSongsForGenre',
          roomCode,
          roundNumber: currentRound
        }
      });

      if (error) {
        console.error('Erro ao buscar músicas:', error);
        throw error;
      }

      const { songs, activeGenreId, usedFallback, totalAvailable } = response;

      if (!songs || songs.length === 0) {
        throw new Error('Nenhuma música encontrada na base de dados');
      }

      if (activeGenreId) {
        console.log(`🎵 Usando ${usedFallback ? 'fallback' : 'gênero específico'} | ${totalAvailable} músicas disponíveis`);
        if (usedFallback) {
          toast({
            title: '⚠️ Fallback Ativado',
            description: 'Poucas músicas do gênero selecionado. Usando catálogo completo.',
            variant: 'default'
          });
        }
      }

      return songs;
    } catch (error) {
      console.error('Erro ao buscar músicas:', error);
      throw error;
    }
  };

  /** Monta a próxima questão priorizando Spotify quando game_mode = spotify */
  const buildQuestion = async (): Promise<GameQuestion> => {
    const mode = await getGameMode();
    const room = await getRoomByCode(roomCode);

    if (mode === 'spotify') {
      const track = await pickOneSpotifyTrack(room);

      if (track) {
        const durationSec = Math.max(
            5,
            Math.round((track.duration_ms || currentSettings.song_duration * 1000) / 1000)
        );

        // Usa o gênero da sala ou da track para buscar outras músicas
        const genreId = room?.selected_genre_id || track.genre_id;

        let options: string[];
        if (genreId) {
          try {
            options = await buildOptionsFromGenre(track.track_name, genreId, track.id, 'spotify');
          } catch (error) {
            console.warn('[buildQuestion] Erro ao buscar opções do gênero, usando fallback:', error);
            options = buildOptionsFromTitles(track.track_name);
          }
        } else {
          options = buildOptionsFromTitles(track.track_name);
        }

        const correctIdx = options.indexOf(track.track_name);

        const q: GameQuestion = {
          song: {
            id: track.id,
            title: track.track_name,
            artist: track.artist_name || '',
            duration_seconds: durationSec,
            // IMPORTANTE: não definir audioUrl para não cair em MP3
            spotify_track_id: track.spotify_track_id,
            embed_url: track.embed_url,
          },
          options,
          correctAnswer: correctIdx >= 0 ? correctIdx : 0,
        };

        console.log('[useGameLogic] next question (spotify)', {
              mode,
              selected_spotify_album_id: room?.selected_spotify_album_id ?? null,
            selected_genre_id: room?.selected_genre_id ?? null,
            next_genre_id: room?.next_genre_id ?? null,
            trackId: track.spotify_track_id,
            embed_url: track.embed_url,
            genreUsedForOptions: genreId
      });

        return q;
      }

      console.warn('[useGameLogic] Spotify ativo, mas sem faixas encontradas. Caindo para MP3...');
    }

    // Fallback: MP3 (seja porque o modo é mp3 ou porque não achou faixas Spotify)
    const songs = await fetchSongsWithGenre();
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    const correct = shuffled[0];

    // Para MP3, tenta usar o gênero da sala ou busca no pool de músicas retornadas
    const genreId = room?.selected_genre_id || room?.next_genre_id;

    let options: string[];
    if (genreId) {
      try {
        options = await buildOptionsFromGenre(correct.title, genreId, correct.id, 'mp3');
      } catch (error) {
        console.warn('[buildQuestion] Erro ao buscar opções do gênero (MP3), usando pool local:', error);
        const titlesPool = shuffled.map(s => s.title);
        options = buildOptionsFromTitles(correct.title, titlesPool);
      }
    } else {
      // Usa o pool de músicas retornadas
      const titlesPool = shuffled.map(s => s.title);
      options = buildOptionsFromTitles(correct.title, titlesPool);
    }

    const correctIndex = options.indexOf(correct.title);

    const question: GameQuestion = {
      song: { ...correct, audioUrl: getAudioUrl(correct), duration_seconds: currentSettings.song_duration },
      options,
      correctAnswer: correctIndex >= 0 ? correctIndex : 0,
    };

    console.log('[useGameLogic] next question (mp3 fallback)', {
      genreUsedForOptions: genreId,
      optionsFromGenre: genreId ? true : false
    });
    return question;
  };

  /* ------------------------------- BROADCAST ------------------------------- */

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

  /* --------------------------------- AÇÕES -------------------------------- */

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
    const responseTime = currentSettings.time_per_question - timeLeft;
    setAnswerTime(responseTime);

    const isCorrect = currentQuestion && idx === currentQuestion.correctAnswer;
    if (isCorrect) {
      const base  = currentSettings.eggs_per_correct;
      const bonus = timeLeft > (currentSettings.time_per_question * 0.8) ? currentSettings.speed_bonus : 0;
      setPlayerEggs(e => e + base + bonus);
    }

    // Salvar estatísticas do jogador no Supabase (modo multiplayer)
    if (sessionId) {
      (async () => {
        try {
          const { data: room } = await supabase
              .from('game_rooms')
              .select('id')
              .eq('room_code', roomCode)
              .maybeSingle();

          if (room?.id) {
            // Buscar dados atuais do participante
            const { data: participant } = await supabase
                .from('room_participants')
                .select('current_eggs, correct_answers, total_answers, total_response_time')
                .eq('room_id', room.id)
                .eq('client_id', clientId.current)
                .maybeSingle();

            if (participant) {
              const newEggs = participant.current_eggs + (isCorrect ? currentSettings.eggs_per_correct + (timeLeft > (currentSettings.time_per_question * 0.8) ? currentSettings.speed_bonus : 0) : 0);
              const newCorrectAnswers = participant.correct_answers + (isCorrect ? 1 : 0);
              const newTotalAnswers = participant.total_answers + 1;
              const newTotalResponseTime = participant.total_response_time + responseTime;

              // Atualizar estatísticas do participante
              await supabase
                  .from('room_participants')
                  .update({
                    current_eggs: newEggs,
                    correct_answers: newCorrectAnswers,
                    total_answers: newTotalAnswers,
                    total_response_time: newTotalResponseTime
                  })
                  .eq('room_id', room.id)
                  .eq('client_id', clientId.current);
              await loadPlayersFromRoom();

            }
          }
        } catch (error) {
          console.error('[stats] Erro ao salvar estatísticas:', error);
        }
      })();
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
  }, [gameState, selectedAnswer, currentSettings, timeLeft, currentQuestion, broadcastAnswer, sessionId, roomCode]);


  const loadPlayersFromRoom = useCallback(async () => {
    try {
      const { data: room } = await supabase
          .from('game_rooms')
          .select('id')
          .eq('room_code', roomCode)
          .maybeSingle();

      if (room?.id) {
        const { data: participants, error } = await supabase
            .from('room_participants')
            .select('client_id, display_name, avatar, current_eggs')
            .eq('room_id', room.id);

        if (!error && participants) {
          const playerList = participants.map(p => ({
            id: p.client_id,
            name: p.display_name || 'Jogador',
            avatar: p.avatar || '🐔',
            eggs: p.current_eggs || 0
          }));

          setPlayers(playerList);
        }
      }
    } catch (e) {
      console.error('[loadPlayersFromRoom] erro ao carregar jogadores:', e);
    }
  }, [roomCode]);

  /* -------------------------- INICIALIZAÇÃO/REALTIME ------------------------- */

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

      // Carregar gênero ativo da sala
      try {
        const { data: genreResponse } = await supabase.functions.invoke('game-manager', {
          body: {
            action: 'getActiveGenre',
            roomCode
          }
        });

        if (!cancelled && genreResponse?.activeGenre) {
          setActiveGenre(genreResponse.activeGenre);
        }
      } catch (error) {
        console.error('Erro ao carregar gênero ativo:', error);
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
      await loadPlayersFromRoom();

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
    activeGenre,
    players,
  };
};