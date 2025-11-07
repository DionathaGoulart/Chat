/**
 * Geração e gerenciamento de chaves para E2EE
 * Usa X25519 para criptografia de mensagens (box encryption)
 */

import _sodium from 'libsodium-wrappers';

export interface KeyPair {
  publicKey: string; // Base64
  privateKey: string; // Base64
}

/**
 * Inicializa libsodium (necessário antes de usar qualquer função)
 */
export async function initSodium(): Promise<typeof _sodium> {
  await _sodium.ready;
  return _sodium;
}

/**
 * Gera um novo par de chaves X25519 para criptografia E2EE
 * @returns Par de chaves (público e privado) em Base64
 */
export async function generateKeyPair(): Promise<KeyPair> {
  const sodium = await initSodium();
  
  // Gerar par de chaves X25519
  const keyPair = sodium.crypto_box_keypair();
  
  return {
    publicKey: sodium.to_base64(keyPair.publicKey, sodium.base64_variants.ORIGINAL),
    privateKey: sodium.to_base64(keyPair.privateKey, sodium.base64_variants.ORIGINAL),
  };
}

/**
 * Converte chave pública de string Base64 para Uint8Array
 */
export async function publicKeyFromBase64(publicKeyBase64: string): Promise<Uint8Array> {
  const sodium = await initSodium();
  return sodium.from_base64(publicKeyBase64, sodium.base64_variants.ORIGINAL);
}

/**
 * Converte chave privada de string Base64 para Uint8Array
 */
export async function privateKeyFromBase64(privateKeyBase64: string): Promise<Uint8Array> {
  const sodium = await initSodium();
  return sodium.from_base64(privateKeyBase64, sodium.base64_variants.ORIGINAL);
}

/**
 * Valida se uma string é uma chave pública válida
 */
export async function validatePublicKey(publicKeyBase64: string): Promise<boolean> {
  try {
    const sodium = await initSodium();
    const key = sodium.from_base64(publicKeyBase64, sodium.base64_variants.ORIGINAL);
    // Chave pública X25519 deve ter 32 bytes
    return key.length === sodium.crypto_box_PUBLICKEYBYTES;
  } catch {
    return false;
  }
}

/**
 * Gera uma chave simétrica para uma conversa
 * Usa crypto_secretbox_KEYBYTES (32 bytes) para criptografia simétrica
 * @returns Chave simétrica em Base64
 */
export async function generateConversationKey(): Promise<string> {
  const sodium = await initSodium();
  const key = sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);
  return sodium.to_base64(key, sodium.base64_variants.ORIGINAL);
}

/**
 * Converte chave simétrica de Base64 para Uint8Array
 */
export async function conversationKeyFromBase64(keyBase64: string): Promise<Uint8Array> {
  const sodium = await initSodium();
  return sodium.from_base64(keyBase64, sodium.base64_variants.ORIGINAL);
}

/**
 * Criptografa a chave de uma conversa com a chave pública de um usuário
 * Usa crypto_box_seal (sealed box) que não requer chave privada do remetente
 */
export async function encryptConversationKey(
  conversationKey: string, // Chave simétrica da conversa (Base64)
  userPublicKey: string // Chave pública do usuário (Base64)
): Promise<{ encryptedKey: string }> {
  const sodium = await initSodium();
  
  // Converter chaves
  const convKey = await conversationKeyFromBase64(conversationKey);
  const pubKey = await publicKeyFromBase64(userPublicKey);
  
  // Usar crypto_box_seal que não requer chave privada do remetente
  // crypto_box_seal já inclui o nonce no resultado
  const encrypted = sodium.crypto_box_seal(convKey, pubKey);
  
  return {
    encryptedKey: sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL),
  };
}

/**
 * Descriptografa a chave de uma conversa usando a chave privada do usuário
 * Usa crypto_box_seal_open (sealed box)
 */
export async function decryptConversationKey(
  encryptedKey: string, // Chave criptografada (Base64) - inclui nonce
  userPrivateKey: string, // Chave privada do usuário (Base64)
  userPublicKey: string // Chave pública do usuário (Base64) - necessária para crypto_box_seal_open
): Promise<string> {
  const sodium = await initSodium();
  
  // Converter chaves
  const privKey = await privateKeyFromBase64(userPrivateKey);
  const pubKey = await publicKeyFromBase64(userPublicKey);
  const encrypted = sodium.from_base64(encryptedKey, sodium.base64_variants.ORIGINAL);
  
  // Gerar par de chaves a partir das chaves fornecidas
  // crypto_box_seal_open precisa do par completo
  const keyPair = {
    publicKey: pubKey,
    privateKey: privKey,
  };
  
  // Descriptografar usando crypto_box_seal_open
  const decrypted = sodium.crypto_box_seal_open(encrypted, keyPair);
  
  // Converter de volta para Base64
  return sodium.to_base64(decrypted, sodium.base64_variants.ORIGINAL);
}


