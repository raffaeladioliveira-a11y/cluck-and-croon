# 🚀 Setup Local do Quiz Musical

## 📋 Pré-requisitos
- **Node.js** (versão 18+) - [nodejs.org](https://nodejs.org)
- **Git** - [git-scm.com](https://git-scm.com)
- **Docker Desktop** - [docker.com](https://docker.com)

## 🔧 Passo a Passo

### 1. Clonar e Configurar o Projeto
```bash
# Clone seu projeto (substitua pela URL real)
git clone <URL_DO_SEU_PROJETO>
cd quiz-musical

# Instalar dependências
npm install
```

### 2. Instalar Supabase CLI
```bash
# Instalar Supabase CLI globalmente
npm install -g supabase

# Verificar instalação
supabase --version
```

### 3. Inicializar Supabase Local
```bash
# Dentro da pasta do projeto
supabase init

# Iniciar Supabase local (vai baixar containers Docker)
supabase start
```

⏳ **Aguarde**: O primeiro start demora ~5-10 minutos baixando imagens Docker.

### 4. Aplicar Schema do Banco

Crie o arquivo `supabase/migrations/20250101000001_create_quiz_musical_schema.sql`:

```sql
-- Criar tabela de perfis de usuário
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_emoji TEXT DEFAULT '🐔',
  total_eggs INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Criar tabela de gêneros musicais
CREATE TABLE public.genres (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  chicken_description TEXT,
  emoji TEXT DEFAULT '🎵',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de músicas
CREATE TABLE public.songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  genre_id UUID REFERENCES public.genres(id) ON DELETE SET NULL,
  album_name TEXT,
  release_year INTEGER,
  duration_seconds INTEGER DEFAULT 15,
  spotify_url TEXT,
  youtube_url TEXT,
  preview_url TEXT,
  audio_file_url TEXT,
  is_active BOOLEAN DEFAULT true,
  difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
  play_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- [Resto do schema... cole todo o conteúdo da migração]
```

### 5. Aplicar Migrações
```bash
# Aplicar migrações ao banco local
supabase db reset
```

### 6. Configurar Client Supabase Local

Edite `src/integrations/supabase/client.ts`:

```typescript
const SUPABASE_URL = "http://localhost:54321";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsaG9zdCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQ1NzY5MjAwLCJleHAiOjE5NjExMjkyMDB9.RZhQX0t86GfHvEy0JYWLyOkHdIbdF_vhJ9Rc7GmCIc4";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

### 7. Rodar o Projeto
```bash
# Terminal 1: Manter Supabase rodando
supabase start

# Terminal 2: Rodar React
npm run dev
```

## 🎯 URLs Importantes

- **App React**: http://localhost:5173
- **Supabase Studio**: http://localhost:54323
- **Database URL**: postgresql://postgres:postgres@localhost:54322/postgres

## 📊 Verificar se Está Funcionando

1. Acesse http://localhost:5173
2. Crie uma conta nova
3. Acesse o painel admin
4. Tente adicionar uma música
5. Verifique no Supabase Studio se salvou

## 🔧 Comandos Úteis

```bash
# Ver status do Supabase
supabase status

# Parar Supabase
supabase stop

# Reset completo do banco
supabase db reset

# Ver logs
supabase logs
```

## ⚠️ Troubleshooting

**Docker não inicia?**
- Verifique se o Docker Desktop está rodando
- Reinicie o Docker Desktop

**Porta ocupada?**
- `supabase stop` para parar tudo
- `docker ps` para ver containers rodando

**Migração falha?**
- Verifique syntax SQL no arquivo de migração
- `supabase db reset` para recriar do zero

**Frontend não conecta?**
- Verifique se as URLs estão corretas no client.ts
- Confirme que Supabase local está rodando

## 🎉 Pronto!

Agora você tem:
- ✅ React rodando localmente
- ✅ Supabase local funcionando
- ✅ Banco de dados completo
- ✅ Admin funcional
- ✅ Tudo offline na sua máquina!