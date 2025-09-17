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

// Adicione estas interfaces após as existentes
export interface EggTransferEvent {
  id: string;
  losers: PlayerFace[];
  winners: PlayerFace[];
  eggsPerTransfer: number;
  timestamp: number;
}

export interface PlayerEggChange {
  playerId: string;
  previousEggs: number;
  newEggs: number;
  change: number;
  timestamp: number;
}

export type GameState = 'idle' | 'playing' | 'reveal' | 'transition' | 'finished';
type AnswersByOption = Record<number, PlayerFace[]>;

function getAudioUrl(song: Song): string {
  // Para Spotify, verificar se é embed
  if (song.spotify_track_id && song.embed_url) {
    return song.embed_url; // Retorna a URL do embed
  }

  // Para MP3 normal
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
    // console.warn('[useGameLogic] game_mode fallback mp3 (erro ao ler game_settings)', error);
    return 'mp3';
  }

  const raw = data?.value;
  // value costuma vir como string JSON com aspas: "\"spotify\"" → normalizar
  const normalized =
      typeof raw === 'string' ? raw.replace(/"/g, '') : 'mp3';

  return normalized === 'spotify' ? 'spotify' : 'mp3';
}

async function getRoomByCode(roomCode: string) {
  const { data, error } = await supabase
      .from('game_rooms')
      .select(
          // ✅ ADICIONAR o novo campo
          'id, room_code, status, selected_spotify_album_id, selected_mp3_album_id, selected_genre_id, next_genre_id, is_random_selection'
      )
      .eq('room_code', roomCode)
      .maybeSingle();

  if (error) throw error;
  return data;
}

/** Busca outras músicas do mesmo gênero para usar como opções incorretas (Spotify) */
async function getOtherSpotifyTracksFromGenre(genreId: string, excludeTrackId: string, limit: number = 10): Promise<string[]> {
  try {
    // CORREÇÃO: Query mais simples
    const { data: albums, error: albumError } = await supabase
        .from('spotify_albums')
        .select('id')
        .eq('genre_id', genreId)
        .limit(10);

    if (albumError || !albums) {
      console.error('[getOtherSpotifyTracksFromGenre] Error getting albums:', albumError);
      return [];
    }

    const albumIds = albums.map(album => album.id);

    const { data: tracks, error } = await supabase
        .from('spotify_tracks')
        .select('track_name')
        .in('spotify_album_id', albumIds)
        .neq('id', excludeTrackId)
        .limit(limit);

    if (error) {
      console.error('[getOtherSpotifyTracksFromGenre] Error getting tracks:', error);
      return [];
    }

    return tracks?.map(t => t.track_name) || [];
  } catch (error) {
    console.error('[getOtherSpotifyTracksFromGenre] Catch error:', error);
    return [];
  }
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
async function pickOneSpotifyTrack(room: any, excludeIds: string[] = []): Promise<{
  id: string;
  track_name: string;
  duration_ms: number;
  embed_url?: string;
  spotify_track_id?: string;
  artist_name?: string;
  genre_id?: string;
} | null> {
  console.log('🎵 [pickOneSpotifyTrack] Iniciando busca...');
  console.log('🎵 [pickOneSpotifyTrack] Room data:', room);
  console.log('🎵 [pickOneSpotifyTrack] Excluded IDs:', excludeIds);

  if (room?.selected_spotify_album_id) {
    console.log('🎵 [pickOneSpotifyTrack] Buscando por album ID:', room.selected_spotify_album_id);

    // CORREÇÃO: Query simples sem filtros complexos
    const { data: tracks, error } = await supabase
        .from('spotify_tracks')
        .select('*')
        .eq('spotify_album_id', room.selected_spotify_album_id);

    console.log('🎵 [pickOneSpotifyTrack] Query result:', { tracks, error, count: tracks?.length });

    if (!error && tracks && tracks.length > 0) {
      // Filtrar exclusões em JavaScript
      const availableTracks = excludeIds.length > 0
          ? tracks.filter(track => !excludeIds.includes(track.id))
          : tracks;

      console.log('🎵 [pickOneSpotifyTrack] Available tracks after filter:', availableTracks.length);

      if (availableTracks.length === 0) {
        console.log('🎵 [pickOneSpotifyTrack] Todas as tracks foram usadas');
        return null;
      }

      // Buscar dados do álbum separadamente
      const { data: albumData, error: albumError } = await supabase
          .from('spotify_albums')
          .select('artist_name, genre_id')
          .eq('id', room.selected_spotify_album_id)
          .single();

      console.log('🎵 [pickOneSpotifyTrack] Album data:', albumData);

      const rnd = Math.floor(Math.random() * availableTracks.length);
      const t = availableTracks[rnd];

      const result = {
            id: t.id,
            track_name: t.track_name,
            duration_ms: t.duration_ms,
            embed_url: t.embed_url || (t.spotify_track_id ? `https://open.spotify.com/embed/track/${t.spotify_track_id}?utm_source=generator&theme=0` : undefined),
            spotify_track_id: t.spotify_track_id,
            artist_name: albumData?.artist_name,
          genre_id: albumData?.genre_id, // Agora albumData está definido
    };

      console.log('🎵 [pickOneSpotifyTrack] Track selecionada:', result);
      return result;
    } else {
      console.log('🎵 [pickOneSpotifyTrack] Erro ou nenhuma track:', error);
    }
  } else {
    console.log('🎵 [pickOneSpotifyTrack] Nenhum album selecionado na sala');
  }

  // CORREÇÃO: Remover a busca por gênero que estava causando problemas
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
    // console.warn(`[buildOptionsFromGenre] Poucas músicas do gênero (${otherTracks.length}), usando fallback`);
    const fallbackOptions = [`${correctTitle} (Remix)`, `${correctTitle} (Live)`, `${correctTitle} (Acoustic)`];
    options.push(...fallbackOptions.slice(0, 3));
  }

  // Embaralha todas as opções para randomizar a posição da resposta correta
  return options.sort(() => Math.random() - 0.5);
}

/** Gera 3 alternativas extras a partir do próprio pool de faixas (fallback antigo).
 * Mantido como backup se buildOptionsFromGenre falhar */
function buildOptionsFromTitles(correctTitle: string, poolTitles: string[] = []): string[] {
  // console.log('🔧 [buildOptionsFromTitles] Entrada:', { correctTitle, poolTitlesCount: poolTitles.length });

  const options = [correctTitle];
  const availablePool = poolTitles.filter(title => title !== correctTitle);

  // console.log('🔧 [buildOptionsFromTitles] Pool disponível:', availablePool.length);

  // Se temos títulos suficientes no pool, usar eles
  if (availablePool.length >= 3) {
    const shuffled = [...availablePool].sort(() => Math.random() - 0.5);
    options.push(...shuffled.slice(0, 3));
    // console.log('🔧 [buildOptionsFromTitles] Usando pool:', options);
  } else {
    // Se não temos títulos suficientes, criar opções genéricas
    // console.log('🔧 [buildOptionsFromTitles] Pool insuficiente, criando opções genéricas');

    // Adicionar títulos do pool se existirem
    options.push(...availablePool);

    // Completar com opções genéricas
    const genericOptions = [
      `${correctTitle} (Remix)`,
      `${correctTitle} (Live)`,
      `${correctTitle} (Acoustic)`,
      `${correctTitle} (Radio Edit)`,
      `${correctTitle} (Extended)`
    ];

    for (const genericOption of genericOptions) {
      if (options.length >= 4) break;
      if (!options.includes(genericOption)) {
        options.push(genericOption);
      }
    }

    // Se ainda não temos 4 opções, completar com numeradas
    let counter = 1;
    while (options.length < 4) {
      const fallbackOption = `Música ${counter}`;
      if (!options.includes(fallbackOption)) {
        options.push(fallbackOption);
      }
      counter++;

      // Proteção contra loop infinito
      if (counter > 10) {
        // console.error('🔧 [buildOptionsFromTitles] Loop detectado, forçando saída');
        break;
      }
    }
  }

  // Embaralhar as opções finais
  const finalOptions = options.sort(() => Math.random() - 0.5);
  // console.log('🔧 [buildOptionsFromTitles] Opções finais:', finalOptions);

  return finalOptions;
}

/* ----------------------------- HOOK PRINCIPAL ------------------------------ */

