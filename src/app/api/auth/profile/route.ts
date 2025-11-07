/**
 * API Route para buscar o perfil do usuário atual
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    // Verificar autenticação
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Buscar perfil
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.error('Erro ao buscar perfil:', {
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
      });
      
      if (profileError.code === 'PGRST116') {
        // Perfil não encontrado - retornar 404 (cliente deve criar)
        return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 });
      }
      
      // Retornar erro detalhado para debug
      return NextResponse.json(
        { 
          error: 'Erro ao buscar perfil',
          details: profileError.message,
          code: profileError.code 
        },
        { status: 500 }
      );
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Erro na API de perfil:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

