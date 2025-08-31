import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthSession } from '@/hooks/useAuthSession';
import { loadProfile } from '@/utils/clientId';

interface LobbyRedirectGuardProps {
    children: React.ReactNode;
}

/**
 * Componente que intercepta acesso ao /lobby/CODIGO
 * Se o usuário não está logado E não tem perfil recém-configurado, redireciona para home
 * Se está logado OU tem perfil recém-configurado, deixa entrar na sala
 */
export function LobbyRedirectGuard({ children }: LobbyRedirectGuardProps) {
    const navigate = useNavigate();
    const params = useParams();
    const roomCode = params.roomCode;
    const { user, loading } = useAuthSession();

    useEffect(() => {
        // Aguarda carregar o status de autenticação
        if (loading) return;

        // Se o usuário NÃO está logado, sempre redireciona para home primeiro
        // Isso força que usuários não logados sempre passem pela configuração
        if (!user && roomCode && /^[A-Z0-9]{6}$/.test(roomCode)) {
            // Verifica se acabou de vir da home (flag temporária)
            const justConfigured = sessionStorage.getItem('justConfiguredProfile');

            if (justConfigured) {
                console.log('👤 Usuário configurou perfil na home, permitindo acesso...');
                // Remove a flag após usar
                sessionStorage.removeItem('justConfiguredProfile');
            } else {
                console.log('🔐 Usuário não logado sem configuração recente, redirecionando para home...');
                console.log('🔗 Código da sala:', roomCode);

                // Salva o código no sessionStorage para a home detectar
                sessionStorage.setItem('pendingRoomCode', roomCode.toUpperCase());

                // Redireciona para home
                navigate('/', { replace: true });
                return;
            }
        }

        // Se está logado, deixa entrar normalmente na sala
        if (user) {
            console.log('✅ Usuário logado, entrando na sala:', roomCode);
        }
    }, [navigate, roomCode, user, loading]);

    // Se ainda está carregando, mostra loading
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-sky flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl mb-4 animate-chicken-walk">🐔</div>
                    <p className="text-lg text-muted-foreground">Verificando acesso...</p>
                </div>
            </div>
        );
    }

    // Se chegou até aqui e está logado, renderiza o lobby normalmente
    return <>{children}</>;
}