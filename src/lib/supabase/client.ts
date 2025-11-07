/**
 * Cliente Supabase para uso no cliente (browser)
 */

import { createBrowserClient } from '@supabase/ssr';
import { Database } from './types';

export function createSupabaseClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export const supabase = createSupabaseClient();


