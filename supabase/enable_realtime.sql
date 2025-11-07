-- ============================================
-- HABILITAR REALTIME PARA MENSAGENS
-- Execute este script no Supabase SQL Editor
-- ============================================

-- Habilitar Realtime para a tabela messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Verificar se foi habilitado
SELECT 
  'REALTIME HABILITADO' as info,
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'messages';

