/**
 * Hook para gerenciar conversas do usuário
 */

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import type { Conversation } from '@/types/chat';
import { useAuth } from './useAuth';

export function useConversations() {
  const { user } = useAuth();
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
    if (!user) return null;

    try {
      // Verificar se já existe conversa entre os dois usuários
      const existingResult = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);
      
      const existingParticipants = existingResult.data as Array<{ conversation_id: string }> | null;

      if (existingParticipants && existingParticipants.length > 0) {
        const conversationIds = existingParticipants.map((p) => p.conversation_id);

        const existingConvResult = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .in('conversation_id', conversationIds)
          .eq('user_id', participantId)
          .maybeSingle();
        
        const existingConv = existingConvResult.data as { conversation_id: string } | null;

        if (existingConv) {
          // Conversa já existe, retornar ela
          const { data: conv } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', existingConv.conversation_id)
            .single();

          if (conv) {
            await loadConversations();
            return conv as Conversation;
          }
        }
      }

      // Criar nova conversa
      const newConvResult = await supabase
        .from('conversations')
        // @ts-expect-error - TypeScript tem problemas com tipos do Supabase aqui
        .insert({})
        .select()
        .single();
      
      const newConversation = newConvResult.data as { id: string } | null;
      const convError = newConvResult.error;

      if (convError || !newConversation) throw convError || new Error('Erro ao criar conversa');

      // Adicionar participantes
      const participantResult = await supabase
        .from('conversation_participants')
        // @ts-expect-error - TypeScript tem problemas com tipos do Supabase aqui
        .insert([
          { conversation_id: newConversation.id, user_id: user.id },
          { conversation_id: newConversation.id, user_id: participantId },
        ]);
      
      const participantError = participantResult.error;

      if (participantError) throw participantError;

      await loadConversations();

      return newConversation as Conversation;
    } catch (err) {
      console.error('Erro ao criar conversa:', err);
      setError((err as Error).message);
      return null;
    }
  }

  return {
    conversations,
    loading,
    error,
    createConversation,
    refresh: loadConversations,
  };
}

