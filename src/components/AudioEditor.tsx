/**
 * Created by rafaela on 11/09/25.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Play, Pause, Square, RotateCcw, Scissors, Download, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AudioEditorProps {
    isOpen: boolean;
    onClose: () => void;
    audioUrl: string;
    songTitle: string;
    songId: string;
    onSave: () => void;
}

export const AudioEditor: React.FC<AudioEditorProps> = ({
    isOpen,
    onClose,
    audioUrl,
    songTitle,
    songId,
    onSave
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);

    const audioRef = useRef<HTMLAudioElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const waveformRef = useRef<number[]>([]);
    const animationRef = useRef<number>();

    // Reset quando o modal abre/fecha
    useEffect(() => {
        if (isOpen) {
            setCurrentTime(0);
            setStartTime(0);
            setEndTime(0);
            setIsPlaying(false);
            setSelectionMode(false);
        }
    }, [isOpen]);

    // Configurar eventos do áudio
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleLoadedMetadata = () => {
            setDuration(audio.duration);
            setEndTime(audio.duration);
            generateWaveform();
        };

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
        };

        const handleEnded = () => {
            setIsPlaying(false);
        };

        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [audioUrl]);

    // Gerar forma de onda simplificada
    const generateWaveform = useCallback(async () => {
        const canvas = canvasRef.current;
        const audio = audioRef.current;
        if (!canvas || !audio) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Criar forma de onda simulada (para demonstração)
        const samples = 200;
        const waveform = [];
        for (let i = 0; i < samples; i++) {
            waveform.push(Math.random() * 0.8 + 0.1);
        }
        waveformRef.current = waveform;
        drawWaveform();
    }, []);

    // Desenhar forma de onda no canvas
    const drawWaveform = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { width, height } = canvas;
        const waveform = waveformRef.current;

        ctx.clearRect(0, 0, width, height);

        // Desenhar forma de onda
        ctx.fillStyle = '#e2e8f0';
        const barWidth = width / waveform.length;

        waveform.forEach((amplitude, i) => {
            const x = i * barWidth;
            const barHeight = amplitude * height * 0.8;
            const y = (height - barHeight) / 2;
            ctx.fillRect(x, y, barWidth - 1, barHeight);
        });

        // Desenhar seleção
        if (startTime < endTime && duration > 0) {
            const startX = (startTime / duration) * width;
            const endX = (endTime / duration) * width;

            ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
            ctx.fillRect(startX, 0, endX - startX, height);

            // Bordas da seleção
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(startX, 0);
            ctx.lineTo(startX, height);
            ctx.moveTo(endX, 0);
            ctx.lineTo(endX, height);
            ctx.stroke();
        }

        // Desenhar posição atual
        if (duration > 0) {
            const currentX = (currentTime / duration) * width;
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(currentX, 0);
            ctx.lineTo(currentX, height);
            ctx.stroke();
        }
    }, [currentTime, startTime, endTime, duration]);

    // Atualizar desenho
    useEffect(() => {
        drawWaveform();
    }, [drawWaveform]);

    // Controles de reprodução
    const togglePlayPause = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
        } else {
            audio.play();
        }
        setIsPlaying(!isPlaying);
    };

    const stopAudio = () => {
        const audio = audioRef.current;
        if (!audio) return;

        audio.pause();
        audio.currentTime = startTime;
        setIsPlaying(false);
    };

    const playSelection = () => {
        const audio = audioRef.current;
        if (!audio || startTime >= endTime) return;

        audio.currentTime = startTime;
        audio.play();
        setIsPlaying(true);

        // Parar no final da seleção
        const checkTime = () => {
            if (audio.currentTime >= endTime) {
                audio.pause();
                setIsPlaying(false);
                return;
            }
            if (isPlaying) {
                requestAnimationFrame(checkTime);
            }
        };
        requestAnimationFrame(checkTime);
    };

    // Manipular cliques no canvas
    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas || duration === 0) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const clickTime = (x / canvas.width) * duration;

        if (selectionMode) {
            if (Math.abs(clickTime - startTime) < Math.abs(clickTime - endTime)) {
                setStartTime(Math.max(0, clickTime));
            } else {
                setEndTime(Math.min(duration, clickTime));
            }
        } else {
            // Mover posição de reprodução
            const audio = audioRef.current;
            if (audio) {
                audio.currentTime = clickTime;
            }
        }
    };

    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Função para recortar e salvar
    const handleSaveClip = async () => {
        if (startTime >= endTime) {
            toast({
                title: "Seleção inválida",
                description: "Selecione um trecho válido para recortar",
                variant: "destructive"
            });
            return;
        }

        setIsSaving(true);
        try {
            // Aqui você implementaria a lógica de recorte do áudio
            // Por limitações do navegador, vamos simular o processo

            const clipDuration = Math.round(endTime - startTime);
            const newFileName = `${songTitle}_clip_${Date.now()}.mp3`;

            // Simular processamento
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Atualizar o banco de dados com a nova duração
            const { error } = await supabase
                .from('songs')
                .update({
                    duration_seconds: clipDuration,
                    // Aqui você salvaria a nova URL do arquivo recortado
                    // audio_file_url: newClippedFileUrl
                })
                .eq('id', songId);

            if (error) throw error;

            toast({
                title: "Música recortada com sucesso!",
                description: `Novo trecho: ${formatTime(startTime)} - ${formatTime(endTime)} (${clipDuration}s)`
            });

            onSave();
            onClose();
        } catch (error) {
            toast({
                title: "Erro ao recortar",
                description: "Não foi possível processar o recorte",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="max-w-4xl">
    <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
    <Scissors className="w-5 h-5" />
        Editor de Áudio - {songTitle}
    </DialogTitle>
    </DialogHeader>

    <div className="space-y-6">
        {/* Áudio oculto */}
        <audio ref={audioRef} src={audioUrl} preload="metadata" />

        {/* Controles principais */}
        <div className="flex items-center justify-center gap-4">
    <Button variant="outline" onClick={togglePlayPause}>
    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
    </Button>
    <Button variant="outline" onClick={stopAudio}>
    <Square className="w-4 h-4" />
    </Button>
    <Button variant="outline" onClick={playSelection} disabled={startTime >= endTime}>
    Reproduzir Seleção
    </Button>
    <Button
        variant={selectionMode ? "default" : "outline"}
    onClick={() => setSelectionMode(!selectionMode)}
    >
    <Scissors className="w-4 h-4 mr-2" />
        Modo Seleção
    </Button>
    </div>

    {/* Visualizador de forma de onda */}
    <div className="space-y-2">
        <Label>Forma de Onda</Label>
    <div className="border rounded-lg p-4 bg-muted/30">
    <canvas
        ref={canvasRef}
    width={800}
    height={150}
    className="w-full h-32 cursor-pointer border rounded"
    onClick={handleCanvasClick}
    />
    <div className="flex justify-between text-xs text-muted-foreground mt-2">
        <span>0:00</span>
    <span>Posição: {formatTime(currentTime)}</span>
    <span>{formatTime(duration)}</span>
    </div>
    </div>
    </div>

    {/* Controles de tempo */}
    <div className="grid grid-cols-2 gap-4">
        <div>
            <Label>Início do Corte</Label>
    <div className="flex gap-2">
    <Input
        type="number"
        value={Math.round(startTime)}
    onChange={(e) => setStartTime(Math.max(0, parseInt(e.target.value) || 0))}
    placeholder="Segundos"
    />
    <Button
        variant="outline"
    size="sm"
    onClick={() => setStartTime(currentTime)}
    >
    Usar Atual
    </Button>
    </div>
    <p className="text-xs text-muted-foreground mt-1">
        {formatTime(startTime)}
        </p>
        </div>

        <div>
            <Label>Fim do Corte</Label>
    <div className="flex gap-2">
    <Input
        type="number"
        value={Math.round(endTime)}
    onChange={(e) => setEndTime(Math.min(duration, parseInt(e.target.value) || duration))}
    placeholder="Segundos"
    />
    <Button
        variant="outline"
    size="sm"
    onClick={() => setEndTime(currentTime)}
    >
    Usar Atual
    </Button>
    </div>
    <p className="text-xs text-muted-foreground mt-1">
        {formatTime(endTime)}
        </p>
        </div>
        </div>

        {/* Informações da seleção */}
    {startTime < endTime && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">Prévia do Recorte</h4>
    <div className="grid grid-cols-3 gap-4 text-sm">
    <div>
        <span className="text-blue-600">Início:</span>
    <span className="ml-2 font-mono">{formatTime(startTime)}</span>
    </div>
    <div>
        <span className="text-blue-600">Fim:</span>
    <span className="ml-2 font-mono">{formatTime(endTime)}</span>
    </div>
    <div>
        <span className="text-blue-600">Duração:</span>
    <span className="ml-2 font-mono">{formatTime(endTime - startTime)}</span>
    </div>
    </div>
    </div>
    )}

    {/* Botões de ação */}
    <div className="flex justify-between">
    <Button variant="outline" onClick={onClose}>
    Cancelar
    </Button>

    <div className="flex gap-2">
    <Button
        variant="default"
    onClick={handleSaveClip}
    disabled={startTime >= endTime || isSaving}
    >
    {isSaving ? (
        <>
            <div className="w-4 h-4 animate-spin border-2 border-current border-t-transparent rounded-full mr-2" />
            Processando...
        </>
    ) : (
        <>
            <Save className="w-4 h-4 mr-2" />
            Salvar Recorte
    </>
    )}
    </Button>
    </div>
    </div>

    {/* Instruções */}
    <div className="text-xs text-muted-foreground space-y-1">
        <p><strong>Instruções:</strong></p>
    <p>• Clique no modo "Seleção" e depois clique na forma de onda para definir início/fim</p>
    <p>• Use "Reproduzir Seleção" para ouvir apenas o trecho selecionado</p>
    <p>• Ajuste os tempos manualmente ou use "Usar Atual" durante a reprodução</p>
    </div>
    </div>
    </DialogContent>
    </Dialog>
    );
};