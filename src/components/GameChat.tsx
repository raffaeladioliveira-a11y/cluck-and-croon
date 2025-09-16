import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarnCard } from "@/components/BarnCard";
import { ChickenButton } from "@/components/ChickenButton";
import { useToast } from "@/hooks/use-toast";
import { getOrCreateClientId, loadProfile } from "@/utils/clientId";
import { useAuthSession } from "@/hooks/useAuthSession";
import { Send, MessageCircle, X, ChevronDown, ChevronUp, Reply, Smile } from "lucide-react";

interface ChatMessage {
    id: string;
    room_id: string;
    client_id: string;
    player_name: string;
    player_avatar: string;
    message: string;
    timestamp: string;
    created_at: string;
    reply_to_id?: string;
    reply_to_message?: string;
    reply_to_player?: string;
    reactions?: { [emoji: string]: string[] }; // emoji -> array de client_ids
}

interface GameChatProps {
    roomCode: string;
    sessionId: string;
    isVisible?: boolean;
    onToggle?: () => void;
    onUnreadChange?: (count: number) => void;
    className?: string;
}

// Emojis disponíveis para reação
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

export function GameChat({ roomCode, sessionId, isVisible = false, onToggle, onUnreadChange, className = "" }: GameChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [roomId, setRoomId] = useState<string | null>(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isBlinking, setIsBlinking] = useState(false);
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const clientId = useRef(getOrCreateClientId());
    const profile = useRef(loadProfile());
    const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    const { user } = useAuthSession();
    const { toast } = useToast();

    const scrollToBottom = () => {
        if (messagesContainerRef.current) {
            setTimeout(() => {
                messagesContainerRef.current!.scrollTop = messagesContainerRef.current!.scrollHeight;
            }, 100);
        }
    };

    // 🔧 NOVO: Effect para rolar para baixo quando o chat for aberto
    useEffect(() => {
        if (isVisible && !isMinimized && messages.length > 0) {
            scrollToBottom();
        }
    }, [isVisible, isMinimized, messages.length]);

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
                        .limit(100); // Aumentamos o limite para 100 mensagens

                    if (chatMessages) {
                        setMessages(chatMessages);
                        setTimeout(scrollToBottom, 200);
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

    useEffect(() => {
        if (!roomCode || !roomId) return;

        const channel = supabase.channel(`chat:${roomCode}`, {
            config: { broadcast: { ack: true } }
        });

        channel.on('broadcast', { event: 'NEW_MESSAGE' }, (msg) => {
            const { message } = msg.payload;
            setMessages(prev => {
                // Evitar duplicatas
                if (prev.find(m => m.id === message.id)) return prev;
                return [...prev, message];
            });

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

        // 🔧 ADICIONAR: Backup com PostgreSQL changes
        channel.on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `room_id=eq.${roomId}`
        }, (payload) => {
            const newMessage = payload.new as ChatMessage;
            setMessages(prev => {
                // Evitar duplicatas
                if (prev.find(m => m.id === newMessage.id)) return prev;
                return [...prev, newMessage];
            });

            if (newMessage.client_id !== clientId.current && (isMinimized || !isVisible)) {
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

        // 🔧 NOVO: Listener para reações
        channel.on('broadcast', { event: 'MESSAGE_REACTION' }, (msg) => {
            const { messageId, emoji, clientId: reactorId, action } = msg.payload;

            setMessages(prev => prev.map(message => {
                if (message.id === messageId) {
                    const reactions = { ...(message.reactions || {}) };

                    if (action === 'add') {
                        if (!reactions[emoji]) reactions[emoji] = [];
                        if (!reactions[emoji].includes(reactorId)) {
                            reactions[emoji].push(reactorId);
                        }
                    } else if (action === 'remove') {
                        if (reactions[emoji]) {
                            reactions[emoji] = reactions[emoji].filter(id => id !== reactorId);
                            if (reactions[emoji].length === 0) {
                                delete reactions[emoji];
                            }
                        }
                    }

                    return { ...message, reactions };
                }
                return message;
            }));
        });

        channel.subscribe();
        chatChannelRef.current = channel;

        return () => {
            if (chatChannelRef.current) {
                supabase.removeChannel(chatChannelRef.current);
            }
        };
    }, [roomCode, roomId, isMinimized, isVisible, onUnreadChange]);

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
                        timestamp: new Date().toISOString(),
                        reply_to_id: replyingTo?.id || null,
                reply_to_message: replyingTo?.message || null,
                reply_to_player: replyingTo?.player_name || null,
                reactions: {}
        };

            const { data: savedMessage, error } = await supabase
                .from('chat_messages')
                .insert(messageData)
                .select()
                .single();

            if (error) throw error;

            if (chatChannelRef.current) {
                try {
                    await chatChannelRef.current.send({
                        type: 'broadcast',
                        event: 'NEW_MESSAGE',
                        payload: { message: savedMessage }
                    });
                    console.log('📤 Mensagem enviada via broadcast');
                } catch (broadcastError) {
                    console.error('Erro no broadcast:', broadcastError);
                }
            }

            // A mensagem será adicionada via PostgreSQL changes listener, não precisa adicionar aqui
            setNewMessage("");
            setReplyingTo(null);
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

    // 🔧 NOVO: Função para adicionar/remover reação
    const toggleReaction = async (messageId: string, emoji: string) => {
        const message = messages.find(m => m.id === messageId);
        if (!message || !chatChannelRef.current) return;

        const currentReactions = message.reactions || {};
        const hasReacted = currentReactions[emoji]?.includes(clientId.current);
        const action = hasReacted ? 'remove' : 'add';

        await chatChannelRef.current.send({
            type: 'broadcast',
            event: 'MESSAGE_REACTION',
            payload: {
                messageId,
                emoji,
                clientId: clientId.current,
                action
            }
        });

        setShowEmojiPicker(null);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
        if (e.key === 'Escape') {
            setReplyingTo(null);
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
            setTimeout(scrollToBottom, 100);
        }
    };

    const handleClose = () => {
        setUnreadCount(0);
        onUnreadChange?.(0);
        setReplyingTo(null);
        setShowEmojiPicker(null);
        onToggle?.();
    };

    if (!isVisible) return null;

    return (
        <div className={`fixed bottom-4 right-4 w-96 max-w-[95vw] z-50 ${className} ${isBlinking ? 'animate-pulse' : ''}`}>
            <div className="bg-black/20 backdrop-blur-md rounded-lg shadow-2xl border border-white/20 overflow-hidden" style={{ height: '500px' }}>
                <div className="bg-black/30 backdrop-blur-sm text-white p-4 flex items-center justify-between border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5" />
                        <h3 className="font-bold text-base">Chat da Sala</h3>
                        {unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center animate-bounce">
                                {unreadCount}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleMinimizeToggle}
                            className="p-1.5 hover:bg-white/20 rounded transition-colors"
                        >
                            {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        {onToggle && (
                            <button
                                onClick={handleClose}
                                className="p-1.5 hover:bg-white/20 rounded transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>

                {!isMinimized && (
                    <>
                    {/* Área de resposta */}
                    {replyingTo && (
                        <div className="bg-blue-500/20 border-b border-white/10 p-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                    <p className="text-xs text-blue-300 mb-1">
                                        ↳ Respondendo a {replyingTo.player_name}
                                    </p>
                                    <p className="text-sm text-white/80 truncate">
                                        {replyingTo.message}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setReplyingTo(null)}
                                    className="text-white/60 hover:text-white"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        </div>
                    )}

                    <div
                        ref={messagesContainerRef}
                        className="bg-black/10 backdrop-blur-sm p-3 overflow-y-auto"
                        style={{ height: replyingTo ? '320px' : '360px' }}
                    >
                        {messages.length === 0 ? (
                            <div className="text-center text-white/70 text-sm py-8">
                                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>Nenhuma mensagem ainda...</p>
                                <p className="text-xs">Seja o primeiro a falar!</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {messages.map((message) => {
                                    const isOwnMessage = message.client_id === clientId.current;
                                    return (
                                        <div
                                            key={message.id}
                                            className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[85%] rounded-lg p-3 relative group ${
                                                        isOwnMessage
                                                            ? 'bg-primary/90 backdrop-blur-sm text-white'
                                                            : 'bg-white/20 backdrop-blur-sm text-white shadow-sm border border-white/10'
                                                    }`}
                                            >
                                                {/* Resposta (se existir) */}
                                                {message.reply_to_message && (
                                                    <div className="mb-2 p-2 bg-black/20 rounded border-l-2 border-white/40">
                                                        <p className="text-xs text-white/70">{message.reply_to_player}</p>
                                                        <p className="text-xs text-white/90 truncate">{message.reply_to_message}</p>
                                                    </div>
                                                )}

                                                {!isOwnMessage && (
                                                    <div className="flex items-center gap-2 mb-2">
                                                        {isImageUrl(message.player_avatar) ? (
                                                            <img
                                                                src={message.player_avatar}
                                                                alt={message.player_name}
                                                                className="w-5 h-5 rounded-full object-cover"
                                                            />
                                                        ) : (
                                                            <span className="text-sm">{message.player_avatar}</span>
                                                        )}
                                                        <span className="text-xs font-medium opacity-80">
                                                                {message.player_name}
                                                            </span>
                                                    </div>
                                                )}

                                                <p className="text-sm break-words">{message.message}</p>

                                                {/* Reações */}
                                                {message.reactions && Object.keys(message.reactions).length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        {Object.entries(message.reactions).map(([emoji, reactors]) => (
                                                            <button
                                                                key={emoji}
                                                                onClick={() => toggleReaction(message.id, emoji)}
                                                                className={`text-xs px-2 py-1 rounded-full bg-black/20 border transition-colors ${
                                                                        reactors.includes(clientId.current)
                                                                            ? 'border-yellow-400 bg-yellow-400/20'
                                                                            : 'border-white/20 hover:border-white/40'
                                                                    }`}
                                                            >
                                                                {emoji} {reactors.length}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="flex items-center justify-between mt-2">
                                                    <p className="text-xs opacity-70">
                                                        {formatTime(message.timestamp)}
                                                    </p>

                                                    {/* Botões de ação */}
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => setReplyingTo(message)}
                                                            className="p-1 hover:bg-white/20 rounded transition-colors"
                                                            title="Responder"
                                                        >
                                                            <Reply className="h-3 w-3" />
                                                        </button>
                                                        <div className="relative">
                                                            <button
                                                                onClick={() => setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)}
                                                                className="p-1 hover:bg-white/20 rounded transition-colors"
                                                                title="Reagir"
                                                            >
                                                                <Smile className="h-3 w-3" />
                                                            </button>

                                                            {/* Picker de emojis */}
                                                            {showEmojiPicker === message.id && (
                                                                <div className="absolute bottom-full right-0 mb-1 bg-black/90 backdrop-blur-sm rounded-lg p-2 shadow-lg border border-white/20 z-10">
                                                                    <div className="flex gap-1">
                                                                        {REACTION_EMOJIS.map(emoji => (
                                                                            <button
                                                                                key={emoji}
                                                                                onClick={() => toggleReaction(message.id, emoji)}
                                                                                className="text-lg hover:scale-125 transition-transform p-1"
                                                                            >
                                                                                {emoji}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    <div className="bg-black/20 backdrop-blur-sm border-t border-white/10 p-3">
                        <div className="flex gap-2 mb-1">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder={replyingTo ? `Respondendo a ${replyingTo.player_name}...` : "Digite sua mensagem..."}
                                className="flex-1 px-3 py-2 text-sm bg-white/10 backdrop-blur-sm border border-white/20 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-white/60"
                                maxLength={300}
                                disabled={isLoading}
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!newMessage.trim() || isLoading}
                                className="px-3 py-2 bg-primary/90 backdrop-blur-sm text-white rounded-md disabled:opacity-50 hover:bg-primary transition-colors"
                            >
                                <Send className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex justify-between items-center">
                            <p className="text-xs text-white/60">
                                {newMessage.length}/300
                            </p>
                            {replyingTo && (
                                <p className="text-xs text-blue-300">
                                    ESC para cancelar resposta
                                </p>
                            )}
                        </div>
                    </div>
                    </>
                )}
            </div>
        </div>
    );
}

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
            className={`fixed bottom-4 right-4 z-40 rounded-full h-16 w-16 p-0 shadow-lg ${unreadCount > 0 ? 'animate-pulse' : ''} ${className}`}
        >
            <div className="relative">
                <MessageCircle className="h-8 w-8" />
                {unreadCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center animate-bounce">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </div>
        </ChickenButton>
    );
}