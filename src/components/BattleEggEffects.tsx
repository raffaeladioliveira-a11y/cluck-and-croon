/**
 * Created by rafaela on 17/09/25.
 */
// BattleEggEffects.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EggTransferEvent, PlayerEggChange, PlayerFace } from './useGameLogic';

interface EggParticleProps {
    id: string;
    fromPlayerId: string;
    toPlayerId: string;
    onComplete: (id: string) => void;
    delay?: number;
}

const EggParticle: React.FC<EggParticleProps> = ({
    id,
    fromPlayerId,
    toPlayerId,
    onComplete,
    delay = 0
}) => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        const fromElement = document.querySelector(`[data-player-id="${fromPlayerId}"]`) as HTMLElement;
        const toElement = document.querySelector(`[data-player-id="${toPlayerId}"]`) as HTMLElement;

        if (!fromElement || !toElement) {
            onComplete(id);
            return;
        }

        const fromRect = fromElement.getBoundingClientRect();
        const toRect = toElement.getBoundingClientRect();

        const startX = fromRect.left + fromRect.width / 2;
        const startY = fromRect.top + fromRect.height / 2;
        const endX = toRect.left + toRect.width / 2;
        const endY = toRect.top + toRect.height / 2;

        // Posição inicial
        setPosition({ x: startX, y: startY });

        // Delay antes de começar animação
        const startTimer = setTimeout(() => {
            setIsAnimating(true);
            setPosition({ x: endX, y: endY });

            // Completar após animação
            const completeTimer = setTimeout(() => {
                onComplete(id);
            }, 1000); // Duração da animação

            return () => clearTimeout(completeTimer);
        }, delay);

        return () => clearTimeout(startTimer);
    }, [fromPlayerId, toPlayerId, id, onComplete, delay]);

    return (
        <div
            className={`fixed pointer-events-none z-[9999] transition-all duration-1000 ease-out ${
    isAnimating ? 'opacity-0 scale-50' : 'opacity-100 scale-100'
  }`}
            style={{
        left: position.x - 12,
        top: position.y - 12,
        transform: `${isAnimating ? 'rotate(720deg)' : 'rotate(0deg)'}`,
      }}
        >
            <div className="w-6 h-6 text-2xl animate-bounce" style={{ animationDuration: '0.5s' }}>
                🥚
            </div>
        </div>
    );
};

interface EggChangeIndicatorProps {
    change: number;
    playerId: string;
    timestamp: number;
}

const EggChangeIndicator: React.FC<EggChangeIndicatorProps> = ({ change, playerId, timestamp }) => {
    const [visible, setVisible] = useState(true);
    const [animationPhase, setAnimationPhase] = useState<'entering' | 'stable' | 'exiting'>('entering');

    useEffect(() => {
        // Fase de entrada
        const enterTimer = setTimeout(() => setAnimationPhase('stable'), 100);

        // Fase estável
        const stableTimer = setTimeout(() => setAnimationPhase('exiting'), 1500);

        // Remover
        const exitTimer = setTimeout(() => setVisible(false), 2000);

        return () => {
            clearTimeout(enterTimer);
            clearTimeout(stableTimer);
            clearTimeout(exitTimer);
        };
    }, []);

    if (!visible) return null;

    const getPositionClasses = () => {
        switch (animationPhase) {
            case 'entering':
                return 'transform -translate-y-1 opacity-0 scale-75';
            case 'stable':
                return 'transform -translate-y-2 opacity-100 scale-100';
            case 'exiting':
                return 'transform -translate-y-3 opacity-0 scale-125';
            default:
                return '';
        }
    };

    const getColorClasses = () => {
        if (change > 0) {
            return 'text-green-400 bg-green-900/80 border-green-400';
        } else {
            return 'text-red-400 bg-red-900/80 border-red-400';
        }
    };

    return (
        <div className={`
     absolute -top-9 left-1/2 transform -translate-x-1/2 z-[9999]
  transition-all duration-500 ease-out pointer-events-none
  px-2 py-1 rounded-full border text-sm font-bold shadow-lg backdrop-blur-sm
      ${getPositionClasses()} ${getColorClasses()}
    `}>
            <div className="flex items-center space-x-1">
                <span>{change > 0 ? '+' : ''}{change}</span>
                <span>🥚</span>
            </div>
        </div>
    );
};

interface BattleEggEffectsProps {
    eggTransferEvents: EggTransferEvent[];
    playerEggChanges: PlayerEggChange[];
    showEggEffects: boolean;
    players: PlayerFace[];
    className?: string;
}

