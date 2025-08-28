import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChickenButton } from "@/components/ChickenButton";
import { BarnCard } from "@/components/BarnCard";
import { ChickenAvatar } from "@/components/ChickenAvatar";
import { EggCounter } from "@/components/EggCounter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreateRoom } from "@/components/multiplayer/CreateRoom";
import { JoinRoom } from "@/components/multiplayer/JoinRoom";
import heroImage from "@/assets/galinheiro-hero.jpg";

export default function Home() {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("🐔");

  // const chickenAvatars = ["🐔", "🐓", "🐣", "🐤", "🐥", "🏵️🐔", "👑🐓", "🌟🐥", "💎🐤", "🎵🐣"];

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
    ];

  return (
    <div className="min-h-screen bg-gradient-sky">
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

          {/* Action Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Create Room Card */}
            <CreateRoom
              playerName={playerName}
              selectedAvatar={selectedAvatar}
              onPlayerNameChange={setPlayerName}
              onAvatarChange={setSelectedAvatar}
            />

            {/* Join Room Card */}
            <JoinRoom
              playerName={playerName}
              selectedAvatar={selectedAvatar}
              onPlayerNameChange={setPlayerName}
              onAvatarChange={setSelectedAvatar}
            />
          </div>

          {/* Player Setup */}
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

          {/* Auth Access */}
          <div className="mt-8 text-center space-y-2">
            <div>
              <ChickenButton
                variant="feather"
                size="md"
                onClick={() => navigate('/auth')}
                className="opacity-90 hover:opacity-100"
              >
                🐔 Entrar/Cadastrar
              </ChickenButton>
            </div>
            <div>
              <ChickenButton
                variant="barn"
                size="sm"
                onClick={() => navigate('/admin')}
                className="opacity-75 hover:opacity-100"
              >
                🚜 Acesso Administrativo
              </ChickenButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}