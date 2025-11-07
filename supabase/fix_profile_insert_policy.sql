-- ============================================
-- CORRIGIR POLÍTICA DE INSERT PARA PROFILES
-- Execute este script no Supabase SQL Editor
-- ============================================

-- Adicionar política para permitir que usuários criem seu próprio perfil
DROP POLICY IF EXISTS "Users can create own profile" ON public.profiles;

CREATE POLICY "Users can create own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Verificar se a política foi criada
SELECT 
  'POLÍTICA CRIADA' as info,
  schemaname,
  tablename,
  policyname
FROM pg_policies
WHERE tablename = 'profiles'
  AND policyname = 'Users can create own profile';

