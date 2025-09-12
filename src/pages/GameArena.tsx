import {useEffect, useRef, useState} from "react";
import {useParams, useNavigate, useSearchParams} from "react-router-dom";
import {BarnCard} from "@/components/BarnCard";
import {ChickenAvatar} from "@/components/ChickenAvatar";
import {EggCounter} from "@/components/EggCounter";
import {MusicPlayer} from "@/components/MusicPlayer";
import {ChickenButton} from "@/components/ChickenButton";
import {GameNavigation} from "@/components/GameNavigation";
import {useGameLogic} from "@/hooks/useGameLogic";
import {Loader2} from "lucide-react";
import GameArenaGuard from "./GameArenaGuard";
import {useAuthSession} from "@/hooks/useAuthSession";
import {getOrCreateClientId} from "@/utils/clientId";
import {GameChat, ChatToggleButton} from "@/components/GameChat";

/** Util: extrai o trackId a partir de uma URL de embed do Spotify */
function extractSpotifyTrackIdFromUrl(url?: string | null): string | undefined {
    if (!url) return undefined;
    const m = url.match(/spotify\.com\/(?:embed\/)?track\/([A-Za-z0-9]+)/i);
    return m ?
.
    [1];
}

function GameArenaContent() {
    const {roomCode} = useParams<{ roomCode: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const sid = (searchParams.get("sid") || "").trim();

    const {user} = useAuthSession();
    const clientId = useRef(getOrCreateClientId());

    const [countdown, setCountdown] = useState<number | null>(null);
    const [showCountdown, setShowCountdown] = useState(false);
    const countdownStartedRef = useRef(false);
    const [systemGameMode, setSystemGameMode] = useState<"mp3" | "spotify">("mp3");

    // Estados do chat
    const [showChat, setShowChat] = useState(false);
    const [chatUnreadCount, setChatUnreadCount] = useState(0);

    // navegação pós-set
    useEffect(() => {
        const handleNavigateToLobby = (event: CustomEvent) => {
            const {roomCode: navRoomCode, setComplete, eggs} = event.detail;
            navigate(`/game/lobby/${navRoomCode}?setComplete=${setComplete}&eggs=${eggs}`);
        };

        const handleNavigateToRoundLobby = (event: CustomEvent) => {
            const {roomCode: navRoomCode, playerEggs, sessionId} = event.detail;
            navigate(`/round-lobby/${navRoomCode}?sid=${sessionId}&eggs=${playerEggs}`);
        };

        window.addEventListener("navigateToLobby", handleNavigateToLobby as EventListener);
        window.addEventListener("navigateToRoundLobby", handleNavigateToRoundLobby as EventListener);
        return () => {
            window.removeEventListener("navigateToLobby", handleNavigateToLobby as EventListener);
            window.removeEventListener("navigateToRoundLobby", handleNavigateToRoundLobby as EventListener);
        };
    }, [navigate]);

    const {
        isLoading,
        gameState,
        currentRound,
        timeLeft,
        selectedAnswer,
        showResults,
        currentQuestion,
        gameStarted,
        audioUnlocked,
        handleAnswerSelect,
        startFirstRound,
        playerEggs,
        players,
        answerTime,
        currentSettings,
        answersByOption,
        isHost,
        activeGenre,
        selectedAlbumInfo,
        battleMode, // ADICIONE ESTA LINHA
        battleSettings, // ADICIONE ESTA LINHA
    } = useGameLogic(roomCode || "", sid);

    // Função para iniciar o countdown
    // Função para iniciar o countdown
    const startCountdown = () => {
        console.log("🔍 startCountdown chamado:", {
            countdownStarted: countdownStartedRef.current,
            showCountdown,
            countdown
        });

        if (countdownStartedRef.current) {
            console.log("⛔ Countdown já iniciado, ignorando chamada");
            return;
        }

        console.log("✅ Iniciando countdown pela primeira vez");
        countdownStartedRef.current = true;
        setShowCountdown(true);
        setCountdown(5);
    };


    // Effect para gerenciar o countdown
    useEffect(() => {
        if (countdown === null) return;

        if (countdown > 0) {
            const timer = setTimeout(() => {
                setCountdown(countdown - 1);
            }, 1000);
            return () => clearTimeout(timer);
        } else {
            // Countdown chegou a 0, iniciar o jogo
            console.log("🎯 Countdown terminou, iniciando jogo");
            setShowCountdown(false);
            setCountdown(null);
            // countdownStartedRef.current = false; // Reset para permitir novo countdown se necessário

            // ADICIONAR: Ativar autoplay para todo o jogo
            if (typeof window !== 'undefined' && window.navigator) {
                // Tentar reproduzir um áudio silencioso para "unlock" autoplay
                const silentAudio = new Audio();
                silentAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IAAAAAEAAQAAQBoAAEAaAAABAAgAZGF0YQAAAAA=";
                silentAudio.play().catch(() => console.log('Silent audio failed'));
            }

            startFirstRound();
        }
    }, [countdown, startFirstRound]);

    useEffect(() => {
        // Reset o flag quando voltar ao estado idle SEM sid
        if (gameState === "idle" && !sid && countdownStartedRef.current) {
            console.log("🔄 Resetando countdown flag - voltou ao idle sem sid");
            countdownStartedRef.current = false;
        }
    }, [gameState, sid]);


    // NOVA LÓGICA: Auto-iniciar countdown se já tem sessionId
    useEffect(() => {
        console.log("🔍 Auto-start useEffect:", {
            sid: !!sid,
            isLoading,
            gameState,
            gameStarted,
            showCountdown,
            countdown,
            countdownStarted: countdownStartedRef.current
        });
        if (sid && !isLoading && gameState === "idle" && !gameStarted && !showCountdown && countdown === null && !countdownStartedRef.current) {
            console.log("🚀 Auto-starting countdown because session ID is present:", sid);
            startCountdown();
        }
    }, [sid, isLoading, gameState, gameStarted, showCountdown, countdown]);

    console.log("=== DEBUG COMPLETO ===");
    console.log("1. clientId.current:", clientId.current);
    console.log("2. players array completo:", players);
    console.log("3. jogador encontrado:", players ?.find((p) => p.id === clientId.current)
)
    ;
    console.log("4. user do supabase:", user);
    console.log("5. user.user_metadata:", user ?.user_metadata
)
    ;
    console.log("6. answersByOption:", answersByOption);
    console.log("7. countdown:", countdown);
    console.log("8. showCountdown:", showCountdown);

    const debugPlayer = players ?
.
    find((p) => p.id === clientId.current);

    // ---------- helpers ----------
    const currentPlayer = (() => {
        const loggedPlayer = players ?
        .
        find((p) => p.id === clientId.current);
        return {
            id: "current",
            name: loggedPlayer ?.name || user ?
        .
        user_metadata ?
        .
        display_name || "Você",
            avatar
        :
        loggedPlayer ?
        .
        avatar || "🐔",
            eggs
        :
        playerEggs,
            selectedAnswer
        :
        selectedAnswer,
    }
        ;
    })();

    const playersOnOption = (optionIndex: number) => {
        const playersOnThisOption = answersByOption ?
        .
        [optionIndex] || [];

        if (selectedAnswer === optionIndex) {
            const loggedPlayer = players ?
        .
            find((p) => p.id === clientId.current);
            const isAlreadyInList = playersOnThisOption.some(p => p.id === clientId.current);

            if (!isAlreadyInList && loggedPlayer ?.
            avatar ?
        .
            startsWith("/")
        )
            {
                return [...playersOnThisOption, {
                    id: clientId.current,
                    name: loggedPlayer.name,
                    avatar: loggedPlayer.avatar
                }];
            }
        }

        return playersOnThisOption;
    };

    const getAnswerColor = (index: number) => {
        if (!showResults) {
            return selectedAnswer === index ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted";
        }
        if (currentQuestion && index === currentQuestion.correctAnswer) return "bg-green-500 text-white border-green-400";
        if (selectedAnswer === index) return "bg-destructive text-destructive-foreground";
        return "bg-muted text-muted-foreground";
    };


    const loadGameMode = async() => {
        try {
            const {data, error} = await supabase
                .from("game_settings")
                .select("value")
                .eq("key", "game_mode")
                .maybeSingle();

            console.log('🎮 Game mode from DB:', data);

            if (!error && data ?.
            value
        )
            {
                const mode = typeof data.value === 'string' ? data.value.replace(/"/g, '') : 'mp3';
                const finalMode = mode === 'spotify' ? 'spotify' : 'mp3';
                console.log('🎮 Setting game mode to:', finalMode);
                setSystemGameMode(finalMode);
            }
        } catch (error) {
            console.error("Error loading game mode:", error);
        }
    };

    // Chamar no useEffect
    useEffect(() => {
        loadGameMode();
    }, []);

    // ---------- DECISÃO: Spotify vs MP3 para a música atual ----------
    const song = currentQuestion?.song ?? {};

    const rawSpotifyTrackId: string | undefined =
        (song as any).spotify_track_id ||
        (song as any).spotifyTrackId ||
        (song as any).track_id ||
        extractSpotifyTrackIdFromUrl((song as any).embed_url || (song as any).spotify_embed_url);

    const spotifyEmbedUrl: string | undefined =
        (song as any).embed_url ||
        (song as any).spotify_embed_url ||
        (rawSpotifyTrackId ? `https://open.spotify.com/embed/track/${rawSpotifyTrackId}?utm_source=generator&theme=0` : undefined);

    const preferSpotify = !!rawSpotifyTrackId || !!spotifyEmbedUrl;
    const finalGameMode: "mp3" | "spotify" = preferSpotify ? "spotify" : "mp3";

    // ---------- LOADING ----------
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-sky flex items-center justify-center p-4">
                <BarnCard variant="golden" className="text-center p-6 sm:p-8 w-full max-w-md">
                    <div className="text-4xl sm:text-6xl mb-4 animate-chicken-walk">🐔</div>
                    <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin mx-auto mb-4 text-white"/>
                    <p className="text-white text-sm sm:text-lg">{sid ? "Entrando no jogo..." : "Preparando o galinheiro musical..."}</p>
                </BarnCard>
            </div>
        );
    }

    // ---------- COUNTDOWN SCREEN ----------
    if (showCountdown && countdown !== null) {
        return (
            <div className="min-h-screen bg-gradient-sky flex items-center justify-center p-4">
                <BarnCard variant="golden" className="text-center p-8 sm:p-12 w-full max-w-lg">
                    <div className="text-6xl sm:text-8xl mb-6 animate-bounce">
                        {countdown > 0 ? countdown : "🎵"}
                    </div>
                    <h2 className="text-2xl sm:text-4xl font-bold text-white mb-4">
                        {countdown > 0 ? "Preparando..." : "Vamos começar!"}
                    </h2>
                    <p className="text-white/80 text-lg sm:text-xl">
                        {countdown > 0
                            ? "O jogo começará em instantes! Aumente o volume do seu dispositivo para ouvir as músicas."
                            : "Boa sorte, galinhas!"
                        }
                    </p>

                    {/* Barra de progresso visual */}
                    <div className="mt-6 w-full bg-white/20 rounded-full h-2">
                        <div
                            className="bg-white h-2 rounded-full transition-all duration-1000 ease-linear"
                            style={{ width: `${((5 - countdown) / 5) * 100}%` }}
                        />
                    </div>
                </BarnCard>
            </div>
        );
    }

    // ---------- RENDER ----------
    return (
        <div className="min-h-screen bg-gradient-sky p-2 sm:p-4">
            
            <div className="flex justify-center mb-4">
                <div className="w-full max-w-4xl sticky top-0 z-50 bg-black/20 backdrop-blur-sm rounded-lg border border-white/10 p-2">
                    <div className="px-4 py-3">

                        {/* Linha principal */}
                        <div className="flex items-center justify-between">

                            {/* Itens (esquerda no mobile, centralizados + espaçados no desktop) */}
                            <div className="flex flex-1 justify-start sm:justify-center gap-4 sm:gap-12">
                                {/* Rodada */}
                                <div className="flex flex-col items-center">
                                    <span className="text-sm mb-1">🔢</span>
                                    <p className="text-xs text-white/80">Rodada</p>
                                    <p className="text-sm font-bold text-white">{currentRound}/10</p>
                                </div>

                                {/* Tempo */}
                                <div className="flex flex-col items-center">
                                    <span className="text-sm mb-1 animate-chicken-walk">🐓</span>
                                    <p className="text-xs text-white/80">Tempo</p>
                                    <p className="text-sm font-bold text-white">{timeLeft}s</p>
                                </div>

                                {/* Valendo */}
                                <div className="flex flex-col items-center">
                                    <span className="text-sm mb-1 animate-egg-bounce">🥚</span>
                                    <p className="text-xs text-white/80">Valendo</p>
                                    <p className="text-sm font-bold text-white">
                                        {currentSettings?.eggs_per_correct || 10}
                                    </p>
                                </div>

                                {/* Estilo */}
                                {activeGenre ? (
                                    <div className="flex flex-col items-center">
                                        <span className="text-sm mb-1">{activeGenre.emoji}</span>
                                        <p className="text-xs text-white/80">Estilo</p>
                                        <p className="text-xs font-bold text-white">{activeGenre.name}</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <span className="text-sm mb-1">🎵</span>
                                        <p className="text-xs text-white/80">Estilo</p>
                                        <p className="text-xs font-bold text-white">-</p>
                                    </div>
                                )}
                            </div>

                            {/* Botão sair sempre na direita */}
                            <div className="flex-shrink-0 ml-4">
                                <GameNavigation showLeaveRoom={true} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>




            {/* Header fixo com informações do jogo - CENTRALIZADO */}
            <div className="flex justify-center mb-4">
                <div className="w-full max-w-4xl sticky top-0 z-50 bg-black/20 backdrop-blur-sm rounded-lg border border-white/10 p-2">
                    <div className="px-4 py-3">


            {/* RANKING - SEMPRE ACIMA EM TODAS AS RESOLUÇÕES */}
            <div className="space-y-4 pt-2 sm:pt-4">
                {/* RANKING HORIZONTAL COM SCROLL */}
                <div className="w-full">
                    <h3 className="text-sm sm:text-xl font-bold text-barn-brown mb-3 sm:mb-4 text-center">
                        🏆 Ranking da Partida
                    </h3>

                    {/* Container com scroll horizontal */}
                    <div className="overflow-x-auto pb-2">
                        <div className="flex gap-1 min-w-max px-2">
                            {Array.isArray(players) && players.length > 0 ? (
                                players
                                    .sort((a, b) => ((b as any).eggs || 0) - ((a as any).eggs || 0))
                                    .map((player, index) => {
                                        const isCurrentPlayer = player.id === clientId.current;
                                        const position = index + 1;

                                        // Cores para as 3 primeiras posições
                                        const badgeColor =
                                            position === 1
                                                ? "bg-yellow-500"
                                                : position === 2
                                                ? "bg-gray-500"
                                                : position === 3
                                                ? "bg-orange-500"
                                                : "bg-muted text-muted-foreground";

                                        return (
                                            <div
                                                key={player.id}
                                                className="relative flex flex-col items-center p-3 rounded-lg min-w-[90px] sm:min-w-[110px]"

                                            >
                                                {/* Avatar com medalha de posição */}
                                                <div className="relative mb-2">
                                                    {player.avatar ?.startsWith("/") ? (
                                                    <img
                                                        src={player.avatar}
                                                        alt={player.name}
                                                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-white"
                                                    />
                                                    ) : (
                                                    <div
                                                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-xl bg-primary/20 border-2 border-white">
                                                        {player.avatar || "🐔"}
                                                    </div>
                                                    )}

                                                    {/* Medalha */}
                                                    <div
                                                        className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${badgeColor}`}
                                                    >
                                                        {position}
                                                    </div>
                                                </div>

                                                {/* Nome do jogador */}
                                                <div
                                                    className="text-xs font-medium text-white truncate max-w-[80px] mb-1 text-center">
                                                    {player.name || "Jogador"}
                                                </div>

                                                {/* Contador de Ovos */}
                                                <div className="flex items-center gap-1 text-xs font-bold text-white">
                                                    <span>{(player as any).eggs || 0}</span>
                                                    <span>🥚</span>
                                                </div>
                                            </div>
                                        );
                                    })
                            ) : (
                                <div className="w-full text-center py-8">
                                    <p className="text-sm text-muted-foreground">
                                        Ranking ainda não disponível...
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Indicador de scroll (opcional) */}
                    {Array.isArray(players) && players.length > 4 && (
                        <div className="text-center mt-2">
                            <p className="text-xs text-muted-foreground">
                                ← Role para ver mais jogadores →
                            </p>
                        </div>
                    )}
                </div>
            </div>

                    </div>
                </div>
            </div>

            {/* Header fixo com informações do jogo - CENTRALIZADO */}
            <div className="flex justify-center mb-4">
                <div className="w-full max-w-4xl sticky top-0 z-50 bg-black/20 backdrop-blur-sm rounded-lg border border-white/10 p-2">
                    <div className="px-4 py-3">

                        {/* Barra de progresso do áudio - centralizada */}
                        {gameState !== "idle" && currentQuestion && (
                            <div className="bg-black/20 rounded-lg p-0">
                                <MusicPlayer
                                    songTitle={currentQuestion?.song.title || ""}
                                artist={currentQuestion ?.song.artist || ""}
                                audioUrl={currentQuestion ?.song.audioUrl}
                                duration={currentSettings.song_duration}
                                    gameState={gameState}
                                    autoPlay={true}
                                    roundKey={`round-${currentRound}`}
                                    gameMode={finalGameMode}
                                    spotifyTrackId={rawSpotifyTrackId}
                                    />
                            </div>
                        )}
                        </div>
                        </div>
                        </div>

            {/* Container principal centralizado */}
            <div className="flex justify-center">
                <div className="w-full max-w-4xl">
                    {/* Estado IDLE */}
                    {gameState === "idle" && !sid && (
                        <div className="flex justify-center">
                            <ChickenButton
                                onClick={async () => {
                                console.log("🖱️ Liberando áudio para toda a sessão");
                                const unlockEvent = new CustomEvent('unlockAudio');
                                window.dispatchEvent(unlockEvent);
                                setTimeout(() => {
                                    startCountdown();
                                }, 100);
                            }}
                            >
                                {isHost ? "🎵 Iniciar Jogo" : "🔊 Liberar áudio"}
                            </ChickenButton>
                        </div>
                    )}

                    {/* Arena do jogo */}
                    {gameState !== "idle" && currentQuestion && (
                        <div className="space-y-4">


                            {/*<BarnCard variant="coop" className="p-3 sm:p-4">*/}
                            {/*<h3 className="text-sm sm:text-xl font-bold text-barn-brown mb-3 sm:mb-4 text-center">*/}
                            {/*🏆 Ranking da Partida*/}
                            {/*</h3>*/}

                            {/*/!* Layout vertical para TODAS as resoluções *!/*/}
                            {/*<div className="space-y-2 sm:space-y-3">*/}
                            {/*{Array.isArray(players) && players.length > 0 ? (*/}
                            {/*players*/}
                            {/*.sort((a, b) => ((b as any).eggs || 0) - ((a as any).eggs || 0))*/}
                            {/*.slice(0, 6)*/}
                            {/*.map((player, index) => {*/}
                            {/*const isCurrentPlayer = player.id === clientId.current;*/}
                            {/*return (*/}
                            {/*<div*/}
                            {/*key={player.id}*/}
                            {/*className={`flex items-center gap-2 sm:gap-3 p-2 rounded-lg ${isCurrentPlayer ? 'bg-primary/10 border-2 border-primary' : 'bg-muted/10'}`}*/}
                            {/*>*/}
                            {/*<span className="text-sm font-bold w-6 text-center">*/}
                            {/*{index + 1}º*/}
                            {/*</span>*/}

                            {/*{player.avatar?.startsWith("/") ? (*/}
                            {/*<img*/}
                            {/*src={player.avatar}*/}
                            {/*alt={player.name}*/}
                            {/*className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-white flex-shrink-0"*/}
                            {/*/>*/}
                            {/*) : (*/}
                            {/*<div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-sm">*/}
                            {/*{player.avatar || "🐔"}*/}
                            {/*</div>*/}
                            {/*)}*/}

                            {/*<div className="flex-1 min-w-0">*/}
                            {/*<span className={`text-sm font-semibold truncate block ${isCurrentPlayer ? 'text-primary' : ''}`}>*/}
                            {/*{player.name || "Jogador"}*/}
                            {/*{isCurrentPlayer && <span className="ml-1">(Você)</span>}*/}
                            {/*</span>*/}
                            {/*</div>*/}

                            {/*<EggCounter*/}
                            {/*count={(player as any).eggs || 0}*/}
                            {/*size="sm"*/}
                            {/*variant={index === 0 ? "golden" : "default"}*/}
                            {/*className="flex-shrink-0"*/}
                            {/*/>*/}
                            {/*</div>*/}
                            {/*);*/}
                            {/*})*/}
                            {/*) : (*/}
                            {/*<p className="text-sm text-muted-foreground text-center">*/}
                            {/*Ranking ainda não disponível...*/}
                            {/*</p>*/}
                            {/*)}*/}
                            {/*</div>*/}
                            {/*</BarnCard>*/}

                            {/* Opções de resposta */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                                {currentQuestion.options.map((option: string, index: number) => (
                                    <BarnCard
                                        key={index}
                                        variant="default"
                                        className={`cursor-pointer transition-all duration-300 p-2 sm:p-3 relative ${getAnswerColor(index)}`}
                                        onClick={() => handleAnswerSelect(index)}
                                    >
                                        {/* Avatares posicionados na borda superior direita */}
                                        {playersOnOption(index).length > 0 && (
                                            <div className="absolute -top-2 -right-2 flex -space-x-1 z-10">
                                                {playersOnOption(index).slice(0, 3).map((p: any) => (
                                                    <div key={p.id} className="relative">
                                                        {p.avatar ?.startsWith("/") && (
                                                        <img
                                                            src={p.avatar}
                                                            alt={p.name}
                                                            className="w-8 h-8 sm:w-8 sm:h-8 rounded-full object-cover border-2 border-white shadow-lg"
                                                            title={p.name}
                                                        />
                                                        )}
                                                    </div>
                                                ))}
                                                {playersOnOption(index).length > 3 && (
                                                    <div
                                                        className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-500 border-2 border-white flex items-center justify-center shadow-lg">
                                                        <span
                                                            className="text-xs font-bold text-white">+{playersOnOption(index).length - 3}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Conteúdo da opção - apenas o texto */}
                                        <div className="flex items-center">
                                            <span className="font-semibold text-sm sm:text-base pr-6">{option}</span>
                                        </div>
                                    </BarnCard>
                                ))}
                            </div>



                            {/* Sua pontuação */}
                            <BarnCard variant="coop" className="p-3 sm:p-4">
                                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                                    <span className="text-lg sm:text-xl">🏆</span>
                                    <h3 className="text-sm sm:text-xl font-bold text-barn-brown">
                                        <span className="sm:hidden">Sua Pontuação</span>
                                        <span className="hidden sm:inline">Sua Pontuação - Rodada {currentRound}</span>
                                    </h3>
                                </div>

                                {/*{battleMode === 'battle' && isHost && (*/}
                                {/*<button onClick={() => {*/}
                                {/*console.log('🧪 Teste de redistribuição forçada');*/}
                                {/*redistributeEggs(roomCode, 0, {*/}
                                {/*'player1': { answer: 0, responseTime: 5 },*/}
                                {/*'player2': { answer: 1, responseTime: 3 }*/}
                                {/*}, battleSettings);*/}
                                {/*}}>*/}
                                {/*Testar Redistribuição*/}
                                {/*</button>*/}
                                {/*)}*/}

                                <div className="flex flex-col items-center text-center">
                                    {currentPlayer.avatar ?.startsWith("/") ? (
                                    <img
                                        src={currentPlayer.avatar}
                                        alt={currentPlayer.name}
                                        className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-white mb-2"
                                    />
                                    ) : (
                                    <ChickenAvatar
                                        emoji={currentPlayer.avatar || "🐔"}
                                        size="lg"
                                        animated
                                        className="mb-2 border-2 border-white"
                                    />
                                    )}

                                    <p className="font-semibold text-sm sm:text-lg mb-2">{currentPlayer.name}</p>
                                    <EggCounter count={playerEggs} size="lg" variant="golden"/>

                                    {selectedAnswer !== null && (
                                        <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-muted/50 rounded-lg w-full">
                                            <p className="text-xs sm:text-sm font-medium">
                                                <span className="sm:hidden">Resposta: </span>
                                                <span className="hidden sm:inline">Sua resposta: </span>
                                                <span
                                                    className="font-bold">{currentQuestion.options[selectedAnswer]}</span>
                                            </p>
                                            {answerTime && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Tempo: {answerTime.toFixed(1)}s
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </BarnCard>

                            {/* Resultados */}
                            {showResults && (
                                <BarnCard variant="golden" className="text-center p-4 sm:p-6">
                                    <div className="text-4xl sm:text-6xl mb-4">
                                        {selectedAnswer === currentQuestion.correctAnswer ? "🎉" : "😅"}
                                    </div>
                                    <h3 className="text-lg sm:text-2xl font-bold text-white mb-2">
                                        {selectedAnswer === currentQuestion.correctAnswer
                                            ? (
                                            <>
                                            <span className="sm:hidden">
                                                    🥚 Parabéns! +{currentSettings.eggs_per_correct || 10} ovos
                                                {timeLeft > ((currentSettings.time_per_question || 15) * 0.8) && ` +${currentSettings.speed_bonus || 5}!`}
                                                </span>
                                            <span className="hidden sm:inline">
                                                    🥚 Parabéns! Você ganhou {currentSettings.eggs_per_correct || 10}
                                                ovos
                                                {timeLeft > ((currentSettings.time_per_question || 15) * 0.8)
                                                    ? ` + ${currentSettings.speed_bonus || 5} bônus velocidade!`
                                                    : "!"
                                                }
                                                </span>
                                            </>
                                        )
                                            : (
                                            <>
                                            <span className="sm:hidden">
                                                    💔 Resposta: {currentQuestion.options[currentQuestion.correctAnswer]}
                                                </span>
                                            <span className="hidden sm:inline">
                                                    💔 Que pena! A resposta correta era: {currentQuestion.options[currentQuestion.correctAnswer]}
                                                </span>
                                            </>
                                        )}
                                    </h3>
                                    <p className="text-white/80 text-sm sm:text-lg">
                                        {currentRound < 10 ? (
                                            <>
                                            <span className="sm:hidden">Próxima música...</span>
                                            <span className="hidden sm:inline">Próxima música em instantes...</span>
                                            </>
                                        ) : (
                                            "Fim do jogo! Parabéns!"
                                        )}
                                    </p>
                                </BarnCard>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Chat */}
            <GameChat
                roomCode={roomCode || ""}
                sessionId={sid}
                isVisible={showChat}
                onToggle={() => {
                setShowChat(false);
                setChatUnreadCount(0);
            }}
                onUnreadChange={(count) => setChatUnreadCount(count)}
            />

            {/* Botão do chat */}
            {!showChat && (
                <ChatToggleButton
                    onClick={() => {
                    setShowChat(true);
                    setChatUnreadCount(0);
                }}
                    unreadCount={chatUnreadCount}
                />
            )}

            {/* Enfeites decorativos - apenas desktop */}
            <div className="fixed inset-0 pointer-events-none z-0 hidden lg:block">
                <div className="absolute top-20 right-10 animate-feather-float text-xl opacity-20">🪶</div>
                <div className="absolute bottom-40 left-10 animate-egg-bounce text-2xl opacity-10">🌽</div>
            </div>
        </div>
    );
}

export default function GameArena() {
    return (
        <GameArenaGuard>
            <GameArenaContent />
        </GameArenaGuard>
    );
}