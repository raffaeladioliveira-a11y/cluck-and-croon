/**
 * Created by rafaela on 12/09/25.
 */
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ChickenButton } from "@/components/ChickenButton";
import { Search, Music, FolderOpen, Plus, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Song {
    id: string;
    title: string;
    artist: string;
    album_ids?: string[]; // Álbuns aos quais a música pertence
}

interface Album {
    id: string;
    name: string;
    artist_name: string;
    cover_image_url?: string;
}

interface SongAlbumManagerProps {
    isOpen: boolean;
    onClose: () => void;
    song: Song | null;
    onUpdate: () => void;
}

export function SongAlbumManager({ isOpen, onClose, song, onUpdate }: SongAlbumManagerProps) {
    const [albums, setAlbums] = useState<Album[]>([]);
    const [currentAlbums, setCurrentAlbums] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Carregar álbuns disponíveis
    const loadAlbums = async () => {
        try {
            const { data, error } = await supabase
                .from('albums')
                .select('id, name, artist_name, cover_image_url')
                .order('name');

            if (error) throw error;
            setAlbums(data || []);
        } catch (error) {
            toast({
                title: "Erro",
                description: "Não foi possível carregar os álbuns",
                variant: "destructive",
            });
        }
    };

    // Carregar álbuns atuais da música
    const loadCurrentAlbums = async () => {
        if (!song) return;

        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('album_songs')
                .select('album_id')
                .eq('song_id', song.id);

            if (error) throw error;
            setCurrentAlbums(data?.map(item => item.album_id) || []);
        } catch (error) {
            toast({
                title: "Erro",
                description: "Não foi possível carregar os álbuns atuais",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Alternar álbum
    const toggleAlbum = (albumId: string) => {
        setCurrentAlbums(prev =>
            prev.includes(albumId)
                ? prev.filter(id => id !== albumId)
                : [...prev, albumId]
        );
    };

    // Salvar alterações
    const saveChanges = async () => {
        if (!song) return;

        setIsSaving(true);
        try {
            // Primeiro, remover todos os relacionamentos existentes
            const { error: deleteError } = await supabase
                .from('album_songs')
                .delete()
                .eq('song_id', song.id);

            if (deleteError) throw deleteError;

            // Depois, adicionar os novos relacionamentos
            if (currentAlbums.length > 0) {
                const albumSongsData = currentAlbums.map((albumId, index) => ({
                    album_id: albumId,
                    song_id: song.id,
                    track_order: index + 1
                }));

                const { error: insertError } = await supabase
                    .from('album_songs')
                    .insert(albumSongsData);

                if (insertError) throw insertError;
            }

            toast({
                title: "Álbuns atualizados!",
                description: `${song.title} agora pertence a ${currentAlbums.length} álbum(ns)`,
            });

            onUpdate();
            onClose();
        } catch (error) {
            toast({
                title: "Erro",
                description: "Não foi possível salvar as alterações",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Filtrar álbuns por busca
    const filteredAlbums = albums.filter(album =>
        album.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        album.artist_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        if (isOpen) {
            loadAlbums();
            loadCurrentAlbums();
            setSearchTerm('');
        }
    }, [isOpen, song]);

    if (!song) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Music className="w-5 h-5" />
                        Gerenciar Álbuns - {song.title}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        Por {song.artist} • Selecione os álbuns aos quais esta música deve pertencer
                    </p>
                </DialogHeader>

                <div className="flex-1 space-y-4 overflow-hidden">
                    {/* Busca */}
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar álbuns..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    {/* Contador */}
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            {currentAlbums.length} álbum(ns) selecionado(s)
                        </p>
                        <Badge variant="outline">
                            {filteredAlbums.length} álbuns disponíveis
                        </Badge>
                    </div>

                    {/* Lista de álbuns */}
                    <div className="flex-1 overflow-y-auto max-h-96 space-y-2 border rounded-lg p-2">
                        {isLoading ? (
                            <div className="text-center py-8">
                                <div className="text-4xl mb-2 animate-spin">🐔</div>
                                <p>Carregando álbuns...</p>
                            </div>
                        ) : filteredAlbums.length === 0 ? (
                            <div className="text-center py-8">
                                <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                                <p className="text-muted-foreground">Nenhum álbum encontrado</p>
                            </div>
                        ) : (
                            filteredAlbums.map(album => {
                                const isSelected = currentAlbums.includes(album.id);
                                return (
                                    <div
                                        key={album.id}
                                        className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                                        onClick={() => toggleAlbum(album.id)}
                                    >
                                        <Checkbox
                                            checked={isSelected}
                                            onChange={() => toggleAlbum(album.id)}
                                            className="pointer-events-none"
                                        />

                                        {album.cover_image_url ? (
                                            <img
                                                src={album.cover_image_url}
                                                alt={album.name}
                                                className="w-12 h-12 object-cover rounded"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                                                <Music className="w-6 h-6 text-muted-foreground" />
                                            </div>
                                        )}

                                        <div className="flex-1">
                                            <h4 className="font-medium">{album.name}</h4>
                                            <p className="text-sm text-muted-foreground">{album.artist_name}</p>
                                        </div>

                                        {isSelected && (
                                            <Badge variant="default" className="text-xs">
                                                Selecionado
                                            </Badge>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Botões de ação */}
                <div className="flex gap-2 pt-4 border-t">
                    <ChickenButton
                        variant="corn"
                        className="flex-1"
                        onClick={saveChanges}
                        disabled={isSaving || isLoading}
                    >
                        {isSaving ? "Salvando..." : "💾 Salvar Alterações"}
                    </ChickenButton>
                    <ChickenButton
                        variant="feather"
                        onClick={onClose}
                        disabled={isSaving}
                    >
                        ❌ Cancelar
                    </ChickenButton>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ============= COMPONENTE AUXILIAR PARA MOVER MÚSICAS =============

interface MoveSongDialogProps {
    isOpen: boolean;
    onClose: () => void;
    song: Song | null;
    currentAlbumId: string;
    onMove: () => void;
}

export function MoveSongDialog({ isOpen, onClose, song, currentAlbumId, onMove }: MoveSongDialogProps) {
    const [albums, setAlbums] = useState<Album[]>([]);
    const [selectedAlbumId, setSelectedAlbumId] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isMoving, setIsMoving] = useState(false);

    const loadAlbums = async () => {
        try {
            const { data, error } = await supabase
                .from('albums')
                .select('id, name, artist_name, cover_image_url')
                .neq('id', currentAlbumId) // Excluir o álbum atual
                .order('name');

            if (error) throw error;
            setAlbums(data || []);
        } catch (error) {
            toast({
                title: "Erro",
                description: "Não foi possível carregar os álbuns",
                variant: "destructive",
            });
        }
    };

    const moveSong = async () => {
        if (!song || !selectedAlbumId) return;

        setIsMoving(true);
        try {
            // Atualizar o relacionamento na tabela album_songs
            const { error } = await supabase
                .from('album_songs')
                .update({ album_id: selectedAlbumId })
                .eq('song_id', song.id)
                .eq('album_id', currentAlbumId);

            if (error) throw error;

            const targetAlbum = albums.find(album => album.id === selectedAlbumId);
            toast({
                title: "Música movida!",
                description: `${song.title} foi movida para o álbum "${targetAlbum?.name}"`,
            });

            onMove();
            onClose();
        } catch (error) {
            toast({
                title: "Erro",
                description: "Não foi possível mover a música",
                variant: "destructive",
            });
        } finally {
            setIsMoving(false);
        }
    };

    const filteredAlbums = albums.filter(album =>
        album.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        album.artist_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        if (isOpen) {
            loadAlbums();
            setSelectedAlbumId('');
            setSearchTerm('');
        }
    }, [isOpen]);

    if (!song) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FolderOpen className="w-5 h-5" />
                        Mover Música - {song.title}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        Escolha o álbum de destino para esta música
                    </p>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Busca */}
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar álbum de destino..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    {/* Lista de álbuns */}
                    <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-2">
                        {filteredAlbums.map(album => (
                            <div
                                key={album.id}
                                className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${
                  selectedAlbumId === album.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                                onClick={() => setSelectedAlbumId(album.id)}
                            >
                                {album.cover_image_url ? (
                                    <img
                                        src={album.cover_image_url}
                                        alt={album.name}
                                        className="w-12 h-12 object-cover rounded"
                                    />
                                ) : (
                                    <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                                        <Music className="w-6 h-6 text-muted-foreground" />
                                    </div>
                                )}

                                <div className="flex-1">
                                    <h4 className="font-medium">{album.name}</h4>
                                    <p className="text-sm text-muted-foreground">{album.artist_name}</p>
                                </div>

                                {selectedAlbumId === album.id && (
                                    <Badge variant="default">Selecionado</Badge>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Botões */}
                    <div className="flex gap-2 pt-4 border-t">
                        <ChickenButton
                            variant="corn"
                            className="flex-1"
                            onClick={moveSong}
                            disabled={!selectedAlbumId || isMoving}
                        >
                            {isMoving ? "Movendo..." : "📁 Mover Música"}
                        </ChickenButton>
                        <ChickenButton
                            variant="feather"
                            onClick={onClose}
                            disabled={isMoving}
                        >
                            ❌ Cancelar
                        </ChickenButton>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}