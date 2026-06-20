# Front-end integrado à API — Integração e publicação

O front-end agora consome a **API real** (NestJS) quando a variável
`VITE_API_URL` está definida. Sem essa variável, ele continua em **modo
demonstração** (dados mockados) — exatamente como antes. **A interface, o layout,
o design e o fluxo visual não mudaram.**

---

## 1. O que mudou (apenas a camada técnica)

Arquivos **novos**:
- `src/lib/api.ts` — cliente HTTP (login, orçamentos, status, CEP) com token JWT.
- `src/auth.tsx` — contexto de autenticação (login/logout, usuário atual).
- `src/pages/Login.tsx` — tela de login simples (usa os mesmos componentes/estilos).
- `.env.example` — modelo da variável `VITE_API_URL`.

Arquivos **ajustados** (sem mudar a aparência):
- `src/store.tsx` — mantém a MESMA interface pública (`orcamentos`, `salvar`,
  `atualizar`, `remover`); agora busca/salva via API quando habilitada.
- `src/lib/mock.ts` — `consultarCEP()` usa a API quando habilitada (mesma
  assinatura); mantém a base fictícia como fallback no modo demo.
- `src/App.tsx` — envolve o app no `AuthProvider` e exibe a tela de login quando
  necessário; adiciona um ícone discreto de "Sair" (só no modo API). Todo o resto
  do layout é idêntico.

Nenhum arquivo foi renomeado. As páginas `NovoOrcamento.tsx` e `Controle.tsx` e
todos os componentes visuais permanecem inalterados.

---

## 2. Dois modos de operação

| Modo | Quando | Comportamento |
| --- | --- | --- |
| **Demonstração** | `VITE_API_URL` vazio/ausente | dados mockados, sem login (preview atual) |
| **Real** | `VITE_API_URL` definido | exige login; lê/grava no backend |

Isso permite manter o preview público de demonstração funcionando e, ao mesmo
tempo, rodar a versão real conectada ao backend.

---

## 3. Rodar localmente (conectado ao backend)

Pré-requisito: backend rodando (veja o README do `orcamentos-backend`).

```bash
# no projeto do front (orcamentos-app)
cp .env.example .env
# edite .env:
# VITE_API_URL=http://localhost:3000/api/v1

npm install
npm run dev
```

Abra `http://localhost:5173`, faça login com o usuário do seed
(`admin@bestmedical.com.br` / `admin123`).

---

## 4. Publicar (deploy)

### Backend (Render) — fazer primeiro
Siga o README do `orcamentos-backend` (Blueprint `render.yaml`). Ao final você terá
uma URL como `https://bestmedical-api.onrender.com`. Rode o seed uma vez.

### Front-end
O build é estático. Defina `VITE_API_URL` apontando para a API publicada **antes**
de buildar:

```bash
# exemplo
echo 'VITE_API_URL=https://bestmedical-api.onrender.com/api/v1' > .env
npm run build      # gera a pasta dist/
```

Opções de hospedagem do front:
- **Vercel / Netlify / Render Static Site**: aponte para o projeto, defina a
  variável de ambiente `VITE_API_URL` no painel e use `npm run build` com
  diretório de saída `dist`.
- **pplx.app** (como já fizemos): publicar o `dist`. Importante: defina
  `VITE_API_URL` antes do build para a versão real; sem isso, fica em modo demo.

### CORS
No backend, inclua a URL do front em `CORS_ORIGIN` (no Render, variável de
ambiente do serviço). Ex.: `https://seu-front.vercel.app,http://localhost:5173`.

---

## 5. Checklist de publicação

1. [ ] Backend no Render com PostgreSQL e migrations aplicadas.
2. [ ] Seed executado (usuário admin criado).
3. [ ] `CORS_ORIGIN` do backend inclui a URL do front.
4. [ ] `.env` do front com `VITE_API_URL` apontando para a API.
5. [ ] `npm run build` do front e deploy da pasta `dist`.
6. [ ] Testar login e o fluxo (novo orçamento, salvar, controle, status).

---

## 6. Observações técnicas

- O token JWT é mantido em memória (sem `localStorage`, por compatibilidade com o
  sandbox/iframe). Em produção fora de iframe, é possível persistir o token se
  desejar manter a sessão entre recargas.
- Os valores monetários e datas trafegam no mesmo formato que o front já usa
  (reais e ISO `yyyy-mm-dd`); o backend cuida da conversão interna em centavos.
- Os cálculos continuam no front para resposta imediata; o backend recalcula e é
  a fonte da verdade ao persistir.
