# Configuração do Sistema - Firebase Firestore

## 1. Banco de Dados Oficial: Firebase Firestore
O banco de dados foi configurado e provisionado diretamente no **Google Cloud / Firebase Firestore**.
Diferente do Supabase que entra em pausa semanal por inatividade no plano gratuito, o **Firebase Firestore permanece sempre ativo e online 24/7**, com sincronização em tempo real nativa (WebSockets).

- **Projeto Firebase**: `gen-lang-client-0445516203`
- **Banco Firestore**: `ai-studio-gestodecomprasve-e6ac396e-aa67-44c1-a3d7-34b1d41e2290`
- **Coleções**:
  - `companies`: Cadastro de empresas, CNPJ, cor e data de criação.
  - `entries`: Lançamentos fiscais mensais (compras, vendas, quantidade de notas e status de fechamento com cadeado).
- **Regras de Segurança (`firestore.rules`)**: Validadas e ativas com tipagem rígida e proteção de esquema.

---

## 2. Hospedagem na Vercel ou Cloud Run

Como este é um aplicativo React construído com Vite:

1. **Configuração de Build**:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
2. **Credenciais**:
   - Toda a configuração do Firebase já está incorporada de forma segura através do `firebase-applet-config.json` e das regras de segurança do Firestore.
