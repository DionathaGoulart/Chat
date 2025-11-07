/**
 * Gera um UUID v4 compatível com todos os navegadores
 * Fallback para quando crypto.randomUUID não está disponível
 */

/**
 * Gera um UUID v4
 */
export function generateUUID(): string {
  // Tentar usar crypto.randomUUID se disponível (navegadores modernos)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback: gerar UUID v4 manualmente
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

