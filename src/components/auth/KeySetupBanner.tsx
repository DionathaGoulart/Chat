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
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [settingUpKeys, setSettingUpKeys] = useState(false);
  const [keySetupError, setKeySetupError] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  const isNewUser = searchParams.get('new_user') === 'true';

  useEffect(() => {
    if (!user) {
      console.log('🔑 KeySetupBanner: Usuário não encontrado');
      return;
    }

    if (!profile) {
      console.log('🔑 KeySetupBanner: Perfil não carregado ainda, aguardando...');
      return;
    }

    // Verificar se precisa configurar chaves
    const checkKeys = async () => {
      const privateKey = await getPrivateKey(user.id);
      const hasPublicKey = profile.public_key && profile.public_key.trim() !== '';

      console.log('🔑 Verificando chaves:', {
        hasPrivateKey: !!privateKey,
        hasPublicKey,
        isNewUser,
        userId: user.id,
        profileId: profile.id,
        publicKeyValue: profile.public_key,
      });

      // Se não tem chave privada mas tem pública, mostrar aviso
      if (!privateKey && hasPublicKey) {
        setShowBanner(true);
        setKeySetupError(
          'Chave privada não encontrada localmente. Você precisa importar sua chave privada de backup ou gerar uma nova.'
        );
        return;
      }

      // Se não tem chave pública, SEMPRE mostrar banner e gerar automaticamente
      if (!hasPublicKey) {
        setShowBanner(true);
        console.log('🔑 Chave pública não encontrada, gerando automaticamente...');
        // Gerar chaves automaticamente após um pequeno delay
        setTimeout(() => {
          setupKeysIfNeeded();
        }, 500);
        return;
      }

      // Se é novo usuário e não tem chave privada, configurar automaticamente
      if (isNewUser && !privateKey) {
        setShowBanner(true);
        setTimeout(() => {
          setupKeysIfNeeded();
        }, 500);
        return;
      }
      
      // Se não tem chave privada mas tem pública, mostrar aviso (já tratado acima)
      // Se tem ambas, não mostrar banner
      if (privateKey && hasPublicKey) {
        setShowBanner(false);
      }
    };

    checkKeys();
  }, [user, profile, isNewUser]);

  async function setupKeysIfNeeded(force: boolean = false) {
    if (!user || !profile) return;

    try {
      setSettingUpKeys(true);
      setKeySetupError(null);

      // Verificar se a chave privada já existe localmente
      const existingPrivateKey = await getPrivateKey(user.id);
      if (existingPrivateKey && !force) {
        setShowBanner(false);
        return;
      }

      // Se o perfil já tem chave pública no servidor mas não temos a privada localmente,
      // e não foi forçado, mostrar aviso
      if (profile.public_key && profile.public_key.trim() !== '' && !force) {
        setKeySetupError(
          'Chave privada não encontrada. Clique em "Gerar Nova Chave" para criar uma nova (isso invalidará mensagens anteriores).'
        );
        setSettingUpKeys(false);
        return;
      }

      console.log('🔑 Gerando novo par de chaves...');

      // Gerar novo par de chaves
      const { publicKey, privateKey } = await generateKeyPair();

      console.log('✅ Chaves geradas, salvando...');

      // Salvar chave privada localmente
      await savePrivateKey(user.id, privateKey);

      console.log('✅ Chave privada salva localmente');

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

      console.log('✅ Chave pública salva no servidor');

      // Atualizar o perfil no hook useAuth
      if (refreshProfile) {
        await refreshProfile();
      }
      
      // Aguardar um pouco para garantir que o perfil foi atualizado
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Recarregar a página para garantir que tudo está sincronizado
      setShowBanner(false);
      window.location.reload(); // Usar reload completo para garantir atualização
    } catch (error) {
      console.error('❌ Erro ao configurar chaves:', error);
      setKeySetupError((error as Error).message);
    } finally {
      setSettingUpKeys(false);
    }
  }

  if (!showBanner) return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 flex-1">
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
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">{keySetupError}</p>
                <button
                  onClick={() => setupKeysIfNeeded(true)}
                  className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Gerar Nova Chave
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex-1">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Configurando suas chaves de criptografia para enviar mensagens seguras...
                </p>
              </div>
            </>
          )}
        </div>
        {!settingUpKeys && (
          <button
            onClick={() => setShowBanner(false)}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 ml-2"
            aria-label="Fechar banner"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

