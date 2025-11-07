# 🔐 Guia de Configuração OAuth - Passo a Passo

## Entendendo o Fluxo

```
Usuário → Google → Supabase → Sua Aplicação
         (1)      (2)         (3)
```

1. **Google Cloud Console**: Configura para onde o Google redireciona após autenticar
2. **Supabase**: Processa a autenticação e redireciona para sua app
3. **Sua Aplicação**: Recebe o código e finaliza o login

## ✅ Passo 1: Google Cloud Console (JÁ ESTÁ CORRETO!)

- **URL configurada**: `https://ljiyvzldfiutebpzuxeg.supabase.co/auth/v1/callback`
- **Status**: ✅ Não precisa alterar nada aqui!

## ⚙️ Passo 2: Configurar Supabase Dashboard

### Onde encontrar as configurações:

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **Authentication** (menu lateral esquerdo)
4. Procure por uma das seguintes opções:
   - **URL Configuration** (mais comum)
   - **Settings** → **Auth** → **URL Configuration**
   - **Auth** → **Settings** → **URL Configuration**

### Campos a configurar:

#### **Site URL**
- **O que é**: URL base da sua aplicação (usada como fallback se redirectTo não corresponder)
- **Valor sugerido**: 
  - Se você sempre acessa pelo IP: `http://192.168.0.9:3000`
  - Se você acessa tanto por localhost quanto IP: `http://localhost:3000` (mas isso pode causar problemas quando acessar pelo IP)
  - **Recomendação**: Use o IP da rede (`http://192.168.0.9:3000`) se você sempre acessa de outros PCs
- **Nota**: O Supabase usa esta URL como fallback se o `redirectTo` não corresponder exatamente às URLs permitidas

#### **Redirect URLs** (MUITO IMPORTANTE!)
- **O que é**: Lista de URLs permitidas para redirecionamento após autenticação
- **Como adicionar**: 
  - Adicione uma URL por linha, OU
  - Separe por vírgula, OU
  - Use o formato que o Supabase aceitar
- **URLs a adicionar**:
  ```
  http://localhost:3000/auth/callback
  http://192.168.0.9:3000/auth/callback
  ```

### Exemplo visual:

```
┌─────────────────────────────────────────┐
│ URL Configuration                       │
├─────────────────────────────────────────┤
│ Site URL:                               │
│ http://localhost:3000                   │
│                                         │
│ Redirect URLs:                          │
│ http://localhost:3000/auth/callback     │
│ http://192.168.0.9:3000/auth/callback   │
│                                         │
│ [Save]                                  │
└─────────────────────────────────────────┘
```

## 🔍 Se não encontrar o campo "Redirect URLs"

Algumas versões do Supabase podem ter nomes diferentes:

- **Allowed Redirect URLs**
- **Authorized Redirect URIs**
- **Redirect URIs**
- **Callback URLs**

Procure por qualquer campo que mencione "redirect", "callback" ou "URL" na seção de Authentication Settings.

## 🧪 Testando

Após configurar:

1. Acesse sua app em `http://192.168.0.9:3000`
2. Clique em "Login com Google"
3. Após autenticar no Google, você deve ser redirecionado de volta para `http://192.168.0.9:3000/auth/callback`
4. Se funcionar, você será redirecionado para o dashboard

## ❌ Problemas Comuns

### Erro: "redirect_uri_mismatch"
- **Causa**: A URL não está na lista de "Redirect URLs" do Supabase
- **Solução**: Adicione a URL exata (com http/https e porta) na lista

### Redireciona para localhost mesmo acessando pelo IP
- **Causa**: O Supabase pode estar usando o "Site URL" como fallback
- **Solução**: 
  1. **Mude o "Site URL" para o IP da rede**: `http://192.168.0.9:3000`
  2. **Verifique os logs no console do navegador**: Você deve ver logs como:
     - `🔐 Iniciando login OAuth com redirectTo: http://192.168.0.9:3000/auth/callback`
     - `📍 Origin atual: http://192.168.0.9:3000`
  3. **Verifique os logs do servidor**: Você deve ver:
     - `🔄 Callback OAuth recebido: { origin: 'http://192.168.0.9:3000', ... }`
  4. **Reinicie o servidor Next.js** após fazer mudanças
  5. **Limpe o cache do navegador** e tente novamente

### Não consigo editar as URLs no Supabase
- **Causa**: Pode ser que você não tenha permissões de admin no projeto
- **Solução**: Verifique se você é o owner/admin do projeto no Supabase

## 📝 Notas Importantes

- A URL no **Google Cloud Console** (`https://ljiyvzldfiutebpzuxeg.supabase.co/auth/v1/callback`) **NÃO deve ser alterada**
- As URLs no **Supabase Dashboard** são diferentes e devem apontar para sua aplicação local
- Você pode adicionar múltiplas URLs (localhost, IP da rede, produção) para desenvolvimento flexível

