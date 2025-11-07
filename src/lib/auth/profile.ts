/**
 * Utilitários para gerenciamento de perfis de usuário
 * Cria perfil automaticamente no primeiro login e gera chaves E2EE
 */

import { createSupabaseServerClient } from '../supabase/server';

export interface UserProfile {
  id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  public_key: string | null; // Pode ser null até o cliente gerar as chaves
  role: 'admin' | 'user'; // Cargo do usuário
}

/**
 * Cria ou atualiza o perfil do usuário após autenticação
 * IMPORTANTE: As chaves E2EE são geradas no CLIENTE, não no servidor
 * Esta função apenas cria/atualiza o perfil básico
 */
export async function createOrUpdateUserProfile(
  userId: string,
  email: string,
  displayName: string,
  avatarUrl?: string
): Promise<{ profile: UserProfile; isNewUser: boolean }> {
  const supabase = await createSupabaseServerClient();

  // Verificar se o perfil já existe
  const { data: existingProfile, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    // PGRST116 = nenhuma linha encontrada (ok para primeira vez)
    throw new Error('Erro ao verificar perfil: ' + fetchError.message);
  }

  // Se o perfil já existe, atualizar informações básicas (mas manter chave pública se existir)
  if (existingProfile) {
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      // @ts-expect-error - TypeScript tem problemas com tipos do Supabase aqui
      .update({
        display_name: displayName,
        email: email,
        avatar_url: avatarUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      throw new Error('Erro ao atualizar perfil: ' + updateError.message);
    }

    return {
      profile: updatedProfile as UserProfile,
      isNewUser: false,
    };
  }

  // Novo usuário: criar perfil SEM chave pública
  // A chave pública será gerada no cliente e enviada via API
  // Por padrão, novos usuários são 'user', não 'admin'
  const { data: newProfile, error: insertError } = await supabase
    .from('profiles')
    // @ts-expect-error - TypeScript tem problemas com tipos do Supabase aqui
    .insert({
      id: userId,
      display_name: displayName,
      email: email,
      avatar_url: avatarUrl || null,
      public_key: null, // NULL até o cliente gerar e enviar a chave pública
      role: 'user', // Por padrão, novos usuários são 'user'
    })
    .select()
    .single();

  if (insertError) {
    throw new Error('Erro ao criar perfil: ' + insertError.message);
  }

  return {
    // @ts-expect-error - TypeScript tem problemas com tipos do Supabase aqui
    profile: { ...newProfile, public_key: null } as UserProfile,
    isNewUser: true,
  };
}

/**
 * Obtém o perfil do usuário atual
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Perfil não encontrado
    }
    throw new Error('Erro ao buscar perfil: ' + error.message);
  }

  // Normalizar public_key null/empty para null
  const profile = data as UserProfile;
  if (!profile.public_key || profile.public_key === '') {
    profile.public_key = null;
  }

  return profile;
}

