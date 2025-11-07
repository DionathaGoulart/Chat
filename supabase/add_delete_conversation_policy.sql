-- ============================================
-- ADICIONAR POLÍTICA RLS PARA DELETAR CONVERSAS
-- Execute este script no Supabase SQL Editor
-- ============================================

-- Usuários podem deletar conversas das quais participam
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.conversations;
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

-- Verificar se a política foi criada
SELECT 
  'POLÍTICA CRIADA' as info,
  schemaname,
  tablename,
  policyname
FROM pg_policies
WHERE tablename = 'conversations'
  AND policyname = 'Users can delete own conversations';

