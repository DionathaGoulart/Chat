/**
 * Hook para gerenciar autenticação e perfil do usuário
 */

'use client';

import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { getUserProfile } from '../auth/profile';
import { getPrivateKey, savePrivateKey } from '../crypto/storage';
import { generateKeyPair } from '../crypto/keys';
import type { UserProfile } from '../auth/profile';

export interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook para gerenciar autenticação
 */
export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    // Verificar sessão atual
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setAuthState({
          user: null,
          profile: null,
          loading: false,
          error: error.message,
        });
        return;
      }

      if (session?.user) {
        handleUserSession(session.user);
      } else {
        setAuthState({
          user: null,
          profile: null,
          loading: false,
          error: null,
        });
      }
    });

    // Escutar mudanças de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await handleUserSession(session.user);
      } else {
        setAuthState({
          user: null,
          profile: null,
          loading: false,
          error: null,
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Processa a sessão do usuário e garante que o perfil e chaves existem
   */
  async function handleUserSession(user: User) {
    try {
      // Buscar perfil do usuário
      const response = await fetch('/api/auth/profile');
      if (!response.ok) {
        if (response.status === 404) {
          // Perfil não existe ainda - isso não é um erro, apenas não foi criado
          setAuthState({
            user,
            profile: null,
            loading: false,
            error: null,
          });
          return;
        }
        throw new Error('Erro ao buscar perfil');
      }

      const profile = await response.json();
      
      // Normalizar public_key null/empty para null
      if (profile && (!profile.public_key || profile.public_key.trim() === '')) {
        profile.public_key = null;
      }

      // Verificar se a chave privada existe localmente
      const hasPrivateKey = await getPrivateKey(user.id);

      if (!hasPrivateKey && profile.public_key) {
        // Se não tem chave privada mas tem perfil, significa que o perfil foi criado
        // mas a chave privada ainda não foi salva localmente
        // Isso pode acontecer se o usuário fez login em outro dispositivo
        // Por segurança, não geramos uma nova chave aqui - o usuário deve importar
        console.warn('Chave privada não encontrada localmente. O usuário precisa importar a chave.');
      }

      setAuthState({
        user,
        profile,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('Erro ao processar sessão:', error);
      setAuthState({
        user,
        profile: null,
        loading: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Realiza login com Google OAuth
   */
  async function signInWithGoogle() {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (error) {
      setAuthState((prev) => ({
        ...prev,
        error: (error as Error).message,
      }));
      throw error;
    }
  }

  /**
   * Realiza logout
   */
  async function signOut() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      
      if (user) {
        // Limpar chave privada do IndexedDB
        const { deletePrivateKey } = await import('../crypto/storage');
        await deletePrivateKey(user.id).catch(console.error);
      }

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setAuthState({
        user: null,
        profile: null,
        loading: false,
        error: null,
      });
    } catch (error) {
      setAuthState((prev) => ({
        ...prev,
        error: (error as Error).message,
      }));
      throw error;
    }
  }

  return {
    ...authState,
    signInWithGoogle,
    signOut,
  };
}

