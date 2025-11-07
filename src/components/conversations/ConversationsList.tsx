/**
 * Componente de lista de conversas (sidebar)
 */

'use client';

import { useConversations } from '@/lib/hooks/useConversations';
import { useAuth } from '@/lib/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';

interface ConversationsListProps {
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
}

export function ConversationsList({
  selectedConversationId,
  onSelectConversation,
  onNewConversation,
}: ConversationsListProps) {
  const { conversations, loading } = useConversations();
  const { profile } = useAuth();

  const getOtherParticipant = (conversation: any) => {
    if (!conversation.participants || !profile) return null;
    return conversation.participants.find((p: any) => p.user_id !== profile.id);
  };

  const getConversationName = (conversation: any) => {
    const otherParticipant = getOtherParticipant(conversation);
    if (otherParticipant?.profile) {
      return otherParticipant.profile.display_name || otherParticipant.profile.email || 'Usuário';
    }
    return 'Conversa sem nome';
  };

  const getConversationAvatar = (conversation: any) => {
    const otherParticipant = getOtherParticipant(conversation);
    return otherParticipant?.profile?.avatar_url || null;
  };

  const getLastMessagePreview = (conversation: any) => {
    if (!conversation.last_message) return 'Nenhuma mensagem';
    
    // Se a mensagem é do próprio usuário, tentar mostrar preview
    // (mesmo que não descriptografado, sabemos que enviamos)
    const isOwnMessage = conversation.last_message.sender_id === profile?.id;
    
    // Se a mensagem já foi descriptografada, mostrar texto
    if (conversation.last_message.decrypted_text) {
      return conversation.last_message.decrypted_text;
    }
    
    // Caso contrário, mostrar indicador
    if (isOwnMessage) {
      return 'Você enviou uma mensagem';
    }
    return '🔒 Mensagem criptografada';
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <LoadingSpinner size="md" text="Carregando conversas..." />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Conversas</h2>
          <button
            onClick={onNewConversation}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            + Nova
          </button>
        </div>
      </div>

      {/* Lista de conversas */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Nenhuma conversa ainda"
              description="Comece uma nova conversa para começar a trocar mensagens"
              action={{
                label: 'Nova Conversa',
                onClick: onNewConversation,
              }}
            />
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {conversations.map((conversation) => {
              const isSelected = conversation.id === selectedConversationId;
              const avatarUrl = getConversationAvatar(conversation);
              const name = getConversationName(conversation);
              const lastMessage = getLastMessagePreview(conversation);
              const lastMessageTime = conversation.last_message
                ? formatDistanceToNow(new Date(conversation.last_message.created_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })
                : '';

              return (
                <button
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation.id)}
                  className={`w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={name}
                          className="h-12 w-12 rounded-full"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                          <span className="text-gray-600 dark:text-gray-300 font-medium">
                            {name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {name}
                        </p>
                        {lastMessageTime && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                            {lastMessageTime}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 truncate">
                        {lastMessage}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

