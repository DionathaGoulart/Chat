-- ============================================
-- ADICIONAR TABELA DE CHAVES DE CONVERSA
-- Execute este script no Supabase SQL Editor
-- ============================================

-- Criar tabela de chaves de conversa
CREATE TABLE IF NOT EXISTS public.conversation_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  encrypted_key TEXT NOT NULL, -- Chave da conversa criptografada com crypto_box_seal (base64) - inclui nonce
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- Índices para conversation_keys
CREATE INDEX IF NOT EXISTS conversation_keys_conversation_id_idx 
  ON public.conversation_keys(conversation_id);
CREATE INDEX IF NOT EXISTS conversation_keys_user_id_idx 
  ON public.conversation_keys(user_id);

-- Habilitar RLS
ALTER TABLE public.conversation_keys ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes antes de criar novas
DROP POLICY IF EXISTS "Users can view own conversation keys" ON public.conversation_keys;
DROP POLICY IF EXISTS "Users can insert own conversation keys" ON public.conversation_keys;

-- Usuários podem ver suas próprias chaves de conversa
CREATE POLICY "Users can view own conversation keys"
  ON public.conversation_keys
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.conversation_participants
      WHERE conversation_id = conversation_keys.conversation_id
        AND user_id = auth.uid()
    )
  );

-- Usuários podem inserir suas próprias chaves de conversa
CREATE POLICY "Users can insert own conversation keys"
  ON public.conversation_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.conversation_participants
      WHERE conversation_id = conversation_keys.conversation_id
        AND user_id = auth.uid()
    )
  );

-- Verificar se a tabela foi criada
SELECT 
  'TABELA CRIADA' as info,
  tablename,
  schemaname
FROM pg_tables
WHERE tablename = 'conversation_keys'
  AND schemaname = 'public';

