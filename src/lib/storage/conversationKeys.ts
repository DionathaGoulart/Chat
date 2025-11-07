/**
 * Armazenamento local de chaves públicas de outros participantes
 * Armazena a chave pública do outro participante por conversa
 */

const STORAGE_PREFIX = 'conversation_peer_key_';

/**
 * Obtém a chave do localStorage para uma conversa
 */
function getStorageKey(conversationId: string, userId: string): string {
  return `${STORAGE_PREFIX}${conversationId}_${userId}`;
}

/**
 * Salva a chave pública do outro participante
 */
export function savePeerPublicKey(
  conversationId: string,
  peerUserId: string,
  publicKey: string
): void {
  try {
    const key = getStorageKey(conversationId, peerUserId);
    localStorage.setItem(key, publicKey);
  } catch (error) {
    console.error('Erro ao salvar chave pública do participante:', error);
  }
}

/**
 * Obtém a chave pública do outro participante
 */
export function getPeerPublicKey(
  conversationId: string,
  peerUserId: string
): string | null {
  try {
    const key = getStorageKey(conversationId, peerUserId);
    return localStorage.getItem(key);
  } catch (error) {
    console.error('Erro ao obter chave pública do participante:', error);
    return null;
  }
}

/**
 * Remove a chave pública do outro participante
 */
export function clearPeerPublicKey(conversationId: string, peerUserId: string): void {
  try {
    const key = getStorageKey(conversationId, peerUserId);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Erro ao limpar chave pública do participante:', error);
  }
}

/**
 * Limpa todas as chaves públicas armazenadas
 */
export function clearAllPeerPublicKeys(): void {
  try {
    const keys = Object.keys(localStorage);
    const keyKeys = keys.filter(key => key.startsWith(STORAGE_PREFIX));
    
    for (const key of keyKeys) {
      localStorage.removeItem(key);
    }
  } catch (error) {
    console.error('Erro ao limpar todas as chaves públicas:', error);
  }
}

