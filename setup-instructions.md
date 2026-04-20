# Configuração para Supabase e Vercel

## 1. Script SQL para Supabase

Execute o script abaixo no Editor SQL do seu projeto no Supabase para criar as tabelas necessárias:

```sql
-- Habilitar extensão para IDs aleatórios (UUID)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabela de Empresas
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Lançamentos (Compras e Vendas)
CREATE TABLE entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  purchases NUMERIC DEFAULT 0,
  sales NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  -- Garante que só exista um lançamento por empresa/mês/ano
  UNIQUE (company_id, year, month)
);

-- Índices para melhor performance
CREATE INDEX idx_entries_company_year ON entries(company_id, year);
CREATE INDEX idx_entries_year_month ON entries(year, month);
```

---

## 2. Hospedagem na Vercel

Como este é um aplicativo React construído com Vite, a Vercel o identificará e configurará automaticamente.

### Passos para Implantação:

1.  **Prepare o Código**:
    *   Certifique-se de que seu código está em um repositório GitHub, GitLab ou Bitbucket.
2.  **Importe no Vercel**:
    *   Vá para [vercel.com](https://vercel.com).
    *   Clique em "Add New" -> "Project".
    *   Importe seu repositório.
3.  **Configurações do Projeto**:
    *   O Vercel deve detectar automaticamente o **Vite** como o Framework Preset.
    *   **Build Command**: `npm run build`
    *   **Output Directory**: `dist`
4.  **Variáveis de Ambiente (Se for usar Supabase no código futuramente)**:
    *   Se no futuro você integrar o SDK do Supabase no código, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas configurações de Environment Variables da Vercel.
5.  **Build**:
    *   Clique em **Deploy**.

### Se quiser apenas o arquivo HTML (Estático):
Se você precisar apenas de um arquivo estático para testes rápidos (embora não recomendado para React), você pode rodar `npm run build` localmente e a Vercel servirá o conteúdo da pasta `dist/` automaticamente se você arrastar essa pasta para o painel de "Deploy" do site.
