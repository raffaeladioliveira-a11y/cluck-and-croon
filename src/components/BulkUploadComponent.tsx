import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ChickenButton } from "@/components/ChickenButton";
import { BarnCard } from "@/components/BarnCard";
import { Upload, Music, Check, X, Edit, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AudioFile {
    file: File;
    id: string;
    metadata: {
        title: string;
        artist: string;
        duration: number;
    };
    status: 'pending' | 'uploading' | 'success' | 'error';
    url?: string;
    error?: string;
}

interface BulkUploadProps {
    selectedAlbum: any;
    onComplete: () => void;
}

export const BulkUploadComponent = ({ selectedAlbum, onComplete }: BulkUploadProps) => {
    const [files, setFiles] = useState<AudioFile[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [currentStep, setCurrentStep] = useState<'select' | 'review' | 'upload' | 'complete'>('select');

    // Função para extrair metadados básicos do arquivo
    const extractMetadata = useCallback(async (file: File): Promise<{ title: string; artist: string; duration: number }> => {
        return new Promise((resolve) => {
            const audio = new Audio();
            const url = URL.createObjectURL(file);

            audio.addEventListener('loadedmetadata', () => {
                // Extrair nome do arquivo sem extensão
                const fileName = file.name.replace(/\.[^/.]+$/, "");

                // Tentar extrair artista e título do nome do arquivo
                // Formato esperado: "Artista - Título" ou apenas "Título"
                let title = fileName;
                let artist = selectedAlbum?.artist_name || "Artista Desconhecido";

                if (fileName.includes(' - ')) {
                    const parts = fileName.split(' - ');
                    artist = parts[0].trim();
                    title = parts.slice(1).join(' - ').trim();
                }

                resolve({
                    title,
                    artist,
                    duration: Math.round(audio.duration) || 30
                });

                URL.revokeObjectURL(url);
            });

            audio.addEventListener('error', () => {
                resolve({
                        title: file.name.replace(/\.[^/.]+$/, ""),
                        artist: selectedAlbum?.artist_name || "Artista Desconhecido",
                    duration: 30
            });
                URL.revokeObjectURL(url);
            });

            audio.src = url;
        });
    }, [selectedAlbum]);

    // Processar arquivos selecionados
    const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(event.target.files || []);
        const mp3Files = selectedFiles.filter(file => file.type === 'audio/mpeg' || file.name.endsWith('.mp3'));

        if (mp3Files.length === 0) {
            toast({
                title: "Nenhum arquivo MP3 encontrado",
                description: "Selecione apenas arquivos .mp3",
                variant: "destructive"
            });
            return;
        }

        setIsProcessing(true);
        const audioFiles: AudioFile[] = [];

        for (let i = 0; i < mp3Files.length; i++) {
            const file = mp3Files[i];
            const metadata = await extractMetadata(file);

            audioFiles.push({
                file,
                id: `${Date.now()}-${i}`,
                metadata,
                status: 'pending'
            });
        }

        setFiles(audioFiles);
        setCurrentStep('review');
        setIsProcessing(false);

        toast({
            title: `${mp3Files.length} arquivos processados`,
            description: "Revise os metadados antes de fazer upload"
        });
    }, [extractMetadata]);

    // Atualizar metadados de um arquivo
    const updateFileMetadata = useCallback((fileId: string, field: keyof AudioFile['metadata'], value: string) => {
        setFiles(prev => prev.map(file =>
            file.id === fileId
                ? {
                ...file,
                metadata: {
                    ...file.metadata,
                    [field]: field === 'duration' ? parseInt(value) || 30 : value
                }
            }
                : file
        ));
    }, []);

    // Upload individual de arquivo
    const uploadSingleFile = useCallback(async (audioFile: AudioFile): Promise<boolean> => {
        try {
            // Upload para storage
            const timestamp = Date.now();
            const slug = audioFile.metadata.title.toLowerCase().replace(/[^a-z0-9]/gi, '-');
            const fileName = `${selectedAlbum.id}/${slug}-${timestamp}.mp3`;

            const { error: uploadError } = await supabase.storage
                .from('songs')
                .upload(fileName, audioFile.file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('songs')
                .getPublicUrl(fileName);

            // Salvar no banco de dados
            const songData = {
                title: audioFile.metadata.title,
                artist: audioFile.metadata.artist,
                album_id: selectedAlbum.id,
                genre_id: selectedAlbum.genre_id,
                duration_seconds: audioFile.metadata.duration,
                audio_file_url: publicUrl,
                difficulty_level: 1,
                is_active: true
            };

            const { error: dbError } = await supabase
                .from('songs')
                .insert([songData]);

            if (dbError) throw dbError;

            return true;
        } catch (error) {
            console.error('Upload error:', error);
            return false;
        }
    }, [selectedAlbum]);

    // Processo de upload em lote
    const handleBulkUpload = useCallback(async () => {
        setCurrentStep('upload');
        setUploadProgress(0);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            // Atualizar status para "uploading"
            setFiles(prev => prev.map(f =>
                f.id === file.id ? { ...f, status: 'uploading' as const } : f
            ));

            const success = await uploadSingleFile(file);

            // Atualizar status final
            setFiles(prev => prev.map(f =>
                f.id === file.id
                    ? { ...f, status: success ? 'success' as const : 'error' as const, error: success ? undefined : 'Erro no upload' }
                    : f
            ));

            // Atualizar progresso
            setUploadProgress(((i + 1) / files.length) * 100);
        }

        setCurrentStep('complete');
        onComplete();

        const successCount = files.filter(f => f.status === 'success').length;
        toast({
            title: "Upload concluído",
            description: `${successCount} de ${files.length} músicas foram adicionadas ao álbum`
        });
    }, [files, uploadSingleFile, onComplete]);

    // Resetar componente
    const handleReset = useCallback(() => {
        setFiles([]);
        setCurrentStep('select');
        setUploadProgress(0);
        setIsProcessing(false);
    }, []);

    return (
        <BarnCard variant="golden" className="p-6">
            <div className="space-y-6">
                {/* Header */}
                <div className="text-center">
                    <h3 className="text-2xl font-bold text-white mb-2">
                        Upload em Lote - {selectedAlbum?.name}
                    </h3>
                    <p className="text-white/80">
                        Adicione múltiplas músicas de uma vez ao álbum
                    </p>
                </div>

                {/* Step 1: Seleção de arquivos */}
                {currentStep === 'select' && (
                    <div className="space-y-4">
                        <div className="text-center py-8 border-2 border-dashed border-white/30 rounded-lg">
                            <Upload className="w-12 h-12 text-white/60 mx-auto mb-4" />
                            <Label htmlFor="bulk-files" className="cursor-pointer">
                                <div className="text-white mb-2">
                                    Clique para selecionar arquivos MP3
                                </div>
                                <div className="text-white/60 text-sm">
                                    Ou arraste e solte os arquivos aqui
                                </div>
                                <Input
                                    id="bulk-files"
                                    type="file"
                                    multiple
                                    accept=".mp3,audio/mpeg"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                            </Label>
                        </div>

                        <div className="bg-white/10 rounded-lg p-4">
                            <h4 className="text-white font-semibold mb-2">Dicas para melhor resultado:</h4>
                            <ul className="text-white/80 text-sm space-y-1">
                                <li>• Nomeie os arquivos como: "Artista - Título.mp3"</li>
                                <li>• Use apenas arquivos MP3</li>
                                <li>• Máximo recomendado: 20 arquivos por vez</li>
                                <li>• Você poderá editar os metadados antes do upload</li>
                            </ul>
                        </div>
                    </div>
                )}

                {/* Step 2: Revisão de metadados */}
                {currentStep === 'review' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xl font-bold text-white">
                                Revisar Metadados ({files.length} arquivos)
                            </h4>
                            <div className="space-x-2">
                                <ChickenButton variant="feather" size="sm" onClick={handleReset}>
                                    Cancelar
                                </ChickenButton>
                                <ChickenButton variant="corn" onClick={handleBulkUpload}>
                                    Fazer Upload
                                </ChickenButton>
                            </div>
                        </div>

                        <div className="max-h-96 overflow-y-auto space-y-3">
                            {files.map((audioFile, index) => (
                                <div key={audioFile.id} className="bg-white/10 rounded-lg p-4">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white font-bold">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-white font-medium text-sm truncate">
                                                {audioFile.file.name}
                                            </div>
                                            <div className="text-white/60 text-xs">
                                                {(audioFile.file.size / 1024 / 1024).toFixed(2)} MB
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div>
                                            <Label className="text-white/90 text-xs">Título</Label>
                                            <Input
                                                value={audioFile.metadata.title}
                                                onChange={(e) => updateFileMetadata(audioFile.id, 'title', e.target.value)}
                                                className="bg-white/20 border-white/30 text-white text-sm"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-white/90 text-xs">Artista</Label>
                                            <Input
                                                value={audioFile.metadata.artist}
                                                onChange={(e) => updateFileMetadata(audioFile.id, 'artist', e.target.value)}
                                                className="bg-white/20 border-white/30 text-white text-sm"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-white/90 text-xs">Duração (s)</Label>
                                            <Input
                                                type="number"
                                                value={audioFile.metadata.duration}
                                                onChange={(e) => updateFileMetadata(audioFile.id, 'duration', e.target.value)}
                                                className="bg-white/20 border-white/30 text-white text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 3: Upload em progresso */}
                {currentStep === 'upload' && (
                    <div className="space-y-4">
                        <div className="text-center">
                            <h4 className="text-xl font-bold text-white mb-2">
                                Fazendo Upload...
                            </h4>
                            <Progress value={uploadProgress} className="w-full" />
                            <p className="text-white/80 text-sm mt-2">
                                {Math.round(uploadProgress)}% concluído
                            </p>
                        </div>

                        <div className="max-h-64 overflow-y-auto space-y-2">
                            {files.map((audioFile) => (
                                <div key={audioFile.id} className="flex items-center gap-3 p-3 bg-white/10 rounded-lg">
                                    <div className="flex-shrink-0">
                                        {audioFile.status === 'pending' && (
                                            <div className="w-5 h-5 rounded-full border-2 border-white/40" />
                                        )}
                                        {audioFile.status === 'uploading' && (
                                            <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                        )}
                                        {audioFile.status === 'success' && (
                                            <Check className="w-5 h-5 text-green-400" />
                                        )}
                                        {audioFile.status === 'error' && (
                                            <X className="w-5 h-5 text-red-400" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-white font-medium truncate">
                                            {audioFile.metadata.title}
                                        </div>
                                        <div className="text-white/60 text-sm truncate">
                                            {audioFile.metadata.artist}
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0">
                                        <Badge
                                            variant={
                        audioFile.status === 'success' ? 'default' :
                        audioFile.status === 'error' ? 'destructive' :
                        'secondary'
                      }
                                            className="text-xs"
                                        >
                                            {audioFile.status === 'pending' && 'Aguardando'}
                                            {audioFile.status === 'uploading' && 'Enviando...'}
                                            {audioFile.status === 'success' && 'Concluído'}
                                            {audioFile.status === 'error' && 'Erro'}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 4: Conclusão */}
                {currentStep === 'complete' && (
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                            <Check className="w-8 h-8 text-white" />
                        </div>

                        <div>
                            <h4 className="text-xl font-bold text-white mb-2">
                                Upload Concluído!
                            </h4>
                            <p className="text-white/80">
                                {files.filter(f => f.status === 'success').length} de {files.length} músicas
                foram adicionadas ao álbum "{selectedAlbum?.name}"
                            </p>
                        </div>

                        {files.some(f => f.status === 'error') && (
                            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-red-200 mb-2">
                                    <AlertCircle className="w-4 h-4" />
                                    <span className="font-medium">Alguns arquivos falharam</span>
                                </div>
                                <div className="text-red-200/80 text-sm space-y-1">
                                    {files.filter(f => f.status === 'error').map(file => (
                                        <div key={file.id}>
                                            • {file.metadata.title} - {file.error}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <ChickenButton variant="feather" onClick={handleReset}>
                            Fazer Novo Upload
                        </ChickenButton>
                    </div>
                )}
            </div>
        </BarnCard>
    );
};