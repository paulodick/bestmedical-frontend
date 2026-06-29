import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Upload,
  Search,
  Trash2,
  Loader2,
  Users,
  Save,
  X,
  Filter,
  EyeOff,
  AlertTriangle,
} from "lucide-react";
import { Block, Button } from "../components/ui";
import { api, API_ENABLED } from "../lib/api";

// ===== Tipos =====
interface Contato {
  id: string;
  nome: string;
  empresa?: string | null;
  telefone?: string | null;
  telefonePessoal?: string | null;
  email?: string | null;
  relacionamento: number;
  pessoal: boolean;
}

// Rótulos do nível de relacionamento (1 a 5).
const RELACIONAMENTO_LABEL: Record<number, string> = {
  1: "1 — Sem relacionamento",
  2: "2 — Frio",
  3: "3 — Neutro",
  4: "4 — Bom",
  5: "5 — Excelente",
};

// Cor do "selo" de relacionamento (frio → quente).
function corRelacionamento(n: number): string {
  switch (n) {
    case 5:
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    case 4:
      return "bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30";
    case 3:
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
    case 2:
      return "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30";
    default:
      return "bg-slate-500/15 text-text-muted border-border";
  }
}

// ===== Remove fotos embutidas (PHOTO) de um vCard =====
// Fotos viram base64 enormes (vCard 3.0/4.0) e não são usadas no CRM.
// Trata tanto PHOTO em uma linha quanto valores quebrados em várias linhas
// (continuação começa com espaço ou tab, conforme o padrão vCard).
function removerFotosVcard(texto: string): string {
  const linhas = texto.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let pulandoFoto = false;
  for (const linha of linhas) {
    if (pulandoFoto) {
      // Linhas de continuação do valor começam com espaço ou tab.
      if (/^[ \t]/.test(linha)) continue;
      pulandoFoto = false;
    }
    // PHOTO:... ou PHOTO;TYPE=...;ENCODING=...:<base64>
    if (/^PHOTO[;:]/i.test(linha)) {
      pulandoFoto = true;
      continue;
    }
    out.push(linha);
  }
  return out.join("\n");
}

// ===== Parser de CSV simples (Google Contacts / Excel exportado) =====
function parseCSV(texto: string): Partial<Contato>[] {
  const linhas = texto.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
  if (linhas.length < 2) return [];

  const dividir = (linha: string): string[] => {
    const out: string[] = [];
    let atual = "";
    let dentroAspas = false;
    for (let i = 0; i < linha.length; i++) {
      const ch = linha[i];
      if (ch === '"') {
        if (dentroAspas && linha[i + 1] === '"') {
          atual += '"';
          i++;
        } else {
          dentroAspas = !dentroAspas;
        }
      } else if (ch === "," && !dentroAspas) {
        out.push(atual);
        atual = "";
      } else {
        atual += ch;
      }
    }
    out.push(atual);
    return out.map((s) => s.trim());
  };

  const cabecalho = dividir(linhas[0]).map((h) => h.toLowerCase());
  const acharIdx = (...chaves: string[]) =>
    cabecalho.findIndex((h) => chaves.some((k) => h.includes(k)));

  const iNome = acharIdx("name", "nome", "first name");
  const iSobrenome = acharIdx("last name", "sobrenome");
  const iEmpresa = acharIdx("organization name", "company", "empresa", "organization");
  const iTelefone = acharIdx("phone 1", "telefone", "phone", "celular", "mobile");
  const iTelefone2 = acharIdx("phone 2");
  const iEmail = acharIdx("e-mail 1", "email", "e-mail");

  const out: Partial<Contato>[] = [];
  for (let i = 1; i < linhas.length; i++) {
    const c = dividir(linhas[i]);
    let nome = iNome >= 0 ? c[iNome] || "" : "";
    if (iSobrenome >= 0 && c[iSobrenome]) {
      nome = `${nome} ${c[iSobrenome]}`.trim();
    }
    if (!nome) continue;
    out.push({
      nome,
      empresa: iEmpresa >= 0 ? c[iEmpresa] || undefined : undefined,
      telefone: iTelefone >= 0 ? c[iTelefone] || undefined : undefined,
      telefonePessoal: iTelefone2 >= 0 ? c[iTelefone2] || undefined : undefined,
      email: iEmail >= 0 ? c[iEmail] || undefined : undefined,
    });
  }
  return out;
}

