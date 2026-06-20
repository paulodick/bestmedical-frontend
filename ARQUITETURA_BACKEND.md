# Arquitetura de Backend — Best Medical (Sistema de Orçamentos)

Documento de arquitetura técnica. Define como evoluir o MVP front-end atual para
uma aplicação real com backend, banco de dados, autenticação e controle
financeiro — sem reescrever a interface já construída.

> Status: proposta de arquitetura (não é implementação).
> Princípio condutor: simplicidade, organização e escalabilidade suficiente para
> operação real. Nada além do necessário.

---

## 0. Premissas e mapeamento do front-end atual

O backend é desenhado a partir do que o front-end já faz hoje. Mapeamento direto:

| Front-end hoje (mockado) | O que o backend assume |
| --- | --- |
| `store.tsx` — salvar / atualizar / remover em memória | CRUD de orçamentos persistido em banco |
| `proximoNumero()` — `ORC-{ano}-{seq}` | Numeração automática server-side, atômica por ano |
| `consultarCEP()` — base fictícia | Integração real (ViaCEP) ou cache próprio |
| `calc.ts` — totais, desconto, parcelas no cliente | Mesmos cálculos validados/recalculados no servidor |
| 6 status booleanos + dropdown inline | Campos de status persistidos e editáveis via API |
| Botões Salvar / Visualizar / Gerar PDF / Enviar | Endpoints de CRUD, geração de PDF e envio de e-mail |
| Filtros (empresa, CNPJ, data, status) + busca + CSV | Query params de listagem + exportação |

Decisões de modelagem herdadas do front-end:

- **Valores monetários**: o front usa reais como número decimal. No banco serão
  armazenados em **centavos (inteiro)** para eliminar erros de ponto flutuante;
  a API expõe/recebe em reais (conversão na borda). Isso não muda a interface.
- **Itens** e **Parcelas** são listas dentro do orçamento → viram **tabelas
  filhas** (1:N), não JSON, para permitir filtros/relatórios financeiros.
- **Empresa/cliente e solicitante**: hoje são campos soltos no orçamento. Serão
  **normalizados em tabelas próprias** (Cliente e Contato) para reaproveitamento
  e para o futuro controle financeiro por cliente — mantendo snapshot no
  orçamento (ver regra RN-02).

---

## 1. Modelagem de dados (visão conceitual)

Entidades principais:

- **Usuario** — quem opera o sistema (login, perfil de acesso).
- **Cliente** — empresa/clínica/hospital (dados fixos: CNPJ, endereço).
- **Contato** — solicitante vinculado a um cliente (nome, setor, telefone, e-mail).
- **Equipamento** *(opcional, fase 2)* — cadastro de equipamentos do cliente.
- **Orcamento** — documento central (cabeçalho, dados técnicos, totais, status).
- **ItemOrcamento** — linhas da grade de itens (1:N com Orçamento).
- **Parcela** — linhas do controle de pagamento (1:N com Orçamento).
- **Anexo / DocumentoGerado** *(fase 2)* — PDFs gerados e armazenados.
- **EventoOrcamento / Auditoria** *(fase 2)* — histórico de ações.

Tabelas de apoio (catálogos): **Modalidade** e **Marca** podem ser enums fixos
(como hoje) ou tabelas no futuro. Recomendação: começar como **enum/constante**
(igual ao front) e só promover a tabela se o cliente quiser gerenciá-los pela UI.

---

## 2. Entidades e relacionamentos

```
Usuario (1) ───< (N) Orcamento        [criadoPor / responsável]
Cliente (1) ───< (N) Contato
Cliente (1) ───< (N) Orcamento
Contato (0..1) ──< (N) Orcamento       [solicitante do orçamento]
Orcamento (1) ──< (N) ItemOrcamento
Orcamento (1) ──< (N) Parcela
Orcamento (1) ──< (N) DocumentoGerado  [fase 2]
Orcamento (1) ──< (N) EventoOrcamento  [fase 2 — auditoria]
Cliente (1) ───< (N) Equipamento       [fase 2]
```

Cardinalidades e regras de vínculo:

