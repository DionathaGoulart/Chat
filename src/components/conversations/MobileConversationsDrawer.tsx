/**
 * Drawer lateral para mobile (sidebar colapsável)
 */

'use client';

import { useEffect } from 'react';
import { ConversationsList } from './ConversationsList';

interface MobileConversationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
}

export function MobileConversationsDrawer({
  isOpen,
  onClose,
  selectedConversationId,
  onSelectConversation,
  onNewConversation,
}: MobileConversationsDrawerProps) {
  // Fechar drawer ao selecionar conversa em mobile
  const handleSelectConversation = (conversationId: string) => {
    onSelectConversation(conversationId);
    // Fechar drawer após seleção em mobile
    if (window.innerWidth < 768) {
      onClose();
    }
  };

  // Fechar drawer ao pressionar ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Prevenir scroll do body quando drawer está aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-gray-600 bg-opacity-75 z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 z-50 w-80 bg-white dark:bg-gray-800 shadow-xl md:hidden transform transition-transform duration-300 ease-in-out">
        <div className="h-full flex flex-col">
          {/* Header do Drawer */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Conversas</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              aria-label="Fechar menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Lista de Conversas */}
          <div className="flex-1 overflow-hidden">
            <ConversationsList
              selectedConversationId={selectedConversationId}
              onSelectConversation={handleSelectConversation}
              onNewConversation={onNewConversation}
            />
          </div>
        </div>
      </div>
    </>
  );
}

