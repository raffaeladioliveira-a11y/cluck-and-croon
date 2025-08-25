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

  // URLs de áudio funcionais para cada música
  const getAudioUrl = (song: Song): string => {
    // Se tem URL válida do banco, usar ela
    if (song.preview_url && song.preview_url.trim() !== '') return song.preview_url;
    if (song.audio_file_url && song.audio_file_url.trim() !== '') return song.audio_file_url;
    
    // Gerar URL de audio sintético baseado na música para demonstração
    // Em produção, seria ideal ter arquivos de áudio reais
    const audioSamples = [
      "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav",
      "https://samplelib.com/lib/preview/mp3/sample-3s.mp3", 
      "https://file-examples.com/storage/fe68c8b7817ed82ba0c4c91/2017/11/file_example_MP3_700KB.mp3"
    ];
    
    // Usar hash do título para consistência
    const hash = song.title.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    return audioSamples[Math.abs(hash) % audioSamples.length];
  };

  // Gerar pergunta com títulos como opções
  const generateQuestion = (songs: Song[]): GameQuestion => {
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    const correctSong = shuffled[0];
    
    // Adicionar URL de áudio à música
    const songWithAudio = {
      ...correctSong,
      audioUrl: getAudioUrl(correctSong)
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
      const songs = await fetchRandomSongs();
      if (songs.length > 0) {
        const question = generateQuestion(songs);
        setCurrentQuestion(question);
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
    if (!showResults && selectedAnswer === null) {
      setSelectedAnswer(answerIndex);
    }
  };

  // Próxima rodada
  const nextRound = async () => {
    if (currentRound < 10) {
      setCurrentRound(prev => prev + 1);
      setSelectedAnswer(null);
      setShowResults(false);
      setTimeLeft(15);
      
      // Gerar nova pergunta
      const songs = await fetchRandomSongs();
      if (songs.length > 0) {
        const question = generateQuestion(songs);
        setCurrentQuestion(question);
      }
    } else {
      // Fim do jogo
      toast({
        title: "Fim do jogo!",
        description: "Parabéns por completar todas as rodadas!"
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
    setShowResults
  };
};