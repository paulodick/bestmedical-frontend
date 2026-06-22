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
} from "lucide-react";
import { Block, Button, Input } from "../components/ui";
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

// ===== Parser de CSV simples (Google Contacts / Excel exportado) =====
// Suporta vírgula como separador e aspas. Mapeia colunas conhecidas.
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
    if ((!nome || iNome < 0) && iSobrenome >= 0) {
      nome = `${nome} ${c[iSobrenome] || ""}`.trim();
    } else if (iSobrenome >= 0 && c[iSobrenome]) {
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

export function Crm() {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // Linhas com edições pendentes (id -> contato editado).
  const [editados, setEditados] = useState<Record<string, Contato>>({});
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
      const q = busca.trim()
        ? `?pageSize=100&busca=${encodeURIComponent(busca.trim())}`
        : "?pageSize=100";
      const res = await api.listarContatosCrm(q);
      setContatos(res.data as Contato[]);
      setEditados({});
    } catch (e: any) {
      setErro(e?.message || "Falha ao carregar contatos.");
    } finally {
      setCarregando(false);
    }
  }, [busca]);

  useEffect(() => {
    carregar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Busca com debounce.
  useEffect(() => {
    const t = setTimeout(() => carregar(), 350);
    return () => clearTimeout(t);
  }, [busca]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalQuentes = useMemo(
    () => contatos.filter((c) => c.relacionamento >= 4).length,
    [contatos],
  );

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

  const salvarLinha = async (id: string) => {
    const c = contatos.find((x) => x.id === id);
    if (!c) return;
    setSalvandoId(id);
    setErro(null);
    try {
      await api.atualizarContatoCrm(id, {
        nome: c.nome,
        empresa: c.empresa || undefined,
        telefone: c.telefone || undefined,
        telefonePessoal: c.telefonePessoal || undefined,
        email: c.email || undefined,
        relacionamento: c.relacionamento,
      });
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
        res = await api.importarContatosCrm({ vcard: texto });
      } else {
        const itens = parseCSV(texto);
        if (!itens.length) {
          setErro("Não encontrei contatos no arquivo. Verifique o formato (.vcf ou .csv).");
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
      setErro(err?.message || "Falha ao importar o arquivo.");
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
            Sua agenda comercial. Importe do celular (.vcf) ou planilha (.csv) e
            classifique cada contato de 1 a 5.
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
          <Button
            icon={<Plus size={16} />}
            onClick={adicionar}
            disabled={!API_ENABLED}
          >
            Adicionar
          </Button>
        </div>
      </div>

      {/* Resumo + busca */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 text-sm text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Users size={15} /> {contatos.length} contato(s)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {totalQuentes} quente(s) (4-5)
          </span>
        </div>
        <div className="w-full sm:max-w-xs">
          <Input
            icon={<Search size={16} />}
            placeholder="Buscar por nome, empresa, e-mail..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
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
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-divider text-left text-[12px] uppercase tracking-wide text-text-faint">
                  <th className="px-2 py-2 font-semibold">Nome</th>
                  <th className="px-2 py-2 font-semibold">Empresa</th>
                  <th className="px-2 py-2 font-semibold">Telefone</th>
                  <th className="px-2 py-2 font-semibold">Telefone Pessoal</th>
                  <th className="px-2 py-2 font-semibold">E-mail</th>
                  <th className="px-2 py-2 font-semibold">Relacionamento</th>
                  <th className="px-2 py-2 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {contatos.map((c) => {
                  const sujo = !!editados[c.id];
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-divider/60 align-middle hover:bg-surface-offset/40"
                    >
                      <td className="px-1 py-1">
                        <CelulaInput
                          value={c.nome}
                          onChange={(v) => editarCampo(c.id, "nome", v)}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <CelulaInput
                          value={c.empresa || ""}
                          onChange={(v) => editarCampo(c.id, "empresa", v)}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <CelulaInput
                          value={c.telefone || ""}
                          onChange={(v) => editarCampo(c.id, "telefone", v)}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <CelulaInput
                          value={c.telefonePessoal || ""}
                          onChange={(v) => editarCampo(c.id, "telefonePessoal", v)}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <CelulaInput
                          type="email"
                          value={c.email || ""}
                          onChange={(v) => editarCampo(c.id, "email", v)}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <select
                          value={c.relacionamento}
                          onChange={(e) =>
                            editarCampo(c.id, "relacionamento", Number(e.target.value))
                          }
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
                      <td className="px-1 py-1">
                        <div className="flex items-center justify-end gap-1">
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
                          <button
                            title="Remover"
                            onClick={() => remover(c.id)}
                            className="rounded-md p-1.5 text-text-muted transition hover:bg-danger/10 hover:text-danger"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {Object.keys(editados).length > 0 && (
          <div className="mt-3 flex items-center gap-2 text-[12px] text-amber-600 dark:text-amber-400">
            <X size={14} />
            Há alterações não salvas. Clique no ícone de salvar (verde) em cada
            linha alterada.
          </div>
        )}
      </Block>
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
