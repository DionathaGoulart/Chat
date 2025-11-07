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

4. **Configure Google OAuth no Supabase:**

- Acesse o Supabase Dashboard → Authentication → Providers
- Ative o Google Provider
- Configure as credenciais do Google Cloud Console
- Adicione a URL de callback: `https://seu-dominio.com/auth/callback`

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


