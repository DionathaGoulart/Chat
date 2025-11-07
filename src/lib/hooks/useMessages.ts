/**
 * Hook para gerenciar mensagens de uma conversa
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabase/client';
import { decryptMessage } from '../crypto/encryption';
import { getPrivateKey } from '../crypto/storage';
import type { Message } from '@/types/chat';
import { useAuth } from './useAuth';

export function useMessages(conversationId: string | null) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);

  const decryptMessages = useCallback(
    async (encryptedMessages: Message[]) => {
      if (!user || !profile) return encryptedMessages;

      const privateKey = await getPrivateKey(user.id);
      if (!privateKey) {
        console.warn('Chave privada não encontrada para descriptografar mensagens');
        return encryptedMessages;
      }

      setDecrypting(true);

      try {
        const decryptedMessages = await Promise.all(
          encryptedMessages.map(async (msg) => {
            // Se já foi descriptografado, não descriptografar novamente
            if (msg.decrypted_text) {
              return msg;
            }

            // Buscar chave pública do remetente
            const senderProfileResult = await supabase
              .from('profiles')
              .select('public_key')
              .eq('id', msg.sender_id)
              .maybeSingle();
            
            const senderProfile = senderProfileResult.data as { public_key: string | null } | null;

            if (!senderProfile?.public_key) {
              return { ...msg, decrypted_text: '[Não foi possível descriptografar]' } as Message;
            }

            try {
              const decryptedText = await decryptMessage(
                {
                  cipherText: msg.cipher_text,
                  nonce: msg.nonce,
                },
                senderProfile.public_key,
                privateKey
              );

              return {
                ...msg,
                decrypted_text: decryptedText,
              };
            } catch (err) {
              console.error('Erro ao descriptografar mensagem:', err);
              return { ...msg, decrypted_text: '[Erro ao descriptografar]' } as Message;
            }
          })
        );

        return decryptedMessages;
      } finally {
        setDecrypting(false);
      }
    },
    [user, profile]
  );

  useEffect(() => {
    if (!conversationId || !user) {
      setMessages([]);
      setLoading(false);
      return;
    }

    loadMessages();

    // Inscrever-se em novas mensagens em tempo real
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMessage = payload.new as Message;

          // Buscar perfil do remetente
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newMessage.sender_id)
            .single();

          const messageWithSender: Message = {
            ...newMessage,
            sender: senderProfile || undefined,
          };

          // Descriptografar a nova mensagem
          const decryptedMessages = await decryptMessages([messageWithSender]);
          if (decryptedMessages.length > 0) {
            setMessages((prev) => {
              // Verificar se a mensagem já existe
              const exists = prev.some((m) => m.id === decryptedMessages[0].id);
              if (exists) return prev;
              return [...prev, ...decryptedMessages];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user, decryptMessages]);

  async function loadMessages() {
    if (!conversationId || !user) return;

    try {
      setLoading(true);
      setError(null);

      // Buscar mensagens
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles(*)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      const messagesWithSender = (messagesData || []) as Message[];

      // Descriptografar mensagens
      const decryptedMessages = await decryptMessages(messagesWithSender);

      setMessages(decryptedMessages);
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(text: string): Promise<boolean> {
    if (!conversationId || !user || !profile) {
      setError('Não é possível enviar mensagem');
      return false;
    }

    try {
      // Buscar chave privada
      const privateKey = await getPrivateKey(user.id);
      if (!privateKey) {
        setError('Chave privada não encontrada');
        return false;
      }

      // Buscar participantes da conversa (exceto o remetente)
      const participantsResult = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .neq('user_id', user.id);
      
      const participants = participantsResult.data as Array<{ user_id: string }> | null;

      if (!participants || participants.length === 0) {
        setError('Nenhum destinatário encontrado');
        return false;
      }

      // Buscar chaves públicas dos destinatários
      const recipientIds = participants.map((p) => p.user_id);
      const recipientProfilesResult = await supabase
        .from('profiles')
        .select('id, public_key')
        .in('id', recipientIds)
        .not('public_key', 'is', null);
      
      const recipientProfiles = recipientProfilesResult.data as Array<{ id: string; public_key: string }> | null;

      if (!recipientProfiles || recipientProfiles.length === 0) {
        setError('Nenhum destinatário com chave pública encontrado');
        return false;
      }

      // Criptografar mensagem para cada destinatário
      // Por simplicidade, vamos criptografar para o primeiro destinatário
      // Em uma versão futura, poderíamos criptografar para todos (grupos)
      const recipientPublicKey = recipientProfiles[0].public_key;

      const { encryptMessage } = await import('../crypto/encryption');
      const encrypted = await encryptMessage(text, recipientPublicKey, privateKey);

      // Enviar mensagem criptografada
      // @ts-expect-error - TypeScript tem problemas com tipos do Supabase aqui
      const insertResult = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        cipher_text: encrypted.cipherText,
        nonce: encrypted.nonce,
      });

      if (insertResult.error) throw insertResult.error;

      // Atualizar updated_at da conversa (não crítico se falhar)
      // Fazemos isso de forma assíncrona sem bloquear
      (async () => {
        try {
          await (supabase
            .from('conversations')
            // @ts-ignore - TypeScript tem problemas com tipos do Supabase aqui
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId) as any);
        } catch (err) {
          // Ignorar erros ao atualizar updated_at - não é crítico
        }
      })();

      return true;
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      setError((err as Error).message);
      return false;
    }
  }

  return {
    messages,
    loading,
    error,
    decrypting,
    sendMessage,
    refresh: loadMessages,
  };
}

