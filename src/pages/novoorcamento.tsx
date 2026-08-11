import { useEffect, useRef, useState } from "react";
import {
  Save,
  Eye,
  FileDown,
  Send,
  CheckCircle2,
  Loader2,
  Building2,
  User,
  MapPin,
  Printer,
  X
} from "lucide-react";
import { Block, Button, Input, Select, Textarea } from "../components/ui";
import { ItensGrid } from "../components/ItensGrid";
import { Parcelamento } from "../components/Parcelamento";
import { Modal } from "../components/Modal";
import { OrcamentoPreview } from "../components/OrcamentoPreview";
import { SolicitanteSelector } from "../components/SolicitanteSelector";
import { ModalEnviarSolicitantes } from "../components/ModalEnviarSolicitantes";
import type { Orcamento, Parcela } from "../types";
import type { EnvioComSolicitantes } from "../lib/api";
import { MARCAS, MODALIDADES } from "../types";
import { useStore } from "../store";
import {
  hojeISO,
  maskCEP,
  maskCNPJ,
  formatBRL,
  uid,
} from "../lib/format";
import { consultarCEP, ESTADOS_BR, proximoNumero } from "../lib/mock";
import {
  totalBruto,
  totalFinal,
  valorDesconto,
  gerarParcelas,
} from "../lib/calc";
import { api, API_ENABLED } from "../lib/api";
import type { ItemOrcamento } from "../types";

export const TEXTO_FINAL_PADRAO =
  "Orçamento válido por 15 dias. Qualquer alteração no escopo do serviço poderá alterar os itens e/ou valores listados nesta proposta.";

interface NovoOrcamentoProps {
  orcamentoParaEditar?: Orcamento | null;
}

function novoOrcamentoVazio(numero: string): Orcamento {
  return {
    id: uid(),
    clienteId: null,
    numero,
    data: hojeISO(),
    cnpj: "",
    empresa: "",
    cep: "",
    endereco: "",
    enderecoNumero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    pais: "Brasil",
    solicitante: "",
    setor: "",
    telefone: "",
    email: "",
    modalidade: "",
    marca: "",
    marcaOutras: "",
    modelo: "",
    numeroSerie: "",
    descricaoVisita: "",
    descontoPercent: 0,
    numParcelas: 1,
    observacoes: "",
    itens: [],
    parcelas: [],
    textoFinal: TEXTO_FINAL_PADRAO,
    dataPagamento: null,
    condicaoPagamento: null,
    // Controle / status
    enviado: false,
    aprovado: false,
    realizado: false,
    aguardandoPeca: false,
    ordemServico: false,
    pagamentoRealizado: false,
    reprovado: false,
  };
}

