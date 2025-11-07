# Chat E2EE - Aplicativo de Mensagens Criptografadas

Aplicativo web de chat privado com criptografia end-to-end (E2EE) usando Next.js, Supabase e Google OAuth.

## 🚀 Stack Tecnológica

- **Frontend**: Next.js 14+ (App Router), TypeScript, TailwindCSS
- **Backend**: Supabase (Auth, Database, Realtime)
- **Criptografia**: libsodium-wrappers (X25519 + XSalsa20-Poly1305)

## 📋 Pré-requisitos

- Node.js 18+ e npm/yarn
- Conta no Supabase
- Conta no Google Cloud Console (para OAuth)

## 🛠️ Instalação

1. **Clone o repositório e instale as dependências:**

```bash
npm install
```

2. **Configure as variáveis de ambiente:**

Copie `.env.local.example` para `.env.local` e preencha com suas credenciais do Supabase:

```bash
cp .env.local.example .env.local
```

3. **Configure o banco de dados:**

Execute o script SQL em `supabase/schema.sql` no Supabase SQL Editor para criar todas as tabelas e políticas RLS.

4. **Configure Google OAuth:**

   **No Google Cloud Console:**
   - A URL de callback já está correta: `https://ljiyvzldfiutebpzuxeg.supabase.co/auth/v1/callback`
   - Não precisa alterar nada aqui!

   **No Supabase Dashboard:**
   - Acesse: **Authentication** → **URL Configuration** (ou **Settings** → **Auth**)
   - No campo **"Site URL"**, coloque: `http://localhost:3000` (ou seu IP: `http://192.168.0.9:3000`)
   - No campo **"Redirect URLs"**, adicione múltiplas URLs (uma por linha ou separadas por vírgula):
     ```
     http://localhost:3000/auth/callback
     http://192.168.0.9:3000/auth/callback
     ```
   - **Importante**: As URLs em "Redirect URLs" são para onde o Supabase vai redirecionar APÓS autenticar. É diferente da URL do Google Cloud Console!
   
   **Resumo do fluxo:**
   1. Usuário clica em "Login" → vai para Google
   2. Google autentica → redireciona para Supabase (`https://ljiyvzldfiutebpzuxeg.supabase.co/auth/v1/callback`)
   3. Supabase processa → redireciona para sua app (`http://localhost:3000/auth/callback` ou `http://192.168.0.9:3000/auth/callback`)

5. **Inicie o servidor de desenvolvimento:**

```bash
npm run dev
```

## 🔐 Segurança

- **Chaves privadas**: Armazenadas apenas localmente no IndexedDB do navegador
- **Criptografia**: Todas as mensagens são criptografadas no cliente antes do envio
- **Servidor**: Nunca tem acesso a chaves privadas ou mensagens descriptografadas
- **RLS**: Row Level Security habilitado em todas as tabelas

## 📁 Estrutura do Projeto

```
src/
├── app/              # App Router do Next.js
├── components/       # Componentes React
├── lib/
│   ├── crypto/      # Utilitários de criptografia
│   ├── supabase/    # Clientes Supabase
│   └── hooks/       # Custom hooks
├── types/           # Definições de tipos TypeScript
└── utils/           # Funções utilitárias
```

## 🎯 Próximos Passos

Consulte o arquivo `supabase/schema.sql` para instruções detalhadas sobre a configuração do banco de dados.

## 📝 Licença

MIT


