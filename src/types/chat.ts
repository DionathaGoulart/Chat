/**
 * Tipos TypeScript para chat e conversas
 */

import type { UserProfile } from '@/lib/auth/profile';

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  participants?: ConversationParticipant[];
  last_message?: Message;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  profile?: UserProfile;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  cipher_text: string;
  nonce: string;
  created_at: string;
  sender?: UserProfile;
  decrypted_text?: string; // Apenas no cliente após descriptografia
}

export interface CreateConversationRequest {
  participant_id: string;
}

export interface SendMessageRequest {
  conversation_id: string;
  message: string; // Texto plano que será criptografado
}

