/**
 * Armazenamento local de textos de mensagens enviadas
 * Permite que o remetente veja o texto original de suas próprias mensagens
 * (já que foram criptografadas com a chave pública do destinatário)
 */

const STORAGE_PREFIX = 'sent_message_text_';

/**
 * Obtém a chave do localStorage para uma mensagem
 */
function getStorageKey(messageId: string): string {
  return `${STORAGE_PREFIX}${messageId}`;
}

/**
 * Salva o texto original de uma mensagem enviada
 */
export function saveSentMessageText(messageId: string, text: string): void {
  try {
    const key = getStorageKey(messageId);
    localStorage.setItem(key, text);
  } catch (error) {
    console.error('Erro ao salvar texto de mensagem enviada:', error);
  }
}

/**
 * Obtém o texto original de uma mensagem enviada
 */
export function getSentMessageText(messageId: string): string | null {
  try {
    const key = getStorageKey(messageId);
    return localStorage.getItem(key);
  } catch (error) {
    console.error('Erro ao obter texto de mensagem enviada:', error);
    return null;
  }
}

/**
 * Remove o texto de uma mensagem enviada
 */
export function removeSentMessageText(messageId: string): void {
  try {
    const key = getStorageKey(messageId);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Erro ao remover texto de mensagem enviada:', error);
  }
}

/**
 * Limpa todos os textos de mensagens enviadas
 */
export function clearAllSentMessageTexts(): void {
  try {
    const keys = Object.keys(localStorage);
    const messageKeys = keys.filter(key => key.startsWith(STORAGE_PREFIX));
    
    for (const key of messageKeys) {
      localStorage.removeItem(key);
    }
  } catch (error) {
    console.error('Erro ao limpar textos de mensagens enviadas:', error);
  }
}

