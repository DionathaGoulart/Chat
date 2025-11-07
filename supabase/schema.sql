-- ============================================
-- SCHEMA DO BANCO DE DADOS - CHAT E2EE
-- ============================================
-- Execute este script no Supabase SQL Editor
-- ============================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABELA: profiles (Perfis de usuários)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  public_key TEXT, -- Chave pública para E2EE (X25519 base64) - NULL até o cliente gerar as chaves
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para profiles
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);
CREATE INDEX IF NOT EXISTS profiles_public_key_idx ON public.profiles(public_key);

-- ============================================
-- TABELA: conversations (Conversas)
-- ============================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: conversation_participants (Participantes)
-- ============================================
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- Índices para conversation_participants
CREATE INDEX IF NOT EXISTS conversation_participants_conversation_id_idx 
  ON public.conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS conversation_participants_user_id_idx 
  ON public.conversation_participants(user_id);

-- ============================================
-- TABELA: messages (Mensagens criptografadas)
-- ============================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cipher_text TEXT NOT NULL, -- Mensagem criptografada (base64)
  nonce TEXT NOT NULL, -- Nonce para descriptografia (base64)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para messages
CREATE INDEX IF NOT EXISTS messages_conversation_id_idx 
  ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS messages_sender_id_idx 
  ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx 
  ON public.messages(created_at DESC);

-- ============================================
-- FUNÇÃO: Atualizar updated_at automaticamente
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
-- Remover triggers existentes antes de criar novos
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- POLÍTICAS RLS (Row Level Security)
-- ============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS: profiles
-- ============================================

-- Remover políticas existentes antes de criar novas
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles of conversation participants" ON public.profiles;

-- Usuários podem ler seu próprio perfil
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Usuários podem atualizar seu próprio perfil
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Usuários podem inserir seu próprio perfil
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Usuários podem ver perfis de outros participantes de suas conversas
CREATE POLICY "Users can view profiles of conversation participants"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversation_participants cp1
      JOIN public.conversation_participants cp2
        ON cp1.conversation_id = cp2.conversation_id
      WHERE cp1.user_id = auth.uid()
        AND cp2.user_id = profiles.id
    )
  );

-- ============================================
-- POLÍTICAS: conversations
-- ============================================

-- Remover políticas existentes antes de criar novas
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;

-- Usuários podem ver conversas das quais participam
CREATE POLICY "Users can view own conversations"
  ON public.conversations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversation_participants
      WHERE conversation_id = conversations.id
        AND user_id = auth.uid()
    )
  );

-- Usuários podem criar conversas
CREATE POLICY "Users can create conversations"
  ON public.conversations
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- FUNÇÃO AUXILIAR: Verificar se usuário participa de conversa
-- ============================================
-- Esta função bypassa RLS para evitar recursão infinita
-- SECURITY DEFINER permite que a função execute com privilégios do criador
CREATE OR REPLACE FUNCTION public.user_is_conversation_participant(
  check_conversation_id UUID,
  check_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Usar SECURITY DEFINER permite bypassar RLS nesta consulta
  RETURN EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = check_conversation_id
      AND user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Permissão para usar a função
GRANT EXECUTE ON FUNCTION public.user_is_conversation_participant(UUID, UUID) TO authenticated;

-- ============================================
-- POLÍTICAS: conversation_participants
-- ============================================

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Users can view participants of own conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add participants to own conversations" ON public.conversation_participants;

-- Usuários podem ver participantes de suas conversas
-- Usa função auxiliar para evitar recursão infinita
CREATE POLICY "Users can view participants of own conversations"
  ON public.conversation_participants
  FOR SELECT
  USING (
    public.user_is_conversation_participant(conversation_id, auth.uid())
  );

-- Usuários podem adicionar participantes às conversas das quais fazem parte
CREATE POLICY "Users can add participants to own conversations"
  ON public.conversation_participants
  FOR INSERT
  WITH CHECK (
    public.user_is_conversation_participant(conversation_id, auth.uid())
  );

-- ============================================
-- POLÍTICAS: messages
-- ============================================

-- Remover políticas existentes antes de criar novas
DROP POLICY IF EXISTS "Users can view messages from own conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages to own conversations" ON public.messages;

-- Usuários podem ler mensagens de conversas das quais participam
CREATE POLICY "Users can view messages from own conversations"
  ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversation_participants
      WHERE conversation_id = messages.conversation_id
        AND user_id = auth.uid()
    )
  );

-- Usuários podem inserir mensagens em conversas das quais participam
CREATE POLICY "Users can insert messages to own conversations"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.conversation_participants
      WHERE conversation_id = messages.conversation_id
        AND user_id = auth.uid()
    )
  );

-- ============================================
-- FUNÇÃO: Buscar usuários por email (para criar conversas)
-- ============================================
CREATE OR REPLACE FUNCTION public.search_users_by_email(search_email TEXT)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  public_key TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.display_name,
    p.email,
    p.avatar_url,
    p.public_key
  FROM public.profiles p
  WHERE p.email ILIKE '%' || search_email || '%'
    AND p.id != auth.uid() -- Excluir o próprio usuário
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissão para usar a função
GRANT EXECUTE ON FUNCTION public.search_users_by_email(TEXT) TO authenticated;

-- ============================================
-- COMENTÁRIOS FINAIS
-- ============================================
-- Após executar este script:
-- 1. Configure Google OAuth no Supabase Dashboard
-- 2. Adicione as URLs de callback nas configurações do Google
-- 3. Teste as políticas RLS com diferentes usuários
-- ============================================


