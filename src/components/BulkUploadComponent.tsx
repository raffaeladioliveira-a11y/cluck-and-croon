import React, { useState, useCallback, useRef } from 'react';
import { ChickenButton } from "@/components/ChickenButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, X, CheckCircle, AlertCircle } from "lucide-react";

interface BulkUploadComponentProps {
    selectedAlbum: {
        id: string;
        name: string;
        genre_id: string;
    };
    onComplete: () => void;
}

interface UploadFile {
    file: File;
    status: 'pending' | 'uploading' | 'processing' | 'success' | 'error';
    progress: number;
    error?: string;
    title?: string;
    artist?: string;
}

export const BulkUploadComponent: React.FC<BulkUploadComponentProps> = ({
    selectedAlbum,
    onComplete
}) => {
    const [files, setFiles] = useState<UploadFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [currentFileIndex, setCurrentFileIndex] = useState(-1);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Função para extrair título e artista do nome do arquivo
    const extractTitleAndArtist = (filename: string) => {
        // Remove a extensão
        const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");

        // Padrões comuns: "Artista - Título" ou "Título - Artista"
        if (nameWithoutExt.includes(' - ')) {
            const parts = nameWithoutExt.split(' - ');
            if (parts.length >= 2) {
                return {
                    artist: parts[0].trim(),
                    title: parts[1].trim()
                };
            }
        }

        // Se não houver padrão, usar nome como título
        return {
            artist: selectedAlbum.name, // Usar nome do álbum como artista padrão
            title: nameWithoutExt.trim()
        };
    };

    // Função para processar arquivos (tanto de input quanto de drag)
    const processSelectedFiles = useCallback((selectedFiles: FileList) => {
        const newFiles: UploadFile[] = Array.from(selectedFiles)
            .filter(file => file.type === 'audio/mpeg' || file.name.endsWith('.mp3'))
            .map(file => {
                const { title, artist } = extractTitleAndArtist(file.name);
                return {
                    file,
                    status: 'pending' as const,
                    progress: 0,
                    title,
                    artist
                };
            });

        if (newFiles.length === 0) {
            toast({
                title: "Arquivos inválidos",
                description: "Por favor, selecione apenas arquivos MP3",
                variant: "destructive"
            });
            return;
        }

        setFiles(prev => [...prev, ...newFiles]);
    }, [selectedAlbum.name]);

    const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = event.target.files;
        if (!selectedFiles) return;

        processSelectedFiles(selectedFiles);

        // Limpar o input para permitir selecionar os mesmos arquivos novamente
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [processSelectedFiles]);

    // Funções de Drag and Drop
    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const droppedFiles = e.dataTransfer.files;
        if (droppedFiles.length > 0) {
            processSelectedFiles(droppedFiles);
        }
    }, [processSelectedFiles]);

    const handleDropZoneClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const updateFileTitle = (index: number, title: string) => {
        setFiles(prev => prev.map((file, i) =>
            i === index ? { ...file, title } : file
        ));
    };

    const updateFileArtist = (index: number, artist: string) => {
        setFiles(prev => prev.map((file, i) =>
            i === index ? { ...file, artist } : file
        ));
    };

    const uploadFile = async (file: File, albumId: string): Promise<string | null> => {
        try {
            const timestamp = Date.now();
            const slug = file.name.toLowerCase().replace(/[^a-z0-9.]/gi, '-');
            const fileName = `${albumId}/${timestamp}-${slug}`;

            console.log(`Fazendo upload: ${fileName}`);

            const { error: uploadError } = await supabase.storage
                .from('songs')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                console.error('Erro no upload:', uploadError);
                throw uploadError;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('songs')
                .getPublicUrl(fileName);

            console.log(`URL gerada: ${publicUrl}`);
            return publicUrl;
        } catch (error) {
            console.error('Erro completo no upload:', error);
            throw error;
        }
    };

    const processFiles = async () => {
        if (files.length === 0) {
            toast({
                title: "Nenhum arquivo selecionado",
                description: "Selecione arquivos MP3 para upload",
                variant: "destructive"
            });
            return;
        }

        setIsUploading(true);
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < files.length; i++) {
            setCurrentFileIndex(i);
            const uploadFile = files[i];

            // Atualizar status para uploading
            setFiles(prev => prev.map((file, index) =>
                index === i ? { ...file, status: 'uploading', progress: 0 } : file
            ));

            try {
                // 1. Fazer upload do arquivo
                console.log(`Processando arquivo ${i + 1}/${files.length}: ${uploadFile.file.name}`);

                const audioUrl = await uploadFileToStorage(uploadFile.file, selectedAlbum.id);

                if (!audioUrl) {
                    throw new Error('Falha no upload do arquivo');
                }

                // Atualizar progresso para 50% (upload concluído)
                setFiles(prev => prev.map((file, index) =>
                    index === i ? { ...file, progress: 50 } : file
                ));

                // 2. Salvar no banco de dados
                console.log(`Salvando no banco: ${uploadFile.title} por ${uploadFile.artist}`);

                setFiles(prev => prev.map((file, index) =>
                    index === i ? { ...file, status: 'processing', progress: 75 } : file
                ));

                // Criar a música
                const songData = {
                    title: uploadFile.title || uploadFile.file.name.replace(/\.[^/.]+$/, ""),
                    artist: uploadFile.artist || selectedAlbum.name,
                    genre_id: selectedAlbum.genre_id,
                    duration_seconds: 10, // Valor padrão
                    audio_file_url: audioUrl,
                    difficulty_level: 1, // Valor padrão
                    is_active: true
                };

                console.log('Dados da música:', songData);

                const { data: createdSong, error: songError } = await supabase
                    .from('songs')
                    .insert([songData])
                    .select()
                    .single();

                if (songError) {
                    console.error('Erro ao criar música:', songError);
                    throw songError;
                }

                console.log('Música criada:', createdSong);

                // 3. Criar relacionamento com álbum
                const relationshipData = {
                    album_id: selectedAlbum.id,
                    song_id: createdSong.id,
                    track_order: i + 1
                };

                console.log('Criando relacionamento:', relationshipData);

                const { error: relationshipError } = await supabase
                    .from('album_songs')
                    .insert([relationshipData]);

                if (relationshipError) {
                    console.error('Erro ao criar relacionamento:', relationshipError);
                    throw relationshipError;
                }

                console.log('Relacionamento criado com sucesso');

                // Sucesso - atualizar para 100%
                setFiles(prev => prev.map((file, index) =>
                    index === i ? { ...file, status: 'success', progress: 100 } : file
                ));

                successCount++;

            } catch (error) {
                console.error(`Erro ao processar arquivo ${uploadFile.file.name}:`, error);

                setFiles(prev => prev.map((file, index) =>
                    index === i ? {
                        ...file,
                        status: 'error',
                        progress: 0,
                        error: error instanceof Error ? error.message : 'Erro desconhecido'
                    } : file
                ));

                errorCount++;
            }
        }

        setIsUploading(false);
        setCurrentFileIndex(-1);

        // Toast de resultado
        if (successCount > 0 && errorCount === 0) {
            toast({
                title: "Upload concluído com sucesso!",
                description: `${successCount} músicas foram adicionadas ao álbum`,
            });
        } else if (successCount > 0 && errorCount > 0) {
            toast({
                title: "Upload parcialmente concluído",
                description: `${successCount} sucessos, ${errorCount} erros`,
            });
        } else if (errorCount > 0 && successCount === 0) {
            toast({
                title: "Falha no upload",
                description: `Nenhuma música foi salva. ${errorCount} erros encontrados`,
                variant: "destructive"
            });
        }

        // Chamar callback se houver sucessos
        if (successCount > 0) {
            onComplete();
        }
    };

    // Renomeando para evitar conflito de nomes
    const uploadFileToStorage = uploadFile;

    return (
        <div className="space-y-6">
            {/* Seleção de arquivos com Drag and Drop */}
            <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer ${
          isDragOver
            ? 'border-primary bg-primary/5 scale-105'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleDropZoneClick}
            >
                <Upload className={`w-12 h-12 mx-auto mb-4 transition-colors ${
          isDragOver ? 'text-primary' : 'text-muted-foreground'
        }`} />
                <div className="space-y-2">
                    <p className="text-lg font-semibold">
                        {isDragOver ? 'Solte os arquivos aqui!' : 'Selecionar Arquivos MP3'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {isDragOver
                            ? 'Solte para fazer upload dos arquivos MP3'
                            : 'Clique aqui ou arraste arquivos MP3 para fazer upload em massa'
                        }
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Suporta múltiplos arquivos • Apenas .mp3
                    </p>
                </div>
                <Input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".mp3,audio/mpeg"
                    onChange={handleFileSelect}
                    className="hidden"
                />
            </div>

            {/* Lista de arquivos */}
            {files.length > 0 && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h4 className="text-lg font-semibold">
                            Arquivos Selecionados ({files.length})
                        </h4>
                        <ChickenButton
                            variant="corn"
                            onClick={processFiles}
                            disabled={isUploading}
                        >
                            {isUploading ? 'Processando...' : 'Iniciar Upload'}
                        </ChickenButton>
                    </div>

                    <div className="space-y-3 max-h-80 overflow-y-auto">
                        {files.map((file, index) => (
                            <div
                                key={index}
                                className={`p-4 border rounded-lg ${
                  index === currentFileIndex ? 'border-primary bg-primary/5' : 'border-muted'
                }`}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Status Icon */}
                                    <div className="mt-1">
                                        {file.status === 'success' && (
                                            <CheckCircle className="w-5 h-5 text-green-500" />
                                        )}
                                        {file.status === 'error' && (
                                            <AlertCircle className="w-5 h-5 text-red-500" />
                                        )}
                                        {(file.status === 'uploading' || file.status === 'processing') && (
                                            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                        )}
                                        {file.status === 'pending' && (
                                            <div className="w-5 h-5 border-2 border-muted-foreground/25 rounded-full" />
                                        )}
                                    </div>

                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="font-medium text-sm">{file.file.name}</p>
                                            {!isUploading && (
                                                <button
                                                    onClick={() => removeFile(index)}
                                                    className="text-muted-foreground hover:text-destructive"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Campos de edição */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <Input
                                                placeholder="Título da música"
                                                value={file.title || ''}
                                                onChange={(e) => updateFileTitle(index, e.target.value)}
                                                disabled={isUploading}
                                                className="text-xs"
                                            />
                                            <Input
                                                placeholder="Artista"
                                                value={file.artist || ''}
                                                onChange={(e) => updateFileArtist(index, e.target.value)}
                                                disabled={isUploading}
                                                className="text-xs"
                                            />
                                        </div>

                                        {/* Progress bar */}
                                        {(file.status === 'uploading' || file.status === 'processing') && (
                                            <div className="space-y-1">
                                                <Progress value={file.progress} className="h-2" />
                                                <p className="text-xs text-muted-foreground">
                                                    {file.status === 'uploading' ? 'Fazendo upload...' : 'Salvando no banco...'}
                                                </p>
                                            </div>
                                        )}

                                        {/* Erro */}
                                        {file.status === 'error' && file.error && (
                                            <p className="text-xs text-red-500">{file.error}</p>
                                        )}

                                        {/* Sucesso */}
                                        {file.status === 'success' && (
                                            <p className="text-xs text-green-600">✓ Música adicionada com sucesso</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};