- Um **Orçamento** pertence a **um Cliente** e (opcionalmente) a **um Contato**.
- Um **Orçamento** tem **N itens** e **N parcelas** (exclusão em cascata).
- Um **Contato** pertence a **um Cliente**.
- Um **Orçamento** referencia o **Usuário** que o criou (e, futuramente, o
  responsável comercial).

---

## 3. Tabelas, campos e tipos

Convenções: `id` = UUID (PK); timestamps `created_at` / `updated_at`; dinheiro em
**centavos** (BIGINT); datas em `DATE`; textos livres em `TEXT`/`VARCHAR`.

### 3.1 `usuarios`
| Campo | Tipo | Regras |
| --- | --- | --- |
| id | UUID PK | |
| nome | VARCHAR(120) | obrigatório |
| email | VARCHAR(180) | único, obrigatório |
| senha_hash | VARCHAR(255) | hash (bcrypt/argon2) |
| perfil | ENUM(`admin`,`operador`,`visualizador`) | default `operador` |
| ativo | BOOLEAN | default true |
| created_at / updated_at | TIMESTAMP | |

### 3.2 `clientes`
| Campo | Tipo | Regras |
| --- | --- | --- |
| id | UUID PK | |
| cnpj | VARCHAR(18) | único quando preenchido; máscara `00.000.000/0000-00` |
| nome | VARCHAR(180) | empresa / clínica / hospital |
| cep | VARCHAR(9) | |
| endereco | VARCHAR(200) | |
| bairro | VARCHAR(120) | |
| cidade | VARCHAR(120) | |
| estado | CHAR(2) | UF |
| pais | VARCHAR(60) | default `Brasil` |
| created_at / updated_at | TIMESTAMP | |

### 3.3 `contatos`
| Campo | Tipo | Regras |
| --- | --- | --- |
| id | UUID PK | |
| cliente_id | UUID FK → clientes | obrigatório |
| nome | VARCHAR(120) | solicitante |
| setor | VARCHAR(120) | |
| telefone | VARCHAR(20) | |
| email | VARCHAR(180) | |
| created_at / updated_at | TIMESTAMP | |

### 3.4 `orcamentos`
| Campo | Tipo | Regras |
| --- | --- | --- |
| id | UUID PK | |
| numero | VARCHAR(20) | único; `ORC-{ano}-{seq}` (RN-01) |
| data | DATE | obrigatório (default hoje) |
| cliente_id | UUID FK → clientes | obrigatório |
| contato_id | UUID FK → contatos | opcional |
| criado_por | UUID FK → usuarios | |
| **snapshot do cliente/solicitante** | (ver RN-02) | colunas espelho para histórico |
| cliente_nome_snap, cliente_cnpj_snap, ... | VARCHAR | preenchidos na emissão |
| solicitante_snap, setor_snap, telefone_snap, email_snap | VARCHAR | |
| modalidade | VARCHAR(60) | enum de domínio |
| marca | VARCHAR(40) | enum de domínio |
| marca_outras | VARCHAR(60) | usado quando marca = `Outras` (RN-03) |
| modelo | VARCHAR(120) | |
| numero_serie | VARCHAR(80) | |
| descricao_visita | TEXT | |
| desconto_percent | NUMERIC(5,2) | 0–100 |
| num_parcelas | INT | default 1 |
| observacoes | TEXT | |
| texto_final | TEXT | default = texto padrão atual |
| subtotal_centavos | BIGINT | calculado (RN-04) |
| desconto_centavos | BIGINT | calculado |
| total_centavos | BIGINT | calculado |
| status_enviado | BOOLEAN | default false |
| status_aprovado | BOOLEAN | default false |
| status_realizado | BOOLEAN | default false |
| status_aguardando_peca | BOOLEAN | default false |
| status_ordem_servico | BOOLEAN | default false |
| status_pagamento_realizado | BOOLEAN | default false |
| enviado_em | TIMESTAMP | preenchido ao enviar |
| created_at / updated_at | TIMESTAMP | |

> Os 6 status booleanos espelham exatamente as colunas da página de Controle.
> Alternativa de evolução: um campo `situacao` (ENUM workflow) — ver Fase 2.

