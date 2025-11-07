-- ============================================
-- SCHEMA SIMPLIFICADO E SEGURO - CHAT E2EE
-- Execute este script no Supabase SQL Editor
-- ============================================
-- Arquitetura:
-- - Admins: mensagens no banco de dados
-- - Usuários: mensagens no localStorage (não no banco)
-- - Cada usuário tem chave pública/privada
-- - Chaves públicas são compartilhadas entre participantes
-- ============================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- LIMPAR DADOS EXISTENTES
-- ============================================
-- ATENÇÃO: Isso vai deletar TODOS os dados existentes!
-- TRUNCATE não suporta IF EXISTS, então usamos DELETE
DO $$
BEGIN
  -- Deletar mensagens
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages') THEN
    DELETE FROM public.messages;
  END IF;
  
  -- Deletar chaves de conversa
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conversation_keys') THEN
    DELETE FROM public.conversation_keys;
  END IF;
  
  -- Deletar participantes
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conversation_participants') THEN
    DELETE FROM public.conversation_participants;
  END IF;
  
  -- Deletar conversas
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conversations') THEN
    DELETE FROM public.conversations;
  END IF;
  
  -- Resetar chaves públicas (não deletamos profiles para manter os usuários)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    UPDATE public.profiles SET public_key = NULL WHERE true;
  END IF;
END $$;

-- ============================================
-- TABELA: profiles (Perfis de usuários)
-- ============================================
DROP TABLE IF EXISTS public.profiles CASCADE;
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  public_key TEXT, -- Chave pública para E2EE (X25519 base64) - gerada automaticamente no cliente
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')), -- Cargo: admin ou user
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para profiles
CREATE INDEX profiles_email_idx ON public.profiles(email);
CREATE INDEX profiles_public_key_idx ON public.profiles(public_key);
CREATE INDEX profiles_role_idx ON public.profiles(role);

-- ============================================
-- TABELA: conversations (Conversas)
-- ============================================
DROP TABLE IF EXISTS public.conversations CASCADE;
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: conversation_participants (Participantes)
-- ============================================
DROP TABLE IF EXISTS public.conversation_participants CASCADE;
CREATE TABLE public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  other_participant_public_key TEXT, -- Chave pública do outro participante (armazenada localmente)
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- Índices para conversation_participants
CREATE INDEX conversation_participants_conversation_id_idx 
  ON public.conversation_participants(conversation_id);
CREATE INDEX conversation_participants_user_id_idx 
  ON public.conversation_participants(user_id);

-- ============================================
-- TABELA: messages (Mensagens - APENAS para ADMINS)
-- ============================================
DROP TABLE IF EXISTS public.messages CASCADE;
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cipher_text TEXT NOT NULL, -- Mensagem criptografada (base64)
  nonce TEXT NOT NULL, -- Nonce para descriptografia (base64)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para messages
CREATE INDEX messages_conversation_id_idx ON public.messages(conversation_id);
CREATE INDEX messages_sender_id_idx ON public.messages(sender_id);
CREATE INDEX messages_created_at_idx ON public.messages(created_at DESC);

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

-- Triggers para atualizar updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HABILITAR RLS
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS: profiles
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view other profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Usuários podem ver seu próprio perfil
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

-- Usuários podem ver outros perfis (para criar conversas)
CREATE POLICY "Users can view other profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Usuários podem criar seu próprio perfil (primeiro login)
CREATE POLICY "Users can create own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Usuários podem atualizar seu próprio perfil
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================
-- POLÍTICAS: conversations
-- ============================================
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.conversations;

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

-- Usuários autenticados podem criar conversas
CREATE POLICY "Users can create conversations"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Usuários podem deletar conversas das quais participam
CREATE POLICY "Users can delete own conversations"
  ON public.conversations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversation_participants
      WHERE conversation_id = conversations.id
        AND user_id = auth.uid()
    )
  );

-- ============================================
-- FUNÇÃO AUXILIAR: Verificar se usuário participa de conversa
-- ============================================
CREATE OR REPLACE FUNCTION public.user_is_conversation_participant(
  check_conversation_id UUID,
  check_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = check_conversation_id
      AND user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.user_is_conversation_participant(UUID, UUID) TO authenticated;

-- ============================================
-- POLÍTICAS: conversation_participants
-- ============================================
DROP POLICY IF EXISTS "Users can view participants of own conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add participants to own conversations" ON public.conversation_participants;

-- Usuários podem ver participantes de suas conversas
CREATE POLICY "Users can view participants of own conversations"
  ON public.conversation_participants
  FOR SELECT
  USING (
    public.user_is_conversation_participant(conversation_id, auth.uid())
  );

-- Usuários podem adicionar participantes
CREATE POLICY "Users can add participants to own conversations"
  ON public.conversation_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR
    public.user_is_conversation_participant(conversation_id, auth.uid())
  );

-- ============================================
-- POLÍTICAS: messages (TODOS OS PARTICIPANTES)
-- ============================================
-- Mudança: Todos os participantes podem ver e inserir mensagens
-- As mensagens são criptografadas E2EE, então mesmo no banco estão seguras
DROP POLICY IF EXISTS "Users can view messages from own conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages to own conversations" ON public.messages;

-- Participantes podem ver mensagens de suas conversas
CREATE POLICY "Users can view messages from own conversations"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversation_participants
      WHERE conversation_id = messages.conversation_id
        AND user_id = auth.uid()
    )
  );

-- Participantes podem inserir mensagens em suas conversas
CREATE POLICY "Users can insert messages to own conversations"
  ON public.messages
  FOR INSERT
  TO authenticated
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
-- FUNÇÃO: Criar conversa com participantes (bypassa RLS)
-- ============================================
CREATE OR REPLACE FUNCTION public.create_conversation_with_participants(
  participant_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  new_conversation_id UUID;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  -- Criar conversa
  INSERT INTO public.conversations DEFAULT VALUES
  RETURNING id INTO new_conversation_id;
  
  -- Adicionar participantes
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES 
    (new_conversation_id, current_user_id),
    (new_conversation_id, participant_user_id);
  
  RETURN new_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.create_conversation_with_participants(UUID) TO authenticated;

-- ============================================
-- FUNÇÃO: Buscar usuários por email
-- ============================================
-- Remover função antiga se existir (pode ter assinatura diferente)
DROP FUNCTION IF EXISTS public.search_users_by_email(TEXT);

CREATE OR REPLACE FUNCTION public.search_users_by_email(search_email TEXT)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  public_key TEXT,
  role TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.display_name,
    p.email,
    p.avatar_url,
    p.public_key,
    p.role
  FROM public.profiles p
  WHERE p.email ILIKE '%' || search_email || '%'
    AND p.id != auth.uid()
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.search_users_by_email(TEXT) TO authenticated;

-- ============================================
-- COMENTÁRIOS FINAIS
-- ============================================
-- Após executar este script:
-- 1. Configure Google OAuth no Supabase Dashboard
-- 2. Adicione as URLs de callback nas configurações do Google
-- 3. Defina alguns usuários como admin manualmente:
--    UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@example.com';
-- 4. Teste a aplicação
-- ============================================

