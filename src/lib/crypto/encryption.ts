/**
 * Criptografia e descriptografia de mensagens usando X25519 + XSalsa20-Poly1305
 * Usa crypto_box do libsodium para criptografia assimétrica
 */

import _sodium from 'libsodium-wrappers';
import { publicKeyFromBase64, privateKeyFromBase64 } from './keys';

export interface EncryptedMessage {
  cipherText: string; // Base64
  nonce: string; // Base64
}

/**
 * Criptografa uma mensagem usando a chave pública do destinatário
 * @param message - Mensagem em texto plano
 * @param recipientPublicKey - Chave pública do destinatário (Base64)
 * @param senderPrivateKey - Chave privada do remetente (Base64)
 * @returns Mensagem criptografada com nonce
 */
export async function encryptMessage(
  message: string,
  recipientPublicKey: string,
  senderPrivateKey: string
): Promise<EncryptedMessage> {
  await _sodium.ready;
  const sodium = _sodium as any;
  
  // Converter chaves de Base64 para Uint8Array
  const recipientPubKey = await publicKeyFromBase64(recipientPublicKey);
  const senderPrivKey = await privateKeyFromBase64(senderPrivateKey);
  
  // Converter mensagem para Uint8Array
  const messageBytes = new TextEncoder().encode(message);
  
  // Gerar nonce aleatório (24 bytes para XSalsa20-Poly1305)
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
  
  // Criptografar usando crypto_box (X25519 + XSalsa20-Poly1305)
  const cipherText = sodium.crypto_box(
    messageBytes,
    nonce,
    recipientPubKey,
    senderPrivKey
  );
  
  return {
    cipherText: sodium.to_base64(cipherText, sodium.base64_variants.ORIGINAL),
    nonce: sodium.to_base64(nonce, sodium.base64_variants.ORIGINAL),
  };
}

/**
 * Descriptografa uma mensagem usando a chave privada do destinatário
 * @param encryptedMessage - Mensagem criptografada com nonce
 * @param senderPublicKey - Chave pública do remetente (Base64)
 * @param recipientPrivateKey - Chave privada do destinatário (Base64)
 * @returns Mensagem descriptografada em texto plano
 */
export async function decryptMessage(
  encryptedMessage: EncryptedMessage,
  senderPublicKey: string,
  recipientPrivateKey: string
): Promise<string> {
  await _sodium.ready;
  const sodium = _sodium as any;
  
  try {
    // Converter chaves de Base64 para Uint8Array
    const senderPubKey = await publicKeyFromBase64(senderPublicKey);
    const recipientPrivKey = await privateKeyFromBase64(recipientPrivateKey);
    
    // Converter cipherText e nonce de Base64 para Uint8Array
    const cipherText = sodium.from_base64(
      encryptedMessage.cipherText,
      sodium.base64_variants.ORIGINAL
    );
    const nonce = sodium.from_base64(
      encryptedMessage.nonce,
      sodium.base64_variants.ORIGINAL
    );
    
    // Descriptografar
    const decryptedBytes = sodium.crypto_box_open(
      cipherText,
      nonce,
      senderPubKey,
      recipientPrivKey
    );
    
    // Converter de Uint8Array para string
    return new TextDecoder().decode(decryptedBytes);
  } catch (error) {
    throw new Error('Falha ao descriptografar mensagem. Verifique as chaves.');
  }
}

/**
 * Criptografa múltiplas mensagens para múltiplos destinatários
 * Útil para conversas em grupo (implementação futura)
 */
export async function encryptMessageForMultipleRecipients(
  message: string,
  recipientPublicKeys: string[],
  senderPrivateKey: string
): Promise<Map<string, EncryptedMessage>> {
  const encryptedMessages = new Map<string, EncryptedMessage>();
  
  await Promise.all(
    recipientPublicKeys.map(async (recipientPublicKey) => {
      const encrypted = await encryptMessage(
        message,
        recipientPublicKey,
        senderPrivateKey
      );
      encryptedMessages.set(recipientPublicKey, encrypted);
    })
  );
  
  return encryptedMessages;
}