### 3.5 `itens_orcamento`
| Campo | Tipo | Regras |
| --- | --- | --- |
| id | UUID PK | |
| orcamento_id | UUID FK → orcamentos | cascade delete |
| ordem | INT | posição na grade |
| codigo | VARCHAR(60) | código do produto |
| descricao | VARCHAR(200) | item |
| quantidade | INT | ≥ 1 (default 1) |
| valor_item_centavos | BIGINT | ≥ 0 |
| (valor_total) | — | derivado: quantidade × valor_item (não armazenar) |

### 3.6 `parcelas`
| Campo | Tipo | Regras |
| --- | --- | --- |
| id | UUID PK | |
| orcamento_id | UUID FK → orcamentos | cascade delete |
| numero | INT | sequencial 1..N (RN-06) |
| data_vencimento | DATE | 1ª manual; demais +30 dias (RN-06) |
| valor_centavos | BIGINT | divisão/redistribuição (RN-07) |
| pago | BOOLEAN | default false (controle financeiro) |
| pago_em | DATE | opcional |

### 3.7 `documentos_gerados` *(fase 2)*
| Campo | Tipo | Regras |
| --- | --- | --- |
| id | UUID PK | |
| orcamento_id | UUID FK | |
| tipo | ENUM(`pdf`) | |
| url / storage_key | VARCHAR | local do arquivo (S3/disco) |
| gerado_em | TIMESTAMP | |

### 3.8 `eventos_orcamento` *(fase 2 — auditoria)*
| Campo | Tipo | Regras |
| --- | --- | --- |
| id | UUID PK | |
| orcamento_id | UUID FK | |
| usuario_id | UUID FK | |
| tipo | ENUM(`criado`,`editado`,`enviado`,`status_alterado`,`pdf_gerado`) | |
| detalhe | JSONB | payload do que mudou |
| created_at | TIMESTAMP | |

---

## 4. Regras de negócio principais

- **RN-01 — Numeração automática.** `numero = ORC-{ano}-{sequencial}` com 4
  dígitos, reiniciando a cada ano. Geração **atômica no servidor** (sequence por
  ano ou transação com lock) para evitar duplicidade em uso concorrente. Campo
  permanece editável pelo usuário (igual ao front), mas a unicidade é validada.

- **RN-02 — Snapshot do cliente/solicitante.** Ao emitir/enviar, o orçamento
  guarda uma cópia (snapshot) dos dados de cliente e solicitante. Assim, alterar
  o cadastro do cliente depois **não muda orçamentos já emitidos** (integridade
  histórica e fiscal). O vínculo por FK continua para relatórios.

- **RN-03 — Marca "Outras".** Se `marca = Outras`, `marca_outras` é considerado;
  caso contrário é ignorado/limpo. (Espelha a regra da UI: campo habilitado só
  quando "Outras".)

- **RN-04 — Cálculo de totais (fonte da verdade no servidor).**
  `subtotal = Σ(quantidade × valor_item)`;
  `desconto = subtotal × desconto_percent/100`;
  `total = subtotal − desconto`.
  O front calcula para exibir; o backend **recalcula e persiste** para garantir
  integridade. Resposta da API sempre devolve os valores oficiais.

- **RN-05 — Exibição do desconto.** O desconto é dado interno; na visualização do
  cliente só aparece quando `desconto_percent > 0` (a API expõe os três valores;
  a decisão de exibir é da UI, já implementada).

- **RN-06 — Datas das parcelas.** 1ª parcela: data informada. Parcelas seguintes:
  **+30 dias corridos** acumulados a partir da anterior. Todas editáveis. O
  backend valida que `numero` é sequencial e que há `num_parcelas` linhas.

- **RN-07 — Distribuição/redistribuição de valores.** Valor padrão = `total /
  num_parcelas` (resíduo de centavos na última). Ao editar a parcela *k*, as
  parcelas `1..k` ficam travadas e o restante (`total − Σ(1..k)`) é dividido
  igualmente entre `k+1..N`. **Invariante: Σ(parcelas) = total.** O backend
  valida essa invariante ao salvar.

- **RN-08 — Tabela de parcelamento no PDF do cliente.** Só incluída quando
  `num_parcelas > 1` (à vista não exibe). Regra já refletida na UI.

- **RN-09 — Status e fluxo.** Os 6 status são independentes (booleanos) nesta
  fase. "Enviar" marca `status_enviado = true` e grava `enviado_em`. Evolução
  possível para máquina de estados na Fase 2 (ver §8).

