/**
 * API Route para configurar chaves E2EE após primeiro login
 * Gera chaves no cliente e salva a chave privada localmente
 * Apenas a chave pública é enviada ao servidor
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { publicKey } = body;

    if (!publicKey || typeof publicKey !== 'string') {
      return NextResponse.json(
        { error: 'Chave pública é obrigatória' },
        { status: 400 }
      );
    }

    // Verificar se o perfil já existe e se já tem chave pública válida
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('public_key')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: 'Erro ao verificar perfil: ' + profileError.message },
        { status: 500 }
      );
    }

    // Se já tem uma chave pública válida, permitir atualizar (usuário pode estar gerando nova chave)
    // Mas logar para debug
    if (existingProfile && 'public_key' in existingProfile) {
      const existingPublicKey = (existingProfile as { public_key: string | null }).public_key;
      if (existingPublicKey && typeof existingPublicKey === 'string' && existingPublicKey.trim() !== '') {
        console.log('⚠️ Atualizando chave pública existente (usuário está gerando nova chave)');
        // Continuar para atualizar a chave
      }
    }

    // Atualizar perfil com a chave pública
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      // @ts-expect-error - TypeScript tem problemas com tipos do Supabase aqui
      .update({ public_key: publicKey })
      .eq('id', session.user.id)
      .select('public_key')
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao atualizar chave pública: ' + updateError.message },
        { status: 500 }
      );
    }

    // Se a atualização foi bem-sucedida, usar a chave que acabamos de salvar
    // (não precisamos verificar updatedProfile já que sabemos que foi atualizado)
    return NextResponse.json({
      message: 'Chave pública salva com sucesso',
      publicKey: publicKey,
    });
  } catch (error) {
    console.error('Erro na API de setup de chaves:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

