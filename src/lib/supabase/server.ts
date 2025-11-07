/**
 * Cliente Supabase para uso no servidor (Server Components, API Routes)
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from './types';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // A chamada `setAll` foi feita de um Server Component.
            // Isso pode ser ignorado se você tiver middleware atualizando cookies.
          }
        },
      },
    }
  );
}


