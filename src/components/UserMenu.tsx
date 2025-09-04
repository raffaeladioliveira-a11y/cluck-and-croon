import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { Button } from "@/components/ui/button";
import { ChickenAvatar } from "@/components/ChickenAvatar";
import { LogOut, User as UserIcon, Settings } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getDisplayNameOrDefault, getAvatarOrDefault, loadProfile } from "@/utils/clientId";
import { useNavigate } from "react-router-dom";

export function UserMenu() {
    const { user, loading } = useAuthSession();
    const navigate = useNavigate();
    const [signingOut, setSigningOut] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false); // Adicione este estado

    const email = user?.email ?? "";
    const meta = (user?.user_metadata ?? {}) as Record<string, any>;
    const displayName = (meta.display_name as string) || loadProfile().displayName || getDisplayNameOrDefault(loadProfile());
    const avatarEmoji = (meta.avatar_emoji as string) || loadProfile().avatar || getAvatarOrDefault(loadProfile());
    const avatarUrl = (meta.avatar_url as string) || "";

    const initials = useMemo(() => {
        const n = (displayName || email || "U").trim();
        return n.slice(0,1).toUpperCase();
    }, [displayName, email]);

    // Verificar se o usuário é admin
    useEffect(() => {
        const checkAdminStatus = async () => {
            if (!user) return;

            try {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('is_admin')
                    .eq('user_id', user.id)
                    .single();

                setIsAdmin(profile?.is_admin || false);
            } catch (error) {
                console.error('Erro ao verificar status admin:', error);
                setIsAdmin(false);
            }
        };

        checkAdminStatus();
    }, [user]);

    if (loading) return null;

    if (!user) {
        return (
            <Button variant="outline" onClick={() => navigate("/auth")} aria-label="Entrar">
                Entrar / Cadastrar
            </Button>
        );
    }

    const avatarNode = avatarUrl
        ? <img src={avatarUrl} alt="Avatar do usuário" className="h-8 w-8 rounded-full object-cover" />
        : <ChickenAvatar emoji={avatarEmoji || "🐔"} size="sm" />;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="inline-flex items-center gap-2 rounded-full focus:outline-none" aria-label="Abrir menu do usuário">
                    {avatarNode}
                    <span className="text-sm font-medium hidden sm:inline">{displayName || email}</span>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                        {avatarUrl ? "" : initials}
                    </div>
                    <div className="min-w-0">
                        <div className="truncate font-semibold">{displayName || "Usuário"}</div>
                        <div className="truncate text-xs text-muted-foreground">{email}</div>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <UserIcon className="h-4 w-4 mr-2" /> Meu perfil
                </DropdownMenuItem>

                {/* Adicione o item de admin AQUI, dentro do DropdownMenuContent */}
                {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate('/admin/dashboard')}>
                        🚜 <span className="ml-2">Painel Admin</span>
                    </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={async () => {
            setSigningOut(true);
            await supabase.auth.signOut();
            setSigningOut(false);
          }}
                    disabled={signingOut}
                >
                    <LogOut className="h-4 w-4 mr-2" /> Sair
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}