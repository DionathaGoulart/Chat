/**
 * Armazenamento seguro de chaves privadas no IndexedDB
 * IMPORTANTE: Chaves privadas NUNCA devem ser enviadas ao servidor
 */

const DB_NAME = 'e2ee_chat_db';
const DB_VERSION = 1;
const STORE_NAME = 'private_keys';

export interface StoredPrivateKey {
  userId: string;
  privateKey: string; // Base64
  createdAt: number;
  lastAccessed: number;
}

/**
 * Abre conexão com IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Criar object store se não existir
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
        objectStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

/**
 * Salva chave privada no IndexedDB
 * @param userId - ID do usuário
 * @param privateKey - Chave privada em Base64
 */
export async function savePrivateKey(
  userId: string,
  privateKey: string
): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  const data: StoredPrivateKey = {
    userId,
    privateKey,
    createdAt: Date.now(),
    lastAccessed: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const request = store.put(data);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Recupera chave privada do IndexedDB
 * @param userId - ID do usuário
 * @returns Chave privada em Base64 ou null se não encontrada
 */
export async function getPrivateKey(userId: string): Promise<string | null> {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.get(userId);
    
    request.onsuccess = () => {
      if (request.result) {
        // Atualizar lastAccessed
        const data = request.result as StoredPrivateKey;
        data.lastAccessed = Date.now();
        savePrivateKey(userId, data.privateKey).catch(console.error);
        
        resolve(data.privateKey);
      } else {
        resolve(null);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Remove chave privada do IndexedDB (logout seguro)
 * @param userId - ID do usuário
 */
export async function deletePrivateKey(userId: string): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.delete(userId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Verifica se existe chave privada armazenada para o usuário
 */
export async function hasPrivateKey(userId: string): Promise<boolean> {
  const key = await getPrivateKey(userId);
  return key !== null;
}

/**
 * Exporta chave privada como JSON (para backup)
 * AVISO: Esta função expõe a chave privada. Use com cuidado!
 */
export async function exportPrivateKey(userId: string): Promise<string> {
  const privateKey = await getPrivateKey(userId);
  
  if (!privateKey) {
    throw new Error('Chave privada não encontrada');
  }
  
  const exportData = {
    userId,
    privateKey,
    exportedAt: new Date().toISOString(),
    warning: 'MANTENHA ESTA CHAVE SEGURA! NUNCA compartilhe com ninguém.',
  };
  
  return JSON.stringify(exportData, null, 2);
}

/**
 * Importa chave privada de um backup JSON
 * AVISO: Valide o formato antes de importar!
 */
export async function importPrivateKey(exportJson: string): Promise<void> {
  try {
    const data = JSON.parse(exportJson);
    
    if (!data.userId || !data.privateKey) {
      throw new Error('Formato de backup inválido');
    }
    
    await savePrivateKey(data.userId, data.privateKey);
  } catch (error) {
    throw new Error('Falha ao importar chave privada: ' + (error as Error).message);
  }
}

/**
 * Limpa todas as chaves privadas do IndexedDB
 * Use apenas em caso de emergência ou logout geral
 */
export async function clearAllPrivateKeys(): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}


