# Guia Completo: Sincronização do Projeto com o GitHub

Este guia fornece o passo a passo completo para conectar, sincronizar e manter o repositório deste projeto atualizado com a sua conta no **GitHub**.

---

## 1. Passo a Passo Rápido (Primeiro Envio para o GitHub)

### Passo 1: Crie um novo repositório no GitHub
1. Acesse [github.com/new](https://github.com/new).
2. Defina o **Repository name** (exemplo: `gestao-financeira-elite` ou `painel-compras-vendas`).
3. Escolha se o repositório será **Público (Public)** ou **Privado (Private)**.
4. **IMPORTANTE:** Não marque as opções "Add a README file", ".gitignore" ou "Choose a license", pois o projeto já possui esses arquivos configurados.
5. Clique em **"Create repository"**.

### Passo 2: Vincule seu repositório local e envie o código
Copie a URL do seu repositório no GitHub (HTTPS ou SSH) e execute os seguintes comandos no terminal:

```bash
# 1. Garante que a branch principal se chama 'main'
git branch -M main

# 2. Adicione o repositório remoto do GitHub (substitua pelo link do seu repositório)
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git

# 3. Envie todos os arquivos e o histórico para o GitHub
git push -u origin main
```

> **Dica de Autenticação:** Se o GitHub solicitar senha no terminal, utilize um **Personal Access Token (PAT)** ou autentique-se via SSH / GitHub CLI (`gh auth login`).

---

## 2. Fluxo de Trabalho Diário (Sincronização Contínua)

Após o primeiro envio, sempre que fizer alterações no projeto, utilize este fluxo rápido para enviar as atualizações:

```bash
# 1. Verifique os arquivos alterados
git status

# 2. Adicione todos os arquivos modificados
git add .

# 3. Crie um commit com uma mensagem descritiva
git commit -m "feat: atualização de métricas e filtros"

# 4. Envie as alterações para o GitHub
git push
```

### Para puxar alterações feitas diretamente no GitHub ou por outro computador:
```bash
git pull origin main
```

---

## 3. Como Gerar um Personal Access Token (PAT) no GitHub
O GitHub não aceita mais a senha comum da sua conta para comandos `git push` via HTTPS. Para criar seu token:

1. No GitHub, clique na sua foto de perfil no canto superior direito e vá em **Settings**.
2. Na barra lateral esquerda, role até o final e clique em **Developer Settings**.
3. Selecione **Personal access tokens** -> **Tokens (classic)**.
4. Clique em **Generate new token** -> **Generate new token (classic)**.
5. Dê um nome (ex: `Meu Computador - Gestão Financeira`).
6. Em **Expiration**, selecione a validade desejada (ex: 90 dias ou No expiration).
7. Marque o escopo principal: `[x] repo` (Acesso completo a repositórios privados e públicos).
8. Clique em **Generate token** no final da página.
9. **Copie o token gerado** e guarde em local seguro! Ao executar `git push`, use seu usuário do GitHub e cole este token quando a senha for solicitada.

---

## 4. Segurança e Arquivos Ignorados (.gitignore)

O arquivo `.gitignore` deste projeto já está configurado para proteger dados sensíveis:
- `node_modules/` (dependências do projeto, instaladas via `npm install`)
- `.env`, `.env.local` (variáveis com chaves secretas ou credenciais)
- `dist/`, `build/` (arquivos gerados para produção)

> **Atenção:** Nunca remova `.env*` do `.gitignore` para evitar enviar chaves privadas de APIs para repositórios públicos.

---

## 5. Deploy Contínuo a partir do GitHub

Com o código hospedado no GitHub, você pode facilmente publicar sua aplicação em nuvem gratuita:
- **Vercel**: Conecte sua conta GitHub em [vercel.com](https://vercel.com), importe o repositório e o deploy será automático a cada `git push`.
- **Netlify**: Conecte o repositório em [netlify.com](https://netlify.com) com comando de build `npm run build` e diretório de saída `dist`.
- **Render**: Suporte nativo a projetos Vite/React com SSL e CDN globais.