// Opções do filtro da coluna Pessoal.
type FiltroPessoal = "desmarcados" | "marcados" | "todos";

// Chaves das colunas que podem ser ocultadas (recolhidas).
type ColunaCrm =
  | "pessoal"
  | "nome"
  | "empresa"
  | "telefone"
  | "telefonePessoal"
  | "email"
  | "relacionamento";

const COLUNAS_CRM: { key: ColunaCrm; label: string }[] = [
  { key: "pessoal", label: "Pessoal" },
  { key: "empresa", label: "Empresa" },
  { key: "nome", label: "Nome" },
  { key: "telefone", label: "Telefone" },
  { key: "telefonePessoal", label: "Telefone Pessoal" },
  { key: "email", label: "E-mail" },
  { key: "relacionamento", label: "Relacionamento" },
];

export function Crm() {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [editados, setEditados] = useState<Record<string, Contato>>({});
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  // Modal de dupla checagem para apagar TODO o CRM.
  const [confirmarApagarTudo, setConfirmarApagarTudo] = useState(false);
  const [apagandoTudo, setApagandoTudo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ===== Filtros por coluna =====
  const [fNome, setFNome] = useState("");
  const [fEmpresa, setFEmpresa] = useState("");
  const [fTelefone, setFTelefone] = useState("");
  const [fTelefonePessoal, setFTelefonePessoal] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fRelacionamento, setFRelacionamento] = useState<number | "">("");
  // Por padrão mostra apenas os contatos NÃO pessoais (profissionais).
  const [fPessoal, setFPessoal] = useState<FiltroPessoal>("desmarcados");

  // Colunas recolhidas (clicar no título oculta; clicar na faixa reabre).
  const [colunasOcultas, setColunasOcultas] = useState<Set<ColunaCrm>>(
    new Set(),
  );
  const oculta = (k: ColunaCrm) => colunasOcultas.has(k);
  const toggleColuna = (k: ColunaCrm) =>
    setColunasOcultas((prev) => {
      const novo = new Set(prev);
      if (novo.has(k)) novo.delete(k);
      else novo.add(k);
      return novo;
    });

  // Carrega TODOS os contatos uma vez; a filtragem é feita no cliente.
  const carregar = useCallback(async () => {
    if (!API_ENABLED) {
      setErro(
        "O CRM precisa da API conectada. Acesse pelo site publicado (produção).",
      );
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      const res = await api.listarContatosCrm("?pageSize=5000");
      setContatos(res.data as Contato[]);
      setEditados({});
    } catch (e: any) {
      setErro(e?.message || "Falha ao carregar contatos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== Aplicação dos filtros (em memória) =====
  const filtrados = useMemo(() => {
    const norm = (s: string | null | undefined) => (s || "").toLowerCase();
    return contatos.filter((c) => {
      if (fNome && !norm(c.nome).includes(fNome.toLowerCase())) return false;
      if (fEmpresa && !norm(c.empresa).includes(fEmpresa.toLowerCase())) return false;
      if (fTelefone && !norm(c.telefone).includes(fTelefone.toLowerCase())) return false;
      if (
        fTelefonePessoal &&
        !norm(c.telefonePessoal).includes(fTelefonePessoal.toLowerCase())
      )
        return false;
      if (fEmail && !norm(c.email).includes(fEmail.toLowerCase())) return false;
      if (fRelacionamento !== "" && c.relacionamento !== fRelacionamento) return false;
      if (fPessoal === "desmarcados" && c.pessoal) return false;
      if (fPessoal === "marcados" && !c.pessoal) return false;
      return true;
    });
  }, [
    contatos,
    fNome,
    fEmpresa,
    fTelefone,
    fTelefonePessoal,
    fEmail,
    fRelacionamento,
    fPessoal,
  ]);

  const totalQuentes = useMemo(
    () => filtrados.filter((c) => c.relacionamento >= 4).length,
    [filtrados],
  );

  const algumFiltroAtivo =
    !!fNome ||
    !!fEmpresa ||
    !!fTelefone ||
    !!fTelefonePessoal ||
    !!fEmail ||
    fRelacionamento !== "" ||
    fPessoal !== "desmarcados";

  const limparFiltros = () => {
    setFNome("");
    setFEmpresa("");
    setFTelefone("");
    setFTelefonePessoal("");
    setFEmail("");
    setFRelacionamento("");
    setFPessoal("desmarcados");
  };

  // Aplica edição em memória; só persiste ao salvar a linha.
  const editarCampo = (id: string, campo: keyof Contato, valor: any) => {
    setContatos((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [campo]: valor } : c)),
    );
    setEditados((prev) => {
      const base = contatos.find((c) => c.id === id)!;
      return { ...prev, [id]: { ...base, ...prev[id], [campo]: valor } };
    });
  };

  // O checkbox "Pessoal" salva imediatamente (ação de organização rápida).
  const alternarPessoal = async (id: string, valor: boolean) => {
    setContatos((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pessoal: valor } : c)),
    );
    try {
      const c = contatos.find((x) => x.id === id);
      if (!c) return;
      await api.atualizarContatoCrm(id, { ...semId(c), pessoal: valor });
    } catch (e: any) {
      setErro(e?.message || "Falha ao atualizar 'Pessoal'.");
      // reverte em caso de erro
      setContatos((prev) =>
        prev.map((c) => (c.id === id ? { ...c, pessoal: !valor } : c)),
      );
    }
  };

  const salvarLinha = async (id: string) => {
    const c = contatos.find((x) => x.id === id);
    if (!c) return;
    setSalvandoId(id);
    setErro(null);
    try {
      await api.atualizarContatoCrm(id, semId(c));
      setEditados((prev) => {
        const novo = { ...prev };
        delete novo[id];
        return novo;
      });
    } catch (e: any) {
      setErro(e?.message || "Falha ao salvar contato.");
    } finally {
      setSalvandoId(null);
    }
  };

  const adicionar = async () => {
    setErro(null);
    try {
      await api.criarContatoCrm({ nome: "Novo contato", relacionamento: 1 });
      await carregar();
    } catch (e: any) {
      setErro(e?.message || "Falha ao adicionar contato.");
    }
  };

  const remover = async (id: string) => {
    if (!confirm("Remover este contato?")) return;
    setErro(null);
    try {
      await api.removerContatoCrm(id);
      setContatos((prev) => prev.filter((c) => c.id !== id));
    } catch (e: any) {
      setErro(e?.message || "Falha ao remover contato.");
    }
  };

  // Apaga TODO o CRM (chamado pelo modal de dupla checagem ao confirmar "Sim").
  const apagarTudo = async () => {
    setErro(null);
    setAviso(null);
    setApagandoTudo(true);
    try {
      const r = await api.removerTodosContatosCrm();
      setContatos([]);
      setEditados({});
      setConfirmarApagarTudo(false);
      setAviso(`CRM apagado: ${r.removidos} contato(s) removido(s).`);
    } catch (e: any) {
      setErro(e?.message || "Falha ao apagar o CRM.");
    } finally {
      setApagandoTudo(false);
    }
  };

  const aoEscolherArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reimportar o mesmo arquivo
    if (!file) return;
    setImportando(true);
    setErro(null);
    setAviso(null);
    try {
      const texto = await file.text();
      const ehVcf = /\.vcf$/i.test(file.name) || /BEGIN:VCARD/i.test(texto);
      let res;
      if (ehVcf) {
        if (!/BEGIN:VCARD/i.test(texto)) {
          setErro(
            "O arquivo .vcf parece vazio ou em formato não reconhecido (não encontrei nenhum cartão VCARD).",
          );
          setImportando(false);
          return;
        }
        // Remove fotos embutidas (PHOTO) — não são usadas no CRM e são a
        // principal causa de arquivos enormes (cada foto vira base64 gigante).
        const vcardLeve = removerFotosVcard(texto);
        res = await api.importarContatosCrm({ vcard: vcardLeve });
      } else {
        const itens = parseCSV(texto);
        if (!itens.length) {
          setErro(
            "Não encontrei contatos no arquivo. Use um .vcf (vCard) ou um .csv com cabeçalho (ex.: Name, Phone, E-mail).",
          );
          setImportando(false);
          return;
        }
        res = await api.importarContatosCrm({ contatos: itens });
      }
      setAviso(
        `${res.importados} contato(s) importado(s)` +
          (res.ignorados ? `, ${res.ignorados} ignorado(s) (sem nome).` : "."),
      );
      await carregar();
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (/413|too large|muito grande|payload/i.test(msg)) {
        setErro(
          "O arquivo ainda ficou grande demais para o servidor. Tente exportar os contatos sem fotos, ou divida a agenda em arquivos menores.",
        );
      } else {
        setErro(
          "Falha ao importar: " +
            (err?.message || "erro desconhecido") +
            ". Verifique se você está conectado (login) e se o arquivo é .vcf ou .csv.",
        );
      }
    } finally {
      setImportando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">CRM — Contatos</h1>
          <p className="mt-1 text-sm text-text-muted">
            Sua agenda comercial. Importe do celular (.vcf) ou planilha (.csv),
            filtre por qualquer coluna e classifique cada contato de 1 a 5.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".vcf,.csv,text/vcard,text/csv"
            className="hidden"
            onChange={aoEscolherArquivo}
          />
          <Button
            variant="outline"
            icon={importando ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            onClick={() => fileRef.current?.click()}
            disabled={importando || !API_ENABLED}
          >
            {importando ? "Importando..." : "Importar contatos"}
          </Button>
          <Button icon={<Plus size={16} />} onClick={adicionar} disabled={!API_ENABLED}>
            Adicionar
          </Button>
          <Button
            variant="outline"
            icon={<Trash2 size={16} />}
            onClick={() => setConfirmarApagarTudo(true)}
            disabled={!API_ENABLED || contatos.length === 0}
            className="border-danger/40 text-danger hover:border-danger hover:bg-danger/10 hover:text-danger"
          >
            Apagar tudo
          </Button>
        </div>
      </div>

      {/* Resumo + filtro Pessoal + limpar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Users size={15} /> {filtrados.length} de {contatos.length} contato(s)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {totalQuentes} quente(s) (4-5)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-text-muted">Pessoais:</span>
          <select
            value={fPessoal}
            onChange={(e) => setFPessoal(e.target.value as FiltroPessoal)}
            className="cursor-pointer rounded-md border border-border bg-surface px-2 py-1.5 text-[13px] text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="desmarcados">Ocultar pessoais</option>
            <option value="marcados">Só pessoais</option>
            <option value="todos">Mostrar todos</option>
          </select>
          {algumFiltroAtivo && (
            <Button variant="ghost" icon={<X size={14} />} onClick={limparFiltros}>
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {erro && (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {erro}
        </div>
      )}
      {aviso && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
          {aviso}
        </div>
      )}

      <Block title="Planilha de contatos" icon={<Users size={18} />}>
        {carregando ? (
          <div className="flex items-center justify-center py-12 text-text-muted">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : contatos.length === 0 ? (
          <div className="py-12 text-center text-sm text-text-muted">
            Nenhum contato ainda. Use{" "}
            <span className="font-medium text-text">Importar contatos</span> para
            trazer do celular, ou <span className="font-medium text-text">Adicionar</span>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse text-sm">
              <thead>
                {/* Títulos (clique no título oculta a coluna) */}
                <tr className="border-b border-divider text-left text-[12px] uppercase tracking-wide text-text-faint">
                  {/* Ações agora à ESQUERDA, antes do checkbox Pessoal */}
                  <th className="px-2 py-2 text-center font-semibold">Ações</th>
                  {COLUNAS_CRM.map((col) =>
                    oculta(col.key) ? (
                      <ColunaRecolhida
                        key={col.key}
                        as="th"
                        label={col.label}
                        mostrarLabel
                        onMostrar={() => toggleColuna(col.key)}
                      />
                    ) : (
                      <ColunaHeader
                        key={col.key}
                        label={col.label}
                        align={col.key === "pessoal" ? "center" : "left"}
                        onOcultar={() => toggleColuna(col.key)}
                      />
                    ),
                  )}
                </tr>
                {/* Linha de filtros */}
                <tr className="border-b border-divider bg-surface-offset/40">
                  {/* Célula da coluna Ações (ícone de filtro) */}
                  <th className="px-2 py-2 text-center text-text-faint">
                    <Filter size={13} className="mx-auto" />
                  </th>
                  {/* Pessoal (sem filtro) */}
                  {oculta("pessoal") ? (
                    <ColunaRecolhida as="th" label="Pessoal" onMostrar={() => toggleColuna("pessoal")} />
                  ) : (
                    <th className="px-2 py-2" />
                  )}
                  {oculta("empresa") ? (
                    <ColunaRecolhida as="th" label="Empresa" onMostrar={() => toggleColuna("empresa")} />
                  ) : (
                    <th className="px-1 py-1.5">
                      <FiltroInput value={fEmpresa} onChange={setFEmpresa} placeholder="Filtrar empresa" />
                    </th>
                  )}
                  {oculta("nome") ? (
                    <ColunaRecolhida as="th" label="Nome" onMostrar={() => toggleColuna("nome")} />
                  ) : (
                    <th className="px-1 py-1.5">
                      <FiltroInput value={fNome} onChange={setFNome} placeholder="Filtrar nome" />
                    </th>
                  )}
                  {oculta("telefone") ? (
                    <ColunaRecolhida as="th" label="Telefone" onMostrar={() => toggleColuna("telefone")} />
                  ) : (
                    <th className="px-1 py-1.5">
                      <FiltroInput value={fTelefone} onChange={setFTelefone} placeholder="Filtrar" />
                    </th>
                  )}
                  {oculta("telefonePessoal") ? (
                    <ColunaRecolhida as="th" label="Telefone Pessoal" onMostrar={() => toggleColuna("telefonePessoal")} />
                  ) : (
                    <th className="px-1 py-1.5">
                      <FiltroInput value={fTelefonePessoal} onChange={setFTelefonePessoal} placeholder="Filtrar" />
                    </th>
                  )}
                  {oculta("email") ? (
                    <ColunaRecolhida as="th" label="E-mail" onMostrar={() => toggleColuna("email")} />
                  ) : (
                    <th className="px-1 py-1.5">
                      <FiltroInput value={fEmail} onChange={setFEmail} placeholder="Filtrar e-mail" />
                    </th>
                  )}
                  {oculta("relacionamento") ? (
                    <ColunaRecolhida as="th" label="Relacionamento" onMostrar={() => toggleColuna("relacionamento")} />
                  ) : (
                    <th className="px-1 py-1.5">
                      <select
                        value={fRelacionamento}
                        onChange={(e) =>
                          setFRelacionamento(e.target.value === "" ? "" : Number(e.target.value))
                        }
                        className="w-full cursor-pointer rounded-md border border-border bg-surface px-2 py-1.5 text-[12px] font-normal text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">Todos</option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {RELACIONAMENTO_LABEL[n]}
                          </option>
                        ))}
                      </select>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr>
                    <td
                      colSpan={COLUNAS_CRM.length + 1}
                      className="py-8 text-center text-sm text-text-muted"
                    >
                      Nenhum contato corresponde aos filtros.
                    </td>
                  </tr>
                ) : (
                  filtrados.map((c) => {
                    const sujo = !!editados[c.id];
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-divider/60 align-middle hover:bg-surface-offset/40"
                      >
                        {/* Ações à ESQUERDA: Excluir sempre; Salvar quando houver alteração */}
                        <td className="px-2 py-1">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              title="Excluir contato"
                              onClick={() => remover(c.id)}
                              className="rounded-md p-1.5 text-text-muted transition hover:bg-danger/10 hover:text-danger"
                            >
                              <Trash2 size={16} />
                            </button>
                            {sujo && (
                              <button
                                title="Salvar"
                                onClick={() => salvarLinha(c.id)}
                                disabled={salvandoId === c.id}
                                className="rounded-md p-1.5 text-emerald-600 transition hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-400"
                              >
                                {salvandoId === c.id ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <Save size={16} />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                        {/* Pessoal */}
                        {oculta("pessoal") ? (
                          <ColunaRecolhida label="Pessoal" onMostrar={() => toggleColuna("pessoal")} />
                        ) : (
                          <td className="px-2 py-1 text-center">
                            <input
                              type="checkbox"
                              checked={c.pessoal}
                              onChange={(e) => alternarPessoal(c.id, e.target.checked)}
                              title="Marcar como contato pessoal"
                              className="h-4 w-4 cursor-pointer accent-primary"
                            />
                          </td>
                        )}
                        {/* Empresa */}
                        {oculta("empresa") ? (
                          <ColunaRecolhida label="Empresa" onMostrar={() => toggleColuna("empresa")} />
                        ) : (
                          <td className="px-1 py-1">
                            <CelulaInput value={c.empresa || ""} onChange={(v) => editarCampo(c.id, "empresa", v)} />
                          </td>
                        )}
                        {/* Nome */}
                        {oculta("nome") ? (
                          <ColunaRecolhida label="Nome" onMostrar={() => toggleColuna("nome")} />
                        ) : (
                          <td className="px-1 py-1">
                            <CelulaInput value={c.nome} onChange={(v) => editarCampo(c.id, "nome", v)} />
                          </td>
                        )}
                        {/* Telefone */}
                        {oculta("telefone") ? (
                          <ColunaRecolhida label="Telefone" onMostrar={() => toggleColuna("telefone")} />
                        ) : (
                          <td className="px-1 py-1">
                            <CelulaInput value={c.telefone || ""} onChange={(v) => editarCampo(c.id, "telefone", v)} />
                          </td>
                        )}
                        {/* Telefone Pessoal */}
                        {oculta("telefonePessoal") ? (
                          <ColunaRecolhida label="Telefone Pessoal" onMostrar={() => toggleColuna("telefonePessoal")} />
                        ) : (
                          <td className="px-1 py-1">
                            <CelulaInput
                              value={c.telefonePessoal || ""}
                              onChange={(v) => editarCampo(c.id, "telefonePessoal", v)}
                            />
                          </td>
                        )}
                        {/* E-mail */}
                        {oculta("email") ? (
                          <ColunaRecolhida label="E-mail" onMostrar={() => toggleColuna("email")} />
                        ) : (
                          <td className="px-1 py-1">
                            <CelulaInput type="email" value={c.email || ""} onChange={(v) => editarCampo(c.id, "email", v)} />
                          </td>
                        )}
                        {/* Relacionamento */}
                        {oculta("relacionamento") ? (
                          <ColunaRecolhida label="Relacionamento" onMostrar={() => toggleColuna("relacionamento")} />
                        ) : (
                          <td className="px-1 py-1">
                            <select
                              value={c.relacionamento}
                              onChange={(e) => editarCampo(c.id, "relacionamento", Number(e.target.value))}
                              className={`w-full cursor-pointer rounded-md border px-2 py-1.5 text-[13px] font-medium outline-none transition focus:ring-2 focus:ring-primary/20 ${corRelacionamento(
                                c.relacionamento,
                              )}`}
                            >
                              {[1, 2, 3, 4, 5].map((n) => (
                                <option key={n} value={n}>
                                  {RELACIONAMENTO_LABEL[n]}
                                </option>
                              ))}
                            </select>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        {Object.keys(editados).length > 0 && (
          <div className="mt-3 flex items-center gap-2 text-[12px] text-amber-600 dark:text-amber-400">
            <Save size={14} />
            Há alterações não salvas. Clique no ícone de salvar (verde) em cada
            linha alterada. (O checkbox Pessoal é salvo automaticamente.)
          </div>
        )}
      </Block>

      {/* Modal de dupla checagem para apagar TODO o CRM */}
      {confirmarApagarTudo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !apagandoTudo && setConfirmarApagarTudo(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-text">
                  Apagar todo o CRM?
                </h3>
                <p className="mt-1 text-[13px] text-text-muted">
                  Esta ação vai remover <strong>todos os {contatos.length}{" "}
                  contato(s)</strong> importados do CRM. Não é possível desfazer.
                  Tem certeza?
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmarApagarTudo(false)}
                disabled={apagandoTudo}
              >
                Não
              </Button>
              <Button
                onClick={apagarTudo}
                disabled={apagandoTudo}
                icon={
                  apagandoTudo ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )
                }
                className="bg-danger text-white hover:bg-danger/90 active:bg-danger/80"
              >
                {apagandoTudo ? "Apagando..." : "Sim, apagar tudo"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Remove o id antes de enviar ao backend (o DTO não espera id).
function semId(c: Contato) {
  return {
    nome: c.nome,
    empresa: c.empresa || undefined,
    telefone: c.telefone || undefined,
    telefonePessoal: c.telefonePessoal || undefined,
    email: c.email || undefined,
    relacionamento: c.relacionamento,
    pessoal: c.pessoal,
  };
}

// Cabeçalho de coluna clicável: clicar no título recolhe a coluna.
function ColunaHeader({
  label,
  onOcultar,
  align = "left",
}: {
  label: string;
  onOcultar: () => void;
  align?: "left" | "center";
}) {
  return (
    <th className="px-2 py-2 font-semibold">
      <button
        type="button"
        onClick={onOcultar}
        title="Clique para ocultar esta coluna"
        className={`group inline-flex w-full items-center gap-1 ${
          align === "center" ? "justify-center" : "justify-start"
        } cursor-pointer text-[12px] uppercase tracking-wide text-text-faint transition hover:text-text`}
      >
        <span>{label}</span>
        <EyeOff
          size={12}
          className="opacity-0 transition group-hover:opacity-70"
        />
      </button>
    </th>
  );
}

// Faixa estreita de uma coluna recolhida: clicar reabre a coluna.
// `as`: 'th' no cabeçalho, 'td' nas linhas.
function ColunaRecolhida({
  label,
  onMostrar,
  as = "td",
  mostrarLabel = false,
}: {
  label: string;
  onMostrar: () => void;
  as?: "th" | "td";
  mostrarLabel?: boolean;
}) {
  const Tag = as as any;
  return (
    <Tag
      onClick={onMostrar}
      title={`Mostrar coluna "${label}"`}
      className="w-7 min-w-7 max-w-7 cursor-pointer border-l border-divider/60 bg-surface-offset/40 p-0 text-center align-middle transition hover:bg-primary-soft"
    >
      {mostrarLabel ? (
        <span
          className="mx-auto block whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-text-faint"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {label}
        </span>
      ) : (
        <span className="text-text-faint">·</span>
      )}
    </Tag>
  );
}

// Campo de filtro compacto (cabeçalho da tabela).
function FiltroInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-text-faint" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-surface py-1.5 pl-7 pr-2 text-[12px] font-normal text-text placeholder:text-text-faint outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}

// Célula de input "transparente" que vira campo ao focar.
function CelulaInput({
  value,
  onChange,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-[13px] text-text outline-none transition hover:border-border focus:border-primary focus:bg-surface focus:ring-2 focus:ring-primary/20"
    />
  );
}
