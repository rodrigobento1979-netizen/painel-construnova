<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e6ac396e-aa67-44c1-a3d7-34b1d41e2290

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Sincronização com o GitHub

Para conectar este projeto a um repositório no GitHub:

```bash
# 1. Definir branch principal
git branch -M main

# 2. Vincular seu repositório remoto (substitua com a sua URL do GitHub)
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git

# 3. Enviar para o GitHub
git push -u origin main
```

Para mais detalhes e guia de geração de token (PAT), consulte [GITHUB_SYNC.md](./GITHUB_SYNC.md).