export const BattleEggEffects: React.FC<BattleEggEffectsProps> = ({
    eggTransferEvents,
    playerEggChanges,
    showEggEffects,
    players,
    className = ''
}) => {
    const [activeParticles, setActiveParticles] = useState<string[]>([]);
    const particleCounter = useRef(0);

    // Gerar partículas baseadas nos eventos de transferência
    const generateParticles = useCallback((event: EggTransferEvent) => {
        if (!showEggEffects) return [];

        const particles: string[] = [];
        const maxParticlesPerTransfer = 3; // Limite para performance

        event.losers.forEach((loser, loserIndex) => {
            const particlesForThisLoser = Math.min(event.eggsPerTransfer, maxParticlesPerTransfer);

            for (let i = 0; i < particlesForThisLoser; i++) {
                const winnerIndex = (i + loserIndex) % event.winners.length;
                const winner = event.winners[winnerIndex];

                const particleId = `${event.id}-${loser.id}-${winner.id}-${particleCounter.current++}`;
                particles.push(particleId);
            }
        });

        return particles;
    }, [showEggEffects]);

    // Processar novos eventos de transferência
    useEffect(() => {
        if (eggTransferEvents.length === 0) return;

        const latestEvent = eggTransferEvents[eggTransferEvents.length - 1];
        const newParticles = generateParticles(latestEvent);

        if (newParticles.length > 0) {
            setActiveParticles(prev => [...prev, ...newParticles]);
        }
    }, [eggTransferEvents, generateParticles]);

    // Handler para completar partícula
    const handleParticleComplete = useCallback((particleId: string) => {
        setActiveParticles(prev => prev.filter(id => id !== particleId));
    }, []);

    // Renderizar partículas baseadas nos eventos
    const renderParticles = () => {
        if (!showEggEffects || eggTransferEvents.length === 0) return null;

        const particles: JSX.Element[] = [];

        eggTransferEvents.forEach((event, eventIndex) => {
            event.losers.forEach((loser, loserIndex) => {
                const particlesForThisLoser = Math.min(event.eggsPerTransfer, 3);

                for (let i = 0; i < particlesForThisLoser; i++) {
                    const winnerIndex = (i + loserIndex) % event.winners.length;
                    const winner = event.winners[winnerIndex];

                    const particleId = `${event.id}-${loser.id}-${winner.id}-${i}`;

                    if (activeParticles.includes(particleId)) {
                        particles.push(
                            <EggParticle
                                key={particleId}
                                id={particleId}
                                fromPlayerId={loser.id}
                                toPlayerId={winner.id}
                                onComplete={handleParticleComplete}
                                delay={eventIndex * 200 + loserIndex * 100 + i * 50}
                            />
                        );
                    }
                }
            });
        });

        return particles;
    };

    // Renderizar indicadores de mudança
    const renderChangeIndicators = () => {
        if (!showEggEffects) return null;

        return playerEggChanges.map((change, index) => {
            const playerElement = document.querySelector(`[data-player-id="${change.playerId}"]`);
            if (!playerElement) return null;

            const rect = playerElement.getBoundingClientRect();

            return (
                <div
                    key={`${change.playerId}-${change.timestamp}-${index}`}
                    className="fixed pointer-events-none z-40"
                    style={{
            left: rect.left + rect.width / 2,
            top: rect.top,
            transform: 'translateX(-50%)'
          }}
                >
                    <EggChangeIndicator
                        change={change.change}
                        playerId={change.playerId}
                        timestamp={change.timestamp}
                    />
                </div>
            );
        });
    };

    if (!showEggEffects) return null;

    return (
        <div className={`fixed inset-0 pointer-events-none z-30 ${className}`}>
            {/* Partículas voando */}
            {renderParticles()}

            {/* Indicadores de mudança */}
            {renderChangeIndicators()}
        </div>
    );
};

// Hook personalizado para usar com o sistema
export const useBattleEffects = () => {
    const [effectsEnabled, setEffectsEnabled] = useState(true);
    const [particleCount, setParticleCount] = useState(0);

    const toggleEffects = useCallback(() => {
        setEffectsEnabled(prev => !prev);
    }, []);

    const updateParticleCount = useCallback((count: number) => {
        setParticleCount(count);
    }, []);

    return {
        effectsEnabled,
        toggleEffects,
        particleCount,
        updateParticleCount
    };
};

export default BattleEggEffects;