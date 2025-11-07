/**
 * Hook para gerenciar mensagens de uma conversa
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabase/client';
import { decryptMessageWithConversationKey } from '../crypto/encryption';
import { getPrivateKey } from '../crypto/storage';
import { decryptConversationKey } from '../crypto/keys';
import type { Message } from '@/types/chat';
import { useAuth } from './useAuth';

export function useMessages(conversationId: string | null) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  // Cache da chave de conversa descriptografada (para evitar descriptografar toda vez)
  const [conversationKeyCache, setConversationKeyCache] = useState<string | null>(null);

  /**
   * Busca e descriptografa a chave da conversa
   */
  const getConversationKey = useCallback(async (): Promise<string | null> => {
    if (!conversationId || !user || !profile) return null;
    
    // Se já está em cache, retornar
    if (conversationKeyCache) {
      return conversationKeyCache;
    }

    try {
      // Buscar chave criptografada da conversa para este usuário
      const { data: keyData, error: keyError } = await supabase
        .from('conversation_keys')
        .select('encrypted_key')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (keyError || !keyData) {
        console.warn('Chave de conversa não encontrada:', keyError);
        return null;
      }

      // Buscar chave privada do usuário
      const privateKey = await getPrivateKey(user.id);
      if (!privateKey) {
        console.warn('Chave privada não encontrada para descriptografar chave de conversa');
        return null;
      }

      // Descriptografar a chave da conversa
      const conversationKey = await decryptConversationKey(
        keyData.encrypted_key,
        privateKey,
        profile.public_key!
      );

      // Armazenar em cache
      setConversationKeyCache(conversationKey);
      return conversationKey;
    } catch (err) {
      console.error('Erro ao buscar/descriptografar chave de conversa:', err);
      return null;
    }
  }, [conversationId, user, profile?.public_key]);

  const decryptMessages = useCallback(
    async (encryptedMessages: Message[]) => {
      if (!user || !profile || !conversationId) return encryptedMessages;

      // Buscar chave da conversa
      const conversationKey = await getConversationKey();
      if (!conversationKey) {
        console.warn('Chave de conversa não disponível');
        return encryptedMessages.map((msg) => ({
          ...msg,
          decrypted_text: '[Chave de conversa não disponível]',
        }));
      }

      setDecrypting(true);

      try {
        const decryptedMessages = await Promise.all(
          encryptedMessages.map(async (msg) => {
            // Se já foi descriptografado, não descriptografar novamente
            if (msg.decrypted_text) {
              return msg;
            }

            try {
              // Descriptografar usando a chave da conversa
              const decryptedText = await decryptMessageWithConversationKey(
                {
                  cipherText: msg.cipher_text,
                  nonce: msg.nonce,
                },
                conversationKey
              );

              return {
                ...msg,
                decrypted_text: decryptedText,
              };
            } catch (err) {
              console.error('Erro ao descriptografar mensagem:', err, {
                messageId: msg.id,
                senderId: msg.sender_id,
              });
              return { ...msg, decrypted_text: '[Erro ao descriptografar]' } as Message;
            }
          })
        );

        return decryptedMessages;
      } finally {
        setDecrypting(false);
      }
    },
    [user, profile, conversationId, getConversationKey]
  );

  useEffect(() => {
    if (!conversationId || !user) {
      setMessages([]);
      setLoading(false);
      setConversationKeyCache(null); // Limpar cache quando mudar de conversa
      return;
    }

    // Limpar cache quando mudar de conversa
    setConversationKeyCache(null);
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

          // Descriptografar a nova mensagem usando a chave da conversa
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
      // Buscar chave da conversa (descriptografada)
      const conversationKey = await getConversationKey();
      if (!conversationKey) {
        setError('Chave de conversa não encontrada. A conversa pode não ter sido configurada corretamente.');
        return false;
      }

      // Criptografar mensagem usando a chave da conversa
      const { encryptMessageWithConversationKey } = await import('../crypto/encryption');
      const encrypted = await encryptMessageWithConversationKey(text, conversationKey);
      
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

