import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Song {
  id: string;
  title: string;
  artist: string;
  preview_url?: string;
  audio_file_url?: string;
  duration_seconds: number;
}

export interface GameQuestion {
  song: Song;
  options: string[]; // Títulos das músicas
  correctAnswer: number;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  eggs: number;
  selectedAnswer?: number;
}

export type GameState = 'idle' | 'playing' | 'reveal' | 'transition' | 'finished';

export interface GameRound {
  id: string;
  question: GameQuestion;
  answersCount: number;
  timeLeft: number;
  state: GameState;
}

export const useGameLogic = (roomCode: string) => {
  // State machine
  const [gameState, setGameState] = useState<GameState>('idle');
  const [currentRound, setCurrentRound] = useState(1);
  const [timeLeft, setTimeLeft] = useState(15);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<GameQuestion | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSettings, setCurrentSettings] = useState<any>({});
  const [playerEggs, setPlayerEggs] = useState(0);
  const [answerTime, setAnswerTime] = useState<number | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [answersCount, setAnswersCount] = useState(0);
  const [expectedPlayers, setExpectedPlayers] = useState(1); // Single-player default
  const [isHost, setIsHost] = useState(true); // Single-player default
  
  // Refs for cleanup
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeChannelRef = useRef<any>(null);
  
  const { toast } = useToast();

  // Buscar músicas do banco
  const fetchRandomSongs = async (): Promise<Song[]> => {
    try {
      const { data: songs, error } = await supabase
        .from('songs')
        .select('id, title, artist, preview_url, audio_file_url, duration_seconds')
        .eq('is_active', true)
        .limit(20);

      if (error) throw error;
      
      if (!songs || songs.length === 0) {
        throw new Error('Não há músicas suficientes no banco de dados');
      }

      return songs;
    } catch (error) {
      console.error('Erro ao buscar músicas:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar músicas do jogo",
        variant: "destructive"
      });
      return [];
    }
  };

  // Carregar configurações do jogo
  const loadGameSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('game_settings')
        .select('key, value');

      if (error) throw error;

      const settings: any = {};
      data?.forEach(setting => {
        settings[setting.key] = parseInt(setting.value as string);
      });

      return settings;
    } catch (error) {
      console.error('❌ Erro ao carregar configurações:', error);
      return {
        eggs_per_correct: 10,
        speed_bonus: 5,
        time_per_question: 15
      };
    }
  };

  // URLs de áudio com prioridade para Storage
  const getAudioUrl = (song: Song): string => {
    // Prioridade: audio_file_url (Storage) → preview_url → outros
    if (song.audio_file_url && song.audio_file_url.trim() !== '') {
      return song.audio_file_url;
    }
    if (song.preview_url && song.preview_url.trim() !== '') {
      return song.preview_url;
    }
    
    // URL de teste confiável como fallback
    return "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav";
  };

  // Gerar pergunta com títulos como opções
  const generateQuestion = (songs: Song[], gameSettings: any): GameQuestion => {
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    const correctSong = shuffled[0];
    
    // Adicionar URL de áudio à música
    const songWithAudio = {
      ...correctSong,
      audioUrl: getAudioUrl(correctSong),
      duration_seconds: gameSettings.song_duration || correctSong.duration_seconds || 15
    };
    
    // Gerar 4 opções, repetindo músicas se necessário
    const availableOptions = shuffled.map(song => song.title);
    const options = [];
    
    // Adicionar opções únicas primeiro
    for (let i = 0; i < Math.min(4, availableOptions.length); i++) {
      options.push(availableOptions[i]);
    }
    
    // Se temos menos de 4 opções, completar com opções repetidas modificadas
    while (options.length < 4) {
      const randomSong = shuffled[Math.floor(Math.random() * shuffled.length)];
      const modifiedTitle = `${randomSong.title} (Versão ${options.length - availableOptions.length + 1})`;
      options.push(modifiedTitle);
    }
    
    // Embaralhar as opções
    const shuffledOptions = options.sort(() => Math.random() - 0.5);
    const correctAnswer = shuffledOptions.indexOf(correctSong.title);

    return {
      song: songWithAudio,
      options: shuffledOptions,
      correctAnswer
    };
  };

  // Inicializar jogo
  const initializeGame = async () => {
    setIsLoading(true);
    try {
      const [songs, gameSettings] = await Promise.all([
        fetchRandomSongs(),
        loadGameSettings()
      ]);
      
      setCurrentSettings(gameSettings);
      
      if (songs.length > 0) {
        const question = generateQuestion(songs, gameSettings);
        setCurrentQuestion(question);
        setTimeLeft(gameSettings.time_per_question || 15);
      }
    } catch (error) {
      console.error('Erro ao inicializar jogo:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Start round timer
  const startRoundTimer = useCallback((duration: number) => {
    clearTimers();
    setTimeLeft(duration);
    
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (isHost) endRound('timeout');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [isHost]);

  // End round (host only)
  const endRound = useCallback((reason: 'timeout' | 'all_answered') => {
    if (!isHost) return;
    
    console.log('🏁 Ending round:', reason);
    clearTimers();
    setGameState('reveal');
    
    // Show results for 3 seconds, then transition
    timeoutRef.current = setTimeout(() => {
      if (currentRound >= 10) {
        setGameState('finished');
        toast({
          title: "🎉 Fim do jogo!",
          description: `Parabéns! Você coletou ${playerEggs} ovos em 10 rodadas!`
        });
      } else {
        setGameState('transition');
        setTimeout(() => startNextRound(), 100);
      }
    }, 3000);
  }, [isHost, currentRound, playerEggs]);

  // Start next round
  const startNextRound = useCallback(async () => {
    if (!isHost) return;
    
    console.log('🚀 Starting next round');
    setCurrentRound(prev => prev + 1);
    setSelectedAnswer(null);
    setAnswerTime(null);
    setAnswersCount(0);
    
    // Generate new question
    const [songs, gameSettings] = await Promise.all([
      fetchRandomSongs(),
      loadGameSettings()
    ]);
    
    setCurrentSettings(gameSettings);
    
    if (songs.length > 0) {
      const question = generateQuestion(songs, gameSettings);
      setCurrentQuestion(question);
      setGameState('playing');
      startRoundTimer(gameSettings.time_per_question || 15);
    }
  }, [isHost, startRoundTimer]);

  // Handle answer selection
  const handleAnswerSelect = useCallback((answerIndex: number) => {
    if (gameState !== 'playing' || selectedAnswer !== null) return;
    
    setSelectedAnswer(answerIndex);
    setAnswerTime((currentSettings.time_per_question || 15) - timeLeft);

    // Calculate score
    const isCorrect = answerIndex === currentQuestion?.correctAnswer;
    if (isCorrect) {
      const baseEggs = currentSettings.eggs_per_correct || 10;
      const timeBonus = timeLeft > ((currentSettings.time_per_question || 15) * 0.8) ? 
        (currentSettings.speed_bonus || 5) : 0;
      
      const totalEggs = baseEggs + timeBonus;
      setPlayerEggs(prev => prev + totalEggs);
      
      console.log('🥚 Score:', { baseEggs, timeBonus, totalEggs, timeLeft });
    }

    // Update answers count for single-player
    const newAnswersCount = answersCount + 1;
    setAnswersCount(newAnswersCount);
    
    // Check if all players answered (single-player: immediate end)
    if (newAnswersCount >= expectedPlayers && isHost) {
      endRound('all_answered');
    }
  }, [gameState, selectedAnswer, timeLeft, currentSettings, currentQuestion, answersCount, expectedPlayers, isHost, endRound]);

  // Manual start first round (user gesture)
  const startFirstRound = useCallback(() => {
    if (gameState !== 'idle') return;
    
    console.log('🎵 Starting first round with user gesture');
    setAudioUnlocked(true);
    setGameState('playing');
    startRoundTimer(currentSettings.time_per_question || 15);
  }, [gameState, currentSettings, startRoundTimer]);

  // Initialize game
  useEffect(() => {
    initializeGame();
    
    // Cleanup on unmount
    return () => {
      clearTimers();
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, []);

  // Auto-advance from reveal to next round (host only)
  useEffect(() => {
    if (gameState === 'reveal' && currentRound < 10 && isHost) {
      timeoutRef.current = setTimeout(() => {
        setGameState('transition');
        setTimeout(() => startNextRound(), 100);
      }, 3000);
    }
  }, [gameState, currentRound, isHost, startNextRound]);

  return {
    // Game state
    gameState,
    currentRound,
    timeLeft,
    selectedAnswer,
    showResults: gameState === 'reveal',
    currentQuestion,
    players,
    isLoading,
    gameStarted: gameState !== 'idle',
    
    // Audio control
    audioUnlocked,
    
    // Actions
    handleAnswerSelect,
    startFirstRound,
    
    // Player data
    playerEggs,
    answerTime,
    currentSettings,
    
    // Multi-player (future)
    answersCount,
    expectedPlayers,
    isHost
  };
};