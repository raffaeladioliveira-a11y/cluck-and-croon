import { useState, useEffect } from 'react';
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

export const useGameLogic = (roomCode: string) => {
  const [currentRound, setCurrentRound] = useState(1);
  const [timeLeft, setTimeLeft] = useState(15);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<GameQuestion | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [currentSettings, setCurrentSettings] = useState<any>({});
  const [playerEggs, setPlayerEggs] = useState(0);
  const [answerTime, setAnswerTime] = useState<number | null>(null);
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
      
      if (!songs || songs.length < 4) {
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
    
    const options = shuffled.slice(0, 4).map(song => song.title);
    
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
        setGameStarted(true);
      }
    } catch (error) {
      console.error('Erro ao inicializar jogo:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Timer do jogo
  useEffect(() => {
    if (gameStarted && timeLeft > 0 && !showResults) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && gameStarted) {
      setShowResults(true);
    }
  }, [timeLeft, showResults, gameStarted]);

  // Selecionar resposta
  const handleAnswerSelect = (answerIndex: number) => {
    if (!showResults && selectedAnswer === null && currentSettings) {
      setSelectedAnswer(answerIndex);
      setAnswerTime(currentSettings.time_per_question - timeLeft); // Tempo que levou para responder

      // Calcular pontos
      const isCorrect = answerIndex === currentQuestion?.correctAnswer;
      if (isCorrect) {
        const baseEggs = currentSettings.eggs_per_correct || 10;
        const timeBonus = timeLeft > (currentSettings.time_per_question * 0.8) ? 
          (currentSettings.speed_bonus || 5) : 0; // Bônus se respondeu em 80% do tempo
        
        const totalEggs = baseEggs + timeBonus;
        setPlayerEggs(prev => prev + totalEggs);
        
        console.log('🥚 Pontuação:', { baseEggs, timeBonus, totalEggs, timeLeft });
      }

      // Auto-avanço em single-player após 2 segundos
      setTimeout(() => {
        setShowResults(true);
      }, 2000);
    }
  };

  // Próxima rodada
  const nextRound = async () => {
    if (currentRound < 10) {
      setCurrentRound(prev => prev + 1);
      setSelectedAnswer(null);
      setShowResults(false);
      setAnswerTime(null);
      
      // Gerar nova pergunta com configurações atualizadas
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
    } else {
      // Fim do jogo
      toast({
        title: "🎉 Fim do jogo!",
        description: `Parabéns! Você coletou ${playerEggs} ovos em 10 rodadas!`
      });
    }
  };

  // Inicializar quando o hook é montado
  useEffect(() => {
    initializeGame();
  }, []);

  return {
    currentRound,
    timeLeft,
    selectedAnswer,
    showResults,
    currentQuestion,
    players,
    isLoading,
    gameStarted,
    handleAnswerSelect,
    nextRound,
    setPlayers,
    setShowResults,
    playerEggs,
    answerTime,
    currentSettings
  };
};