- **RN-10 — Permissões.** `admin`: tudo. `operador`: cria/edita/envia orçamentos.
  `visualizador`: somente leitura e exportação. (Aplicado nos endpoints.)

---

## 5. Endpoints REST

Base: `/api/v1`. Autenticação via `Authorization: Bearer <token>`. Respostas em
JSON; dinheiro exposto em reais (decimal) na borda.

### Autenticação
| Método | Rota | Descrição | Perfil |
| --- | --- | --- | --- |
| POST | `/auth/login` | login, retorna access + refresh token | público |
| POST | `/auth/refresh` | renova access token | autenticado |
| POST | `/auth/logout` | invalida refresh token | autenticado |
| GET | `/auth/me` | dados do usuário logado | autenticado |

### Orçamentos (núcleo — conecta o front atual)
| Método | Rota | Descrição | Perfil |
| --- | --- | --- | --- |
| GET | `/orcamentos` | listar com filtros e busca (ver query params) | todos |
| POST | `/orcamentos` | criar (Salvar orçamento) | operador+ |
| GET | `/orcamentos/{id}` | detalhe completo (itens + parcelas) | todos |
| PUT | `/orcamentos/{id}` | atualizar orçamento completo | operador+ |
| PATCH | `/orcamentos/{id}/status` | alterar 1+ status (dropdown inline) | operador+ |
| DELETE | `/orcamentos/{id}` | remover | admin |
| GET | `/orcamentos/proximo-numero` | número sugerido `ORC-{ano}-{seq}` | operador+ |
| POST | `/orcamentos/{id}/enviar` | enviar por e-mail (marca enviado) | operador+ |
| GET | `/orcamentos/{id}/pdf` | gerar/baixar PDF | todos |
| GET | `/orcamentos/export` | exportar CSV (respeita filtros) | todos |

Query params de `GET /orcamentos` (espelham os filtros da tela de Controle):
`?busca=texto&cliente_id=&cnpj=&data=&status=enviado&page=&page_size=&order=data_desc`

### Clientes e contatos
| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/clientes` | listar/buscar (autocompletar empresa/CNPJ) |
| POST | `/clientes` | criar |
| GET | `/clientes/{id}` | detalhe |
| PUT | `/clientes/{id}` | atualizar |
| GET | `/clientes/{id}/contatos` | contatos do cliente |
| POST | `/clientes/{id}/contatos` | criar contato |

### Utilitários
| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/cep/{cep}` | consulta CEP (proxy ViaCEP + cache) — substitui o mock |
| GET | `/catalogos/modalidades` | lista de modalidades |
| GET | `/catalogos/marcas` | lista de marcas |

