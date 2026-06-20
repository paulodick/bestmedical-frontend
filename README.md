# Best Medical — Sistema de Orçamentos (MVP V1)

MVP navegável de front-end para gestão de orçamentos de visita técnica de
equipamentos médicos. **Sem backend, sem banco de dados real, sem envio real
de e-mails** — tudo simulado no front-end com dados mockados.

## Stack

- **React + TypeScript + Vite**
- **Tailwind CSS** (design system próprio — tema claro/escuro)
- **lucide-react** (ícones)
- Estado em memória (React Context) — dados fictícios

## Como rodar

```bash
npm install
npm run dev      # servidor de desenvolvimento (http://localhost:5173)
npm run build    # build de produção (pasta dist/)
npm run preview  # pré-visualizar o build
```

## Estrutura

```
src/
  App.tsx                  # shell, navegação, tema claro/escuro
  store.tsx                # estado em memória (dados mockados)
  types.ts                 # tipos de domínio, modalidades, marcas, status
  lib/
    format.ts              # máscaras (CNPJ, CEP, telefone, moeda BRL), datas
    calc.ts                # cálculos de subtotal, desconto e total
    mock.ts                # base de CEPs simulada + orçamentos fictícios
  components/
    ui.tsx                 # campos, botões, blocos, badges
    ItensGrid.tsx          # grade estilo planilha dos itens
    Modal.tsx              # modal genérico
    OrcamentoPreview.tsx   # visualização final / PDF (sem exibir desconto)
  pages/
    NovoOrcamento.tsx      # Página 1 — formulário (blocos 1 a 7)
    Controle.tsx           # Página 2 — tabela, filtros, status
```

## Funcionalidades da V1

### Página 1 — Novo Orçamento
- Número e Data automáticos, editáveis e obrigatórios; demais campos opcionais.
- CEP simula preenchimento automático de endereço (base fictícia em `mock.ts`).
- Bloco do solicitante visualmente separado dos dados da empresa.
- Marca "Outras" habilita campo de texto livre; marcas padrão o desabilitam.
- Grade de itens com máscara monetária BR, total por linha e adição de linhas.
- Desconto em % recalcula o total. O desconto aparece **apenas no sistema** —
  na visualização final somente o total é exibido.
- Botões: Salvar (adiciona à lista), Visualizar (prévia), Gerar PDF
  (impressão do navegador), Enviar (feedback visual de sucesso).

### Página 2 — Controle de Orçamentos
- Lista cronológica (mais recente primeiro) com dados fictícios.
- Filtros por empresa, CNPJ, data e status + busca por texto.
- Status editáveis em dropdown direto na tabela.
- Visualização do orçamento em modal e exportação CSV.

## Evolução futura (preparado para)
- Substituir `store.tsx` por chamadas a uma API real.
- Trocar `consultarCEP` por integração com ViaCEP.
- Persistência em banco de dados e envio real de e-mail/PDF.
