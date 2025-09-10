import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarnCard } from "@/components/BarnCard";
import { ChickenButton } from "@/components/ChickenButton";
import { useToast } from "@/hooks/use-toast";
import { getOrCreateClientId, loadProfile } from "@/utils/clientId";
import { useAuthSession } from "@/hooks/useAuthSession";
import { Send, MessageCircle, X, ChevronDown, ChevronUp } from "lucide-react";

interface ChatMessage {
    id: string;
    room_id: string;
    client_id: string;
    player_name: string;
    player_avatar: string;
    message: string;
    timestamp: string;
    created_at: string;
}

interface GameChatProps {
    roomCode: string;
    sessionId: string;
    isVisible?: boolean;
    onToggle?: () => void;
    className?: string;
}

export function GameChat({ roomCode, sessionId, isVisible = false, onToggle, className = "" }: GameChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [roomId, setRoomId] = useState<string | null>(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const clientId = useRef(getOrCreateClientId());
    const profile = useRef(loadProfile());
    const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    const { user } = useAuthSession();
    const { toast } = useToast();

    // Scroll para a última mensagem
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Carregar room_id e mensagens iniciais
    useEffect(() => {
        const loadChatData = async () => {
            try {
                // Buscar room_id
                const { data: room } = await supabase
                    .from('game_rooms')
                    .select('id')
                    .eq('room_code', roomCode)
                    .single();

                if (room) {
                    setRoomId(room.id);

                    // Carregar mensagens existentes
                    const { data: chatMessages } = await supabase
                        .from('chat_messages')
                        .select('*')
                        .eq('room_id', room.id)
                        .order('created_at', { ascending: true })
                        .limit(50);

                    if (chatMessages) {
                        setMessages(chatMessages);
                        setTimeout(scrollToBottom, 100);
                    }
                }
            } catch (error) {
                console.error('Erro ao carregar chat:', error);
            }
        };

        if (roomCode) {
            loadChatData();
        }
    }, [roomCode]);

    // Configurar canal realtime para chat
    useEffect(() => {
        if (!sessionId || !roomId) return;

        const channel = supabase.channel(`chat:${sessionId}`, {
            config: { broadcast: { ack: true } }
        });

        // Listener para novas mensagens
        channel.on('broadcast', { event: 'NEW_MESSAGE' }, (msg) => {
            const { message } = msg.payload;
            setMessages(prev => [...prev, message]);

            // Se não é a sua mensagem e o chat está minimizado, incrementar contador
            if (message.client_id !== clientId.current && (isMinimized || !isVisible)) {
                setUnreadCount(prev => prev + 1);
            }

            setTimeout(scrollToBottom, 100);
        });

        channel.subscribe((status) => {
            console.log('[realtime] chat channel status:', status);
        });

        chatChannelRef.current = channel;

        return () => {
            if (chatChannelRef.current) {
                supabase.removeChannel(chatChannelRef.current);
            }
        };
    }, [sessionId, roomId, isMinimized, isVisible]);

    // Reset do contador quando abrir o chat
    useEffect(() => {
        if (isVisible && !isMinimized) {
            setUnreadCount(0);
        }
    }, [isVisible, isMinimized]);

    const sendMessage = async () => {
        if (!newMessage.trim() || !roomId || isLoading) return;

        setIsLoading(true);

        try {
            // Buscar dados do participante na sala (fonte principal)
            const { data: participant } = await supabase
                .from('room_participants')
                .select('display_name, avatar')
                .eq('room_id', roomId)
                .eq('client_id', clientId.current)
                .maybeSingle();

            console.log('=== DEBUG CHAT ===');
            console.log('roomId:', roomId);
            console.log('clientId:', clientId.current);
            console.log('participant encontrado:', participant);

            let playerName = 'Jogador Anônimo';
            let playerAvatar = '🐔';

            if (participant?.display_name) {
                playerName = participant.display_name;
                playerAvatar = participant.avatar || '🐔';
                console.log('Usando dados da sala:', { playerName, playerAvatar });
            } else {
                console.log('Participante não encontrado ou sem display_name');
                // Fallback apenas se não encontrar na sala
                playerName = user?.user_metadata?.display_name || profile.current?.name || 'Jogador Anônimo';
                playerAvatar = user?.user_metadata?.avatar_url || profile.current?.avatar || '🐔';
            }

            // Criar mensagem
            const messageData = {
                room_id: roomId,
                client_id: clientId.current,
                player_name: playerName,
                player_avatar: playerAvatar,
                message: newMessage.trim(),
                timestamp: new Date().toISOString()
            };

            // Salvar no banco
            const { data: savedMessage, error } = await supabase
                .from('chat_messages')
                .insert(messageData)
                .select()
                .single();

            if (error) throw error;

            // Broadcast para outros jogadores
            if (chatChannelRef.current) {
                await chatChannelRef.current.send({
                    type: 'broadcast',
                    event: 'NEW_MESSAGE',
                    payload: { message: savedMessage }
                });
            }

            // Adicionar à lista local
            setMessages(prev => [...prev, savedMessage]);
            setNewMessage("");
            setTimeout(scrollToBottom, 100);

        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            toast({
                title: 'Erro',
                description: 'Não foi possível enviar a mensagem.',
                variant: 'destructive'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const formatTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const isImageUrl = (url: string): boolean => {
        return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');
    };

    if (!isVisible) return null;

    return (
        <div className={`fixed bottom-4 right-4 w-80 max-w-[90vw] z-50 ${className}`}>
            <BarnCard variant="coop" className="flex flex-col h-96 max-h-[70vh]">
                {/* Header do chat */}
                <div className="flex items-center justify-between p-3 border-b border-muted">
                    <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        <h3 className="font-bold text-sm">Chat da Sala</h3>
                        {unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                {unreadCount}
              </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <ChickenButton
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsMinimized(!isMinimized)}
                            className="h-6 w-6 p-0"
                        >
                            {isMinimized ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </ChickenButton>
                        {onToggle && (
                            <ChickenButton
                                variant="ghost"
                                size="sm"
                                onClick={onToggle}
                                className="h-6 w-6 p-0"
                            >
                                <X className="h-3 w-3" />
                            </ChickenButton>
                        )}
                    </div>
                </div>

                {!isMinimized && (
                    <>
                    {/* Mensagens */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                        {messages.length === 0 ? (
                            <div className="text-center text-muted-foreground text-sm py-8">
                                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>Nenhuma mensagem ainda...</p>
                                <p className="text-xs">Seja o primeiro a falar!</p>
                            </div>
                        ) : (
                            messages.map((message) => {
                                const isOwnMessage = message.client_id === clientId.current;
                                return (
                                    <div
                                        key={message.id}
                                        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[80%] rounded-lg p-2 ${
                          isOwnMessage
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                                        >
                                            {!isOwnMessage && (
                                                <div className="flex items-center gap-2 mb-1">
                                                    {isImageUrl(message.player_avatar) ? (
                                                        <img
                                                            src={message.player_avatar}
                                                            alt={message.player_name}
                                                            className="w-4 h-4 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <span className="text-xs">{message.player_avatar}</span>
                                                    )}
                                                    <span className="text-xs font-medium opacity-80">
                              {message.player_name}
                            </span>
                                                </div>
                                            )}
                                            <p className="text-sm break-words">{message.message}</p>
                                            <p className={`text-xs mt-1 ${isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                                {formatTime(message.timestamp)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input de mensagem */}
                    <div className="p-3 border-t border-muted">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Digite sua mensagem..."
                                className="flex-1 px-3 py-2 text-sm border border-muted rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                maxLength={200}
                                disabled={isLoading}
                            />
                            <ChickenButton
                                onClick={sendMessage}
                                disabled={!newMessage.trim() || isLoading}
                                size="sm"
                                className="px-3"
                            >
                                <Send className="h-4 w-4" />
                            </ChickenButton>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {newMessage.length}/200 caracteres
                        </p>
                    </div>
                    </>
                )}
            </BarnCard>
        </div>
    );
}

// Botão para toggle do chat
interface ChatToggleButtonProps {
    onClick: () => void;
    unreadCount?: number;
    className?: string;
}

export function ChatToggleButton({ onClick, unreadCount = 0, className = "" }: ChatToggleButtonProps) {
    return (
        <ChickenButton
            onClick={onClick}
            variant="default"
            size="lg"
            className={`fixed bottom-4 right-4 z-40 rounded-full h-12 w-12 p-0 shadow-lg ${className}`}
        >
            <div className="relative">
                <MessageCircle className="h-6 w-6" />
                {unreadCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
                )}
            </div>
        </ChickenButton>
    );
}