### Controle financeiro (parcelas) — Fase 2
| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/parcelas` | listar parcelas com filtros (vencimento, pago, cliente) |
| PATCH | `/parcelas/{id}` | marcar paga / alterar data ou valor |
| GET | `/financeiro/resumo` | totais a receber, vencidas, recebidas |

---

## 6. Stack recomendada

Duas opções, ambas alinhadas a "simplicidade + escalabilidade suficiente".

### Opção A — Recomendada (continuidade com o front atual)
- **Runtime/linguagem:** Node.js + TypeScript (mesma linguagem do front → um só
  ecossistema, tipos compartilhados).
- **Framework HTTP:** NestJS (estruturado, modular, ótimo para crescer com perfis
  de acesso e camadas) — ou Express, se preferir algo mais enxuto no início.
- **ORM:** Prisma (migrations, tipos automáticos, produtivo).
- **Banco:** PostgreSQL (relacional, transações, ótimo para financeiro e
  relatórios; suporta `JSONB` para auditoria).
- **Autenticação:** JWT (access curto + refresh) com hash de senha argon2/bcrypt.
  Perfis via roles no token + guards por endpoint.
- **PDF:** geração server-side com Puppeteer (renderiza um HTML idêntico ao
  layout do `OrcamentoPreview`) ou React-PDF. Puppeteer reaproveita o visual já
  pronto.
- **E-mail:** provedor transacional (Resend, SendGrid ou Amazon SES) com template
  do orçamento + PDF anexo.
- **Armazenamento de PDFs:** S3 (ou disco no início).
- **Infra:** Docker; deploy em Render/Railway/Fly.io (simples) ou AWS (escala).

### Opção B — Backend gerenciado (menos código de infraestrutura)
- **Supabase** (PostgreSQL + Auth + Storage prontos). Acelera muito o início;
  bom se a prioridade é velocidade. Atenção: regras de negócio mais ricas (RN-01,
  RN-07) pedem Edge Functions/RPC para ficarem no servidor.

> Recomendação final: **Opção A com NestJS + Prisma + PostgreSQL + JWT**.
> Equilíbrio entre organização, controle das regras de negócio e escalabilidade
> real, mantendo TypeScript de ponta a ponta.

---

## 7. Perfis de acesso (autorização)

| Perfil | Orçamentos | Clientes | Status | Financeiro | Usuários |
| --- | --- | --- | --- | --- | --- |
| **admin** | CRUD + excluir | CRUD | editar | total | gerenciar |
| **operador** | criar/editar/enviar | criar/editar | editar | marcar pago | — |
| **visualizador** | ler/exportar | ler | — | ler | — |

Implementação: role no JWT + guard por rota. Estrutura já pensada para granular
mais no futuro (ex.: permissões por recurso) sem refatoração grande.

---

## 8. Ordem recomendada de implementação (por fases)

### Fase 1 — Fundação e paridade com o front (MVP real)
1. Projeto backend (NestJS + Prisma + PostgreSQL) + Docker + migrations.
2. **Auth** (login, JWT, hash, `/auth/me`) com perfil único `operador`.
3. Tabelas núcleo: `usuarios`, `clientes`, `contatos`, `orcamentos`,
   `itens_orcamento`, `parcelas`.
4. **CRUD de Orçamentos** com itens e parcelas aninhados (PUT completo).
5. **Numeração automática** (RN-01) e **cálculo de totais no servidor** (RN-04).
6. **PATCH de status** (dropdown inline) e listagem com **filtros/busca/paginação**.
7. `GET /cep/{cep}` real (ViaCEP) substituindo o mock.
8. Conectar o front: trocar `store.tsx` por chamadas à API (sem mudar a UI).

### Fase 2 — Documentos, envio e controle financeiro
9. **Geração de PDF** server-side (Puppeteer com o layout atual).
10. **Envio por e-mail** com PDF anexo (`/orcamentos/{id}/enviar`).
11. **Snapshot** de cliente/solicitante na emissão (RN-02).
12. **Controle financeiro de parcelas** (marcar paga, vencimentos, resumo).
13. **Perfis de acesso** completos (admin / operador / visualizador).
14. **Auditoria** (`eventos_orcamento`) e histórico por orçamento.

### Fase 3 — Escala e produtividade (opcional)
15. Cadastro de **Equipamentos** por cliente e histórico de manutenções.
16. **Catálogos** (modalidades/marcas) gerenciáveis pela UI.
17. Dashboard/relatórios (conversão de orçamentos, faturamento, recebíveis).
18. Máquina de estados de status (substituir 6 booleanos por workflow).
19. Multiempresa / multiusuário avançado, notificações, integrações fiscais.

---

## 9. O que pode ficar para a Fase 2 (resumo)

- Geração de PDF e envio de e-mail (na Fase 1 podem permanecer simulados no front).
- Snapshot histórico de cliente/solicitante.
- Controle financeiro de parcelas (pago/vencido/recebíveis).
- Perfis de acesso completos (Fase 1 pode rodar com um perfil único).
- Auditoria e histórico de eventos.
- Cadastro de equipamentos, catálogos editáveis e dashboards.

---

## 10. Notas de compatibilidade com o front-end (não muda a interface)

- A API expõe exatamente os campos que o front já usa; a única diferença interna
  é dinheiro em centavos (convertido na borda) e cliente/solicitante normalizados.
- O contrato de listagem cobre todos os filtros e a busca já existentes.
- A troca do `store.tsx` (memória) por um cliente HTTP é o único ponto de
  integração — telas, componentes e fluxos permanecem idênticos.
- Os cálculos do `calc.ts` permanecem no front para resposta imediata; o servidor
  apenas valida e é a fonte da verdade na persistência.