export function NovoOrcamento({ orcamentoParaEditar }: NovoOrcamentoProps = {}) {
  const { orcamentos, salvar } = useStore();

  const [o, setO] = useState<Orcamento>(() => orcamentoParaEditar || novoOrcamentoVazio(proximoNumero(orcamentos)));

  // Atualiza o formulário se o utilizador clicou no número lá na tela de Controle
  useEffect(() => {
    if (orcamentoParaEditar) {
      setO(orcamentoParaEditar);
    }
  }, [orcamentoParaEditar]);

  // Busca o orçamento ao digitar o número (Enter ou ao sair do campo).
  // Em modo real, consulta a API; em modo demo, procura na lista local.
  // Evita disparar quando o número é o do próprio orçamento já aberto.
  const buscarOrcamentoPorNumero = async (numeroDigitado: string) => {
    const alvo = (numeroDigitado || "").trim();
    if (!alvo) return;
    if (alvo.toLowerCase() === (o.numero || "").toLowerCase() && o.empresa) {
      // Já é o orçamento aberto e com dados carregados: nada a fazer.
      return;
    }

    if (API_ENABLED) {
      try {
        const encontrado = await api.buscarPorNumero(alvo);
        setO(encontrado as Orcamento);
        mostrarToast("Orçamento carregado para edição", "sucesso");
      } catch {
        // 404 ou erro de rede: segue como novo orçamento, sem incomodar.
      }
      return;
    }

    // Modo demo (offline)
    const encontrado = orcamentos.find(
      (orc) => orc.numero.toLowerCase() === alvo.toLowerCase(),
    );
    if (encontrado) {
      setO(encontrado);
      mostrarToast("Orçamento carregado para edição", "sucesso");
    }
  };

  // Dados de um cliente (achado por CNPJ ou por nome) a aplicar no formulário.
  type DadosClienteEncontrado = {
    clienteId?: string | null;
    cnpj?: string;
    empresa?: string;
    cep?: string;
    endereco?: string;
    enderecoNumero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    pais?: string;
    solicitante?: string;
    setor?: string;
    telefone?: string;
    email?: string;
  };

  // Aplica os dados encontrados (por CNPJ ou por nome da empresa) no
  // formulário. A busca é sempre uma ação deliberada do usuário (saiu do
  // campo ou clicou numa sugestão), então sobrescreve os campos que a busca
  // trouxer — preenchendo o máximo possível — e só mantém o valor atual
  // quando a busca não trouxe nada para aquele campo.
  const aplicarDadosCliente = (d: DadosClienteEncontrado, mensagem: string) => {
    setO((atual) => ({
      ...atual,
      clienteId: d.clienteId ?? atual.clienteId ?? null,
      cnpj: d.cnpj ? maskCNPJ(d.cnpj) : atual.cnpj,
      empresa: d.empresa || atual.empresa || "",
      cep: d.cep || atual.cep || "",
      endereco: d.endereco || atual.endereco || "",
      enderecoNumero: d.enderecoNumero || atual.enderecoNumero || "",
      complemento: d.complemento || atual.complemento || "",
      bairro: d.bairro || atual.bairro || "",
      cidade: d.cidade || atual.cidade || "",
      estado: d.estado || atual.estado || "",
      pais: d.pais || atual.pais || "Brasil",
      solicitante: d.solicitante || atual.solicitante || "",
      setor: d.setor || atual.setor || "",
      telefone: d.telefone || atual.telefone || "",
      email: d.email || atual.email || "",
    }));
    mostrarToast(mensagem, "sucesso");
  };

  // Autocompleta os dados da empresa/solicitante a partir do CNPJ digitado
  // (Enter ou ao sair do campo), caso já exista cadastro/orçamento anterior
  // para o mesmo CNPJ. Os campos preenchidos continuam editáveis.
  const buscarClientePorCnpj = async (cnpjDigitado: string) => {
    // Só dispara com CNPJ completo (14 dígitos).
    const digitos = (cnpjDigitado || "").replace(/\D/g, "");
    if (digitos.length !== 14) return;

    if (API_ENABLED) {
      setBuscandoCnpj(true);
      try {
        const cliente = await api.buscarClientePorCnpj(cnpjDigitado);
        if (cliente && cliente.encontrado) {
          aplicarDadosCliente(cliente, "Dados da empresa preenchidos pelo CNPJ");
        } else {
          mostrarToast(
            "CNPJ não encontrado na base pública. Preencha os dados manualmente.",
            "erro",
          );
        }
      } catch {
        // Falha de rede/servidor (ex.: servidor “acordando”). Avisa o usuário.
        mostrarToast(
          "Não foi possível consultar o CNPJ agora. Tente novamente em instantes.",
          "erro",
        );
      } finally {
        setBuscandoCnpj(false);
      }
      return;
    }

    // Modo demo (offline): usa o orçamento mais recente com o mesmo CNPJ.
    const mesmoCnpj = orcamentos
      .filter((orc) => orc.cnpj.replace(/\D/g, "") === digitos)
      .sort((a, b) => b.numero.localeCompare(a.numero));
    if (mesmoCnpj.length > 0) {
      aplicarDadosCliente(mesmoCnpj[0], "Dados da empresa preenchidos pelo CNPJ");
    }
  };

  // ===== Autocompletar "Empresa / Cliente" pelo nome (cadastro local) =====
  type SugestaoCliente = {
    id: string;
    cnpj: string | null;
    nome: string;
    cep: string | null;
    endereco: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
    pais: string;
  };
  const [sugestoesEmpresa, setSugestoesEmpresa] = useState<SugestaoCliente[]>([]);
  const [mostrarSugestoesEmpresa, setMostrarSugestoesEmpresa] = useState(false);
  const debounceEmpresaRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buscarClientesPorNome = (nomeDigitado: string) => {
    if (debounceEmpresaRef.current) clearTimeout(debounceEmpresaRef.current);
    const termo = nomeDigitado.trim();
    if (!API_ENABLED || termo.length < 3) {
      setSugestoesEmpresa([]);
      setMostrarSugestoesEmpresa(false);
      return;
    }
    debounceEmpresaRef.current = setTimeout(async () => {
      try {
        const r = await api.listarClientes(termo);
        setSugestoesEmpresa(r.data || []);
        setMostrarSugestoesEmpresa((r.data || []).length > 0);
      } catch {
        // Busca de conveniência: falha silenciosa, o usuário segue digitando.
      }
    }, 350);
  };

  const selecionarClienteExistente = async (c: SugestaoCliente) => {
    setMostrarSugestoesEmpresa(false);
    setSugestoesEmpresa([]);
    let solicitante = "";
    let setor = "";
    let telefone = "";
    let email = "";
    try {
      const contatos = await api.listarContatosCliente(c.id);
      const maisRecente = (contatos || [])[0];
      if (maisRecente) {
        solicitante = maisRecente.nome || "";
        setor = maisRecente.setor || "";
        telefone = maisRecente.telefone || "";
        email = maisRecente.email || "";
      }
    } catch {
      // Sem contato cadastrado ainda — segue só com os dados da empresa.
    }
    aplicarDadosCliente(
      {
        clienteId: c.id,
        cnpj: c.cnpj || undefined,
        empresa: c.nome,
        cep: c.cep || undefined,
        endereco: c.endereco || undefined,
        enderecoNumero: c.numero || undefined,
        complemento: c.complemento || undefined,
        bairro: c.bairro || undefined,
        cidade: c.cidade || undefined,
        estado: c.estado || undefined,
        pais: c.pais || undefined,
        solicitante,
        setor,
        telefone,
        email,
      },
      "Dados preenchidos a partir do cadastro existente",
    );
  };

  const [showPreview, setShowPreview] = useState(false);
  const [modalEnviarAberto, setModalEnviarAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  // Já existe no servidor? (edição de um orçamento existente, ou já salvo
  // nesta sessão). Enviar/Gerar PDF oficial dependem disso — não do id
  // local, que é só um placeholder de React até o primeiro salvamento.
  const [salvo, setSalvo] = useState<boolean>(!!orcamentoParaEditar);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [toast, setToast] = useState<{ tipo: "sucesso" | "erro"; msg: string } | null>(
    null
  );
  const printRef = useRef<HTMLDivElement>(null);

  const mostrarToast = (msg: string, tipo: "sucesso" | "erro" = "sucesso") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  };

  // Gera o PDF de forma confiável:
  // - Se o orçamento já foi salvo (tem id) e estamos conectados à API, baixa o
  //   PDF gerado pelo servidor (idêntico ao oficial, com logo).
  // - Caso contrário, abre a pré-visualização e usa a impressão do navegador
  //   (Imprimir > Salvar como PDF). Antes o botão chamava window.print() sem
  //   abrir a pré-visualização, o que gerava página em branco.
  const handleGerarPdf = async () => {
    if (API_ENABLED && salvo) {
      setGerandoPdf(true);
      try {
        await api.abrirPdf(o.id);
      } catch (e) {
        mostrarToast(
          e instanceof Error ? e.message : "Não foi possível gerar o PDF.",
          "erro",
        );
      } finally {
        setGerandoPdf(false);
      }
      return;
    }
    // Ainda não salvo no servidor (ou modo demo): abre a pré-visualização e
    // imprime. Antes disso checava `o.id`, mas esse id é gerado no cliente
    // e nunca é vazio — o PDF oficial só existe depois de salvar de verdade.
    setShowPreview(true);
    // Aguarda o modal montar a área de impressão antes de chamar a impressão.
    setTimeout(() => window.print(), 350);
    if (API_ENABLED && !salvo) {
      mostrarToast(
        "Dica: salve o orçamento para baixar o PDF oficial do servidor.",
      );
    }
  };

  const handleSalvar = async () => {
    if (!o.numero || !o.empresa) {
      mostrarToast("Preencha ao menos o número e a empresa.", "erro");
      return;
    }
    const resultado = await salvar(o);
    if (!resultado) {
      mostrarToast("Falha ao salvar o orçamento.", "erro");
      return;
    }
    // O id local (gerado no cliente) nunca é o id definitivo do servidor:
    // sincroniza o formulário com o registro real assim que ele volta da
    // API, para que "Enviar" e "Gerar PDF" (que dependem do id certo)
    // funcionem imediatamente, sem precisar sair e voltar à tela.
    if (API_ENABLED) {
      setO((prev) => ({ ...prev, ...resultado }));
      setSalvo(true);
    }
    mostrarToast("Orçamento salvo com sucesso!");
  };

  // Abre o modal de seleção de solicitantes (não envia direto).
  const handleAbrirModalEnviar = () => {
    if (!API_ENABLED) {
      mostrarToast("Envio de e-mail indisponível no modo offline.", "erro");
      return;
    }
    if (!salvo) {
      mostrarToast("Salve o orçamento antes de enviar por e-mail.", "erro");
      return;
    }
    setModalEnviarAberto(true);
  };

  // Confirmação do modal: salva o orçamento e envia para os solicitantes
  // selecionados (principal em "Para", demais em cópia).
  const handleEnviar = async (envio: EnvioComSolicitantes) => {
    setEnviando(true);
    try {
      await api.atualizarOrcamento(o.id, o);
      const r = await api.enviarOrcamento(o.id, envio);
      mostrarToast(r.mensagem, r.ok ? "sucesso" : "erro");
      if (r.ok) setModalEnviarAberto(false);
    } catch (e) {
      mostrarToast(
        e instanceof Error ? e.message : "Falha ao enviar o orçamento.",
        "erro",
      );
    } finally {
      setEnviando(false);
    }
  };

  // Recalcula as parcelas de forma consistente a partir dos itens, desconto e
  // número de parcelas, preservando datas/valores já informados quando possível.
  const recalcParcelas = (
    itens: ItemOrcamento[],
    numParcelas: number,
    descontoPercent: number,
  ): Parcela[] => {
    const total = totalFinal({ itens, descontoPercent });
    return gerarParcelas(numParcelas, total, o.parcelas);
  };

  // Bug reportado: às vezes o endereço "sumia" ao sair do campo CEP e não
  // preenchia mais depois disso. Duas causas, ambas corrigidas abaixo:
  // 1) O ViaCEP retorna logradouro vazio para alguns CEPs "de faixa"
  //    (bastante comuns) mesmo sendo válidos — o merge antigo aplicava
  //    esse vazio por cima do endereço já preenchido, apagando-o.
  // 2) setO({ ...o, ...res }) usava o "o" capturado no momento do blur; se
  //    o usuário editasse outro campo enquanto a consulta (assíncrona)
  //    ainda estava em andamento, essa edição era perdida quando a
  //    resposta chegava. Trocado para atualização funcional (prev).
  const handleBuscarCep = async () => {
    if (o.cep.length < 8) return;
    const res = await consultarCEP(o.cep);
    if (!res) return;
    setO((prev) => ({
      ...prev,
      endereco: res.endereco || prev.endereco,
      bairro: res.bairro || prev.bairro,
      cidade: res.cidade || prev.cidade,
      estado: res.estado || prev.estado,
    }));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {orcamentoParaEditar ? `Editar Orçamento ${o.numero}` : "Novo Orçamento"}
          </h1>
          <p className="text-sm text-slate-500">Preencha os dados abaixo para gerar a proposta.</p>
        </div>
        {/* Grid (em vez de flex-wrap) para os 4 botões ficarem sempre
            alinhados e do mesmo tamanho, independente da resolução — com
            flex-wrap eles quebravam de forma desigual em larguras
            intermediárias. */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button
            variant="secondary"
            className="w-full"
            icon={<Eye size={16} />}
            onClick={() => setShowPreview(true)}
          >
            Visualizar
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            icon={gerandoPdf ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
            onClick={handleGerarPdf}
            disabled={gerandoPdf}
          >
            {gerandoPdf ? "Gerando…" : "Gerar PDF"}
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            icon={enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            onClick={handleAbrirModalEnviar}
            disabled={enviando}
          >
            {enviando ? "Enviando…" : "Enviar orçamento"}
          </Button>
          <Button
            className="w-full"
            icon={<Save size={16} />}
            onClick={handleSalvar}
          >
            Salvar orçamento
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Coluna Principal (Formulário) */}
        <div className="space-y-6 lg:col-span-8">
          <Block title="Dados Orçamento" step={1} icon={<Building2 size={18} />}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Número"
                value={o.numero}
                onChange={(e) => setO({ ...o, numero: e.target.value })}
                onBlur={(e) => buscarOrcamentoPorNumero(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    buscarOrcamentoPorNumero(e.currentTarget.value);
                  }
                }}
                required
              />
              <Input
                label="Data"
                type="date"
                value={o.data}
                onChange={(e) => setO({ ...o, data: e.target.value })}
                required
              />
            </div>
          </Block>

          <Block title="Dados do Cliente" step={2} icon={<Building2 size={18} />}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Input
                  label="CNPJ"
                  value={o.cnpj}
                  onChange={(e) => setO({ ...o, cnpj: maskCNPJ(e.target.value) })}
                  onBlur={(e) => buscarClientePorCnpj(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      buscarClientePorCnpj(e.currentTarget.value);
                    }
                  }}
                  maxLength={18}
                />
                {buscandoCnpj && (
                  <div className="mt-1 flex items-center gap-1.5 text-[12px] text-text-muted">
                    <Loader2 size={12} className="animate-spin" />
                    Buscando dados do CNPJ...
                  </div>
                )}
              </div>
              <div className="relative">
                <Input
                  label="Empresa / Cliente"
                  value={o.empresa}
                  onChange={(e) => {
                    const valor = e.target.value;
                    setO({ ...o, empresa: valor });
                    buscarClientesPorNome(valor);
                  }}
                  onFocus={() => {
                    if (sugestoesEmpresa.length > 0) setMostrarSugestoesEmpresa(true);
                  }}
                  onBlur={() => setMostrarSugestoesEmpresa(false)}
                  autoComplete="off"
                  required
                />
                {mostrarSugestoesEmpresa && sugestoesEmpresa.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
                    {sugestoesEmpresa.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selecionarClienteExistente(c);
                        }}
                        className="block w-full px-3 py-2 text-left text-[13px] hover:bg-surface-offset"
                      >
                        <div className="font-medium text-text">{c.nome}</div>
                        <div className="text-[11px] text-text-muted">
                          {[c.cnpj, [c.cidade, c.estado].filter(Boolean).join("/")]
                            .filter(Boolean)
                            .join(" — ")}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Block>

          <Block title="Endereço" step={3} icon={<MapPin size={18} />}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="sm:col-span-3">
                <Input
                  label="CEP"
                  value={o.cep}
                  onChange={(e) => setO({ ...o, cep: maskCEP(e.target.value) })}
                  onBlur={handleBuscarCep}
                  maxLength={9}
                />
              </div>
              <div className="sm:col-span-5">
                <Input
                  label="Endereço"
                  value={o.endereco}
                  onChange={(e) => setO({ ...o, endereco: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="Número"
                  value={o.enderecoNumero}
                  onChange={(e) =>
                    setO({ ...o, enderecoNumero: e.target.value })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="Complemento"
                  value={o.complemento}
                  onChange={(e) => setO({ ...o, complemento: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="sm:col-span-3">
                <Input
                  label="Bairro"
                  value={o.bairro}
                  onChange={(e) => setO({ ...o, bairro: e.target.value })}
                />
              </div>
              <div className="sm:col-span-4">
                <Input
                  label="Cidade"
                  value={o.cidade}
                  onChange={(e) => setO({ ...o, cidade: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Select
                  label="UF"
                  value={o.estado}
                  onChange={(e) => setO({ ...o, estado: e.target.value })}
                >
                  <option value=""></option>
                  {ESTADOS_BR.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-3">
                <Input
                  label="País"
                  value={o.pais}
                  onChange={(e) => setO({ ...o, pais: e.target.value })}
                />
              </div>
            </div>
          </Block>

          <Block title="Solicitante" step={4} icon={<User size={18} />}>
            <SolicitanteSelector
              clienteId={o.clienteId}
              nome={o.solicitante}
              setor={o.setor}
              telefone={o.telefone}
              email={o.email}
              onChange={(patch) => setO((atual) => ({ ...atual, ...patch }))}
            />
          </Block>

          <Block title="Equipamento e Serviço" step={5}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
              <Select
                label="Modalidade"
                value={o.modalidade}
                onChange={(e) => setO({ ...o, modalidade: e.target.value })}
              >
                <option value="">Selecione...</option>
                {MODALIDADES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
              <Select
                label="Marca"
                value={o.marca}
                onChange={(e) => setO({ ...o, marca: e.target.value })}
              >
                <option value="">Selecione...</option>
                {MARCAS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
              <Input
                label="Modelo"
                value={o.modelo}
                onChange={(e) => setO({ ...o, modelo: e.target.value })}
              />
              <Input
                label="Nº de Série"
                value={o.numeroSerie}
                onChange={(e) => setO({ ...o, numeroSerie: e.target.value })}
              />
            </div>
            {o.marca === "Outras" && (
              <Input
                label="Especifique a Marca"
                value={o.marcaOutras}
                onChange={(e) => setO({ ...o, marcaOutras: e.target.value })}
              />
            )}
            <Textarea
              label="Descrição da Visita"
              value={o.descricaoVisita}
              onChange={(e) => setO({ ...o, descricaoVisita: e.target.value })}
              rows={2}
            />
          </Block>

          <Block title="Itens e Serviços" step={6}>
            <ItensGrid
              itens={o.itens}
              onChange={(novosItens) => {
                const parcelas = recalcParcelas(
                  novosItens,
                  o.numParcelas,
                  o.descontoPercent,
                );
                setO({ ...o, itens: novosItens, parcelas });
              }}
            />
          </Block>

          <Block title="Finalização e Observações" step={7}>
            <div className="space-y-4">
              <Textarea
                label="Observações Internas (Não aparecem no PDF)"
                value={o.observacoes}
                onChange={(e) => setO({ ...o, observacoes: e.target.value })}
                rows={2}
              />
              <Textarea
                label="Texto Final (Aparece no rodapé do PDF)"
                value={o.textoFinal}
                onChange={(e) => setO({ ...o, textoFinal: e.target.value })}
                rows={3}
              />
            </div>
          </Block>
        </div>

        {/* Coluna Lateral (Totais e Pagamento) */}
        <div className="space-y-6 lg:col-span-4">
          <Block title="Resumo Financeiro">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-text-muted">
                <span>Subtotal</span>
                <span>{formatBRL(totalBruto(o))}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">Desconto</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    className="w-20 text-right"
                    value={o.descontoPercent}
                    onChange={(e) => {
                      const pct = Number(e.target.value) || 0;
                      const parcelas = recalcParcelas(o.itens, o.numParcelas, pct);
                      setO({ ...o, descontoPercent: pct, parcelas });
                    }}
                    rightIcon={<span className="text-slate-400">%</span>}
                  />
                </div>
              </div>
              {o.descontoPercent > 0 && (
                <div className="flex items-center justify-between text-xs text-emerald-600">
                  <span>Valor do desconto</span>
                  <span>- {formatBRL(valorDesconto(o))}</span>
                </div>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-divider pt-4 text-lg font-semibold text-text">
                <span>Total</span>
                <span>{formatBRL(totalFinal(o))}</span>
              </div>
            </div>
          </Block>

          <Block title="Condições de Pagamento">
            <Parcelamento
              numParcelas={o.numParcelas}
              parcelas={o.parcelas}
              total={totalFinal(o)}
              onChangeNum={(n) =>
                setO((prev) => ({ ...prev, numParcelas: n }))
              }
              onChangeParcelas={(novasParcelas) =>
                setO((prev) => ({ ...prev, parcelas: novasParcelas }))
              }
            />
          </Block>

          <Block title="Data de Pagamento">
            <div className="space-y-2">
              <p className="text-xs text-text-muted">
                Informe uma data prevista ou, se ainda não houver data, uma
                condição em texto livre (ex.: "Antecipado", "30 dias").
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={o.dataPagamento || ""}
                  disabled={!!o.condicaoPagamento}
                  onChange={(e) =>
                    setO((prev) => ({
                      ...prev,
                      dataPagamento: e.target.value || null,
                      condicaoPagamento: e.target.value
                        ? null
                        : prev.condicaoPagamento,
                    }))
                  }
                  className="disabled:cursor-not-allowed disabled:opacity-50"
                />
                <span className="text-[11px] text-slate-400">ou</span>
                <Input
                  type="text"
                  value={o.condicaoPagamento || ""}
                  disabled={!!o.dataPagamento}
                  onChange={(e) =>
                    setO((prev) => ({
                      ...prev,
                      condicaoPagamento: e.target.value || null,
                      dataPagamento: e.target.value
                        ? null
                        : prev.dataPagamento,
                    }))
                  }
                  placeholder="Antecipado, 30 dias..."
                  className="disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
          </Block>
        </div>
      </div>

      {/* Modal de visualização */}
      <Modal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        title="Visualização do orçamento"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowPreview(false)}>
              Fechar
            </Button>
            {API_ENABLED && o.id ? (
              <Button
                icon={gerandoPdf ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                onClick={handleGerarPdf}
                disabled={gerandoPdf}
              >
                {gerandoPdf ? "Gerando…" : "Baixar PDF"}
              </Button>
            ) : (
              <Button icon={<Printer size={16} />} onClick={() => window.print()}>
                Imprimir / PDF
              </Button>
            )}
          </>
        }
      >
        <div ref={printRef} className="bg-slate-100 p-4 print-area">
          <ModalEnviarSolicitantes
        open={modalEnviarAberto}
        onClose={() => setModalEnviarAberto(false)}
        clienteId={o.clienteId}
        empresa={o.empresa}
        titulo={`Enviar Orçamento ${o.numero}`}
        enviando={enviando}
        onEnviar={handleEnviar}
        referenciaPadrao={o.itens[0]?.item ?? ""}
      />

            <OrcamentoPreview o={o} />
        </div>
      </Modal>

      {/* Toast de feedback */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 animate-[fadeIn_.2s_ease] rounded-lg bg-slate-900 px-4 py-3 text-[13px] font-medium text-white shadow-lg">
          <span className="flex items-center gap-2">
            {toast.tipo === "sucesso" ? (
              <CheckCircle2 size={16} className="text-emerald-400" />
            ) : (
              <X size={16} className="text-rose-400" />
            )}
            {toast.msg}
          </span>
        </div>
      )}
    </div>
  );
}
