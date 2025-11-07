/**
 * Modal para criar nova conversa (buscar usuários)
 */

'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { UserProfile } from '@/lib/auth/profile';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (userId: string) => void;
}

export function NewConversationModal({
  isOpen,
  onClose,
  onSelectUser,
}: NewConversationModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Limpar estado quando modal fecha
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setUsers([]);
      setError(null);
    }
  }, [isOpen]);

  // Buscar usuários com debounce
  useEffect(() => {
    if (!isOpen || !searchTerm || searchTerm.length < 3) {
      setUsers([]);
      return;
    }

    const searchUsers = async () => {
      setLoading(true);
      setError(null);

      try {
        // Usar a função SQL para buscar usuários
        // @ts-expect-error - TypeScript tem problemas com tipos do RPC do Supabase
        const { data, error: searchError } = await supabase.rpc('search_users_by_email', {
          search_email: searchTerm,
        });

        if (searchError) throw searchError;

        setUsers(data || []);
      } catch (err) {
        console.error('Erro ao buscar usuários:', err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(searchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, isOpen]);

  // Fechar modal ao pressionar ESC e controlar scroll do body
  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
          aria-hidden="true"
        ></div>

        {/* Modal */}
        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 id="modal-title" className="text-lg font-medium text-gray-900 dark:text-white">
                Nova Conversa
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                aria-label="Fechar modal"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Busca */}
            <div className="mb-4">
              <label htmlFor="search-input" className="sr-only">
                Buscar usuário por email
              </label>
              <input
                id="search-input"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por email..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                autoFocus
                aria-label="Buscar usuário por email"
              />
            </div>

            {/* Lista de usuários */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="py-4">
                  <LoadingSpinner size="md" text="Buscando usuários..." />
                </div>
              ) : error ? (
                <div className="p-4">
                  <ErrorMessage message={error} />
                </div>
              ) : searchTerm.length < 3 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Digite pelo menos 3 caracteres para buscar
                  </p>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Nenhum usuário encontrado
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={async () => {
                        console.log('🖱️ Clicou no usuário:', user.display_name, user.id);
                        await onSelectUser(user.id);
                        // O modal será fechado pelo dashboard após a conversa ser criada
                      }}
                      className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label={`Iniciar conversa com ${user.display_name}`}
                    >
                      <div className="flex items-center space-x-3">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.display_name}
                            className="h-10 w-10 rounded-full"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                            <span className="text-gray-600 dark:text-gray-300 font-medium">
                              {user.display_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {user.display_name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

