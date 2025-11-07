/**
 * Componente da janela de chat
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useMessages } from '@/lib/hooks/useMessages';
import { useAuth } from '@/lib/hooks/useAuth';
import { formatDistanceToNow, format } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { EmptyState } from '@/components/ui/EmptyState';

interface ChatWindowProps {
  conversationId: string | null;
  conversationName?: string;
  conversationAvatar?: string;
}

export function ChatWindow({
  conversationId,
  conversationName,
  conversationAvatar,
}: ChatWindowProps) {
  const { messages, loading, error, sendMessage } = useMessages(conversationId);
  const { profile } = useAuth();
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!messageText.trim() || !conversationId || sending) return;

    const text = messageText.trim();
    setMessageText('');
    setSending(true);
    setSendError(null);

    try {
      const success = await sendMessage(text);

      if (!success) {
        // Se falhou, restaurar o texto
        setMessageText(text);
        setSendError('Erro ao enviar mensagem. Tente novamente.');
      }
    } catch (err) {
      setMessageText(text);
      setSendError((err as Error).message || 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
      // Focar no input novamente
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!conversationId) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-gray-800">
        <EmptyState
          title="Nenhuma conversa selecionada"
          description="Selecione uma conversa da lista ou crie uma nova para começar a conversar"
          icon={
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          }
        />
      </div>
    );
  }

  if (loading && messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-gray-800">
        <LoadingSpinner size="lg" text="Carregando mensagens..." />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {conversationAvatar ? (
          <img
            src={conversationAvatar}
            alt={conversationName || 'Conversa'}
            className="h-10 w-10 rounded-full mr-3 flex-shrink-0"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center mr-3 flex-shrink-0">
            <span className="text-gray-600 dark:text-gray-300 font-medium">
              {conversationName?.charAt(0).toUpperCase() || '?'}
            </span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {conversationName || 'Conversa'}
          </h3>
        </div>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <div className="mb-4">
            <ErrorMessage message={error} />
          </div>
        )}

        {sendError && (
          <div className="mb-4">
            <ErrorMessage
              message={sendError}
              onDismiss={() => setSendError(null)}
            />
          </div>
        )}

        {messages.length === 0 ? (
          <EmptyState
            title="Nenhuma mensagem ainda"
            description="Comece a conversar enviando uma mensagem"
            icon={
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            }
          />
        ) : (
          messages.map((message) => {
            const isOwn = message.sender_id === profile?.id;
            const senderName = message.sender?.display_name || 'Usuário';
            const messageTime = format(new Date(message.created_at), "HH:mm", { locale: ptBR });

            return (
              <div
                key={message.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    isOwn
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                  }`}
                >
                  {!isOwn && (
                    <p className="text-xs font-medium mb-1 opacity-75">{senderName}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.decrypted_text || '🔒 Descriptografando...'}
                  </p>
                  <p className={`text-xs mt-1 ${isOwn ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                    {messageTime}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
        <div className="flex items-end space-x-2">
          <textarea
            ref={inputRef}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite uma mensagem..."
            rows={1}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
            style={{ maxHeight: '120px' }}
            disabled={sending}
            aria-label="Campo de mensagem"
          />
          <button
            onClick={handleSend}
            disabled={!messageText.trim() || sending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            aria-label="Enviar mensagem"
          >
            {sending ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              'Enviar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

