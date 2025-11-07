-- ============================================
-- CORREÇÃO ROBUSTA DE POLÍTICAS RLS PARA CONVERSAS
-- Execute este script no Supabase SQL Editor
-- ============================================

-- 1. Verificar status atual das políticas
SELECT 
  'POLÍTICAS ATUAIS DE CONVERSATIONS' as info,
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  with_check
FROM pg_policies
WHERE tablename = 'conversations'
ORDER BY policyname;

SELECT 
  'POLÍTICAS ATUAIS DE CONVERSATION_PARTICIPANTS' as info,
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  with_check
FROM pg_policies
WHERE tablename = 'conversation_participants'
ORDER BY policyname;

-- 2. Verificar se RLS está habilitado
SELECT 
  'STATUS RLS' as info,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('conversations', 'conversation_participants');

-- 3. REMOVER TODAS as políticas existentes (para garantir limpeza)
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Remover políticas de conversations
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'conversations' AND schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.conversations', r.policyname);
    RAISE NOTICE 'Removida política: %', r.policyname;
  END LOOP;
  
  -- Remover políticas de conversation_participants relacionadas
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'conversation_participants' AND schemaname = 'public' AND policyname LIKE '%conversation%') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.conversation_participants', r.policyname);
    RAISE NOTICE 'Removida política: %', r.policyname;
  END LOOP;
END $$;

-- 4. Garantir que RLS está habilitado
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- 5. Criar política para SELECT em conversations (se não existir)
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
CREATE POLICY "Users can view own conversations"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversation_participants
      WHERE conversation_id = conversations.id
        AND user_id = auth.uid()
    )
  );

-- 6. Criar política para INSERT em conversations (PERMITE QUALQUER USUÁRIO AUTENTICADO)
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 7. Criar política para SELECT em conversation_participants (se não existir)
DROP POLICY IF EXISTS "Users can view participants of own conversations" ON public.conversation_participants;
CREATE POLICY "Users can view participants of own conversations"
  ON public.conversation_participants
  FOR SELECT
  TO authenticated
  USING (
    public.user_is_conversation_participant(conversation_id, auth.uid())
  );

-- 8. Criar política para INSERT em conversation_participants
DROP POLICY IF EXISTS "Users can add participants to own conversations" ON public.conversation_participants;
CREATE POLICY "Users can add participants to own conversations"
  ON public.conversation_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Permite adicionar a si mesmo (criação de nova conversa)
    user_id = auth.uid()
    OR
    -- OU permite adicionar outros se já é participante
    public.user_is_conversation_participant(conversation_id, auth.uid())
  );

-- 9. Verificar políticas criadas
SELECT 
  'POLÍTICAS CRIADAS - CONVERSATIONS' as info,
  policyname,
  cmd,
  roles,
  with_check
FROM pg_policies
WHERE tablename = 'conversations'
ORDER BY policyname;

SELECT 
  'POLÍTICAS CRIADAS - CONVERSATION_PARTICIPANTS' as info,
  policyname,
  cmd,
  roles,
  with_check
FROM pg_policies
WHERE tablename = 'conversation_participants'
ORDER BY policyname;

-- 10. Criar função SECURITY DEFINER para criar conversas (bypassa RLS)
-- Esta é uma solução alternativa caso as políticas RLS não funcionem
-- NOTA: Esta função apenas cria a conversa e participantes
-- A chave de conversa será gerada no cliente
CREATE OR REPLACE FUNCTION public.create_conversation_with_participants(
  participant_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  new_conversation_id UUID;
  current_user_id UUID;
BEGIN
  -- Obter ID do usuário atual
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  -- Criar conversa (bypassa RLS porque é SECURITY DEFINER)
  INSERT INTO public.conversations DEFAULT VALUES
  RETURNING id INTO new_conversation_id;
  
  -- Adicionar participantes (bypassa RLS)
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES 
    (new_conversation_id, current_user_id),
    (new_conversation_id, participant_user_id);
  
  RETURN new_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Dar permissão para usuários autenticados usarem a função
GRANT EXECUTE ON FUNCTION public.create_conversation_with_participants(UUID) TO authenticated;

-- 12. Criar função para inserir chaves de conversa (bypassa RLS)
CREATE OR REPLACE FUNCTION public.insert_conversation_keys(
  p_conversation_id UUID,
  p_keys JSONB -- Array de objetos: [{"user_id": "...", "encrypted_key": "..."}, ...]
)
RETURNS VOID AS $$
DECLARE
  key_item JSONB;
BEGIN
  -- Verificar se o usuário atual é participante da conversa
  IF NOT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Usuário não é participante desta conversa';
  END IF;

  -- Inserir cada chave (bypassa RLS porque é SECURITY DEFINER)
  FOR key_item IN SELECT * FROM jsonb_array_elements(p_keys)
  LOOP
    INSERT INTO public.conversation_keys (
      conversation_id,
      user_id,
      encrypted_key
    )
    VALUES (
      p_conversation_id,
      (key_item->>'user_id')::UUID,
      key_item->>'encrypted_key'
    )
    ON CONFLICT (conversation_id, user_id) 
    DO UPDATE SET encrypted_key = EXCLUDED.encrypted_key;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Dar permissão para usuários autenticados usarem a função
GRANT EXECUTE ON FUNCTION public.insert_conversation_keys(UUID, JSONB) TO authenticated;

-- 11. Teste: Verificar se auth.uid() funciona
SELECT 
  'TESTE AUTH' as info,
  auth.uid() as current_user_id,
  CASE 
    WHEN auth.uid() IS NOT NULL THEN 'Usuário autenticado'
    ELSE 'Usuário NÃO autenticado'
  END as auth_status;

