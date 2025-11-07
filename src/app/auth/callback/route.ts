/**
 * Route Handler para callback do OAuth
 * Processa o retorno do Google OAuth e cria/atualiza o perfil do usuário
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createOrUpdateUserProfile } from '@/lib/auth/profile';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/dashboard';

  if (code) {
    const supabase = await createSupabaseServerClient();

    // Trocar código por sessão
    const { data: { session }, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

    if (sessionError || !session?.user) {
      console.error('Erro ao trocar código por sessão:', sessionError);
      return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
    }

    const user = session.user;
    const email = user.email;
    const displayName = user.user_metadata?.full_name || user.user_metadata?.name || email?.split('@')[0] || 'Usuário';
    const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

    if (!email) {
      return NextResponse.redirect(new URL('/login?error=no_email', request.url));
    }

    try {
      // Criar ou atualizar perfil do usuário
      // As chaves E2EE serão geradas no cliente (não no servidor)
      const { isNewUser } = await createOrUpdateUserProfile(
        user.id,
        email,
        displayName,
        avatarUrl
      );

      // Redirecionar para o dashboard
      // O cliente verificará se precisa gerar e salvar as chaves E2EE
      return NextResponse.redirect(new URL(`${next}?new_user=${isNewUser}`, request.url));
    } catch (error) {
      console.error('Erro ao criar/atualizar perfil:', error);
      return NextResponse.redirect(new URL('/login?error=profile_creation_failed', request.url));
    }
  }

  // Se não há código, redirecionar para login
  return NextResponse.redirect(new URL('/login', request.url));
}

