-- ============================================
-- CORREÇÃO DE POLÍTICAS RLS PARA CONVERSAS
-- Execute este script no Supabase SQL Editor
-- ============================================

-- Remover política antiga de conversations
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;

-- Criar nova política que permite usuários autenticados criarem conversas
-- TO authenticated já garante que o usuário está autenticado
CREATE POLICY "Users can create conversations"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Remover política antiga de conversation_participants
DROP POLICY IF EXISTS "Users can add participants to own conversations" ON public.conversation_participants;

-- Criar nova política que permite:
-- 1. Adicionar a si mesmo (para criar nova conversa)
-- 2. Adicionar outros se já é participante
-- Usa a função auxiliar para evitar recursão infinita
CREATE POLICY "Users can add participants to own conversations"
  ON public.conversation_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Permite adicionar a si mesmo (criação de nova conversa)
    user_id = auth.uid()
    OR
    -- OU permite adicionar outros se já é participante (adicionar mais pessoas)
    -- Usa função SECURITY DEFINER para evitar recursão
    public.user_is_conversation_participant(conversation_id, auth.uid())
  );

-- Verificar se as políticas foram criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('conversations', 'conversation_participants')
  AND policyname LIKE '%conversation%'
ORDER BY tablename, policyname;

