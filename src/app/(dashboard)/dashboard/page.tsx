/**
 * Página do Dashboard com Chat
 */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useConversations } from '@/lib/hooks/useConversations';
import { ConversationsList } from '@/components/conversations/ConversationsList';
import { MobileConversationsDrawer } from '@/components/conversations/MobileConversationsDrawer';
import { NewConversationModal } from '@/components/conversations/NewConversationModal';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { KeySetupBanner } from '@/components/auth/KeySetupBanner';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

export default function DashboardPage() {
  const { user, profile, loading, signOut, error } = useAuth();
  const router = useRouter();
  const { conversations, createConversation, loading: conversationsLoading } = useConversations();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
  };

  const handleNewConversation = () => {
    setShowNewConversationModal(true);
  };

  const handleSelectUser = async (userId: string) => {
    const conversation = await createConversation(userId);
    if (conversation) {
      setSelectedConversationId(conversation.id);
    }
  };

  // Obter informações da conversa selecionada
  const selectedConversation = conversations.find((c) => c.id === selectedConversationId);
  const getOtherParticipant = (conversation: any) => {
    if (!conversation?.participants || !profile) return null;
    return conversation.participants.find((p: any) => p.user_id !== profile.id);
  };
  const otherParticipant = selectedConversation ? getOtherParticipant(selectedConversation) : null;
  const conversationName = otherParticipant?.profile?.display_name || otherParticipant?.profile?.email || 'Conversa';
  const conversationAvatar = otherParticipant?.profile?.avatar_url || undefined;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="lg" text="Carregando..." />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Se não tem perfil ainda, mostrar loading
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="lg" text="Criando seu perfil..." />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Banner de Setup de Chaves */}
      <KeySetupBanner />

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            {/* Botão Menu Mobile */}
            <button
              onClick={() => setShowMobileDrawer(true)}
              className="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              aria-label="Abrir menu de conversas"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            {profile.avatar_url && (
              <img
                src={profile.avatar_url}
                alt={profile.display_name}
                className="h-10 w-10 rounded-full flex-shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                Chat E2EE
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{profile.email}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex-shrink-0 ml-2"
            aria-label="Sair da conta"
          >
            Sair
          </button>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar com Lista de Conversas (Desktop) */}
        <div className="hidden md:block w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700">
          <ConversationsList
            selectedConversationId={selectedConversationId}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
          />
        </div>

        {/* Drawer Mobile */}
        <MobileConversationsDrawer
          isOpen={showMobileDrawer}
          onClose={() => setShowMobileDrawer(false)}
          selectedConversationId={selectedConversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={() => {
            setShowMobileDrawer(false);
            handleNewConversation();
          }}
        />

        {/* Área de Chat */}
        <div className="flex-1 min-w-0">
          <ChatWindow
            conversationId={selectedConversationId}
            conversationName={conversationName}
            conversationAvatar={conversationAvatar}
          />
        </div>
      </div>

      {/* Modal de Nova Conversa */}
      <NewConversationModal
        isOpen={showNewConversationModal}
        onClose={() => setShowNewConversationModal(false)}
        onSelectUser={handleSelectUser}
      />

      {/* Status de Segurança */}
      {error && (
        <div className="border-t border-red-200 dark:border-red-800 p-4">
          <ErrorMessage message={`Erro: ${error}`} />
        </div>
      )}
    </div>
  );
}
