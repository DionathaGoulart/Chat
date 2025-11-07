# Migração para Arquitetura Simplificada

## 📋 Resumo das Mudanças

### Nova Arquitetura
- **Admins**: Mensagens armazenadas no banco de dados
- **Usuários**: Mensagens armazenadas no localStorage (não no banco)
- **Chaves**: Cada usuário tem chave pública/privada, compartilhadas diretamente entre participantes
- **Segurança**: Chaves privadas nunca saem do navegador (IndexedDB)

### Arquivos Criados/Modificados

1. **`supabase/schema_simple.sql`** - Novo schema simplificado
2. **`src/lib/storage/localMessages.ts`** - Gerenciamento de mensagens no localStorage
3. **`src/lib/storage/conversationKeys.ts`** - Armazenamento de chaves públicas de participantes
4. **`src/lib/hooks/useMessagesSimple.ts`** - Hook simplificado para mensagens
5. **Tipos atualizados** - Adicionado campo `role` em `UserProfile`

## 🚀 Como Migrar

### 1. Executar o Novo Schema

```sql
-- Execute no Supabase SQL Editor
-- Isso vai limpar TODOS os dados existentes!
```

Execute o arquivo `supabase/schema_simple.sql` no Supabase SQL Editor.

**⚠️ ATENÇÃO**: Este script vai deletar todas as conversas, mensagens e chaves existentes!

### 2. Definir Usuários Admin

Após executar o schema, defina alguns usuários como admin:

```sql
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'seu-email@example.com';
```

### 3. Atualizar Código

Substitua o uso de `useMessages` por `useMessagesSimple` nos componentes:

```typescript
// Antes
import { useMessages } from '@/lib/hooks/useMessages';

// Depois
import { useMessagesSimple } from '@/lib/hooks/useMessagesSimple';
```

### 4. Atualizar Componentes

Atualize os componentes que usam mensagens para usar o novo hook:

- `src/components/chat/ChatWindow.tsx`
- Outros componentes que usam mensagens

## 🔐 Como Funciona

### Geração de Chaves
1. Ao fazer login, o usuário gera automaticamente um par de chaves (pública/privada)
2. A chave privada fica no IndexedDB (nunca é enviada ao servidor)
3. A chave pública é salva no perfil do usuário

### Criação de Conversa
1. Usuário A cria conversa com Usuário B
2. Sistema busca a chave pública do Usuário B
3. Chave pública do Usuário B é salva no localStorage do Usuário A
4. Chave pública do Usuário A é salva no localStorage do Usuário B

### Envio de Mensagem
1. **Admin**: Mensagem é criptografada e salva no banco
2. **Usuário**: Mensagem é criptografada e salva no localStorage

### Recebimento de Mensagem
1. **Admin**: Mensagens são carregadas do banco e descriptografadas
2. **Usuário**: Mensagens são carregadas do localStorage e descriptografadas

## 📝 Próximos Passos

1. Atualizar `useConversations` para trocar chaves públicas ao criar conversa
2. Atualizar `ChatWindow` para usar `useMessagesSimple`
3. Testar com usuários admin e não-admin
4. Adicionar indicador visual de role (admin/user)

## 🔒 Segurança

- ✅ Chaves privadas nunca saem do navegador
- ✅ Mensagens de usuários não ficam no banco (apenas localStorage)
- ✅ Criptografia E2EE usando X25519 + XSalsa20-Poly1305
- ✅ Chaves públicas são compartilhadas apenas entre participantes

