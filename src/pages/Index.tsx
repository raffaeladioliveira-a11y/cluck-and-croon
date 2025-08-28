import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ChickenButton } from "@/components/ChickenButton";
import { BarnCard } from "@/components/BarnCard";
import { ChickenAvatar } from "@/components/ChickenAvatar";
import { EggCounter } from "@/components/EggCounter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreateRoom } from "@/components/multiplayer/CreateRoom";
import { JoinRoom } from "@/components/multiplayer/JoinRoom";
import { UserMenu } from "@/components/UserMenu";
import { loadProfile, saveProfile, Profile, getDisplayNameOrDefault, getAvatarOrDefault } from "@/utils/clientId";
import heroImage from "@/assets/galinheiro-hero.jpg";

const Index = () => {
  const navigate = useNavigate();
  const { roomCode } = useParams<{ roomCode: string }>();
  const { user, loading } = useAuthSession();
  
  const [playerName, setPlayerName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("🐔");
  const [isRedirectMode, setIsRedirectMode] = useState(false);

  const chickenAvatars = ["🐔", "🐓", "🐣", "🐤", "🐥", "🏵️🐔", "👑🐓", "🌟🐥", "💎🐤", "🎵🐣"];

  // Verifica se chegou via link compartilhado
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

  // Carrega perfil se usuário estiver logado
  useEffect(() => {
    if (user && !roomCode) {
      const profile = loadProfile();
      if (profile.displayName) setPlayerName(profile.displayName);
      if (profile.avatar) setSelectedAvatar(profile.avatar);
    }
  }, [user, roomCode]);

  const handleJoinRoomWithCode = () => {
    if (!playerName.trim()) return;
    
    // Salva perfil
    saveProfile({ displayName: playerName, avatar: selectedAvatar });
    
    if (roomCode) {
      navigate(`/lobby/${roomCode}`);
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

  // Modo redirect para link compartilhado (usuário não logado)
  if (isRedirectMode && !user) {
    return (
      <div className="min-h-screen bg-gradient-sky">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-6xl font-bold mb-4 text-transparent bg-gradient-sunrise bg-clip-text">
              🐔 Entrando no Galinheiro
            </h1>
            <p className="text-xl text-muted-foreground">
              Você foi convidado para o galinheiro <strong>{roomCode}</strong>
            </p>
          </div>

          <BarnCard variant="golden" className="max-w-md mx-auto">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-6 text-white">Configure sua Galinha</h3>
              
              {/* Name Input */}
              <div className="mb-6">
                <Label htmlFor="player-name" className="text-white/90">Nome da sua galinha</Label>
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
                  {chickenAvatars.map((emoji) => (
                    <ChickenAvatar
                      key={emoji}
                      emoji={emoji}
                      size="md"
                      animated
                      className={`cursor-pointer transition-all duration-200 ${
                        selectedAvatar === emoji 
                          ? 'transform scale-110 ring-2 ring-white/50' 
                          : 'hover:scale-105 opacity-70'
                      }`}
                      onClick={() => setSelectedAvatar(emoji)}
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
    );
  }

  return (
    <div className="min-h-screen bg-gradient-sky">
      {/* Header com UserMenu */}
      <header className="w-full sticky top-0 z-20 bg-background/70 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="font-bold text-lg">🐔 Cluck & Croon</div>
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
        
        {/* Animated Background Elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-10 animate-chicken-walk text-4xl">🐔</div>
          <div className="absolute top-32 right-20 animate-egg-bounce text-3xl">🥚</div>
          <div className="absolute bottom-40 left-20 animate-chicken-walk text-3xl" style={{animationDelay: '1s'}}>🐓</div>
          <div className="absolute top-60 left-1/4 animate-feather-float text-2xl" style={{animationDelay: '2s'}}>🪶</div>
          <div className="absolute bottom-60 right-1/4 animate-egg-bounce text-2xl" style={{animationDelay: '0.5s'}}>🌽</div>
        </div>

        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          {/* Main Title */}
          <div className="mb-8 animate-barn-door-open">
            <h1 className="text-6xl md:text-8xl font-bold mb-4 text-transparent bg-gradient-sunrise bg-clip-text">
              🐔 Galinheiro Musical 🎵
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground font-medium mb-2">
              Onde as galinhas mais musicais se encontram!
            </p>
            <p className="text-lg text-muted-foreground">
              Teste seus conhecimentos musicais em um quiz multiplayer cheio de diversão
            </p>
          </div>

          {/* Action Cards - Para usuários logados */}
          {user && (
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Create Room Card - Só aparece para logados */}
              <CreateRoom 
                playerName={user.user_metadata?.display_name || user.email || "Galinha"}
                selectedAvatar="🐔"
                onPlayerNameChange={() => {}}
                onAvatarChange={() => {}}
              />

              {/* Join Room Card */}
              <JoinRoom 
                playerName={user.user_metadata?.display_name || user.email || "Galinha"}
                selectedAvatar="🐔"
                onPlayerNameChange={() => {}}
                onAvatarChange={() => {}}
              />
            </div>
          )}

          {/* Join Room - Para usuários NÃO logados */}
          {!user && (
            <div className="max-w-md mx-auto mb-8">
              <JoinRoom 
                playerName={playerName}
                selectedAvatar={selectedAvatar}
                onPlayerNameChange={setPlayerName}
                onAvatarChange={setSelectedAvatar}
              />
            </div>
          )}

          {/* Player Setup - Só para não logados */}
          {!user && (
            <BarnCard variant="golden" className="max-w-2xl mx-auto">
              <div className="text-center">
                <h3 className="text-2xl font-bold mb-6">Escolha sua Galinha</h3>
                
                {/* Name Input */}
                <div className="mb-6">
                  <Label htmlFor="player-name" className="text-white/90">Nome da sua galinha</Label>
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
                  <div className="grid grid-cols-5 md:grid-cols-10 gap-2 justify-center">
                    {chickenAvatars.map((emoji) => (
                      <ChickenAvatar
                        key={emoji}
                        emoji={emoji}
                        size="lg"
                        animated
                        className={`cursor-pointer transition-all duration-200 ${
                          selectedAvatar === emoji 
                            ? 'transform scale-125 ring-2 ring-white/50 ring-offset-2 ring-offset-transparent' 
                            : 'hover:scale-110 opacity-70'
                        }`}
                        onClick={() => setSelectedAvatar(emoji)}
                      />
                    ))}
                  </div>
                </div>

                {/* Selected Chicken Preview */}
                {playerName && selectedAvatar && (
                  <div className="bg-white/10 rounded-lg p-4 border border-white/20">
                    <p className="text-white/90 mb-2">Sua galinha:</p>
                    <div className="flex items-center justify-center gap-4">
                      <ChickenAvatar emoji={selectedAvatar} size="xl" animated />
                      <div>
                        <p className="text-xl font-bold text-white">{playerName}</p>
                        <EggCounter count={0} variant="golden" size="sm" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </BarnCard>
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

          {/* Auth Access - Só para não logados */}
          {!user && (
            <div className="mt-8 text-center">
              <ChickenButton 
                variant="feather" 
                size="md"
                onClick={() => navigate('/auth')}
                className="opacity-90 hover:opacity-100"
              >
                🐔 Entrar/Cadastrar
              </ChickenButton>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Index;
