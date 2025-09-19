import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Cloud, HardDrive, X } from 'lucide-react';
import { ChickenButton } from '@/components/ChickenButton';

interface StorageStats {
    supabase: {
        total: number;
        active: number;
    };
    cloudinary: {
        total: number;
        withBackup: number;
    };
}

export const MusicStorageModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentProvider, setCurrentProvider] = useState<'supabase' | 'cloudinary'>('supabase');
    const [isLoading, setIsLoading] = useState(false);
    const [stats, setStats] = useState<StorageStats | null>(null);
    const { toast } = useToast();

    // Carregar dados quando modal abrir
    useEffect(() => {
        if (isOpen) {
            loadCurrentSetting();
            loadStorageStats();
        }
    }, [isOpen]);

    const loadCurrentSetting = async () => {
        try {
            const { data, error } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'music_storage_provider')
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (data?.value) {
                const provider = typeof data.value === 'string'
                    ? data.value.replace(/"/g, '')
                    : data.value;
                setCurrentProvider(provider);
            }
        } catch (error) {
            console.error('Erro ao carregar configuração:', error);
        }
    };

    const loadStorageStats = async () => {
        try {
            // Estatísticas do Supabase
            const { count: supabaseTotal } = await supabase
                .from('songs')
                .select('*', { count: 'exact', head: true })
                .not('audio_file_url', 'is', null);

            // Estatísticas do Cloudinary
            const { count: cloudinaryBackups } = await supabase
                .from('songs')
                .select('*', { count: 'exact', head: true })
                .not('cloudinary_url', 'is', null);

            setStats({
                supabase: {
                    total: supabaseTotal || 0,
                    active: supabaseTotal || 0
                },
                cloudinary: {
                    total: supabaseTotal || 0,
                    withBackup: cloudinaryBackups || 0
                }
            });
        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
        }
    };

    const handleToggle = async (newProvider: 'supabase' | 'cloudinary') => {
        if (newProvider === 'cloudinary' && stats && stats.cloudinary.withBackup === 0) {
            toast({
                title: "Aviso",
                description: "Nenhuma música foi copiada para o Cloudinary ainda. Execute o backup primeiro.",
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);

        try {
            const { error } = await supabase
                .from('system_settings')
                .upsert({
                    key: 'music_storage_provider',
                    value: JSON.stringify(newProvider),
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            setCurrentProvider(newProvider);

            toast({
                title: "Configuração Atualizada",
                description: `Músicas agora serão carregadas do ${newProvider === 'cloudinary' ? 'Cloudinary' : 'Supabase'}`,
                variant: "default",
            });

            // Recarregar página após 2 segundos
            setTimeout(() => {
                window.location.reload();
            }, 2000);

        } catch (error) {
            console.error('Erro ao atualizar configuração:', error);
            toast({
                title: "Erro",
                description: "Falha ao atualizar configuração",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const getProgressPercentage = () => {
        if (!stats) return 0;
        return Math.round((stats.cloudinary.withBackup / stats.supabase.total) * 100);
    };

    if (!isOpen) {
        return (
            <ChickenButton
                variant="coop"
                onClick={() => setIsOpen(true)}
            >
                <Cloud className="w-4 h-4 mr-2"/>
                Storage Manager
            </ChickenButton>
        );
    }

    return (
        <>
        {/* Overlay */}
        <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setIsOpen(false)}
        >
            {/* Modal */}
            <div
                className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Gerenciar Storage de Música</h2>
                        <p className="text-sm text-gray-600">Alternar entre Supabase e Cloudinary</p>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Toggle Switch */}
                    <div className="flex items-center justify-center space-x-6 mb-6">
                        <div className="flex items-center space-x-2">
                            <HardDrive className={`w-5 h-5 ${currentProvider === 'supabase' ? 'text-blue-600' : 'text-gray-400'}`} />
                            <span className={`text-sm font-medium ${currentProvider === 'supabase' ? 'text-blue-600' : 'text-gray-400'}`}>
                  Supabase
                </span>
                        </div>

                        <button
                            onClick={() => handleToggle(currentProvider === 'supabase' ? 'cloudinary' : 'supabase')}
                            disabled={isLoading}
                            className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  currentProvider === 'cloudinary' ? 'bg-orange-500' : 'bg-blue-500'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    currentProvider === 'cloudinary' ? 'translate-x-9' : 'translate-x-1'
                  }`}
                />
                        </button>

                        <div className="flex items-center space-x-2">
                            <Cloud className={`w-5 h-5 ${currentProvider === 'cloudinary' ? 'text-orange-600' : 'text-gray-400'}`} />
                            <span className={`text-sm font-medium ${currentProvider === 'cloudinary' ? 'text-orange-600' : 'text-gray-400'}`}>
                  Cloudinary
                </span>
                        </div>
                    </div>

                    {/* Status atual */}
                    <div className={`text-center p-4 rounded-lg mb-6 ${
              currentProvider === 'cloudinary' ? 'bg-orange-50' : 'bg-blue-50'
            }`}>
                        <div className="flex items-center justify-center space-x-2">
                            <div className={`w-3 h-3 rounded-full ${currentProvider === 'cloudinary' ? 'bg-orange-500' : 'bg-blue-500'}`}></div>
                            <span className="font-medium text-gray-800">
                  Músicas sendo carregadas do {currentProvider === 'cloudinary' ? 'Cloudinary' : 'Supabase'}
                </span>
                        </div>
                    </div>

                    {/* Estatísticas */}
                    {stats && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-medium text-blue-900 flex items-center">
                                            <HardDrive className="w-4 h-4 mr-1" />
                                            Supabase
                                        </h3>
                                        <p className="text-2xl font-bold text-blue-600">{stats.supabase.total}</p>
                                        <p className="text-sm text-blue-600">músicas disponíveis</p>
                                    </div>
                                    {currentProvider === 'supabase' && (
                                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-orange-50 p-4 rounded-lg border-2 border-orange-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-medium text-orange-900 flex items-center">
                                            <Cloud className="w-4 h-4 mr-1" />
                                            Cloudinary
                                        </h3>
                                        <p className="text-2xl font-bold text-orange-600">{stats.cloudinary.withBackup}</p>
                                        <p className="text-sm text-orange-600">
                                            backup concluído ({getProgressPercentage()}%)
                                        </p>
                                    </div>
                                    {currentProvider === 'cloudinary' && (
                                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Barra de progresso */}
                    {stats && (
                        <div className="mb-6">
                            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                                <span>Progresso do Backup para Cloudinary</span>
                                <span>{getProgressPercentage()}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                                <div
                                    className="bg-orange-500 h-3 rounded-full transition-all duration-300"
                                    style={{ width: `${getProgressPercentage()}%` }}
                                ></div>
                            </div>
                            {getProgressPercentage() < 100 && (
                                <p className="text-xs text-gray-500 mt-1">
                                    Execute o script de backup para copiar mais músicas para o Cloudinary
                                </p>
                            )}
                        </div>
                    )}

                    {/* Avisos */}
                    {currentProvider === 'cloudinary' && stats && stats.cloudinary.withBackup < stats.supabase.total && (
                        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                            <p className="text-sm text-yellow-800">
                                ⚠️ Apenas {stats.cloudinary.withBackup} de {stats.supabase.total} músicas têm backup no Cloudinary.
                  Algumas músicas podem não carregar.
                            </p>
                        </div>
                    )}

                    {isLoading && (
                        <div className="flex items-center justify-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                            <span className="ml-2 text-sm text-gray-600">Atualizando configuração...</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end p-6 border-t space-x-3">
                    <button
                        onClick={() => setIsOpen(false)}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
        </>
    );
};