export const useGameLogic = (roomCode: string, sessionId?: string, isSpectator: boolean = false) => {
  const { toast } = useToast();

  // identidade local
  const clientId = useRef(getOrCreateClientId());
  const profile  = useRef(loadProfile()); // { displayName, avatar }

  // ADICIONE ESTA LINHA AQUI DENTRO:
  const [redistributionProcessed, setRedistributionProcessed] = useState<Record<number, boolean>>({});

  // estado principal
  const [isLoading, setIsLoading] = useState(true);
  const [gameState, setGameState] = useState<GameState>('idle');
  const [currentRound, setCurrentRound] = useState(1);
  const [timeLeft, setTimeLeft] = useState(15);
  const [currentQuestion, setCurrentQuestion] = useState<GameQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [selectedAlbumInfo, setSelectedAlbumInfo] = useState<{
    name: string;
    artist: string;
    genre: string;
    coverImage?: string;
  } | null>(null);
  const [playerEggs, setPlayerEggs] = useState(0);
  const [players, setPlayers] = useState<PlayerFace[] & { eggs: number }[]>([]);
  const [answerTime, setAnswerTime] = useState<number | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [usedSongIds, setUsedSongIds] = useState<string[]>([]);
  const [usedOptionTitles, setUsedOptionTitles] = useState<string[]>([]);
  const [albums, setAlbums] = useState<Mp3Album[]>([]);

  // NOVOS ESTADOS PARA EFEITOS VISUAIS
  const [eggTransferEvents, setEggTransferEvents] = useState<EggTransferEvent[]>([]);
  const [playerEggChanges, setPlayerEggChanges] = useState<PlayerEggChange[]>([]);
  const [previousPlayerEggs, setPreviousPlayerEggs] = useState<Record<string, number>>({});
  const [showEggEffects, setShowEggEffects] = useState(true);


  // Adicione após os estados existentes
  const [battleMode, setBattleMode] = useState<'classic' | 'battle'>('classic');
  const [battleSettings, setBattleSettings] = useState({
    eggsPerRound: 10,
    totalRounds: 10,
    initialEggs: 100
  });
  const [roundAnswers, setRoundAnswers] = useState<Record<string, { answer: number; responseTime: number }>>({});

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
    console.log('🎵 [fetchSongsWithGenre] INÍCIO');

    try {
      const mode = await getGameMode();
      console.log('🎵 [fetchSongsWithGenre] Modo:', mode);

      if (mode === 'spotify') {
        console.log('🎵 [fetchSongsWithGenre] Modo Spotify - retornando vazio');
        return [];
      }

      console.log('🎵 [fetchSongsWithGenre] Buscando dados da sala...');
      const { data: roomData, error: roomError } = await supabase
          .from('game_rooms')
          .select('selected_mp3_album_id, is_random_selection')
          .eq('room_code', roomCode)
          .single();

      if (roomError) {
        console.error('🎵 [fetchSongsWithGenre] Erro ao buscar sala:', roomError);
        throw roomError;
      }

      console.log('🎵 [fetchSongsWithGenre] Dados da sala:', roomData);

      // SELEÇÃO ALEATÓRIA
      if (roomData?.is_random_selection === true) {
        console.log('🎲 [fetchSongsWithGenre] SELEÇÃO ALEATÓRIA detectada');

        const { data: randomSongs, error: randomError } = await supabase
            .from('album_songs')
            .select(`
          songs (
            id,
            title,
            artist,
            audio_file_url,
            preview_url,
            duration_seconds,
            spotify_track_id,
            embed_url
          )
        `)
            .not('songs.audio_file_url', 'is', null)
            .not('songs.id', 'in', `(${usedSongIds.length > 0 ? usedSongIds.join(',') : 'null'})`)
            .order('random()')
            .limit(50);

        console.log('🎲 [fetchSongsWithGenre] Query result:', {
              data: randomSongs?.length || 0,
            error: randomError?.message
      });

        if (!randomError && randomSongs && randomSongs.length > 0) {
          console.log(`🎲 [fetchSongsWithGenre] ${randomSongs.length} músicas aleatórias encontradas`);

          const songs = randomSongs
              .map(item => item.songs)
              .filter(song => song !== null)
              .map(song => ({
                id: song.id,
                title: song.title,
                artist: song.artist,
                audio_file_url: song.audio_file_url,
                preview_url: song.preview_url,
                duration_seconds: song.duration_seconds || 15,
                spotify_track_id: song.spotify_track_id || undefined,
                embed_url: song.embed_url || undefined,
              }));

          console.log('🎲 [fetchSongsWithGenre] Músicas processadas:', songs.length);
          return songs;
        }

        console.log('🎲 [fetchSongsWithGenre] Nenhuma música encontrada na seleção aleatória');
      }

      // ÁLBUM ESPECÍFICO
      if (roomData?.selected_mp3_album_id && !roomData.is_random_selection) {
        console.log('🎵 [fetchSongsWithGenre] Álbum específico:', roomData.selected_mp3_album_id);

        const { data: albumSongs, error: songsError } = await supabase
            .from('album_songs')
            .select(`
          songs (
            id,
            title,
            artist,
            audio_file_url,
            preview_url,
            duration_seconds,
            spotify_track_id,
            embed_url
          )
        `)
            .eq('album_id', roomData.selected_mp3_album_id)
            .not('song_id', 'in', `(${usedSongIds.length > 0 ? usedSongIds.join(',') : 'null'})`);

        console.log('🎵 [fetchSongsWithGenre] Album songs result:', {
              data: albumSongs?.length || 0,
            error: songsError?.message
      });

        if (!songsError && albumSongs && albumSongs.length > 0) {
          const songs = albumSongs
              .map(item => item.songs)
              .filter(song => song !== null)
              .map(song => ({
                id: song.id,
                title: song.title,
                artist: song.artist,
                audio_file_url: song.audio_file_url,
                preview_url: song.preview_url,
                duration_seconds: song.duration_seconds || 15,
                spotify_track_id: song.spotify_track_id || undefined,
                embed_url: song.embed_url || undefined,
              }));

          console.log('🎵 [fetchSongsWithGenre] Músicas do álbum processadas:', songs.length);
          return songs;
        }
      }

      // FALLBACK PARA EDGE FUNCTION
      console.log('🎵 [fetchSongsWithGenre] Usando edge function como fallback');
      const { data: response, error } = await supabase.functions.invoke('game-manager', {
        body: {
          action: 'getSongsForGenre',
          roomCode,
          roundNumber: currentRound,
          excludeSongIds: usedSongIds
        }
      });

      if (error) {
        console.error('🎵 [fetchSongsWithGenre] Erro na edge function:', error);
        throw error;
      }

      console.log('🎵 [fetchSongsWithGenre] Edge function result:', response);

      const { songs } = response;
      return songs || [];

    } catch (error) {
      console.error('🎵 [fetchSongsWithGenre] ERRO GERAL:', error);
      throw error;
    }
  };

  // Função para detectar mudanças nos ovos dos jogadores
  const detectEggChanges = useCallback((currentPlayers: PlayerFace[]) => {
    const changes: PlayerEggChange[] = [];
    const newEggState: Record<string, number> = {};

    currentPlayers.forEach(player => {
      const currentEggs = player.eggs || 0;
      const previousEggs = previousPlayerEggs[player.id] ?? currentEggs;
      const change = currentEggs - previousEggs;

      newEggState[player.id] = currentEggs;

      if (change !== 0) {
        changes.push({
          playerId: player.id,
          previousEggs,
          newEggs: currentEggs,
          change,
          timestamp: Date.now()
        });
      }
    });

    if (changes.length > 0) {
      setPlayerEggChanges(prev => [...prev, ...changes]);
      console.log('🥚 [detectEggChanges] Mudanças detectadas:', changes);
    }

    setPreviousPlayerEggs(newEggState);
  }, [previousPlayerEggs]);

  // Função para criar evento de transferência de ovos
  const createEggTransferEvent = useCallback((
      losers: PlayerFace[],
      winners: PlayerFace[],
      eggsPerTransfer: number
  ) => {
    if (!showEggEffects || losers.length === 0 || winners.length === 0) return;

    const transferEvent: EggTransferEvent = {
      id: `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      losers: losers.map(p => ({ ...p })), // Clone para evitar referência
      winners: winners.map(p => ({ ...p })), // Clone para evitar referência
      eggsPerTransfer,
      timestamp: Date.now()
    };

    setEggTransferEvents(prev => [...prev, transferEvent]);
    console.log('🎯 [createEggTransferEvent] Evento de transferência criado:', transferEvent);

    // Remover evento após 5 segundos
    setTimeout(() => {
      setEggTransferEvents(prev => prev.filter(event => event.id !== transferEvent.id));
    }, 5000);
  }, [showEggEffects]);



  // 1. ADICIONAR novas funções para buscar opções especificamente do álbum

  /** Busca outras músicas do mesmo ÁLBUM para usar como opções incorretas (MP3) */
  async function getOtherMP3TracksFromAlbum(
      albumId: string,
      excludeSongId: string,
      excludeTitles: string[] = [], // NOVO: títulos já usados
      limit: number = 50 // AUMENTAR limite
  ): Promise<string[]> {
    try {
      console.log('🛠 [getOtherMP3TracksFromAlbum] INÍCIO:', {
        albumId,
        excludeSongId,
        excludeTitles: excludeTitles.length,
        limit
      });

      const { data: albumSongs, error } = await supabase
          .from('album_songs')
          .select(`
        songs (
          id,
          title
        )
      `)
          .eq('album_id', albumId)
          .neq('song_id', excludeSongId)
          .limit(limit);

      if (error || !albumSongs) {
        console.error('🛠 [getOtherMP3TracksFromAlbum] ERRO:', error);
        return [];
      }

      const availableTitles = albumSongs
          .map(item => item.songs?.title)
    .filter(title => title && !excludeTitles.includes(title)) // FILTRAR títulos já usados
          .filter((title, index, self) => self.indexOf(title) === index); // Remove duplicatas

      console.log('🛠 [getOtherMP3TracksFromAlbum] TÍTULOS DISPONÍVEIS:', {
        total: albumSongs.length,
        afterFilter: availableTitles.length,
        excluded: excludeTitles.length
      });

      // EMBARALHAR para garantir variedade
      return availableTitles.sort(() => Math.random() - 0.5);

    } catch (error) {
      console.error('🛠 [getOtherMP3TracksFromAlbum] CATCH ERROR:', error);
      return [];
    }
  }
  /** Busca outras músicas do mesmo ÁLBUM para usar como opções incorretas (Spotify) */
  async function getOtherSpotifyTracksFromAlbum(
      spotifyAlbumId: string,
      excludeTrackId: string,
      excludeTitles: string[] = [], // NOVO: títulos já usados
      limit: number = 50 // AUMENTAR limite
  ): Promise<string[]> {
    try {
      const { data: tracks, error } = await supabase
          .from('spotify_tracks')
          .select('track_name')
          .eq('spotify_album_id', spotifyAlbumId)
          .neq('id', excludeTrackId)
          .limit(limit);

      if (error || !tracks) return [];

      const availableTitles = tracks
          .map(t => t.track_name)
          .filter(title => title && !excludeTitles.includes(title)) // FILTRAR títulos já usados
          .filter((title, index, self) => self.indexOf(title) === index);

      return availableTitles.sort(() => Math.random() - 0.5);

    } catch (error) {
      console.error('[getOtherSpotifyTracksFromAlbum] Erro:', error);
      return [];
    }
  }

  /** Gera opções com músicas reais do mesmo ÁLBUM - VERSÃO DEBUG */
  async function buildOptionsFromAlbumOrRandom(
      correctTitle: string,
      albumId: string,
      excludeId: string,
      mode: 'mp3' | 'spotify',
      isRandomSelection: boolean = false
  ): Promise<string[]> {
    try {
      console.log('🎯 [buildOptionsFromAlbumOrRandom]:', {
        correctTitle,
        albumId,
        excludeId,
        mode,
        isRandomSelection
      });

      const options = [correctTitle];

      if (isRandomSelection) {
        // Para seleção aleatória, buscar músicas de qualquer álbum
        console.log('🎲 Buscando opções de qualquer álbum para seleção aleatória');

        const { data: randomOptions, error } = await supabase
            .from('album_songs')
            .select(`
          songs (
            title
          )
        `)
            .neq('song_id', excludeId)
            .not('songs.title', 'eq', correctTitle)
            .order('random()')
            .limit(10);

        if (!error && randomOptions && randomOptions.length > 0) {
          const otherTracks = randomOptions
              .map(item => item.songs?.title)
        .filter(title => title && title !== correctTitle)
              .slice(0, 3);

          if (otherTracks.length >= 3) {
            options.push(...otherTracks);
          } else {
            options.push(...otherTracks);
            const needed = 4 - options.length;
            const fallbackOptions = [`${correctTitle} (Remix)`, `${correctTitle} (Live)`, `${correctTitle} (Acoustic)`];
            options.push(...fallbackOptions.slice(0, needed));
          }
        } else {
          // Fallback para seleção aleatória
          const fallbackOptions = [`${correctTitle} (Remix)`, `${correctTitle} (Live)`, `${correctTitle} (Acoustic)`];
          options.push(...fallbackOptions.slice(0, 3));
        }
      } else {
        // Lógica original para álbum específico
        let otherTracks: string[] = [];

        if (mode === 'mp3') {
          otherTracks = await getOtherMP3TracksFromAlbum(albumId, excludeId, 10);
        } else {
          otherTracks = await getOtherSpotifyTracksFromAlbum(albumId, excludeId, 10);
        }

        if (otherTracks.length >= 3) {
          const shuffled = otherTracks.sort(() => Math.random() - 0.5);
          options.push(...shuffled.slice(0, 3));
        } else if (otherTracks.length > 0) {
          options.push(...otherTracks);
          const needed = 4 - options.length;
          const fallbackOptions = [`${correctTitle} (Remix)`, `${correctTitle} (Live)`, `${correctTitle} (Acoustic)`];
          options.push(...fallbackOptions.slice(0, needed));
        } else {
          const fallbackOptions = [`${correctTitle} (Remix)`, `${correctTitle} (Live)`, `${correctTitle} (Acoustic)`];
          options.push(...fallbackOptions.slice(0, 3));
        }
      }

      const finalOptions = options.sort(() => Math.random() - 0.5);
      console.log('🎯 [buildOptionsFromAlbumOrRandom] Opções finais:', finalOptions);

      return finalOptions;
    } catch (error) {
      console.error('🎯 [buildOptionsFromAlbumOrRandom] Erro:', error);
      const fallbackOptions = [
        correctTitle,
        `${correctTitle} (Remix)`,
        `${correctTitle} (Live)`,
        `${correctTitle} (Acoustic)`
      ];
      return fallbackOptions.sort(() => Math.random() - 0.5);
    }
  }

  /** Força busca de opções APENAS do álbum selecionado */
  async function forceAlbumOptions(correctTitle: string, albumId: string, excludeId: string): Promise<string[]> {
    console.log('🎯 [forceAlbumOptions] FORÇANDO busca no álbum:', albumId);

    try {
      // Buscar TODAS as músicas do álbum
      const { data: allAlbumSongs, error } = await supabase
          .from('album_songs')
          .select(`
          songs (
            id,
            title
          )
        `)
          .eq('album_id', albumId);

      console.log('🎯 [forceAlbumOptions] Músicas encontradas no álbum:', allAlbumSongs?.length || 0);

      if (error || !allAlbumSongs || allAlbumSongs.length === 0) {
        console.warn('🎯 [forceAlbumOptions] Nenhuma música encontrada, usando fallback');
        return [
          correctTitle,
          `${correctTitle} (Remix)`,
          `${correctTitle} (Live)`,
          `${correctTitle} (Acoustic)`
        ].sort(() => Math.random() - 0.5);
      }

      // Filtrar a música atual e pegar títulos únicos
      const otherTitles = allAlbumSongs
          .map(item => item.songs)
          .filter(song => song && song.id !== excludeId && song.title !== correctTitle)
          .map(song => song.title)
          .filter((title, index, self) => self.indexOf(title) === index); // Remove duplicatas

      console.log('🎯 [forceAlbumOptions] Outras músicas filtradas:', otherTitles);

      const options = [correctTitle];

      if (otherTitles.length >= 3) {
        // Temos músicas suficientes do álbum
        const shuffled = otherTitles.sort(() => Math.random() - 0.5);
        options.push(...shuffled.slice(0, 3));
        console.log('🎯 [forceAlbumOptions] ✅ SUCESSO - 4 músicas do álbum:', options);
      } else if (otherTitles.length > 0) {
        // Algumas músicas do álbum + fallback
        options.push(...otherTitles);

        // Completar com variações da música atual
        const variations = [
          `${correctTitle} (Versão Estendida)`,
          `${correctTitle} (Versão do Álbum)`,
          `${correctTitle} (Faixa Bônus)`
        ];

        for (const variation of variations) {
          if (options.length >= 4) break;
          options.push(variation);
        }

        console.log('🎯 [forceAlbumOptions] ⚠️ PARCIAL - álbum + variações:', options);
      } else {
        // Álbum tem só 1 música, usar variações
        options.push(
            `${correctTitle} (Versão Estendida)`,
            `${correctTitle} (Versão do Álbum)`,
            `${correctTitle} (Faixa Bônus)`
        );
        console.log('🎯 [forceAlbumOptions] ⚠️ ÁLBUM SINGLE - só variações:', options);
      }

      return options.sort(() => Math.random() - 0.5);

    } catch (error) {
      console.error('🎯 [forceAlbumOptions] Erro na função:', error);
      return [
        correctTitle,
        `${correctTitle} (Remix)`,
        `${correctTitle} (Live)`,
        `${correctTitle} (Acoustic)`
      ].sort(() => Math.random() - 0.5);
    }
  }

  /** Monta a próxima questão priorizando Spotify quando game_mode = spotify */
  const buildQuestion = async (): Promise<GameQuestion> => {
    console.log('🎯 [buildQuestion] INÍCIO - Iniciando construção da questão...');
    console.log('🎯 [buildQuestion] Músicas já usadas:', usedSongIds.length);

    try {
      console.log('🎯 [buildQuestion] PASSO 1 - Obtendo modo do jogo...');
      const mode = await getGameMode();
      console.log('🎯 [buildQuestion] Modo do jogo:', mode);

      console.log('🎯 [buildQuestion] PASSO 2 - Obtendo dados da sala...');
      const room = await getRoomByCode(roomCode);
      console.log('🎯 [buildQuestion] Dados da sala:', room);

      console.log('🔍 [DEBUG] VERIFICAÇÕES ESPECÍFICAS:');
      console.log('🔍 [DEBUG] - selected_mp3_album_id:', room?.selected_mp3_album_id);
      console.log('🔍 [DEBUG] - is_random_selection:', room?.is_random_selection);
      console.log('🔍 [DEBUG] - room existe?', !!room);

      // Verificar se room existe
      if (!room) {
        throw new Error('Sala não encontrada');
      }

      if (mode === 'spotify') {
        console.log('🎯 [buildQuestion] PASSO 3 - Tentando Spotify...');
        const track = await pickOneSpotifyTrack(room, usedSongIds);

        if (track) {
          console.log('🎯 [buildQuestion] Track Spotify encontrada:', track);

          setUsedSongIds(prev => [...prev, track.id]);

          const durationSec = Math.max(
              5,
              Math.round((track.duration_ms || currentSettings.song_duration * 1000) / 1000)
          );

          let options: string[];

          if (room?.selected_spotify_album_id) {
            console.log('🎵 [buildQuestion] Gerando opções do álbum Spotify selecionado');
            try {
              options = await buildOptionsFromAlbum(track.track_name, room.selected_spotify_album_id, track.id, 'spotify');
            } catch (error) {
              console.warn('[buildQuestion] Erro ao buscar opções do álbum Spotify, usando gênero:', error);
              const genreId = room?.selected_genre_id || track.genre_id;
              options = genreId
                  ? await buildOptionsFromGenre(track.track_name, genreId, track.id, 'spotify')
                  : buildOptionsFromTitles(track.track_name);
            }
          } else {
            const genreId = room?.selected_genre_id || track.genre_id;
            options = genreId
                ? await buildOptionsFromGenre(track.track_name, genreId, track.id, 'spotify')
                : buildOptionsFromTitles(track.track_name);
          }

          const correctIdx = options.indexOf(track.track_name);

          const q: GameQuestion = {
            song: {
              id: track.id,
              title: track.track_name,
              artist: track.artist_name || '',
              duration_seconds: durationSec,
              spotify_track_id: track.spotify_track_id,
              embed_url: track.embed_url,
            },
            options,
            correctAnswer: correctIdx >= 0 ? correctIdx : 0,
          };

          console.log('🎯 [buildQuestion] Questão Spotify criada:', q);
          return q;
        }

        console.warn('🎯 [buildQuestion] Spotify ativo, mas sem faixas encontradas. Caindo para MP3...');
      }

      // MP3 Mode ou fallback
      console.log('🎯 [buildQuestion] PASSO 4 - Tentando buscar músicas MP3...');

      try {
        const songs = await fetchSongsWithGenre();
        console.log('🎯 [buildQuestion] Músicas encontradas:', songs.length);
        console.log('🎯 [buildQuestion] Primeira música:', songs[0]);

        if (songs.length === 0) {
          throw new Error('Nenhuma música encontrada');
        }

        const shuffled = [...songs].sort(() => Math.random() - 0.5);
        const correct = shuffled[0];
        console.log('🎯 [buildQuestion] Música selecionada:', correct);

        // Verificar se a música é válida
        if (!correct || !correct.id || !correct.title) {
          throw new Error('Música selecionada é inválida');
        }

        setUsedSongIds(prev => [...prev, correct.id]);

        console.log('🎯 [buildQuestion] PASSO 5 - Buscando dados da sala para opções...');
        const roomForOptions = await getRoomByCode(roomCode);
        console.log('🎯 [buildQuestion] Room data para opções:', roomForOptions);

        let options: string[];

        try {
          console.log('🎯 [buildQuestion] PASSO 6 - Gerando opções...');
          console.log('🔍 [DEBUG] ANTES DAS VERIFICAÇÕES:');
          console.log('🔍 [DEBUG] - roomForOptions:', roomForOptions);
          console.log('🔍 [DEBUG] - roomForOptions?.selected_mp3_album_id:', roomForOptions?.selected_mp3_album_id);
          console.log('🔍 [DEBUG] - roomForOptions?.is_random_selection:', roomForOptions?.is_random_selection);

          // Verificar qual tipo de seleção
          if (roomForOptions?.is_random_selection === true) {
            console.log('🎲 [buildQuestion] SELEÇÃO ALEATÓRIA detectada');

            // CORREÇÃO: Para seleção aleatória, verificar se há um álbum específico sorteado
            if (roomForOptions?.selected_mp3_album_id) {
              console.log('🎲 [buildQuestion] Álbum específico foi sorteado:', roomForOptions.selected_mp3_album_id);
              console.log('🎲 [buildQuestion] Usando opções do álbum sorteado');

              try {
                // Usar opções do álbum que foi sorteado aleatoriamente
                options = await buildOptionsFromAlbum(
                    correct.title,
                    roomForOptions.selected_mp3_album_id,
                    correct.id,
                    'mp3'
                );

                console.log('🎲 [buildQuestion] ✅ Opções do álbum sorteado:', options);
              } catch (error) {
                console.error('🎲 [buildQuestion] Erro ao buscar opções do álbum sorteado:', error);
                // Fallback para busca geral
                options = await buildRandomOptions(correct.title);
              }
            } else {
              console.log('🎲 [buildQuestion] Nenhum álbum sorteado, usando busca geral');
              options = await buildRandomOptions(correct.title);
            }

          } else if (roomForOptions?.selected_mp3_album_id) {
            // Lógica para álbum específico
            console.log('🎵 [buildQuestion] ÁLBUM ESPECÍFICO - ID:', roomForOptions.selected_mp3_album_id);
            console.log('🎵 [buildQuestion] Música atual:', correct.title, 'ID:', correct.id);

            try {
              options = await buildOptionsFromAlbum(
                  correct.title,
                  roomForOptions.selected_mp3_album_id,
                  correct.id,
                  'mp3'
              );

              console.log('🎵 [buildQuestion] Opções do álbum geradas:', options);

              // Verificar se as opções são realmente do álbum
              if (options.length < 4 || options.filter(opt => opt.includes('(Remix)') || opt.includes('(Live)')).length > 0) {
                console.warn('🎵 [buildQuestion] Fallback detectado nas opções, forçando busca do álbum');
                options = await forceAlbumOptions(correct.title, roomForOptions.selected_mp3_album_id, correct.id);
              }

            } catch (error) {
              console.error('🎵 [buildQuestion] Erro ao buscar opções do álbum:', error);
              options = await forceAlbumOptions(correct.title, roomForOptions.selected_mp3_album_id, correct.id);
            }
          } else {
            // Lógica para gênero
            console.log('🎯 [buildQuestion] SEM ÁLBUM - usando método original por gênero');
            const genreId = roomForOptions?.selected_genre_id || roomForOptions?.next_genre_id;

            if (genreId) {
              try {
                options = await buildOptionsFromGenre(correct.title, genreId, correct.id, 'mp3');
              } catch (error) {
                console.warn('[buildQuestion] Erro ao buscar opções do gênero, usando pool local:', error);
                const titlesPool = shuffled.map(s => s.title);
                options = buildOptionsFromTitles(correct.title, titlesPool);
              }
            } else {
              console.log('🎯 [buildQuestion] Construindo opções do pool de músicas');
              const titlesPool = shuffled.map(s => s.title);
              options = buildOptionsFromTitles(correct.title, titlesPool);
            }
          }

          console.log('🎯 [buildQuestion] PASSO 7 - Opções geradas:', options);

          // Verificar se as opções são válidas
          if (!options || options.length < 4) {
            throw new Error(`Opções insuficientes: ${options?.length || 0}`);
          }

        } catch (optionsError) {
          console.error('🎯 [buildQuestion] ERRO ao gerar opções:', optionsError);
          const titlesPool = shuffled.map(s => s.title);
          options = buildOptionsFromTitles(correct.title, titlesPool);
          console.log('🎯 [buildQuestion] Usando fallback options:', options);
        }

        const correctIndex = options.indexOf(correct.title);
        console.log('🎯 [buildQuestion] Correct index:', correctIndex);

        if (correctIndex === -1) {
          console.error('🎯 [buildQuestion] ERRO: Resposta correta não encontrada nas opções');
          console.log('🎯 [buildQuestion] Correct title:', correct.title);
          console.log('🎯 [buildQuestion] Options:', options);
        }

        const question: GameQuestion = {
          song: {
            ...correct,
            audioUrl: getAudioUrl(correct),
            duration_seconds: currentSettings.song_duration
          },
          options,
          correctAnswer: correctIndex >= 0 ? correctIndex : 0,
        };

        console.log('🎯 [buildQuestion] SUCESSO - Questão MP3 final criada:', {
          songTitle: question.song.title,
          songId: question.song.id,
          options: question.options,
          correctAnswer: question.correctAnswer,
          audioUrl: question.song.audioUrl
        });

        return question;

      } catch (songsError) {
        console.error('🎯 [buildQuestion] ERRO ao buscar músicas:', songsError);
        throw songsError;
      }

    } catch (error) {
      console.error('🎯 [buildQuestion] ERRO GERAL na construção da questão:', error);
      console.error('🎯 [buildQuestion] Stack trace:', error.stack);
      throw error;
    }
  };

  /** Busca opções aleatórias de qualquer álbum (fallback para seleção aleatória) */
  async function buildRandomOptions(correctTitle: string): Promise<string[]> {
    try {
      console.log('🎲 [buildRandomOptions] Buscando opções de qualquer álbum');

      const { data: allSongs, error } = await supabase
          .from('songs')
          .select('title')
          .not('audio_file_url', 'is', null)
          .not('title', 'eq', correctTitle)
          .limit(30);

      if (!error && allSongs && allSongs.length >= 3) {
        const otherTitles = allSongs
            .map(song => song.title)
            .filter((title, index, self) => self.indexOf(title) === index) // Remove duplicatas
            .sort(() => Math.random() - 0.5)
            .slice(0, 3);

        const options = [correctTitle, ...otherTitles].sort(() => Math.random() - 0.5);
        console.log('🎲 [buildRandomOptions] ✅ Opções geradas:', options);
        return options;
      }
    } catch (error) {
      console.error('🎲 [buildRandomOptions] Erro:', error);
    }

    // Fallback final
    console.log('🎲 [buildRandomOptions] Usando fallback com variações');
    return [
      correctTitle,
      `${correctTitle} (Remix)`,
      `${correctTitle} (Live)`,
      `${correctTitle} (Acoustic)`
    ].sort(() => Math.random() - 0.5);
  }

  async function buildOptionsFromAlbum(
      correctTitle: string,
      albumId: string,
      excludeId: string,
      mode: 'mp3' | 'spotify'
  ): Promise<string[]> {
    console.log('🎵 [buildOptionsFromAlbum] INÍCIO:', {
      correctTitle,
      albumId,
      excludeId,
      mode,
      usedOptions: usedOptionTitles.length // MOSTRAR quantas opções já foram usadas
    });

    try {
      let otherTracks: string[] = [];

      if (mode === 'mp3') {
        // PASSAR títulos já usados para evitar repetição
        otherTracks = await getOtherMP3TracksFromAlbum(
            albumId,
            excludeId,
            usedOptionTitles, // NOVO: excluir títulos já usados
            100 // AUMENTAR limite drasticamente
        );
      } else if (mode === 'spotify') {
        otherTracks = await getOtherSpotifyTracksFromAlbum(
            albumId,
            excludeId,
            usedOptionTitles, // NOVO: excluir títulos já usados
            100
        );
      }

      console.log('🎵 [buildOptionsFromAlbum] Tracks encontradas:', otherTracks.length);

      // Se temos músicas suficientes do álbum
      if (otherTracks.length >= 3) {
        // EMBARALHAR e pegar 3 opções diferentes
        const shuffled = otherTracks.sort(() => Math.random() - 0.5);
        const selectedOptions = shuffled.slice(0, 3);

        // REGISTRAR as opções usadas para evitar repetição futura
        setUsedOptionTitles(prev => [...prev, ...selectedOptions]);

        const finalOptions = [correctTitle, ...selectedOptions].sort(() => Math.random() - 0.5);

        console.log('🎵 [buildOptionsFromAlbum] ✅ SUCESSO - Opções únicas:', {
          options: finalOptions,
          totalUsedOptions: usedOptionTitles.length + selectedOptions.length
        });

        return finalOptions;
      }

      // Fallback se não temos músicas suficientes
      console.warn('🎵 [buildOptionsFromAlbum] Poucas músicas disponíveis, usando fallback');

      // BUSCAR de outros álbuns do mesmo gênero se necessário
      if (otherTracks.length < 3) {
        try {
          const { data: albumInfo } = await supabase
              .from('albums')
              .select('genre_id')
              .eq('id', albumId)
              .single();

          if (albumInfo?.genre_id) {
            const { data: sameGenreAlbums } = await supabase
                .from('albums')
                .select('id')
                .eq('genre_id', albumInfo.genre_id)
                .neq('id', albumId)
                .limit(10);

            if (sameGenreAlbums && sameGenreAlbums.length > 0) {
              const albumIds = sameGenreAlbums.map(a => a.id);

              const { data: moreTracks } = await supabase
                  .from('album_songs')
                  .select(`
                songs (
                  title
                )
              `)
                  .in('album_id', albumIds)
                  .not('songs.title', 'eq', correctTitle)
                  .order('random()')
                  .limit(50);

              if (moreTracks) {
                const additionalTracks = moreTracks
                    .map(item => item.songs?.title)
              .filter(title =>
                    title &&
                    !usedOptionTitles.includes(title) && // NOVO: excluir já usadas
                    !otherTracks.includes(title)
                )
                    .slice(0, 10);

                otherTracks.push(...additionalTracks);
              }
            }
          }
        } catch (genreError) {
          console.error('🎵 [buildOptionsFromAlbum] Erro ao buscar por gênero:', genreError);
        }
      }

      // Garantir que temos pelo menos 3 opções
      const needed = Math.max(0, 3 - otherTracks.length);
      if (needed > 0) {
        // Buscar músicas aleatórias como último recurso
        const { data: randomTracks } = await supabase
            .from('songs')
            .select('title')
            .not('title', 'eq', correctTitle)
            .not('title', 'in', `(${[...usedOptionTitles, ...otherTracks].map(t => `"${t}"`).join(',')})`)
            .order('random()')
            .limit(needed * 3); // Buscar mais para ter opções

        if (randomTracks && randomTracks.length > 0) {
          const randomTitles = randomTracks
              .map(s => s.title)
              .slice(0, needed);

          otherTracks.push(...randomTitles);
        }
      }

      // Garantir que temos exatamente 3 opções incorretas
      const finalIncorrectOptions = otherTracks.slice(0, 3);

      // REGISTRAR as opções usadas
      setUsedOptionTitles(prev => [...prev, ...finalIncorrectOptions]);

      const finalOptions = [correctTitle, ...finalIncorrectOptions].sort(() => Math.random() - 0.5);

      console.log('🎵 [buildOptionsFromAlbum] ✅ Opções finais com fallback:', finalOptions);
      return finalOptions;

    } catch (error) {
      console.error('🎵 [buildOptionsFromAlbum] ❌ ERRO:', error);
      return [correctTitle, 'Opção A', 'Opção B', 'Opção C'].sort(() => Math.random() - 0.5);
    }
  }

  // 5. ADICIONAR função para resetar opções usadas quando necessário
  const resetUsedOptions = useCallback(() => {
    setUsedOptionTitles([]);
    console.log('🔄 Histórico de opções resetado');
  }, []);

// 6. ADICIONAR lógica para resetar opções a cada novo jogo
  useEffect(() => {
    if (gameState === 'idle') {
      resetUsedOptions();
    }
  }, [gameState, resetUsedOptions]);

// 7. ADICIONAR função para limpar opções quando ficam poucas disponíveis
  const checkAndResetOptions = useCallback(async (albumId: string) => {
    try {
      // Verificar quantas músicas ainda estão disponíveis
      const { data: albumSongs } = await supabase
          .from('album_songs')
          .select('songs(title)')
          .eq('album_id', albumId);

      const totalTracks = albumSongs?.length || 0;
      const usedTracks = usedOptionTitles.length;

      // Se usamos mais de 80% das músicas disponíveis, resetar
      if (totalTracks > 0 && usedTracks > (totalTracks * 0.8)) {
        console.log('🔄 Resetando opções - muitas músicas já utilizadas');
        setUsedOptionTitles([]);
      }
    } catch (error) {
      console.error('Erro ao verificar opções disponíveis:', error);
    }
  }, [usedOptionTitles]);

  // Substituir a lógica existente de carregamento de configurações por esta:
// Substitua a função loadModeSpecificSettings existente por esta versão corrigida:

  const loadModeSpecificSettings = async (mode: 'classic' | 'battle') => {
    try {
      console.log('🔧 [loadModeSpecificSettings] Carregando configurações para modo:', mode);

      // Definir as chaves baseadas no modo
      const prefix = mode === 'battle' ? 'battle_' : 'classic_';
      const keys = [
        `${prefix}eggs_per_correct`,
        `${prefix}speed_bonus`,
        `${prefix}time_per_question`,
        `${prefix}song_duration`
      ];

      console.log('🔧 [loadModeSpecificSettings] Buscando chaves:', keys);

      const { data, error } = await supabase
          .from('game_settings')
          .select('key, value')
          .in('key', keys);

      if (error) {
        console.error('🔧 [loadModeSpecificSettings] Erro ao buscar:', error);
        throw error;
      }

      console.log('🔧 [loadModeSpecificSettings] Dados do banco:', data);

      const settings: any = {};
      data?.forEach(setting => {
        // Remove o prefixo para ter as chaves padrão
        const key = setting.key.replace(prefix, '');
        const value = parseInt(setting.value as string) || 0;
        settings[key] = value;
        console.log(`🔧 [loadModeSpecificSettings] ${setting.key} -> ${key}: ${value}`);
      });

      // Valores padrão específicos por modo
      const defaultSettings = mode === 'battle' ? {
        eggs_per_correct: 0, // Battle mode não usa eggs_per_correct
        speed_bonus: 0,      // Battle mode não usa speed bonus
        time_per_question: 15,
        song_duration: 10,
        max_players: 10
      } : {
        eggs_per_correct: 10,
        speed_bonus: 5,
        time_per_question: 15,
        song_duration: 15, // Classic mode: música mais longa
        max_players: 10
      };

      const finalSettings = {
        ...defaultSettings,
        ...settings // Sobrescrever com dados do banco se existirem
      };

      console.log(`🔧 [loadModeSpecificSettings] Configurações finais do modo ${mode}:`, finalSettings);

      setCurrentSettings(prev => ({
        ...prev,
        ...finalSettings
      }));

    } catch (error) {
      console.error(`🔧 [loadModeSpecificSettings] Erro ao carregar configurações do modo ${mode}:`, error);

      // Fallback com valores padrão
      const fallbackSettings = mode === 'battle' ? {
        eggs_per_correct: 0,
        speed_bonus: 0,
        time_per_question: 15,
        song_duration: 10
      } : {
        eggs_per_correct: 10,
        speed_bonus: 5,
        time_per_question: 15,
        song_duration: 15
      };

      setCurrentSettings(prev => ({ ...prev, ...fallbackSettings }));
    }
  };

// Função para inicializar ovos
  const initializeBattleEggs = async (roomCode: string, battleSettings: any) => {
    const { data: room } = await supabase
        .from('game_rooms')
        .select('id')
        .eq('room_code', roomCode)
        .single();

    if (!room) throw new Error('Sala não encontrada');

    // 🔥 IMPORTANTE: Apenas jogadores ativos recebem ovos de batalha
    await supabase
        .from('room_participants')
        .update({
          current_eggs: battleSettings.initialEggs,
          battle_eggs: battleSettings.initialEggs
        })
        .eq('room_id', room.id)
        .eq('is_spectator', false); // ← Excluir espectadores

    console.log('🥚 Ovos de batalha inicializados apenas para jogadores ativos');
  };

// Função para redistribuir ovos
  // MODIFIQUE a função redistributeEggs existente para disparar efeitos visuais
  const redistributeEggs = async (roomCode: string, correctAnswerIndex: number, answersData: any, battleSettings: any) => {
    const playersWhoAnswered = Object.keys(answersData);

    if (playersWhoAnswered.length === 0) {
      return;
    }

    try {
      const { data: room, error: roomError } = await supabase
          .from('game_rooms')
          .select('id')
          .eq('room_code', roomCode)
          .single();

      if (roomError || !room) return;

      const { data: participants, error: participantsError } = await supabase
          .from('room_participants')
          .select('client_id, current_eggs, display_name')
          .eq('room_id', room.id);

      if (participantsError || !participants) return;

      const correctPlayers = playersWhoAnswered.filter(
          playerId => answersData[playerId].answer === correctAnswerIndex
      );
      const incorrectPlayers = playersWhoAnswered.filter(
          playerId => answersData[playerId].answer !== correctAnswerIndex
      );

      if (incorrectPlayers.length === 0 || correctPlayers.length === 0) {
        console.log('🎯 [redistributeEggs] Sem redistribuição necessária');
        return;
      }

      // NOVO: Preparar dados para efeitos visuais ANTES da redistribuição
      const losersForEffect = incorrectPlayers
          .map(playerId => players?.find(p => p.id === playerId))
    .filter(Boolean) as PlayerFace[];

      const winnersForEffect = correctPlayers
          .map(playerId => players?.find(p => p.id === playerId))
    .filter(Boolean) as PlayerFace[];

      // Executar redistribuição no banco (código existente)
      const eggsToRedistribute = incorrectPlayers.length * battleSettings.eggsPerRound;
      const eggsPerWinner = Math.floor(eggsToRedistribute / correctPlayers.length);

      if (eggsPerWinner > 0) {
        const updates = [];

        // Processar perdas
        for (const playerId of incorrectPlayers) {
          const participant = participants.find(p => p.client_id === playerId);
          if (participant) {
            const newEggs = Math.max(0, participant.current_eggs - battleSettings.eggsPerRound);
            updates.push(
                supabase
                    .from('room_participants')
                    .update({ current_eggs: newEggs })
                    .eq('room_id', room.id)
                    .eq('client_id', playerId)
            );
          }
        }

        // Processar ganhos
        for (const playerId of correctPlayers) {
          const participant = participants.find(p => p.client_id === playerId);
          if (participant) {
            const newEggs = participant.current_eggs + eggsPerWinner;
            updates.push(
                supabase
                    .from('room_participants')
                    .update({ current_eggs: newEggs })
                    .eq('room_id', room.id)
                    .eq('client_id', playerId)
            );
          }
        }

        // Executar todas as atualizações
        await Promise.all(updates);

        // NOVO: Disparar efeitos visuais APÓS a redistribuição
        createEggTransferEvent(losersForEffect, winnersForEffect, battleSettings.eggsPerRound);

        console.log('🎯 [redistributeEggs] Redistribuição completa com efeitos visuais');
      }

    } catch (error) {
      console.error('🎯 [redistributeEggs] Erro na redistribuição:', error);
    }
  };



// 5. ADICIONAR reset do histórico quando o jogo reinicia
  const resetUsedSongs = useCallback(() => {
    setUsedSongIds([]);
    // console.log('🔄 Histórico de músicas resetado');
  }, []);

  /* ------------------------------- BROADCAST ------------------------------- */

  const broadcastRoundStart = useCallback(async (q: GameQuestion, round: number) => {
    if (!sessionId || !gameChannelRef.current) return;

    // LIMPAR flag de redistribuição para nova rodada
    setRedistributionProcessed(prev => ({ ...prev, [round]: false }));

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

  // 2. CORRIGIR broadcastAnswer para bloquear espectadores
  const broadcastAnswer = useCallback(async (answerIndex: number) => {
    // 🔥 VERIFICAÇÃO RIGOROSA
    if (isSpectator) {
      console.log('🚫 SPECTATOR: Bloqueando broadcastAnswer');
      return;
    }

    if (!sessionId || !gameChannelRef.current) return;

    const responseTime = currentSettings.time_per_question - timeLeft;
    const loggedPlayer = players?.find((p) => p.id === clientId.current);

    console.log('🎯 [broadcastAnswer] Enviando resposta (jogador ativo):', {
      answerIndex,
      responseTime,
      participantId: clientId.current,
      battleMode,
      isSpectator // ← deve ser false
    });

    await gameChannelRef.current.send({
      type: 'broadcast',
      event: 'ANSWER',
      payload: {
        answerIndex,
        responseTime,
        participantId: clientId.current,
        name: profile.current.displayName || 'Jogador',
        avatar: loggedPlayer?.avatar,
    },
  });
  }, [sessionId, players, currentSettings, timeLeft, battleMode, isSpectator]); // ← Adicionar isSpectator

  useEffect(() => {
    const loadBattleConfig = async () => {
      try {
        const [mode, settings] = await Promise.all([
          getBattleMode(),
          getBattleSettings() // você precisa desta função
        ]);

        setBattleMode(mode);
        setBattleSettings(settings);

        console.log('🎯 Battle config loaded:', { mode, settings });
      } catch (error) {
        console.error('Erro ao carregar config de batalha:', error);
      }
    };

    loadBattleConfig();
  }, []);

  const getBattleSettings = async () => {
    const { data, error } = await supabase
        .from('game_settings')
        .select('key, value')
        .in('key', ['battle_eggs_per_round', 'battle_total_rounds']);

    const defaults = {
      eggsPerRound: 10,
      totalRounds: 10,
      initialEggs: 100,
      time_per_question: 15,
      song_duration: 10
    };

    if (error || !data) return defaults;

    const settings = { ...defaults };
    data.forEach(row => {
      if (row.key === 'battle_eggs_per_round') {
        settings.eggsPerRound = parseInt(String(row.value), 10) || defaults.eggsPerRound;
      }
      if (row.key === 'battle_total_rounds') {
        settings.totalRounds = parseInt(String(row.value), 10) || defaults.totalRounds;
      }
    });

    settings.initialEggs = settings.eggsPerRound * settings.totalRounds;
    return settings;
  };


  /* --------------------------------- AÇÕES -------------------------------- */

  const startFirstRound = useCallback(async () => {
    // console.log('🎮 [startFirstRound] Iniciando...', { gameState, audioUnlocked });

    if (gameState !== 'idle') {
      // console.log('🎮 [startFirstRound] Jogo não está em idle, retornando');
      return;
    }

    setAudioUnlocked(true);

    // // ADICIONE ESTA PARTE para modo batalha
    // if (battleMode === 'battle' && isHost && sessionId) {
    //   try {
    //     await initializeBattleEggs(roomCode, battleSettings);
    //     toast({
    //       title: '⚔️ Modo Batalha Ativado!',
    //       description: `Cada jogador recebeu ${battleSettings.initialEggs} ovos para a batalha!`,
    //     });
    //   } catch (error) {
    //     toast({
    //       title: 'Erro',
    //       description: 'Falha ao inicializar modo batalha',
    //       variant: 'destructive'
    //     });
    //     return;
    //   }
    // }

    if (sessionId && isHost) {
      try {
        // console.log('🎮 [startFirstRound] Host construindo questão...');
        const q = await buildQuestion();
        // console.log('🎮 [startFirstRound] Questão construída com sucesso:', q);

        // console.log('🎮 [startFirstRound] Fazendo broadcast...');
        await broadcastRoundStart(q, 1);
        // console.log('🎮 [startFirstRound] Broadcast concluído!');

      } catch (e) {
        // console.error('🎮 [startFirstRound] ERRO ao iniciar 1ª rodada:', e);
        toast({ title: 'Erro', description: 'Não foi possível iniciar a rodada.', variant: 'destructive' });
      }
      return;
    }

    // console.log('🎮 [startFirstRound] Modo single player');
    setGameState('playing');
    startRoundTimer(currentSettings.time_per_question);
  }, [sessionId, isHost, gameState, startRoundTimer, currentSettings.time_per_question, broadcastRoundStart, toast]);

  // 1. CORRIGIR handleAnswerSelect - a verificação deve ser MAIS rigorosa
  const handleAnswerSelect = useCallback((idx: number) => {
    // 🔥 VERIFICAÇÃO RIGOROSA - parar TUDO se for espectador
    if (isSpectator) {
      console.log('🚫 SPECTATOR: Bloqueando handleAnswerSelect completamente');
      setSelectedAnswer(idx); // Apenas feedback visual
      return; // PARAR AQUI - não executar mais nada
    }

    // Verificações normais do jogo
    if (gameState !== 'playing' || selectedAnswer !== null) return;

    console.log('🎯 [handleAnswerSelect] CHAMADO (jogador ativo):', {
      idx,
      battleMode,
      sessionId: !!sessionId,
      isSpectator // ← deve ser false aqui
    });

    setSelectedAnswer(idx);
    const responseTime = currentSettings.time_per_question - timeLeft;
    setAnswerTime(responseTime);

    const isCorrect = currentQuestion && idx === currentQuestion.correctAnswer;

    // SEPARAR CLARAMENTE: Modo batalha vs clássico
    if (battleMode === 'battle' && sessionId) {
      console.log('🎯 [handleAnswerSelect] MODO BATALHA - apenas registrando resposta');

      // Modo batalha: APENAS registrar a resposta, SEM aplicar pontuação
      setRoundAnswers(prev => {
        const updated = {
          ...prev,
          [clientId.current]: { answer: idx, responseTime }
        };
        console.log('🎯 [handleAnswerSelect] roundAnswers ATUALIZADO:', updated);
        return updated;
      });

    } else {
      console.log('🎯 [handleAnswerSelect] MODO CLÁSSICO - aplicando pontuação');

      // Modo clássico: aplicar pontuação imediatamente
      if (isCorrect) {
        const base = currentSettings.eggs_per_correct;
        const bonus = timeLeft > (currentSettings.time_per_question * 0.8) ? currentSettings.speed_bonus : 0;
        setPlayerEggs(e => e + base + bonus);
      }
    }

    // 🔥 IMPORTANTE: Só salvar estatísticas se NÃO for espectador
    if (sessionId && !isSpectator) { // ← Adicionar verificação !isSpectator
      (async () => {
        try {
          const { data: room } = await supabase
              .from('game_rooms')
              .select('id')
              .eq('room_code', roomCode)
              .maybeSingle();

          if (room?.id) {
            const { data: participant } = await supabase
                .from('room_participants')
                .select('current_eggs, correct_answers, total_answers, total_response_time, is_spectator')
                .eq('room_id', room.id)
                .eq('client_id', clientId.current)
                .maybeSingle();

            if (participant && !participant.is_spectator) { // ← Verificação dupla
              // IMPORTANTE: No modo batalha, NÃO aplicar pontuação aqui
              const eggGain = (battleMode === 'classic' && isCorrect)
                  ? currentSettings.eggs_per_correct + (timeLeft > (currentSettings.time_per_question * 0.8) ? currentSettings.speed_bonus : 0)
                  : 0; // Zero para modo batalha

              console.log('🎯 [handleAnswerSelect] Salvando no banco (jogador ativo):', {
                battleMode,
                isCorrect,
                eggGain,
                currentEggs: participant.current_eggs,
                participantIsSpectator: participant.is_spectator
              });

              const newEggs = participant.current_eggs + eggGain;
              const newCorrectAnswers = participant.correct_answers + (isCorrect ? 1 : 0);
              const newTotalAnswers = participant.total_answers + 1;
              const newTotalResponseTime = participant.total_response_time + responseTime;

              await supabase
                  .from('room_participants')
                  .update({
                    current_eggs: newEggs,
                    correct_answers: newCorrectAnswers,
                    total_answers: newTotalAnswers,
                    total_response_time: newTotalResponseTime
                    // 🔥 NÃO atualizar is_spectator aqui!
                  })
                  .eq('room_id', room.id)
                  .eq('client_id', clientId.current);

              console.log('🎯 [handleAnswerSelect] Dados salvos no banco');
            } else {
              console.log('🚫 [handleAnswerSelect] Participante é espectador, não salvando estatísticas');
            }
          }
        } catch (error) {
          console.error('[stats] Erro ao salvar estatísticas:', error);
        }
      })();
    }

    // avatar local - só adicionar se não for espectador
    if (!isSpectator) {
      setAnswersByOption(prev => {
        const next = { ...prev };
        const list = next[idx] ? [...next[idx]] : [];
        if (!list.find(p => p.id === clientId.current)) {
          const loggedPlayer = players?.find((p) => p.id === clientId.current);
          if (loggedPlayer?.avatar?.startsWith("/")) {
            list.push({
              id: clientId.current,
              name: loggedPlayer.name,
              avatar: loggedPlayer.avatar
            });
          }
        }
        next[idx] = list;
        return next;
      });

      broadcastAnswer(idx);
    }
  }, [gameState, selectedAnswer, currentSettings, timeLeft, currentQuestion, broadcastAnswer, sessionId, roomCode, battleMode, players, clientId, isSpectator]); // ← Adicionar isSpectator nas dependências



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
            .select('client_id, display_name, avatar, current_eggs, is_spectator')
            .eq('room_id', room.id);

        if (!error && participants) {
          const playerList = participants.map(p => ({
            id: p.client_id,
            name: p.display_name || 'Jogador',
            avatar: p.avatar,
            eggs: p.current_eggs || 0,
            is_spectator: p.is_spectator || false // ← Preservar valor do banco
          }));

          // NOVO: Detectar mudanças nos ovos antes de atualizar o estado
          detectEggChanges(playerList);

          setPlayers(playerList);

          // 🔥 ATUALIZAR playerEggs local se for o jogador atual e NÃO for espectador
          const currentPlayerData = playerList.find(p => p.id === clientId.current);
          if (currentPlayerData && !currentPlayerData.is_spectator && !isSpectator) {
            setPlayerEggs(currentPlayerData.eggs);
          }

          console.log('🔍 [loadPlayersFromRoom] Players carregados:', {
            total: playerList.length,
            spectators: playerList.filter(p => p.is_spectator).length,
            currentPlayer: currentPlayerData,
            localIsSpectator: isSpectator
          });
        }
      }
    } catch (e) {
      console.error('[loadPlayersFromRoom] erro ao carregar jogadores:', e);
    }
  }, [roomCode, clientId, isSpectator, detectEggChanges]); // ← Adicionar isSpectator


  // Função para limpar efeitos antigos
  const cleanupOldEffects = useCallback(() => {
    const now = Date.now();
    const maxAge = 10000; // 10 segundos

    setPlayerEggChanges(prev =>
        prev.filter(change => now - change.timestamp < maxAge)
    );

    setEggTransferEvents(prev =>
        prev.filter(event => now - event.timestamp < maxAge)
    );
  }, []);

  // Cleanup automático dos efeitos antigos
  useEffect(() => {
    const cleanupInterval = setInterval(cleanupOldEffects, 5000);
    return () => clearInterval(cleanupInterval);
  }, [cleanupOldEffects]);

  // Função para alternar visibilidade dos efeitos
  const toggleEggEffects = useCallback(() => {
    setShowEggEffects(prev => !prev);
  }, []);

  // Função para forçar atualização dos efeitos (útil para debug)
  const forceEffectsUpdate = useCallback(() => {
    if (players && players.length > 0) {
      detectEggChanges(players);
    }
  }, [players, detectEggChanges]);

// Certifique-se de que esta função existe no useGameLogic.ts
  const getBattleMode = async (): Promise<'classic' | 'battle'> => {
    try {
      const { data, error } = await supabase
          .from('game_settings')
          .select('value')
          .eq('key', 'battle_mode')
          .maybeSingle();

      if (error) {
        console.warn('⚠️ Erro ao buscar battle_mode:', error);
        return 'classic';
      }

      const raw = data?.value;
      console.log('🔍 [getBattleMode] Valor bruto do banco:', raw);

      const normalized = typeof raw === 'string' ? raw.replace(/"/g, '') : 'classic';
      const result = normalized === 'battle' ? 'battle' : 'classic';

      console.log('🔍 [getBattleMode] Modo detectado:', result);
      return result;
    } catch (error) {
      console.error('❌ Erro em getBattleMode:', error);
      return 'classic';
    }
  };

  /* -------------------------- INICIALIZAÇÃO/REALTIME ------------------------- */

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        // ADICIONE estas linhas
        const [gameSettings, battleModeResult] = await Promise.all([
          supabase.from('game_settings').select('key,value'),
          getBattleMode()
        ]);

        if (!cancelled) {
          setBattleMode(battleModeResult);

          // Carregar configurações específicas do modo ativo
          await loadModeSpecificSettings(battleModeResult);

          // Configurar battleSettings se necessário
          if (gameSettings.data) {
            const eggsPerRound = gameSettings.data.find(s => s.key === 'battle_eggs_per_round')?.value || 10;
            const totalRounds = gameSettings.data.find(s => s.key === 'battle_total_rounds')?.value || 10;
            setBattleSettings({
              eggsPerRound: parseInt(String(eggsPerRound), 10),
              totalRounds: parseInt(String(totalRounds), 10),
              initialEggs: parseInt(String(eggsPerRound), 10) * parseInt(String(totalRounds), 10)
            });
          }
        }

        // carrega configurações (opcional)
        // const { data, error } = await supabase.from('game_settings').select('key,value');
        // if (!error && data) {
        //   const s: any = {};
        //   data.forEach(row => { s[row.key] = parseInt(String(row.value), 10); });
        //   if (!cancelled) {
        //     setCurrentSettings(prev => ({ ...prev, ...s }));
        //   }
        // }
      } catch {
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
        // console.error('Erro ao carregar gênero ativo:', error);
      }

      // se houver sessão, conecta no canal e descobre se sou host
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
            setRoundAnswers({}); // ADICIONE: Reset das respostas da rodada
            setGameState('playing');

            const elapsed = Math.floor((Date.now() - startedAt) / 1000);
            const duration = settings.time_per_question;
            const remaining = Math.max(1, duration - elapsed);
            startRoundTimer(remaining);
          });

          ch.on('broadcast', { event: 'ANSWER' }, (msg) => {
            const { answerIndex, responseTime, participantId, name, avatar } = msg.payload as {
              answerIndex: number; responseTime: number; participantId: string; name: string; avatar: string;
            };

            console.log('🎯 [realtime ANSWER] Resposta recebida:', {
              answerIndex,
              responseTime,
              participantId,
              name,
              battleMode
            });

            // Registrar resposta para modo batalha
            if (battleMode === 'battle') {
              setRoundAnswers(prev => {
                const updated = {
                  ...prev,
                  [participantId]: { answer: answerIndex, responseTime }
                };
                console.log('🎯 [realtime ANSWER] roundAnswers atualizado:', updated);
                return updated;
              });
            }

            setAnswersByOption(prev => {
              const next = { ...prev };
              const list = next[answerIndex] ? [...next[answerIndex]] : [];
              if (!list.find(p => p.id === participantId)) {
                if (avatar?.startsWith("/")) {
                  list.push({ id: participantId, name, avatar });
                }
              }
              next[answerIndex] = list;
              return next;
            });
          });

          // SEPARAR: Event listener para BATTLE_RESULTS
          ch.on('broadcast', { event: 'BATTLE_RESULTS' }, async (msg) => {
            console.log('🥚 Resultados de batalha recebidos, recarregando jogadores...');
            await loadPlayersFromRoom();
          });

          // SEPARAR: Event listener para SCORE_UPDATE
          ch.on('broadcast', { event: 'SCORE_UPDATE' }, async (msg) => {
            console.log('🥚 Score update received, reloading players...');
            await loadPlayersFromRoom();
          });

          ch.on('broadcast', { event: 'ROUND_COMPLETE' }, (msg) => {
            const { roomCode, sessionId } = msg.payload as {
              roomCode: string; sessionId: string;
            };
            const navigateEvent = new CustomEvent("navigateToRoundLobby", {
              detail: { roomCode, playerEggs, sessionId }
            });
            window.dispatchEvent(navigateEvent);
          });

          ch.subscribe((status) => {
            console.log('[realtime] game channel status:', status);
          });

          // Dentro do useEffect principal, onde você configura o canal, adicione:
          ch.on('broadcast', { event: 'PLAYER_LEFT' }, (msg) => {
            const { clientId: leftClientId, roomCode: msgRoomCode } = msg.payload;

            console.log('👋 [real-time] Jogador saiu:', leftClientId);

            if (msgRoomCode === roomCode) {
              // Remover do estado local imediatamente
              setPlayers(prevPlayers => {
                const filtered = prevPlayers.filter(p => p.id !== leftClientId);
                console.log('👋 Players após remoção:', filtered);
                return filtered;
              });

              // Limpar das respostas também
              setAnswersByOption(prev => {
                const cleaned = { ...prev };
                Object.keys(cleaned).forEach(optionIndex => {
                  cleaned[Number(optionIndex)] = cleaned[Number(optionIndex)].filter(
                      p => p.id !== leftClientId
                  );
                });
                return cleaned;
              });
            }
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
          // console.error('[realtime] erro ao iniciar canal:', e);
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

// Adicione este useEffect separado para reagir a mudanças de modo
  useEffect(() => {
    if (!isLoading) {
      loadModeSpecificSettings(battleMode);
    }
  }, [battleMode, isLoading]);

  const loadGeneralSettings = async () => {
    try {
      const { data, error } = await supabase
          .from('game_settings')
          .select('key, value')
          .in('key', ['max_players', 'room_timeout', 'auto_next_round']);

      if (error) throw error;

      const generalSettings: any = {};
      data?.forEach(setting => {
        if (setting.key === 'auto_next_round') {
          generalSettings[setting.key] = setting.value === 'true';
        } else {
          generalSettings[setting.key] = parseInt(setting.value as string) || 0;
        }
      });

      // Aplicar configurações gerais ao currentSettings
      setCurrentSettings(prev => ({ ...prev, ...generalSettings }));

    } catch (error) {
      console.error('Erro ao carregar configurações gerais:', error);
    }
  };

// Substitua o useEffect atual por este:
  useEffect(() => {
    if (battleMode === 'battle' && isHost && currentQuestion && sessionId) {
      if (redistributionProcessed[currentRound]) {
        return;
      }

      if (gameState === 'reveal' || gameState === 'transition') {
        const processRoundEnd = async () => {
          try {
            // 🔥 FILTRAR respostas de espectadores
            const activePlayerAnswers = Object.fromEntries(
                Object.entries(roundAnswers).filter(([playerId]) => {
                  const player = players?.find(p => p.id === playerId);
                  return player && !player.is_spectator; // ← Excluir espectadores
                })
            );

            const answerCount = Object.keys(activePlayerAnswers).length;

            if (answerCount === 0) {
              console.log('🚫 Nenhuma resposta de jogador ativo encontrada');
              return;
            }

            console.log('🎯 Processando respostas apenas de jogadores ativos:', {
              total: Object.keys(roundAnswers).length,
              activeOnly: answerCount
            });

            setRedistributionProcessed(prev => ({ ...prev, [currentRound]: true }));

            await redistributeEggs(roomCode, currentQuestion.correctAnswer, activePlayerAnswers, battleSettings);

            await loadPlayersFromRoom();

            if (gameChannelRef.current) {
              await gameChannelRef.current.send({
                type: 'broadcast',
                event: 'BATTLE_RESULTS',
                payload: { processed: true }
              });
            }

          } catch (error) {
            setRedistributionProcessed(prev => ({ ...prev, [currentRound]: false }));
          }
        };

        processRoundEnd();
      }
    }
  }, [gameState, battleMode, isHost, currentQuestion, sessionId, roomCode, roundAnswers, battleSettings, currentRound, redistributionProcessed, players]); // ← Adicionar players

  // 4. ADICIONAR um useEffect SEPARADO (não mexer no principal)
// Adicione este useEffect separado, não mexa no seu useEffect principal:
// 🔧 CORREÇÕES NECESSÁRIAS no useEffect:

// 1. PROBLEMA: getRoomByCode pode não estar buscando o campo is_random_selection
// SOLUÇÃO: Atualizar a função getRoomByCode

async function getRoomByCode(roomCode: string) {
  const { data, error } = await supabase
      .from('game_rooms')
      .select(
          // ✅ ADICIONAR o novo campo
          'id, room_code, status, selected_spotify_album_id, selected_mp3_album_id, selected_genre_id, next_genre_id, is_random_selection'
      )
      .eq('room_code', roomCode)
      .maybeSingle();

  if (error) throw error;
  return data;
}

// 2. PROBLEMA: loadAlbumInfo pode não estar funcionando com escolha aleatória
// SOLUÇÃO: Atualizar o useEffect que carrega informações do álbum

// Adicione este useEffect separado APÓS o useEffect principal:
  useEffect(() => {
    const loadAlbumInfo = async () => {
      try {
        const mode = await getGameMode();
        if (mode !== 'mp3') return;

        const { data: roomData } = await supabase
            .from('game_rooms')
            .select('selected_mp3_album_id, is_random_selection')
            .eq('room_code', roomCode)
            .maybeSingle();

        // ✅ CORRIGIDO: Verificar seleção aleatória PRIMEIRO
        if (roomData?.is_random_selection === true) {
          console.log('🎲 Carregando info para seleção aleatória');
          setSelectedAlbumInfo({
            name: 'Seleção Aleatória',
            artist: 'Vários Artistas',
            genre: 'Mix de Gêneros',
            coverImage: undefined
          });
          return; // ← IMPORTANTE: PARAR AQUI, não continuar
        }

        // ✅ CORRIGIDO: Verificar se ID não é null/undefined ANTES de buscar
        if (!roomData?.selected_mp3_album_id) {
          console.log('🎯 Nenhum álbum selecionado, limpando info');
          setSelectedAlbumInfo(null);
          return; // ← IMPORTANTE: PARAR AQUI também
        }

        // Só chegar aqui se tiver um ID válido de álbum
        console.log('🎵 Buscando álbum específico:', roomData.selected_mp3_album_id);

        const { data: album, error } = await supabase
            .from('albums')
            .select(`
          name,
          artist_name,
          cover_image_url,
          genres (name)
        `)
            .eq('id', roomData.selected_mp3_album_id) // ← Agora é garantido que não é null
            .maybeSingle();

        if (error) {
          console.error('Erro ao buscar álbum:', error);
          setSelectedAlbumInfo(null);
          return;
        }

        if (album) {
          setSelectedAlbumInfo({
                name: album.name,
                artist: album.artist_name,
                genre: album.genres?.name || '',
              coverImage: album.cover_image_url
        });
        } else {
          setSelectedAlbumInfo(null);
        }

      } catch (error) {
        console.error('Erro ao carregar info do álbum:', error);
        setSelectedAlbumInfo(null);
      }
    };

    loadAlbumInfo();
  }, [roomCode]);


// Sistema simples de cleanup automático - adicione este useEffect
  // Sistema de cleanup automático usando sua função leave_room
  useEffect(() => {
    if (!isHost || !sessionId) return;

    const autoCleanup = async () => {
      try {
        // Buscar participantes que não foram atualizados há mais de 30 segundos
        const { data: staleParticipants, error } = await supabase
            .from('room_participants')
            .select('client_id, display_name, updated_at')
            .eq('room_code', roomCode)
            .lt('updated_at', new Date(Date.now() - 30000).toISOString());

        if (!error && staleParticipants && staleParticipants.length > 0) {
          console.log('Removendo jogadores inativos:', staleParticipants);

          // Usar sua função leave_room para cada um
          for (const participant of staleParticipants) {
            const { error: leaveError } = await supabase.rpc('leave_room', {
              p_room_code: roomCode,
              p_client_id: participant.client_id
            });

            if (leaveError) {
              console.error('Erro ao remover jogador:', participant.client_id, leaveError);
            } else {
              console.log('Jogador removido:', participant.client_id);
            }
          }

          // Recarregar lista de jogadores
          await loadPlayersFromRoom();

          // Notificar outros jogadores
          if (gameChannelRef.current) {
            await gameChannelRef.current.send({
              type: 'broadcast',
              event: 'FORCE_PLAYERS_RELOAD',
              payload: { reason: 'auto_cleanup', removedCount: staleParticipants.length }
            });
          }
        }
      } catch (error) {
        console.error('Erro no auto-cleanup:', error);
      }
    };

    // Executar a cada 15 segundos
    const cleanupInterval = setInterval(autoCleanup, 15000);

    return () => clearInterval(cleanupInterval);
  }, [isHost, sessionId, roomCode, loadPlayersFromRoom]);

  // Heartbeat simples - apenas UPDATE no timestamp
  useEffect(() => {
    if (!sessionId) return;

    const updatePresence = async () => {
      try {
        await supabase
            .from('room_participants')
            .update({ updated_at: new Date().toISOString() })
            .eq('room_code', roomCode)
            .eq('client_id', clientId.current);
      } catch (error) {
        // Ignorar erros silenciosamente
      }
    };

    // Atualizar presença a cada 10 segundos
    const presenceInterval = setInterval(updatePresence, 10000);
    updatePresence(); // Executar imediatamente

    return () => clearInterval(presenceInterval);
  }, [sessionId, roomCode]);



const broadcastScoreUpdate = useCallback(async () => {
    if (!sessionId || !gameChannelRef.current) return;

    await gameChannelRef.current.send({
      type: 'broadcast',
      event: 'SCORE_UPDATE',
      payload: {
        timestamp: Date.now()
      }
    });
  }, [sessionId]);



  // Adicionar nova função para atualizar ovos no final da rodada
  // 2. ADICIONAR nova função para atualizar scores no final da rodada
  const updateScoresAtRoundEnd = useCallback(async () => {
    console.log('🎯 Atualizando scores no final da rodada...', { isSpectator });

    // 🔥 NÃO atualizar scores se for espectador
    if (isSpectator) {
      console.log('🚫 SPECTATOR: Não atualizando scores');
      return;
    }

    if (sessionId) {
      // Multiplayer: recarregar do banco
      await loadPlayersFromRoom();

      // Atualizar score local baseado no banco
      const currentPlayerData = players?.find(p => p.id === clientId.current);
      if (currentPlayerData && !currentPlayerData.is_spectator) {
        const bankEggs = (currentPlayerData as any).eggs || 0;
        console.log('🥚 Atualizando ovos locais:', playerEggs, '->', bankEggs);
        setPlayerEggs(bankEggs);
      }
    } else {
      // Single player: calcular localmente
      if (selectedAnswer !== null && currentQuestion && selectedAnswer === currentQuestion.correctAnswer) {
        const base = currentSettings.eggs_per_correct;
        const bonus = timeLeft > (currentSettings.time_per_question * 0.8) ? currentSettings.speed_bonus : 0;
        setPlayerEggs(e => e + base + bonus);
      }
    }
  }, [sessionId, loadPlayersFromRoom, players, clientId, selectedAnswer, currentQuestion, currentSettings, timeLeft, playerEggs, isSpectator]); // ← Adicionar isSpectator



// Chamar no final da rodada (gameState = 'reveal')
  useEffect(() => {
    if (gameState === 'reveal') {
      updateScoresAtRoundEnd();
    }
  }, [gameState, updateScoresAtRoundEnd]);

  // Adicione DENTRO da função useGameLogic, após os outros useEffect
  useEffect(() => {
    console.log('🎮 [useGameLogic] Estado COMPLETO:', {
      battleMode,
      battleSettings,
      gameState,
      sessionId: !!sessionId,
      isHost,
      roundAnswersKeys: Object.keys(roundAnswers)
    });
  }, [battleMode, battleSettings, gameState, sessionId, isHost, roundAnswers]);


  // próxima rodada (host)
  useEffect(() => {
    if (!sessionId || !isHost) return;
    if (gameState !== 'transition') return;

    (async () => {
      try {
        const nextRound = currentRound + 1;
        const maxRounds = battleMode === 'battle' ? battleSettings.totalRounds : 10;
        if (nextRound > maxRounds) {

          try {
            // 🔥 Atualiza status da sala via função do banco
            const { data, error } = await supabase.rpc("end_round_allow_album_selection", {
              p_room_code: roomCode,
              p_winner_profile_id: null // ou id do vencedor se tiver
            });

            if (error) {
              console.error("❌ Erro ao chamar end_round_allow_album_selection:", error);
            } else {
              console.log("✅ Sala atualizada para round_lobby:", data);
            }
          } catch (err) {
            console.error("❌ Exceção ao chamar função RPC:", err);
          }
          // Ao final da 10ª pergunta, host dispara evento para todos redirecionarem
          // console.log('[host] Fim das 10 perguntas, enviando broadcast para redirecionar todos');
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
        // console.error('[host] erro ao iniciar próxima rodada:', err);
        toast({ title: 'Erro', description: 'Falha ao iniciar a próxima rodada.', variant: 'destructive' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, roomCode, playerEggs, sessionId, broadcastEndOfRound]);

  // Adicione este useEffect separado APÓS todos os outros useEffect:
  useEffect(() => {
    if (battleMode === 'battle' && sessionId && !isLoading) {
      const initializeBattleEggsOnce = async () => {
        try {
          console.log('🥚 [useEffect] Inicializando ovos de batalha...');
          await initializeBattleEggs(roomCode, battleSettings);
          await loadPlayersFromRoom();
          console.log('🥚 [useEffect] Ovos de batalha inicializados');
        } catch (error) {
          console.error('🥚 [useEffect] Erro ao inicializar ovos:', error);
        }
      };

      initializeBattleEggsOnce();
    }
  }, [battleMode, sessionId, isLoading, roomCode, battleSettings]); // Executa apenas quando necessário

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
        playerEggs: battleMode === 'battle'
            ? (players?.find(p => p.id === clientId.current)?.eggs || battleSettings.initialEggs)
  : playerEggs,
    answerTime,
    currentSettings,
      // NOVOS RETORNOS:
      eggTransferEvents,
      playerEggChanges,
      showEggEffects,
      toggleEggEffects,
      forceEffectsUpdate,

    //Não utilizar músicas repetidas na rodada
    resetUsedSongs, // NOVA FUNÇÃO PARA RESETAR
    usedSongsCount: usedSongIds.length,

    // sync
    isHost,
    answersByOption,
    activeGenre,
    players,
    selectedAlbumInfo,
    resetUsedOptions,
    usedOptionsCount: usedOptionTitles.length,
    checkAndResetOptions,
    // ADICIONE estas novas propriedades:
    battleMode,
    battleSettings,
      totalRounds: battleMode === 'battle' ? battleSettings.totalRounds : 10,
    roundAnswers: Object.keys(roundAnswers).length,
    redistributionProcessed, // ADICIONE esta linha
  };
};