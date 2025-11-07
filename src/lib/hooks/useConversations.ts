/**
 * Hook para gerenciar conversas do usuário
 */

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import type { Conversation } from '@/types/chat';
import { useAuth } from './useAuth';
import { generateConversationKey, encryptConversationKey } from '../crypto/keys';
import { getPrivateKey } from '../crypto/storage';

export function useConversations() {
  const { user, profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    loadConversations();

    // Inscrever-se em mudanças em tempo real
    const channel = supabase
      .channel('conversations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          loadConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function loadConversations() {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Buscar conversas do usuário
      const result = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);
      
      const participantData = result.data as Array<{ conversation_id: string }> | null;
      const participantError = result.error;

      if (participantError) throw participantError;

      if (!participantData || participantData.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const conversationIds = participantData.map((p) => p.conversation_id);

      // Buscar detalhes das conversas
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select('*')
        .in('id', conversationIds)
        .order('updated_at', { ascending: false });

      if (conversationsError) throw conversationsError;

      // Buscar participantes de cada conversa
      const conversationsWithParticipants = await Promise.all(
        (conversationsData || []).map(async (conv: any) => {
          const { data: participants } = await supabase
            .from('conversation_participants')
            .select(`
              *,
              profile:profiles(*)
            `)
            .eq('conversation_id', conv.id);

          // Buscar última mensagem
          const lastMessageResult = await supabase
            .from('messages')
            .select(`
              *,
              sender:profiles(*)
            `)
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          const lastMessageData = lastMessageResult.data;

          const lastMessage = lastMessageData || undefined;

          return {
            ...conv,
            participants: participants || [],
            last_message: lastMessage || undefined,
          } as Conversation;
        })
      );

      setConversations(conversationsWithParticipants);
    } catch (err) {
      console.error('Erro ao carregar conversas:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function createConversation(participantId: string): Promise<Conversation | null> {
    if (!user) {
      console.error('❌ createConversation: usuário não autenticado');
      return null;
    }

    console.log('🔄 Criando conversa com participante:', participantId);

    try {
      // Verificar se já existe conversa entre os dois usuários
      console.log('🔍 Verificando se já existe conversa...');
      const existingResult = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);
      
      if (existingResult.error) {
        console.error('❌ Erro ao buscar conversas existentes:', existingResult.error);
        throw existingResult.error;
      }

      const existingParticipants = existingResult.data as Array<{ conversation_id: string }> | null;
      console.log('📋 Conversas existentes do usuário:', existingParticipants?.length || 0);

      if (existingParticipants && existingParticipants.length > 0) {
        const conversationIds = existingParticipants.map((p) => p.conversation_id);

        const existingConvResult = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .in('conversation_id', conversationIds)
          .eq('user_id', participantId)
          .maybeSingle();
        
        if (existingConvResult.error) {
          console.error('❌ Erro ao verificar conversa existente:', existingConvResult.error);
          throw existingConvResult.error;
        }

        const existingConv = existingConvResult.data as { conversation_id: string } | null;

        if (existingConv) {
          console.log('✅ Conversa já existe:', existingConv.conversation_id);
          // Conversa já existe, retornar ela
          const { data: conv, error: convError } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', existingConv.conversation_id)
            .single();

          if (convError) {
            console.error('❌ Erro ao buscar conversa existente:', convError);
            throw convError;
          }

          if (conv) {
            await loadConversations();
            return conv as Conversation;
          }
        }
      }

      // Criar nova conversa usando função RPC (bypassa RLS)
      console.log('➕ Criando nova conversa usando função RPC...');
      
      // Debug: Verificar autenticação
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('🔐 Status de autenticação:', {
        hasSession: !!session,
        userId: session?.user?.id,
        sessionError: sessionError?.message,
      });
      
      if (!session) {
        throw new Error('Usuário não autenticado');
      }
      
      // Tentar usar função RPC primeiro (bypassa RLS)
      try {
        // @ts-expect-error - TypeScript tem problemas com tipos do RPC do Supabase
        const { data: conversationId, error: rpcError } = await supabase.rpc(
          'create_conversation_with_participants',
          { participant_user_id: participantId }
        );

        if (rpcError) {
          console.warn('⚠️ Função RPC não disponível, tentando método direto:', rpcError);
          throw rpcError; // Vai para o catch e tenta método direto
        }

        if (!conversationId) {
          throw new Error('Função RPC retornou null');
        }

        console.log('✅ Conversa criada via RPC:', conversationId);
        
        // Buscar a conversa criada
        const { data: conv, error: fetchError } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', conversationId)
          .single();

        if (fetchError || !conv) {
          throw fetchError || new Error('Erro ao buscar conversa criada');
        }

        // Trocar chaves públicas entre participantes (nova arquitetura simplificada)
        console.log('🔑 Trocando chaves públicas entre participantes...');
        const { savePeerPublicKey } = await import('../storage/conversationKeys');
        
        // Buscar participantes com perfis
        const { data: allParticipants } = await supabase
          .from('conversation_participants')
          .select(`
            user_id,
            profile:profiles(public_key)
          `)
          .eq('conversation_id', conversationId);
        
        if (allParticipants) {
          // Encontrar o outro participante
          const otherParticipant = allParticipants.find((p: any) => p.user_id !== user.id);
          if (otherParticipant?.profile?.public_key) {
            // Salvar chave pública do outro participante no localStorage
            savePeerPublicKey(conversationId, otherParticipant.user_id, otherParticipant.profile.public_key);
            console.log('✅ Chave pública do outro participante salva no localStorage');
          } else {
            console.warn('⚠️ Chave pública do outro participante não encontrada');
          }
        }
        
        await loadConversations();
        return conv as Conversation;
      } catch (rpcError) {
        // Se função RPC não existe ou falhou, tentar método direto
        console.log('🔄 Tentando método direto (pode falhar se RLS estiver bloqueando)...');
        
        const newConvResult = await supabase
          .from('conversations')
          // @ts-expect-error - TypeScript tem problemas com tipos do Supabase aqui
          .insert({})
          .select()
          .single();
        
        const newConversation = newConvResult.data as { id: string } | null;
        const convError = newConvResult.error;

        if (convError) {
          console.error('❌ Erro ao criar conversa:', convError);
          throw new Error(`Erro ao criar conversa. Execute o script SQL fix_conversations_policy_robust.sql no Supabase para criar a função RPC. Erro: ${convError.message}`);
        }

        if (!newConversation) {
          console.error('❌ Conversa criada mas sem ID');
          throw new Error('Erro ao criar conversa: ID não retornado');
        }

        console.log('✅ Conversa criada:', newConversation.id);

        // Adicionar participantes
        console.log('👥 Adicionando participantes...');
        
        // 1. Adicionar o usuário atual primeiro
        const selfParticipantResult = await supabase
          .from('conversation_participants')
          // @ts-expect-error - TypeScript tem problemas com tipos do Supabase aqui
          .insert({ conversation_id: newConversation.id, user_id: user.id });
        
        if (selfParticipantResult.error) {
          console.error('❌ Erro ao adicionar participante (usuário atual):', selfParticipantResult.error);
          throw selfParticipantResult.error;
        }
        
        console.log('✅ Usuário atual adicionado como participante');

        // 2. Agora adicionar o outro participante
        const otherParticipantResult = await supabase
          .from('conversation_participants')
          // @ts-expect-error - TypeScript tem problemas com tipos do Supabase aqui
          .insert({ conversation_id: newConversation.id, user_id: participantId });
        
        if (otherParticipantResult.error) {
          console.error('❌ Erro ao adicionar participante (outro usuário):', otherParticipantResult.error);
          throw otherParticipantResult.error;
        }

        console.log('✅ Participantes adicionados com sucesso');
        
        // Trocar chaves públicas entre participantes (nova arquitetura simplificada)
        console.log('🔑 Trocando chaves públicas entre participantes...');
        const { savePeerPublicKey } = await import('../storage/conversationKeys');
        
        // Buscar chave pública do outro participante
        const { data: otherProfile } = await supabase
          .from('profiles')
          .select('public_key')
          .eq('id', participantId)
          .single();
        
        if (otherProfile?.public_key) {
          // Salvar chave pública do outro participante no localStorage
          savePeerPublicKey(newConversation.id, participantId, otherProfile.public_key);
          console.log('✅ Chave pública do outro participante salva no localStorage');
        } else {
          console.warn('⚠️ Chave pública do outro participante não encontrada');
        }
        
        await loadConversations();
        console.log('✅ Conversa criada e carregada com sucesso');

        return newConversation as Conversation;
      }
    } catch (err) {
      console.error('❌ Erro ao criar conversa:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao criar conversa';
      setError(errorMessage);
      return null;
    }
  }

  /**
   * Configura a chave de conversa para uma conversa
   * Gera uma chave simétrica e a criptografa para cada participante
   */
  async function setupConversationKey(conversationId: string, participantIds: string[]): Promise<void> {
    if (!user || !profile?.public_key) {
      throw new Error('Usuário não autenticado ou sem chave pública');
    }

    try {
      console.log('🔑 Configurando chave de conversa para:', conversationId);
      
      // Verificar se já existe chave para este usuário
      const { data: existingKey } = await supabase
        .from('conversation_keys')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (existingKey) {
        console.log('✅ Chave de conversa já existe para este usuário');
        return;
      }

      // Buscar chaves públicas de todos os participantes
      const { data: participantProfiles } = await supabase
        .from('profiles')
        .select('id, public_key')
        .in('id', participantIds)
        .not('public_key', 'is', null);
      
      if (!participantProfiles || participantProfiles.length === 0) {
        throw new Error('Nenhum participante com chave pública encontrado');
      }

      // Gerar chave simétrica para a conversa
      const conversationKey = await generateConversationKey();
      console.log('✅ Chave de conversa gerada');

      // Criptografar a chave para cada participante
      const keyData = await Promise.all(
        participantProfiles.map(async (participant: { id: string; public_key: string }) => {
          const { encryptedKey } = await encryptConversationKey(
            conversationKey,
            participant.public_key
          );
          
          return {
            user_id: participant.id,
            encrypted_key: encryptedKey,
          };
        })
      );

      // Inserir todas as chaves usando função RPC (bypassa RLS)
      try {
        // @ts-expect-error - TypeScript tem problemas com tipos do RPC do Supabase
        const { error: rpcError } = await supabase.rpc(
          'insert_conversation_keys',
          {
            p_conversation_id: conversationId,
            p_keys: keyData,
          }
        );

        if (rpcError) {
          console.warn('⚠️ Função RPC não disponível, tentando método direto:', rpcError);
          throw rpcError; // Vai para o catch e tenta método direto
        }

        console.log('✅ Chaves de conversa inseridas via RPC');
      } catch (rpcError) {
        // Se função RPC não existe ou falhou, tentar método direto (só para o usuário atual)
        console.log('🔄 Tentando inserir apenas chave do usuário atual...');
        
        const currentUserKey = keyData.find((k) => k.user_id === user.id);
        if (currentUserKey) {
          const { error: insertError } = await supabase
            .from('conversation_keys')
            // @ts-expect-error - TypeScript tem problemas com tipos do Supabase aqui
            .insert({
              conversation_id: conversationId,
              user_id: currentUserKey.user_id,
              encrypted_key: currentUserKey.encrypted_key,
            });

          if (insertError) {
            console.error('❌ Erro ao inserir chave de conversa:', insertError);
            throw insertError;
          }

          console.log('✅ Chave de conversa inserida para o usuário atual (outros participantes precisarão inserir suas chaves)');
        } else {
          throw new Error('Chave do usuário atual não encontrada');
        }
      }

      console.log('✅ Chaves de conversa configuradas para todos os participantes');
    } catch (err) {
      console.error('❌ Erro ao configurar chave de conversa:', err);
      throw err;
    }
  }

  async function deleteConversation(conversationId: string): Promise<boolean> {
    if (!user) {
      console.error('❌ deleteConversation: usuário não autenticado');
      return false;
    }

    console.log('🗑️ Deletando conversa:', conversationId);

    try {
      // Verificar se o usuário é participante da conversa
      const { data: participant, error: participantError } = await supabase
        .from('conversation_participants')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (participantError) {
        console.error('❌ Erro ao verificar participante:', participantError);
        throw participantError;
      }

      if (!participant) {
        console.error('❌ Usuário não é participante desta conversa');
        throw new Error('Você não tem permissão para deletar esta conversa');
      }

      // Deletar a conversa (cascade vai deletar participantes, mensagens e chaves)
      const { error: deleteError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (deleteError) {
        console.error('❌ Erro ao deletar conversa:', deleteError);
        throw deleteError;
      }

      console.log('✅ Conversa deletada com sucesso');
      
      // Recarregar lista de conversas
      await loadConversations();
      
      return true;
    } catch (err) {
      console.error('❌ Erro ao deletar conversa:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao deletar conversa';
      setError(errorMessage);
      return false;
    }
  }

  return {
    conversations,
    loading,
    error,
    createConversation,
    deleteConversation,
    refresh: loadConversations,
  };
}

