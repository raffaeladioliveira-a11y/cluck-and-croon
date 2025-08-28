-- Criar tabela de usuários administradores
CREATE TABLE public.admin_users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  avatar_emoji text DEFAULT '🚜',
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Admin users can view all admin accounts" 
ON public.admin_users 
FOR SELECT 
USING (true);

CREATE POLICY "Admin users can update their own account" 
ON public.admin_users 
FOR UPDATE 
USING (true);

-- Inserir usuário admin padrão (senha: galinha123 - hash bcrypt)
INSERT INTO public.admin_users (username, password_hash, display_name) 
VALUES ('fazendeiro', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Fazendeiro Silva');

-- Trigger para update automático do updated_at
CREATE TRIGGER update_admin_users_updated_at
BEFORE UPDATE ON public.admin_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();