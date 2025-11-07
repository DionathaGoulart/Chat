/**
 * Tipos TypeScript gerados do Supabase
 * Execute: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/supabase/types.ts
 * ou use o Supabase CLI para gerar automaticamente
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string
          email: string | null
          avatar_url: string | null
          public_key: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name: string
          email?: string | null
          avatar_url?: string | null
          public_key?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string
          email?: string | null
          avatar_url?: string | null
          public_key?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
        }
      }
      conversation_participants: {
        Row: {
          id: string
          conversation_id: string
          user_id: string
          joined_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          user_id: string
          joined_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          user_id?: string
          joined_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          cipher_text: string
          nonce: string
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          cipher_text: string
          nonce: string
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          cipher_text?: string
          nonce?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_users_by_email: {
        Args: {
          search_email: string
        }
        Returns: {
          id: string
          display_name: string
          email: string
          avatar_url: string | null
          public_key: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}


