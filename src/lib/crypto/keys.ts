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


