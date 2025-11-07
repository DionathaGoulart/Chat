-- ============================================
-- CORRIGIR POLÍTICAS DE MENSAGENS
-- Permite que todos os participantes vejam e insiram mensagens
-- Execute este script no Supabase SQL Editor
-- ============================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Admins can view messages" ON public.messages;
DROP POLICY IF EXISTS "Admins can insert messages" ON public.messages;
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

-- Verificar se as políticas foram criadas
SELECT 
  'POLÍTICAS CRIADAS' as info,
  schemaname,
  tablename,
  policyname
FROM pg_policies
WHERE tablename = 'messages'
ORDER BY policyname;

