-- ============================================
-- FUNÇÃO RPC PARA INSERIR CHAVES DE CONVERSA
-- Bypassa RLS para permitir inserir chaves para todos os participantes
-- Execute este script no Supabase SQL Editor
-- ============================================

-- Função para inserir chaves de conversa para múltiplos participantes
-- Recebe um array JSON com {user_id, encrypted_key}
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

-- Verificar se a função foi criada
SELECT 
  'FUNÇÃO CRIADA' as info,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'insert_conversation_keys';

