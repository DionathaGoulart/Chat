/**
 * Route Handler para callback do OAuth
 * Processa o retorno do Google OAuth e cria/atualiza o perfil do usuário
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createOrUpdateUserProfile } from '@/lib/auth/profile';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Obtém a URL base correta do request, usando o header Host para evitar problemas com 0.0.0.0
 */
function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host');
  const protocol = request.headers.get('x-forwarded-proto') || 
                   (request.url.startsWith('https') ? 'https' : 'http');
  
  if (host) {
    // Se o host contém porta, usar diretamente, senão adicionar porta padrão
    const baseUrl = host.includes(':') ? `${protocol}://${host}` : `${protocol}://${host}`;
    return baseUrl;
  }
  
  // Fallback: usar origin do request, mas substituir 0.0.0.0 por localhost
  const origin = new URL(request.url).origin;
  if (origin.includes('0.0.0.0')) {
    return origin.replace('0.0.0.0', 'localhost');
  }
  
  return origin;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/dashboard';

  // Usar função auxiliar para obter URL base correta
  const baseUrl = getBaseUrl(request);
  
  // Log para debug - remover em produção
  console.log('🔄 Callback OAuth recebido:', {
    origin: baseUrl,
    host: request.headers.get('host'),
    fullUrl: request.url,
    code: code ? 'presente' : 'ausente',
  });

  if (code) {
    const supabase = await createSupabaseServerClient();

    // Trocar código por sessão
    const { data: { session }, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

    if (sessionError || !session?.user) {
      console.error('Erro ao trocar código por sessão:', sessionError);
      return NextResponse.redirect(new URL('/login?error=auth_failed', baseUrl));
    }

    const user = session.user;
    const email = user.email;
    const displayName = user.user_metadata?.full_name || user.user_metadata?.name || email?.split('@')[0] || 'Usuário';
    const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

    if (!email) {
      return NextResponse.redirect(new URL('/login?error=no_email', baseUrl));
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

      // Redirecionar para o dashboard mantendo o mesmo host
      // O cliente verificará se precisa gerar e salvar as chaves E2EE
      return NextResponse.redirect(new URL(`${next}?new_user=${isNewUser}`, baseUrl));
    } catch (error) {
      console.error('Erro ao criar/atualizar perfil:', error);
      return NextResponse.redirect(new URL('/login?error=profile_creation_failed', baseUrl));
    }
  }

  // Se não há código, redirecionar para login
  return NextResponse.redirect(new URL('/login', baseUrl));
}

