/**
 * Armazenamento local de mensagens para usuários não-admin
 * Mensagens são armazenadas no localStorage por conversa
 */

export interface LocalMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  cipher_text: string;
  nonce: string;
  created_at: string;
  decrypted_text?: string; // Após descriptografia
}

const STORAGE_PREFIX = 'chat_messages_';

/**
 * Obtém a chave do localStorage para uma conversa
 */
function getStorageKey(conversationId: string): string {
  return `${STORAGE_PREFIX}${conversationId}`;
}

/**
 * Salva mensagens de uma conversa no localStorage
 */
export function saveMessages(conversationId: string, messages: LocalMessage[]): void {
  try {
    const key = getStorageKey(conversationId);
    localStorage.setItem(key, JSON.stringify(messages));
  } catch (error) {
    console.error('Erro ao salvar mensagens no localStorage:', error);
    // Se o localStorage estiver cheio, tentar limpar mensagens antigas
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      clearOldMessages();
      // Tentar novamente
      try {
        localStorage.setItem(key, JSON.stringify(messages));
      } catch (retryError) {
        console.error('Erro ao salvar mensagens após limpeza:', retryError);
      }
    }
  }
}

/**
 * Carrega mensagens de uma conversa do localStorage
 */
export function loadMessages(conversationId: string): LocalMessage[] {
  try {
    const key = getStorageKey(conversationId);
    const data = localStorage.getItem(key);
    if (!data) return [];
    
    return JSON.parse(data) as LocalMessage[];
  } catch (error) {
    console.error('Erro ao carregar mensagens do localStorage:', error);
    return [];
  }
}

/**
 * Adiciona uma nova mensagem ao localStorage
 */
export function addMessage(conversationId: string, message: LocalMessage): void {
  const messages = loadMessages(conversationId);
  messages.push(message);
  // Ordenar por created_at
  messages.sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  saveMessages(conversationId, messages);
}

/**
 * Remove todas as mensagens de uma conversa
 */
export function clearMessages(conversationId: string): void {
  try {
    const key = getStorageKey(conversationId);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Erro ao limpar mensagens:', error);
  }
}

/**
 * Remove mensagens antigas para liberar espaço
 * Mantém apenas as últimas 1000 mensagens por conversa
 */
function clearOldMessages(): void {
  try {
    const keys = Object.keys(localStorage);
    const messageKeys = keys.filter(key => key.startsWith(STORAGE_PREFIX));
    
    for (const key of messageKeys) {
      const data = localStorage.getItem(key);
      if (data) {
        const messages = JSON.parse(data) as LocalMessage[];
        if (messages.length > 1000) {
          // Manter apenas as últimas 1000 mensagens
          const recentMessages = messages.slice(-1000);
          localStorage.setItem(key, JSON.stringify(recentMessages));
        }
      }
    }
  } catch (error) {
    console.error('Erro ao limpar mensagens antigas:', error);
  }
}

/**
 * Limpa todas as mensagens do localStorage
 */
export function clearAllMessages(): void {
  try {
    const keys = Object.keys(localStorage);
    const messageKeys = keys.filter(key => key.startsWith(STORAGE_PREFIX));
    
    for (const key of messageKeys) {
      localStorage.removeItem(key);
    }
  } catch (error) {
    console.error('Erro ao limpar todas as mensagens:', error);
  }
}

/**
 * Obtém o tamanho total usado pelo localStorage de mensagens
 */
export function getMessagesStorageSize(): number {
  try {
    const keys = Object.keys(localStorage);
    const messageKeys = keys.filter(key => key.startsWith(STORAGE_PREFIX));
    
    let totalSize = 0;
    for (const key of messageKeys) {
      const data = localStorage.getItem(key);
      if (data) {
        totalSize += new Blob([data]).size;
      }
    }
    
    return totalSize;
  } catch (error) {
    console.error('Erro ao calcular tamanho do storage:', error);
    return 0;
  }
}

