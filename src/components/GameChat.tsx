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
    onUnreadChange?: (count: number) => void;
    className?: string;
}

export function GameChat({ roomCode, sessionId, isVisible = false, onToggle, onUnreadChange, className = "" }: GameChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [roomId, setRoomId] = useState<string | null>(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isBlinking, setIsBlinking] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const clientId = useRef(getOrCreateClientId());
    const profile = useRef(loadProfile());
    const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    const { user } = useAuthSession();
    const { toast } = useToast();

    // Scroll para a última mensagem
    const scrollToBottom = () => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
    };

    // Carregar room_id e mensagens iniciais
    useEffect(() => {
        const loadChatData = async () => {
            try {
                const { data: room } = await supabase
                    .from('game_rooms')
                    .select('id')
                    .eq('room_code', roomCode)
                    .single();

                if (room) {
                    setRoomId(room.id);

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

            // Se não é a sua mensagem e o chat está fechado ou minimizado
            if (message.client_id !== clientId.current && (isMinimized || !isVisible)) {
                setUnreadCount(prev => {
                    const newCount = prev + 1;
                    onUnreadChange?.(newCount);
                    return newCount;
                });

                setIsBlinking(true);
                setTimeout(() => setIsBlinking(false), 3000);
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
    }, [sessionId, roomId, isMinimized, isVisible, onUnreadChange]);

    const sendMessage = async () => {
        if (!newMessage.trim() || !roomId || isLoading) return;

        setIsLoading(true);

        try {
            const { data: participant } = await supabase
                .from('room_participants')
                .select('display_name, avatar')
                .eq('room_id', roomId)
                .eq('client_id', clientId.current)
                .maybeSingle();

            let playerName = 'Jogador Anônimo';
            let playerAvatar = '🐔';

            if (participant?.display_name) {
                playerName = participant.display_name;
                playerAvatar = participant.avatar || '🐔';
            } else {
                playerName = user?.user_metadata?.display_name || profile.current?.name || 'Jogador Anônimo';
                playerAvatar = user?.user_metadata?.avatar_url || profile.current?.avatar || '🐔';
            }

            const messageData = {
                room_id: roomId,
                client_id: clientId.current,
                player_name: playerName,
                player_avatar: playerAvatar,
                message: newMessage.trim(),
                timestamp: new Date().toISOString()
            };

            const { data: savedMessage, error } = await supabase
                .from('chat_messages')
                .insert(messageData)
                .select()
                .single();

            if (error) throw error;

            if (chatChannelRef.current) {
                await chatChannelRef.current.send({
                    type: 'broadcast',
                    event: 'NEW_MESSAGE',
                    payload: { message: savedMessage }
                });
            }

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

    const handleMinimizeToggle = () => {
        const newMinimized = !isMinimized;
        setIsMinimized(newMinimized);
        if (!newMinimized) {
            setUnreadCount(0);
            onUnreadChange?.(0);
        }
    };

    const handleClose = () => {
        setUnreadCount(0);
        onUnreadChange?.(0);
        onToggle?.();
    };

    if (!isVisible) return null;

    return (
        <div className={`fixed bottom-4 right-4 w-80 max-w-[90vw] z-50 ${className} ${isBlinking ? 'animate-pulse' : ''}`}>
            {/* Chat container com altura fixa e fundo transparente */}
            <div className="bg-black/20 backdrop-blur-md rounded-lg shadow-2xl border border-white/20 overflow-hidden" style={{ height: '400px' }}>

                {/* Header com fundo transparente */}
                <div className="bg-black/30 backdrop-blur-sm text-white p-3 flex items-center justify-between border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        <h3 className="font-bold text-sm">Chat da Sala</h3>
                        {unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center animate-bounce">
                                {unreadCount}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleMinimizeToggle}
                            className="p-1 hover:bg-white/20 rounded transition-colors"
                        >
                            {isMinimized ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                        {onToggle && (
                            <button
                                onClick={handleClose}
                                className="p-1 hover:bg-white/20 rounded transition-colors"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                </div>

                {!isMinimized && (
                    <>
                    {/* Messages area - altura fixa com scroll e fundo transparente */}
                    <div
                        ref={messagesContainerRef}
                        className="bg-black/10 backdrop-blur-sm p-3 overflow-y-auto"
                        style={{ height: '280px' }}
                    >
                        {messages.length === 0 ? (
                            <div className="text-center text-white/70 text-sm py-8">
                                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>Nenhuma mensagem ainda...</p>
                                <p className="text-xs">Seja o primeiro a falar!</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {messages.map((message) => {
                                    const isOwnMessage = message.client_id === clientId.current;
                                    return (
                                        <div
                                            key={message.id}
                                            className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[80%] rounded-lg p-2 ${
                                                        isOwnMessage
                                                            ? 'bg-primary/90 backdrop-blur-sm text-white'
                                                            : 'bg-white/20 backdrop-blur-sm text-white shadow-sm border border-white/10'
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
                                                <p className={`text-xs mt-1 opacity-70`}>
                                                    {formatTime(message.timestamp)}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    {/* Input area - altura fixa com fundo transparente */}
                    <div className="bg-black/20 backdrop-blur-sm border-t border-white/10 p-3" style={{ height: '72px' }}>
                        <div className="flex gap-2 mb-1">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Digite sua mensagem..."
                                className="flex-1 px-3 py-1 text-sm bg-white/10 backdrop-blur-sm border border-white/20 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-white/60"
                                maxLength={200}
                                disabled={isLoading}
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!newMessage.trim() || isLoading}
                                className="px-3 py-1 bg-primary/90 backdrop-blur-sm text-white rounded-md disabled:opacity-50 hover:bg-primary transition-colors"
                            >
                                <Send className="h-4 w-4" />
                            </button>
                        </div>
                        <p className="text-xs text-white/60">
                            {newMessage.length}/200
                        </p>
                    </div>
                    </>
                )}
            </div>
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
            className={`fixed bottom-4 right-4 z-40 rounded-full h-12 w-12 p-0 shadow-lg ${unreadCount > 0 ? 'animate-pulse' : ''} ${className}`}
        >
            <div className="relative">
                <MessageCircle className="h-6 w-6" />
                {unreadCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center animate-bounce">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </div>
        </ChickenButton>
    );
}