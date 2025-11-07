/**
 * Banner para configurar chaves E2EE no primeiro login
 */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { generateKeyPair } from '@/lib/crypto/keys';
import { savePrivateKey, getPrivateKey } from '@/lib/crypto/storage';

export function KeySetupBanner() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [settingUpKeys, setSettingUpKeys] = useState(false);
  const [keySetupError, setKeySetupError] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  const isNewUser = searchParams.get('new_user') === 'true';

  useEffect(() => {
    if (!user || !profile) return;

    // Verificar se precisa configurar chaves
    const checkKeys = async () => {
      const privateKey = await getPrivateKey(user.id);
      const hasPublicKey = profile.public_key && profile.public_key.trim() !== '';

      // Se não tem chave privada mas tem pública, mostrar aviso
      if (!privateKey && hasPublicKey) {
        setShowBanner(true);
        setKeySetupError(
          'Chave privada não encontrada localmente. Você precisa importar sua chave privada de backup.'
        );
        return;
      }

      // Se é novo usuário ou não tem chave pública, configurar
      if ((isNewUser || !hasPublicKey) && !privateKey) {
        setShowBanner(true);
        setupKeysIfNeeded();
      }
    };

    checkKeys();
  }, [user, profile, isNewUser]);

  async function setupKeysIfNeeded() {
    if (!user || !profile) return;

    try {
      setSettingUpKeys(true);
      setKeySetupError(null);

      // Verificar se a chave privada já existe localmente
      const existingPrivateKey = await getPrivateKey(user.id);
      if (existingPrivateKey) {
        setShowBanner(false);
        return;
      }

      // Se o perfil já tem chave pública no servidor mas não temos a privada localmente,
      // não geramos uma nova automaticamente
      if (profile.public_key && profile.public_key.trim() !== '') {
        setKeySetupError(
          'Chave privada não encontrada. Importe sua chave de backup ou gere uma nova (invalidará mensagens anteriores).'
        );
        return;
      }

      // Gerar novo par de chaves
      const { publicKey, privateKey } = await generateKeyPair();

      // Salvar chave privada localmente
      await savePrivateKey(user.id, privateKey);

      // Enviar chave pública ao servidor
      const response = await fetch('/api/auth/setup-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ publicKey }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar chave pública');
      }

      // Recarregar a página para atualizar o perfil
      setShowBanner(false);
      router.refresh();
    } catch (error) {
      console.error('Erro ao configurar chaves:', error);
      setKeySetupError((error as Error).message);
    } finally {
      setSettingUpKeys(false);
    }
  }

  if (!showBanner) return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {settingUpKeys ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Configurando chaves de criptografia...
              </p>
            </>
          ) : keySetupError ? (
            <>
              <div className="flex-1">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">{keySetupError}</p>
              </div>
            </>
          ) : null}
        </div>
        <button
          onClick={() => setShowBanner(false)}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

