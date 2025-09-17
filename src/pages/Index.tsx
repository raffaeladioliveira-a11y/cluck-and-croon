import {useState, useEffect} from "react";
import {useNavigate, useParams, useSearchParams} from "react-router-dom";
import {useAuthSession} from "@/hooks/useAuthSession";
import {ChickenButton} from "@/components/ChickenButton";
import {BarnCard} from "@/components/BarnCard";
import {ChickenAvatar} from "@/components/ChickenAvatar";
import {EggCounter} from "@/components/EggCounter";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {CreateRoom} from "@/components/multiplayer/CreateRoom";
import {JoinRoom} from "@/components/multiplayer/JoinRoom";
import {UserMenu} from "@/components/UserMenu";
import {toast} from "@/hooks/use-toast";
import {loadProfile, saveProfile, Profile, getDisplayNameOrDefault, getAvatarOrDefault} from "@/utils/clientId";
import heroImage from "@/assets/galinheiro-hero.jpg";
import heroImagelogo from "@/assets/smokechicken.png";
import {supabase} from "@/integrations/supabase/client";


interface BattleSettings {
    eggsPerRound: number;
    totalRounds: number;
    initialEggs: number;
}

// Adicione este componente na sua tela de entrada
const BattleModeInfo = ({battleSettings}: { battleSettings: BattleSettings }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const openModal = () => setIsModalOpen(true);
    const closeModal = () => setIsModalOpen(false);

    return (
        <>
        {/* Componente principal - apenas título e botão */}
        <div className="bg-gradient-to-r from-glass-500/10 to-orange-500/10 border-0 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-center gap-2 mb-4">
                <span className="text-4xl">⚔️</span>
                <h3 className="font-bold text-700 text-xl md:text-3xl">Modo Batalha Ativado!</h3>
            </div>
            <div className="flex items-center justify-center gap-2 mb-4">
                <h5 className="font-bold text-700 text-xl md:text-3xl">Como funciona?</h5>
            </div>
            <div className="text-center">
                <button
                    onClick={openModal}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-2 px-6 rounded-full transition-all duration-200 transform hover:scale-105 shadow-lg"
                >
                    📖 Ver Regras Completas
                </button>
            </div>
        </div>

        {/* Modal */}
        {isModalOpen && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-gradient-to-br from-purple-900/95 via-black/90 to-purple-800/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-purple-500/30">
                    {/* Header do Modal */}
                    <div className="sticky top-0 bg-gradient-to-r from-purple-800/90 to-black/90 backdrop-blur-md p-6 rounded-t-2xl border-b border-purple-400/30">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-4xl">⚔️</span>
                                <h2 className="text-2xl md:text-3xl font-bold text-white">Como funciona o Modo Batalha?</h2>
                            </div>
                            <button
                                onClick={closeModal}
                                className="bg-purple-600/30 hover:bg-purple-500/40 border border-purple-400/50 text-white font-semibold py-3 px-8 rounded-full transition-all duration-200 transform hover:scale-105"
                            >
                                ×
                            </button>
                        </div>
                    </div>

                    {/* Conteúdo do Modal */}
                    <div className="p-6 text-white">
                        <div className="text-base md:text-lg space-y-4 leading-relaxed">
                            <div className="bg-white/10 rounded-lg p-4 border border-white/20">
                                <p className="mb-3">🐔 <strong>Crie sua galinha:</strong> escolha um nome e um avatar, depois clique em <em>"Entrar na sala"</em>.</p>
                                <p className="mb-3">🎶 <strong>Aguarde o Host:</strong> ele selecionará o gênero musical e o álbum da partida.</p>
                                <p className="mb-3">⏱️ <strong>Início da rodada:</strong> após a contagem regressiva, uma música tocará por alguns segundos.</p>
                                <p>👉 <strong>Sua missão:</strong> antes que o tempo acabe, clique na opção que você acredita ser o nome correto da música.</p>
                            </div>

                            <hr className="border-white/20 my-4" />

                            <div className="bg-white/10 rounded-lg p-4 border border-white/20">
                                <p className="text-lg font-semibold mb-3 text-yellow-200">🥚 <strong>Regras dos ovos:</strong></p>
                                <ul className="list-disc list-inside space-y-2 pl-2">
                                    <li>Você começa com <strong className="text-yellow-200">{battleSettings.initialEggs} ovos</strong>.</li>
                                    <li>Cada rodada vale <strong className="text-yellow-200">{battleSettings.eggsPerRound} ovos</strong>.</li>
                                    <li>A partida tem <strong className="text-yellow-200">10 rodadas</strong>.</li>
                                    <li>Se <span className="text-red-300 font-semibold">errar</span>: seus ovos vão para quem acertou.</li>
                                    <li>Se <span className="text-green-300 font-semibold">acertar</span>: você ganha ovos de quem errou.</li>
                                    <li>Se <span className="text-yellow-300 font-semibold">não responder</span>: mantém seus ovos.</li>
                                </ul>
                            </div>

                            <div className="bg-gradient-to-r from-yellow-400/20 to-orange-400/20 rounded-lg p-4 border border-yellow-400/30 mt-4">
                                <p className="text-center text-lg font-semibold text-yellow-200">
                                    🏆 Quem tiver mais ovos ao final é o grande campeão! 🏆
                                </p>
                            </div>
                        </div>

                        {/* Botão de fechar no final */}
                        <div className="text-center mt-6">
                            <button
                                onClick={closeModal}
                                className="bg-white/20 hover:bg-white/30 text-white font-semibold py-3 px-8 rounded-full transition-all duration-200 transform hover:scale-105"
                            >
                                ✅ Entendi, vamos jogar!
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};
const Index = () => {
    const navigate = useNavigate();
    const {roomCode} = useParams<{ roomCode: string }>();
    const [searchParams] = useSearchParams();
    const {user, loading} = useAuthSession();

    const [playerName, setPlayerName] = useState("");
    const [selectedAvatar, setSelectedAvatar] = useState("🐔");
    const [isRedirectMode, setIsRedirectMode] = useState(false);

    // Estado para auto-join via sessionStorage (vindo do LobbyRedirectGuard)
    const [pendingRoomCode, setPendingRoomCode] = useState<string | null>(null);
    const [showAutoJoinForm, setShowAutoJoinForm] = useState(false);

    // Adicione estas funções no seu componente:
    const getBattleMode = async(): Promise<'classic' | 'battle'> => {
        const {data, error} = await supabase
            .from('game_settings')
            .select('value')
            .eq('key', 'battle_mode')
            .maybeSingle();

        if (error) return 'classic';

        const raw = data ?.value;
        const normalized = typeof raw === 'string' ? raw.replace(/"/g, '') : 'classic';
        return normalized === 'battle' ? 'battle' : 'classic';
    };

    const getBattleSettings = async(): Promise<BattleSettings> => {
        const {data, error} = await supabase
            .from('game_settings')
            .select('key, value')
            .in('key', ['battle_eggs_per_round', 'battle_total_rounds']);

        const defaults: BattleSettings = {
            eggsPerRound: 10,
            totalRounds: 10,
            initialEggs: 100
        };

        if (error || !data) return defaults;

        const settings = {...defaults};
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

    const chickenAvatars = [
        "/avatars/avatar1.jpg",
        "/avatars/avatar2.webp",
        "/avatars/avatar3.webp",
        "/avatars/avatar4.jpg",
        "/avatars/avatar5.webp",
        "/avatars/avatar6.webp",
        "/avatars/avatar7.webp",
        "/avatars/avatar8.jpg",
        "/avatars/avatar9.jpg",
        "/avatars/avatar10.jpg",
        "/avatars/avatar11.webp",
        "/avatars/avatar12.webp",
        "/avatars/avatar13.webp",
        "/avatars/avatar14.webp",
        "/avatars/avatar15.webp",
        "/avatars/avatar16.webp",
        "/avatars/avatar17.webp",
        "/avatars/avatar18.gif",
        "/avatars/avatar19.webp",
        "/avatars/avatar20.webp",
        "/avatars/avatar21.webp",
        "/avatars/avatar22.webp",
        "/avatars/avatar23.webp",
        "/avatars/avatar24.webp",
        "/avatars/avatar25.webp",
        "/avatars/avatar26.webp",
        "/avatars/avatar27.webp",
        "/avatars/avatar28.webp",
        "/avatars/avatar29.webp",
        "/avatars/avatar30.webp",
    ];


    // Dentro do componente da sua tela de entrada, adicione estes estados:
    const [battleMode, setBattleMode] = useState<'classic' | 'battle'>('classic');
    const [battleSettings, setBattleSettings] = useState<BattleSettings>({
        eggsPerRound: 10,
        totalRounds: 10,
        initialEggs: 100
    });
    const [isLoadingBattleSettings, setIsLoadingBattleSettings] = useState(true);

    // NOVA LÓGICA: Detecta auto-join vindo do LobbyRedirectGuard
    useEffect(() => {
        const roomFromStorage = sessionStorage.getItem('pendingRoomCode');

        if (roomFromStorage && /^[A-Z0-9]{6}$/.test(roomFromStorage)) {
            console.log("🔗 Auto-join detectado:", roomFromStorage);
            setPendingRoomCode(roomFromStorage.toUpperCase());
            setShowAutoJoinForm(true);

            // Carrega perfil existente se houver
            const profile = loadProfile();
            if (profile.displayName) setPlayerName(profile.displayName);
            if (profile.avatar) setSelectedAvatar(profile.avatar);

            // Limpa do sessionStorage
            sessionStorage.removeItem('pendingRoomCode');
        }
    }, []);

    // LÓGICA ORIGINAL: Verifica se chegou via link compartilhado
    useEffect(() => {
        if (roomCode) {
            if (user) {
                // Se logado, entra diretamente na sala
                navigate(`/lobby/${roomCode}`);
            } else {
                // Se não logado, ativa modo redirect
                setIsRedirectMode(true);
                // Carrega perfil salvo se houver
                const profile = loadProfile();
                if (profile.displayName) setPlayerName(profile.displayName);
                if (profile.avatar) setSelectedAvatar(profile.avatar);
            }
        }
    }, [roomCode, user, navigate]);

    // LÓGICA ORIGINAL: Carrega perfil se usuário estiver logado
    useEffect(() => {
        if (user && !roomCode) {
            const profile = loadProfile();
            if (profile.displayName) setPlayerName(profile.displayName);
            if (profile.avatar) setSelectedAvatar(profile.avatar);
        }
    }, [user, roomCode]);

    useEffect(() => {
        const loadBattleConfig = async() => {
            try {
                setIsLoadingBattleSettings(true);
                const [mode, settings] = await Promise.all([
                    getBattleMode(),
                    getBattleSettings()
                ]);

                setBattleMode(mode);
                setBattleSettings(settings);
            } catch (error) {
                console.error('Erro ao carregar configurações de batalha:', error);
            } finally {
                setIsLoadingBattleSettings(false);
            }
        };

        loadBattleConfig();
    }, []);

    // LÓGICA ORIGINAL: Join room com código
    const handleJoinRoomWithCode = () => {
        if (!playerName.trim()) return;

        // Salva perfil
        saveProfile({displayName: playerName, avatar: selectedAvatar});

        // IMPORTANTE: Define flag para o LobbyRedirectGuard
        sessionStorage.setItem('justConfiguredProfile', 'true');

        if (roomCode) {
            navigate(`/lobby/${roomCode}`);
        }
    };


    // NOVA FUNÇÃO: Auto-join para sessionStorage
    const handleAutoJoinRoom = async() => {
        if (!pendingRoomCode || !playerName.trim()) {
            toast({
                title: "🐔 Ops!",
                description: "Você precisa dar um nome para sua galinha primeiro!",
                variant: "destructive",
            });
            return;
        }

        const code = pendingRoomCode.toUpperCase().trim();
        if (!/^[A-Z0-9]{6}$/.test(code)) {
            toast({
                title: "🚪 Código Inválido!",
                description: "O código do galinheiro deve ter 6 caracteres (A-Z/0-9).",
                variant: "destructive",
            });
            setPendingRoomCode(null);
            setShowAutoJoinForm(false);
            return;
        }

        try {
            saveProfile({displayName: playerName, avatar: selectedAvatar});

            // IMPORTANTE: Define flag para o LobbyRedirectGuard saber que acabou de configurar
            sessionStorage.setItem('justConfiguredProfile', 'true');

            toast({
                title: "🎉 Entrando no Galinheiro!",
                description: `Conectando automaticamente ao galinheiro ${code}...`,
            });

            navigate(`/lobby/${code}`);

        } catch (error) {
            console.error("❌ Erro ao entrar na sala automaticamente:", error);
            toast({
                title: "❌ Erro!",
                description: "Não foi possível entrar na sala. Tente novamente.",
                variant: "destructive",
            });
            setPendingRoomCode(null);
            setShowAutoJoinForm(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-sky flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl animate-chicken-walk mb-4">🐔</div>
                    <p className="text-xl text-muted-foreground">Carregando galinheiro...</p>
                </div>
            </div>
        );
    }


    // MODO AUTO-JOIN: Quando vem do LobbyRedirectGuard para usuários não logados
    if (showAutoJoinForm && pendingRoomCode && !user) {
        return (
            <div className="min-h-screen bg-gradient-sky">
                {/* Header com UserMenu */}
                <header className="w-full sticky top-0 z-20 bg-background/70 backdrop-blur border-b">
                    <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
                        <div className="font-bold text-lg">®️ Cocoli</div>
                        <UserMenu />
                    </div>
                </header>


                <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
                    {/* Background Hero Image */}
                    <div
                        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
                        style={{ backgroundImage: `url(${heroImage})` }}
                    />

                    {/*/!* ADICIONE ESTA PARTE - Elementos animados *!/*/}
                    {/*<div className="absolute inset-0 pointer-events-none">*/}
                        {/*<div className="absolute top-20 left-10 animate-chicken-walk text-4xl">🐔</div>*/}
                        {/*<div className="absolute top-32 right-20 animate-egg-bounce text-3xl">🥚</div>*/}
                        {/*<div className="absolute bottom-40 left-20 animate-chicken-walk text-3xl"*/}
                             {/*style={{animationDelay: '1s'}}>🐓*/}
                        {/*</div>*/}
                        {/*<div className="absolute top-60 left-1/4 animate-feather-float text-2xl"*/}
                             {/*style={{animationDelay: '2s'}}>🪶*/}
                        {/*</div>*/}
                        {/*<div className="absolute bottom-60 right-1/4 animate-egg-bounce text-2xl"*/}
                             {/*style={{animationDelay: '0.5s'}}>🌽*/}
                        {/*</div>*/}
                    {/*</div>*/}

                    <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
                        {/* Main Title */}
                        <div className="mb-2 text-center">
                            <img
                                src={heroImagelogo}
                                alt="Galinheiro Musical"
                                className="mx-auto w-40 md:w-40"
                            />
                        </div>
                        <div className="mb-6 animate-barn-door-open">
                            <h1 className="text-3xl md:text-6xl font-bold mb-4 bg-gradient-sunrise bg-clip-text">
                                🎵 Galinheiro Musical
                            </h1>

                            <p className="text-xl md:text-4xl font-medium mb-2">
                                Onde o carro da rua passa no seu ovo e as galinhas choram!
                            </p>
                            {/*<p className="text-lg text-muted-foreground">*/}
                            {/*Teste seus conhecimentos musicais em um quiz multiplayer cheio de diversão*/}
                            {/*</p>*/}
                        </div>

                        {/* MUDE ESTA LINHA - adicione relative z-10 */}
                        <div className="relative z-10 container mx-auto px-4 py-8">
                            <div className="text-center mb-8">
                                <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-sunrise bg-clip-text">
                                    🎉 Você foi convidado!
                                </h1>
                                <p className="text-xl text-muted-foreground">
                                    Galinheiro: <strong className="font-mono">{pendingRoomCode}</strong>
                                </p>
                            </div>

                            {/* ADICIONE AQUI: */}
                            {!isLoadingBattleSettings && battleMode === 'battle' && (
                                <BattleModeInfo battleSettings={battleSettings}/>
                            )}

                            <BarnCard variant="golden" className="max-w-md mx-auto">
                                <div className="text-center">
                                    <h3 className="text-2xl font-bold mb-6 text-white">Configure sua Galinha</h3>

                                    {/* Name Input */}
                                    <div className="mb-6">
                                        <Label htmlFor="player-name"
                                               className="text-white/90">Nome da sua galinha</Label>
                                        <Input
                                            id="player-name"
                                            placeholder="Ex: Galinha Pititica"
                                            value={playerName}
                                            onChange={(e) => setPlayerName(e.target.value)}
                                            className="mt-2 text-center bg-white/10 border-white/20 text-white placeholder:text-white/60"
                                            maxLength={20}
                                        />
                                    </div>

                                    {/* Avatar Selection */}
                                    <div className="mb-6">
                                        <Label className="text-white/90 block mb-4">Escolha seu avatar</Label>
                                        <div className="grid grid-cols-5 gap-2">
                                            {chickenAvatars.map((gifUrl) => (
                                                <img
                                                    key={gifUrl}
                                                    src={gifUrl}
                                                    alt="Avatar"
                                                    className={`w-16 h-16 rounded-full object-cover cursor-pointer transition-all duration-200 ${
                        selectedAvatar === gifUrl
                          ? "transform scale-110 ring-2 ring-white/50"
                          : "hover:scale-105 opacity-70"
                      }`}
                                                    onClick={() => setSelectedAvatar(gifUrl)}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <ChickenButton
                                        onClick={handleAutoJoinRoom}
                                        disabled={!playerName.trim()}
                                        className="w-full mb-4"
                                        variant="corn"
                                        size="lg"
                                    >
                                        🚀 Entrar na Sala {pendingRoomCode}
                                    </ChickenButton>

                                    <div className="text-center">
                                        <button
                                            onClick={() => {
                    setPendingRoomCode(null);
                    setShowAutoJoinForm(false);
                  }}
                                            className="text-white/60 hover:text-white/80 text-sm underline"
                                        >
                                            Cancelar e usar interface normal
                                        </button>
                                    </div>
                                </div>
                            </BarnCard>
                        </div>
                    </div>
                </section>
            </div>
        );
    }


    // MODO REDIRECT: Lógica original para roomCode na URL
    if (isRedirectMode && !user) {
        return (
            <div className="min-h-screen bg-gradient-sky">
                {/* Header com UserMenu */}
                <header className="w-full sticky top-0 z-20 bg-background/70 backdrop-blur border-b">
                    <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
                        <div className="font-bold text-lg">®️ Cocoli</div>
                        <UserMenu />
                    </div>
                </header>

                <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
                    {/* Background Hero Image */}
                    <div
                        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
                        style={{ backgroundImage: `url(${heroImage})` }}
                    />

                    {/*/!* ADICIONE ESTA PARTE - Elementos animados *!/*/}
                    {/*<div className="absolute inset-0 pointer-events-none">*/}
                        {/*<div className="absolute top-20 left-10 animate-chicken-walk text-4xl">🐔</div>*/}
                        {/*<div className="absolute top-32 right-20 animate-egg-bounce text-3xl">🥚</div>*/}
                        {/*<div className="absolute bottom-40 left-20 animate-chicken-walk text-3xl"*/}
                             {/*style={{animationDelay: '1s'}}>🐓*/}
                        {/*</div>*/}
                        {/*<div className="absolute top-60 left-1/4 animate-feather-float text-2xl"*/}
                             {/*style={{animationDelay: '2s'}}>🪶*/}
                        {/*</div>*/}
                        {/*<div className="absolute bottom-60 right-1/4 animate-egg-bounce text-2xl"*/}
                             {/*style={{animationDelay: '0.5s'}}>🌽*/}
                        {/*</div>*/}
                    {/*</div>*/}

                    <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
                        {/* Main Title */}
                        <div className="mb-2 text-center">
                            <img
                                src={heroImagelogo}
                                alt="Galinheiro Musical"
                                className="mx-auto w-40 md:w-40"
                            />
                        </div>
                        <div className="mb-6 animate-barn-door-open">
                            <h1 className="text-3xl md:text-6xl font-bold mb-4 bg-gradient-sunrise bg-clip-text">
                                🎵 Galinheiro Musical
                            </h1>

                            <p className="text-xl md:text-4xl font-medium mb-2">
                                Onde o carro da rua passa no seu ovo e as galinhas choram!
                            </p>
                            {/*<p className="text-lg text-muted-foreground">*/}
                            {/*Teste seus conhecimentos musicais em um quiz multiplayer cheio de diversão*/}
                            {/*</p>*/}
                        </div>

                        {/* MUDE ESTA LINHA - adicione relative z-10 */}
                        <div className="relative z-10 container mx-auto px-4 py-8">
                            <div className="text-center mb-8">
                                <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-sunrise bg-clip-text">
                                    🎉 Você foi convidado!
                                </h1>
                                <p className="text-xl text-muted-foreground">
                                    Galinheiro: <strong className="font-mono">{pendingRoomCode}</strong>
                                </p>
                            </div>

                            {/* ADICIONE AQUI: */}
                            {!isLoadingBattleSettings && battleMode === 'battle' && (
                                <BattleModeInfo battleSettings={battleSettings}/>
                            )}

                            <BarnCard variant="golden" className="max-w-md mx-auto">
                                <div className="text-center">
                                    <h3 className="text-2xl font-bold mb-6 text-white">Configure sua Galinha</h3>

                                    {/* Name Input */}
                                    <div className="mb-6">
                                        <Label htmlFor="player-name"
                                               className="text-white/90">Nome da sua galinha</Label>
                                        <Input
                                            id="player-name"
                                            placeholder="Ex: Galinha Pititica"
                                            value={playerName}
                                            onChange={(e) => setPlayerName(e.target.value)}
                                            className="mt-2 text-center bg-white/10 border-white/20 text-white placeholder:text-white/60"
                                            maxLength={20}
                                        />
                                    </div>

                                    {/* Avatar Selection */}
                                    <div className="mb-6">
                                        <Label className="text-white/90 block mb-4">Escolha seu avatar</Label>
                                        <div className="grid grid-cols-5 gap-2">
                                            {chickenAvatars.map((gifUrl) => (
                                                <img
                                                    key={gifUrl}
                                                    src={gifUrl}
                                                    alt="Avatar"
                                                    className={`w-16 h-16 rounded-full object-cover cursor-pointer transition-all duration-200 ${
                        selectedAvatar === gifUrl
                          ? "transform scale-110 ring-2 ring-white/50"
                          : "hover:scale-105 opacity-70"
                      }`}
                                                    onClick={() => setSelectedAvatar(gifUrl)}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <ChickenButton
                                        onClick={handleJoinRoomWithCode}
                                        disabled={!playerName.trim()}
                                        className="w-full mb-4"
                                        variant="corn"
                                        size="lg"
                                    >
                                        🚪 Entrar no Galinheiro {roomCode}
                                    </ChickenButton>

                                    <div className="text-center">
                                        <ChickenButton
                                            variant="feather"
                                            size="sm"
                                            onClick={() => navigate('/auth')}
                                        >
                                            🐔 Fazer Login/Cadastro
                                        </ChickenButton>
                                    </div>
                                </div>
                            </BarnCard>
                        </div>
                    </div>
                </section>
            </div>
        );
    }

    // PÁGINA NORMAL: Lógica original
    return (
        <div className="min-h-screen bg-gradient-sky">
            {/* Header com UserMenu */}
            <header className="w-full sticky top-0 z-20 bg-background/70 backdrop-blur border-b">
                <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
                    <div className="font-bold text-lg">®️ Cocoli</div>
                    <UserMenu />
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
                {/* Background Hero Image */}
                <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
                    style={{ backgroundImage: `url(${heroImage})` }}
                />

                {/*/!* Animated Background Elements *!/*/}
                {/*<div className="absolute inset-0 pointer-events-none">*/}
                    {/*<div className="absolute top-20 left-10 animate-chicken-walk text-4xl">🐔</div>*/}
                    {/*<div className="absolute top-32 right-20 animate-egg-bounce text-3xl">🥚</div>*/}
                    {/*<div className="absolute bottom-40 left-20 animate-chicken-walk text-3xl"*/}
                         {/*style={{animationDelay: '1s'}}>🐓*/}
                    {/*</div>*/}
                    {/*<div className="absolute top-60 left-1/4 animate-feather-float text-2xl"*/}
                         {/*style={{animationDelay: '2s'}}>🪶*/}
                    {/*</div>*/}
                    {/*<div className="absolute bottom-60 right-1/4 animate-egg-bounce text-2xl"*/}
                         {/*style={{animationDelay: '0.5s'}}>🌽*/}
                    {/*</div>*/}
                {/*</div>*/}

                <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
                    {/* Main Title */}
                    <div className="mb-2 text-center">
                        <img
                            src={heroImagelogo}
                            alt="Galinheiro Musical"
                            className="mx-auto w-40 md:w-40"
                        />
                    </div>
                    <div className="mb-6 animate-barn-door-open">
                        <h1 className="text-3xl md:text-6xl font-bold mb-4 bg-gradient-sunrise bg-clip-text">
                            🎵 Galinheiro Musical
                        </h1>

                        <p className="text-xl md:text-4xl font-medium mb-2">
                            Onde o carro da rua passa no seu ovo e as galinhas choram!
                        </p>
                        {/*<p className="text-lg text-muted-foreground">*/}
                        {/*Teste seus conhecimentos musicais em um quiz multiplayer cheio de diversão*/}
                        {/*</p>*/}
                    </div>

                    {/* ADICIONE AQUI: */}
                    {!isLoadingBattleSettings && battleMode === 'battle' && (
                        <div className="max-w-2xl mx-auto mb-8">
                            <BattleModeInfo battleSettings={battleSettings}/>
                        </div>
                    )}


                    {/* NOVA: Banner de auto-join para usuários não logados */}
                    {showAutoJoinForm && pendingRoomCode && !user && (
                        <BarnCard variant="golden" className="max-w-2xl mx-auto mb-8">
                            <div className="text-center">
                                <h3 className="text-2xl font-bold mb-4 text-white">
                                    🎉 Você foi convidado para uma sala!
                                </h3>
                                <p className="text-white/90 mb-6">
                                    Código: <span className="font-mono font-bold">{pendingRoomCode}</span>
                                </p>
                                <p className="text-white/80 mb-4">
                                    Configure seu perfil abaixo e clique no botão especial para entrar automaticamente:
                                </p>
                            </div>
                        </BarnCard>
                    )}

                    {/* Action Cards - Para usuários logados */}
                    {user && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 max-w-5xl mx-auto">
                            <CreateRoom
                                playerName={user.user_metadata?.display_name || user.email || "Galinha"}
      selectedAvatar="🐔"
      onPlayerNameChange={() => {
                            }}
                                onAvatarChange={() => {
                            }}
                                />

                            <JoinRoom
                                playerName={user.user_metadata?.display_name || user.email || "Galinha"}
      selectedAvatar="🐔"
      onPlayerNameChange={() => {
                            }}
                                onAvatarChange={() => {
                            }}
                                />
                        </div>
                    )}

                    {/* Player Setup - Só para não logados */}
                    {!user && (
                        <BarnCard variant="golden" className="max-w-2xl mx-auto mb-8">
                            <div className="text-center">
                                <h3 className="text-2xl font-bold mb-6">Escolha sua Galinha</h3>

                                {/* Name Input */}
                                <div className="mb-6">
                                    <Label htmlFor="player-name" className="text-white/90">
                                        Nome da sua galinha
                                    </Label>
                                    <Input
                                        id="player-name"
                                        placeholder="Ex: Galinha Pititica"
                                        value={playerName}
                                        onChange={(e) => setPlayerName(e.target.value)}
                                        className="mt-2 text-center bg-white/10 border-white/20 text-white placeholder:text-white/60"
                                        maxLength={20}
                                    />
                                </div>

                                {/* Avatar Selection */}
                                <div className="mb-8">
                                    <Label className="text-white/90 block mb-4">Escolha seu avatar</Label>
                                    <div
                                        className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 justify-center">
                                        {chickenAvatars.map((gifUrl) => (
                                            <img
                                                key={gifUrl}
                                                src={gifUrl}
                                                alt="Avatar"
                                                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover cursor-pointer transition-all duration-200 ${
                selectedAvatar === gifUrl
                  ? "transform scale-125 ring-2 ring-white/50 ring-offset-2"
                  : "hover:scale-110 opacity-70"
              }`}
                                                onClick={() => setSelectedAvatar(gifUrl)}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* NOVO: Botão auto-join */}
                                {showAutoJoinForm && pendingRoomCode && playerName.trim() && (
                                    <div className="mb-6">
                                        <ChickenButton
                                            variant="corn"
                                            size="lg"
                                            onClick={handleAutoJoinRoom}
                                            className="w-full animate-pulse"
                                        >
                                            🚀 Entrar na Sala {pendingRoomCode}
                                        </ChickenButton>
                                        <button
                                            onClick={() => {
              setPendingRoomCode(null);
              setShowAutoJoinForm(false);
            }}
                                            className="text-white/60 hover:text-white/80 text-sm mt-2 underline"
                                        >
                                            Cancelar e usar interface normal
                                        </button>
                                    </div>
                                )}

                                {/* Selected Chicken Preview */}
                                {playerName && selectedAvatar && (
                                    <div className="bg-white/10 rounded-lg p-4 border border-white/20">
                                        <p className="text-white/90 mb-2">Sua galinha:</p>
                                        <div className="flex items-center justify-center gap-4">
                                            <img
                                                src={selectedAvatar}
                                                alt="Avatar selecionado"
                                                className="w-20 h-20 rounded-full object-cover"
                                            />
                                            <div>
                                                <p className="text-xl font-bold text-white">{playerName}</p>
                                                <EggCounter count={0} variant="golden" size="sm"/>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </BarnCard>
                    )}

                    {/* Join Room - Para não logados */}
                    {!user && !showAutoJoinForm && (
                        <div className="max-w-md mx-auto mb-8">
                            <JoinRoom
                                playerName={playerName}
                                selectedAvatar={selectedAvatar}
                                onPlayerNameChange={setPlayerName}
                                onAvatarChange={setSelectedAvatar}
                            />
                        </div>
                    )}

                    {/* Quick Stats */}
                    <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
                        <div className="text-center">
                            <div className="text-3xl mb-2">🐔</div>
                            <div className="font-bold text-2xl text-primary">1,234</div>
                            <div className="text-sm text-muted-foreground">Galinhas Ativas</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl mb-2">🎵</div>
                            <div className="font-bold text-2xl text-accent">5,678</div>
                            <div className="text-sm text-muted-foreground">Músicas no Repertório</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl mb-2">🥚</div>
                            <div className="font-bold text-2xl text-secondary">98,765</div>
                            <div className="text-sm text-muted-foreground">Ovos Coletados</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl mb-2">🏆</div>
                            <div className="font-bold text-2xl text-corn-golden">432</div>
                            <div className="text-sm text-muted-foreground">Galinhas de Ouro</div>
                        </div>
                    </div>

                    {/* Auth Access - Só para não logados (LÓGICA ORIGINAL) */}

                </div>
            </section>
        </div>
    );
};

export default Index;