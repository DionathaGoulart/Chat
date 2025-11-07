/**
 * Middleware do Next.js para proteger rotas e gerenciar autenticação
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Atualizar sessão
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;

  // Rotas públicas
  const publicPaths = ['/login', '/auth/callback'];
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

/**
 * Obtém a URL base correta do request, usando o header Host para evitar problemas com 0.0.0.0
 */
function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host');
  const protocol = request.headers.get('x-forwarded-proto') || 
                   (request.url.startsWith('https') ? 'https' : 'http');
  
  if (host) {
    return `${protocol}://${host}`;
  }
  
  // Fallback: usar origin do request, mas substituir 0.0.0.0 por localhost
  const origin = new URL(request.url).origin;
  if (origin.includes('0.0.0.0')) {
    return origin.replace('0.0.0.0', 'localhost');
  }
  
  return origin;
}

  // Se está tentando acessar rota protegida sem autenticação
  if (!session && !isPublicPath) {
    // Usar função auxiliar para obter URL base correta
    const baseUrl = getBaseUrl(request);
    const redirectUrl = new URL('/login', baseUrl);
    redirectUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Se está autenticado e tentando acessar login, redirecionar para dashboard
  if (session && pathname === '/login') {
    const baseUrl = getBaseUrl(request);
    return NextResponse.redirect(new URL('/dashboard', baseUrl));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

