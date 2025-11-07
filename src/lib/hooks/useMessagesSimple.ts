/**
 * Hook simplificado para gerenciar mensagens
 * - Admins: mensagens no banco de dados
 * - Usuários: mensagens no localStorage
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../supabase/client';
import { encryptMessage, decryptMessage } from '../crypto/encryption';
import { getPrivateKey } from '../crypto/storage';
import { saveMessages, loadMessages, addMessage as addLocalMessage } from '../storage/localMessages';
import { getPeerPublicKey, savePeerPublicKey } from '../storage/conversationKeys';
import { saveSentMessageText, getSentMessageText } from '../storage/sentMessages';
import { generateUUID } from '../utils/uuid';
import type { Message } from '@/types/chat';
import { useAuth } from './useAuth';

export function useMessagesSimple(conversationId: string | null) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const lastMessageCountRef = useRef<number>(0);

  /**
   * Carrega mensagens do banco de dados
   * Todas as mensagens são salvas no banco (criptografadas E2EE)
   */
  const loadMessagesData = useCallback(async () => {
    if (!conversationId || !user) return;

    try {
      setLoading(true);
      setError(null);

      // Todos os usuários carregam do banco agora
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
  }, [conversationId, user]);

  /**
   * Descriptografa mensagens usando a chave pública do remetente
   */
  const decryptMessages = useCallback(async (messagesToDecrypt: Message[]): Promise<Message[]> => {
    if (!user || !profile?.public_key) {
      return messagesToDecrypt;
    }

    const privateKey = await getPrivateKey(user.id);
    if (!privateKey) {
      console.warn('Chave privada não encontrada, não é possível descriptografar');
      return messagesToDecrypt;
    }

    setDecrypting(true);
    try {
      const decrypted = await Promise.all(
        messagesToDecrypt.map(async (msg) => {
          // Se já foi descriptografada, retornar como está
          if (msg.decrypted_text) {
            return msg;
          }

          // Se a mensagem é do próprio usuário, buscar texto original do localStorage
          if (msg.sender_id === user.id) {
            // Se já tem texto descriptografado, usar
            if (msg.decrypted_text && msg.decrypted_text !== '[Mensagem enviada]' && msg.decrypted_text !== '[Você enviou uma mensagem]') {
              return msg;
            }
            
            // Tentar buscar o texto original do localStorage
            const originalText = getSentMessageText(msg.id);
            if (originalText) {
              return { ...msg, decrypted_text: originalText };
            }
            
            // Se não encontrou, marcar como enviada
            return { ...msg, decrypted_text: '[Você enviou uma mensagem]' };
          }

          // Buscar chave pública do remetente
          let senderPublicKey = msg.sender?.public_key;
          
          // Se não tiver no sender, tentar buscar do localStorage
          if (!senderPublicKey || senderPublicKey.trim() === '') {
            senderPublicKey = getPeerPublicKey(conversationId || '', msg.sender_id);
          }
          
          // Se ainda não encontrou, buscar diretamente do banco
          if (!senderPublicKey || senderPublicKey.trim() === '') {
            console.log('🔍 Buscando chave pública do remetente diretamente do banco...');
            const { data: senderProfile } = await supabase
              .from('profiles')
              .select('public_key')
              .eq('id', msg.sender_id)
              .single();
            
            if (senderProfile?.public_key && senderProfile.public_key.trim() !== '') {
              senderPublicKey = senderProfile.public_key;
              // Salvar no localStorage para uso futuro
              if (conversationId) {
                savePeerPublicKey(conversationId, msg.sender_id, senderPublicKey);
              }
            }
          }
          
          if (!senderPublicKey || senderPublicKey.trim() === '') {
            console.error('❌ Chave pública do remetente não encontrada:', {
              senderId: msg.sender_id,
              conversationId: conversationId,
            });
            return { ...msg, decrypted_text: '[Chave pública do remetente não encontrada]' };
          }

          try {
            console.log('🔓 Descriptografando mensagem do remetente:', msg.sender_id);
            const decryptedText = await decryptMessage(
              {
                cipherText: msg.cipher_text,
                nonce: msg.nonce,
              },
              senderPublicKey,
              privateKey
            );

            console.log('✅ Mensagem descriptografada com sucesso');
            return {
              ...msg,
              decrypted_text: decryptedText,
            };
          } catch (decryptError) {
            console.error('❌ Erro ao descriptografar mensagem:', decryptError, {
              senderId: msg.sender_id,
              hasCipherText: !!msg.cipher_text,
              hasNonce: !!msg.nonce,
            });
            return { ...msg, decrypted_text: '[Erro ao descriptografar]' };
          }
        })
      );

      return decrypted;
    } finally {
      setDecrypting(false);
    }
  }, [user, profile]);

  /**
   * Envia uma mensagem
   */
  async function sendMessage(text: string): Promise<boolean> {
    if (!conversationId || !user) {
      setError('Usuário não autenticado');
      return false;
    }

    if (!profile) {
      setError('Perfil não carregado. Aguarde um momento e tente novamente.');
      return false;
    }

    if (!profile.public_key || profile.public_key.trim() === '') {
      setError('Chave pública não encontrada. Por favor, configure suas chaves de criptografia primeiro.');
      console.error('❌ Chave pública não encontrada:', {
        userId: user.id,
        profileId: profile.id,
        hasPublicKey: !!profile.public_key,
      });
      return false;
    }

    try {
      const privateKey = await getPrivateKey(user.id);
      if (!privateKey) {
        setError('Chave privada não encontrada');
        return false;
      }

      // Buscar o outro participante da conversa
      const { data: participants } = await supabase
        .from('conversation_participants')
        .select(`
          *,
          profile:profiles(*)
        `)
        .eq('conversation_id', conversationId);

      if (!participants || participants.length < 2) {
        setError('Conversa não encontrada ou sem participantes');
        return false;
      }

      const otherParticipant = participants.find((p: any) => p.user_id !== user.id);
      if (!otherParticipant) {
        setError('Outro participante não encontrado');
        return false;
      }

      // Obter chave pública do destinatário
      let recipientPublicKey = otherParticipant.profile?.public_key;
      
      // Se não tiver no perfil, tentar buscar do localStorage
      if (!recipientPublicKey || recipientPublicKey.trim() === '') {
        recipientPublicKey = getPeerPublicKey(conversationId, otherParticipant.user_id);
      }

      // Se ainda não encontrou, tentar buscar diretamente do perfil do destinatário
      if (!recipientPublicKey || recipientPublicKey.trim() === '') {
        console.log('🔍 Buscando chave pública do destinatário diretamente do perfil...');
        const { data: recipientProfile } = await supabase
          .from('profiles')
          .select('public_key')
          .eq('id', otherParticipant.user_id)
          .single();
        
        if (recipientProfile?.public_key && recipientProfile.public_key.trim() !== '') {
          recipientPublicKey = recipientProfile.public_key;
          console.log('✅ Chave pública encontrada no perfil do destinatário');
        }
      }

      if (!recipientPublicKey || recipientPublicKey.trim() === '') {
        const recipientName = otherParticipant.profile?.display_name || otherParticipant.profile?.email || 'o destinatário';
        setError(`O usuário ${recipientName} ainda não configurou suas chaves de criptografia. Peça para ele fazer login e configurar as chaves primeiro.`);
        console.error('❌ Chave pública do destinatário não encontrada:', {
          recipientId: otherParticipant.user_id,
          recipientName: recipientName,
          hasProfile: !!otherParticipant.profile,
          profilePublicKey: otherParticipant.profile?.public_key,
        });
        return false;
      }

      // Salvar chave pública no localStorage para uso futuro
      savePeerPublicKey(conversationId, otherParticipant.user_id, recipientPublicKey);

      // Criptografar mensagem
      const { cipherText, nonce } = await encryptMessage(
        text,
        recipientPublicKey,
        privateKey
      );

      // Salvar mensagem no banco (todos os usuários agora salvam no banco)
      // As mensagens são criptografadas E2EE, então estão seguras mesmo no banco
      const { data: insertedMessage, error: insertError } = await supabase
        .from('messages')
        // @ts-expect-error
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          cipher_text: cipherText,
          nonce: nonce,
        })
        .select(`
          *,
          sender:profiles(*)
        `)
        .single();

      if (insertError) {
        throw insertError;
      }

      // Criar mensagem com dados do banco
      const newMessage: Message = {
        ...insertedMessage,
        sender: profile,
        decrypted_text: text, // Para mensagens próprias, já temos o texto
      };

      // Salvar texto original no localStorage para poder ver depois
      saveSentMessageText(newMessage.id, text);

      // Adicionar mensagem à lista local
      setMessages((prev) => [...prev, newMessage]);

      return true;
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      setError((err as Error).message);
      return false;
    }
  }

  // Carregar mensagens quando a conversa mudar
  useEffect(() => {
    loadMessagesData();
  }, [loadMessagesData]);

  // Escutar novas mensagens em tempo real (todos os usuários)
  useEffect(() => {
    if (!conversationId || !user) return;

    console.log('📡 Inscrito em mensagens em tempo real para conversa:', conversationId);

    let channel: ReturnType<typeof supabase.channel> | null = null;

    // Tentar criar subscription de real-time
    try {
      channel = supabase
        .channel(`messages:${conversationId}`, {
          config: {
            broadcast: { self: true },
            presence: { key: user.id },
          },
        })
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          async (payload) => {
            console.log('📨 Nova mensagem recebida via real-time:', payload.new.id);
            
            // Buscar mensagem completa com sender
            const { data: messageData, error: fetchError } = await supabase
              .from('messages')
              .select(`
                *,
                sender:profiles(*)
              `)
              .eq('id', payload.new.id)
              .single();

            if (fetchError) {
              console.error('❌ Erro ao buscar mensagem:', fetchError);
              return;
            }

            if (!messageData) {
              console.error('❌ Mensagem não encontrada no banco');
              return;
            }

            const message = messageData as Message;
            
            // Verificar se já existe antes de adicionar
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === message.id);
              if (exists) {
                console.log('⚠️ Mensagem já existe, ignorando');
                return prev;
              }
              
              // Adicionar mensagem temporariamente (será descriptografada)
              console.log('➕ Adicionando mensagem à lista:', message.id);
              return [...prev, message];
            });

            // Descriptografar mensagem
            try {
              console.log('🔓 Descriptografando mensagem recebida...');
              const decrypted = await decryptMessages([message]);
              
              if (decrypted.length > 0 && decrypted[0]) {
                console.log('✅ Mensagem descriptografada:', decrypted[0].decrypted_text?.substring(0, 50));
                
                // Atualizar mensagem descriptografada
                setMessages((prev) => {
                  const exists = prev.some((m) => m.id === message.id);
                  if (!exists) {
                    console.log('⚠️ Mensagem não encontrada na lista ao atualizar, adicionando...');
                    return [...prev, decrypted[0]];
                  }
                  return prev.map((m) => 
                    m.id === message.id ? decrypted[0] : m
                  );
                });
              } else {
                console.error('❌ Nenhuma mensagem descriptografada retornada');
              }
            } catch (decryptError) {
              console.error('❌ Erro ao descriptografar mensagem recebida:', decryptError);
              // Manter mensagem com erro de descriptografia
              setMessages((prev) => {
                const exists = prev.some((m) => m.id === message.id);
                if (!exists) {
                  return [...prev, { ...message, decrypted_text: '[Erro ao descriptografar]' }];
                }
                return prev.map((m) => 
                  m.id === message.id 
                    ? { ...m, decrypted_text: '[Erro ao descriptografar]' }
                    : m
                );
              });
            }
          }
        )
        .subscribe((status) => {
          console.log('📡 Status da subscription:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Subscription ativa!');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Erro na subscription, usando fallback de polling');
          }
        });
    } catch (error) {
      console.error('❌ Erro ao criar subscription de real-time:', error);
    }

    // Fallback: recarregar mensagens periodicamente (caso real-time não funcione)
    // Inicializar contagem atual
    lastMessageCountRef.current = messages.length;
    
    const pollInterval = setInterval(async () => {
      try {
        // Verificar apenas a contagem de mensagens (mais eficiente)
        const { count, error: countError } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conversationId);
        
        if (!countError && count !== null && count !== lastMessageCountRef.current) {
          console.log('🔄 Nova mensagem detectada via polling, recarregando...', {
            oldCount: lastMessageCountRef.current,
            newCount: count,
          });
          lastMessageCountRef.current = count;
          await loadMessagesData();
        }
      } catch (error) {
        console.error('❌ Erro no polling:', error);
      }
    }, 2000); // Verificar a cada 2 segundos
    
    // Atualizar contagem inicial após carregar mensagens
    loadMessagesData().then(() => {
      setMessages((current) => {
        lastMessageCountRef.current = current.length;
        return current;
      });
    });

    return () => {
      console.log('📡 Desinscrevendo de mensagens em tempo real');
      if (channel) {
        supabase.removeChannel(channel);
      }
      clearInterval(pollInterval);
    };
  }, [conversationId, user, decryptMessages, loadMessagesData]);

  return {
    messages,
    loading,
    error,
    decrypting,
    sendMessage,
    refresh: loadMessagesData,
  };
}

