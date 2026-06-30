import { useEffect, useState } from "react";
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
  Plus,
  Trash2,
  FileText,
  X,
} from "lucide-react";
import { Block, Button, Input, Select, Textarea } from "../components/ui";
import { Modal } from "../components/Modal";
import type { Proposta, EquipamentoProposta } from "../types";
import { MARCAS, MODALIDADES, TIPOS_CONTRATO, CONDICOES_PADRAO } from "../types";
import {
  hojeISO,
  maskCEP,
  maskCNPJ,
  maskTelefone,
  formatBRL,
  formatDataBR,
  moedaParaInput,
  parseMoedaInput,
  uid,
} from "../lib/format";
import { consultarCEP, ESTADOS_BR } from "../lib/mock";
import {
  montarObservacoesInternas,
  subtotalProposta,
  totalPropostaFinal,
  valorDescontoProposta,
} from "../lib/contrato";
import { api, API_ENABLED } from "../lib/api";

export const TEXTO_FINAL_PADRAO =
  "Proposta válida por 30 dias. Este documento é uma proposta comercial, não um contrato.";

interface PropostaContratoProps {
  propostaParaEditar?: Proposta | null;
}

function equipamentoVazio(): EquipamentoProposta {
  return {
    id: uid(),
    modalidade: "",
    marca: "",
    marcaOutras: "",
    modelo: "",
    numeroSerie: "",
    valorContrato: 0,
  };
}

function novaPropostaVazia(numero: string): Proposta {
  return {
    id: uid(),
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
    tipoContrato: "",
    condicoesContrato: "",
    condicoesPadraoSnap: "",
    observacoesInternas: "",
    descontoPercent: 0,
    subtotal: 0,
    desconto: 0,
    total: 0,
    textoFinal: TEXTO_FINAL_PADRAO,
    enviado: false,
    aprovado: false,
    realizado: false,
    aguardandoPeca: false,
    ordemServico: false,
    pagamentoRealizado: false,
    equipamentos: [equipamentoVazio()],
  };
}

// Descrição textual de um equipamento (usada na tabela de valores e no preview).
const descreverEquip = (e: EquipamentoProposta): string => {
  const marca = e.marca === "Outras" ? e.marcaOutras || "Outras" : e.marca;
  return [e.modalidade, marca, e.modelo, e.numeroSerie].filter(Boolean).join(" · ");
};

export function PropostaContrato({ propostaParaEditar }: PropostaContratoProps = {}) {
  const [p, setP] = useState<Proposta>(
    () => propostaParaEditar || novaPropostaVazia(""),
  );
  const [showPreview, setShowPreview] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [toast, setToast] = useState<{ tipo: "sucesso" | "erro"; msg: string } | null>(
    null,
  );

  const mostrarToast = (msg: string, tipo: "sucesso" | "erro" = "sucesso") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  };

  // Sugere o próximo número (PC-...) ao abrir uma proposta nova.
  useEffect(() => {
    if (propostaParaEditar) {
      setP(propostaParaEditar);
      return;
    }
    if (API_ENABLED) {
      api
        .proximoNumeroProposta()
        .then((r) => setP((prev) => (prev.numero ? prev : { ...prev, numero: r.numero })))
        .catch(() => {
          /* offline: mantém vazio */
        });
    }
  }, [propostaParaEditar]);

  // Busca a proposta ao digitar o número (Enter/blur).
  const buscarPropostaPorNumero = async (numeroDigitado: string) => {
    const alvo = (numeroDigitado || "").trim();
    if (!alvo) return;
    if (alvo.toLowerCase() === (p.numero || "").toLowerCase() && p.empresa) return;
    if (!API_ENABLED) return;
    try {
      const encontrada = await api.buscarPropostaPorNumero(alvo);
      setP(encontrada as Proposta);
      mostrarToast("Proposta carregada para edição");
    } catch {
      // 404/rede: segue como nova proposta.
    }
  };

  // Autocompleta dados da empresa/solicitante pelo CNPJ (igual ao orçamento).
  const buscarClientePorCnpj = async (cnpjDigitado: string) => {
    const digitos = (cnpjDigitado || "").replace(/\D/g, "");
    if (digitos.length !== 14 || !API_ENABLED) return;
    setBuscandoCnpj(true);
    try {
      const c = await api.buscarClientePorCnpj(cnpjDigitado);
      if (c && c.encontrado) {
        setP((atual) => ({
          ...atual,
          empresa: atual.empresa || c.empresa || "",
          cep: atual.cep || c.cep || "",
          endereco: atual.endereco || c.endereco || "",
          enderecoNumero: atual.enderecoNumero || c.enderecoNumero || "",
          complemento: atual.complemento || c.complemento || "",
          bairro: atual.bairro || c.bairro || "",
          cidade: atual.cidade || c.cidade || "",
          estado: atual.estado || c.estado || "",
          pais: atual.pais || c.pais || "Brasil",
          solicitante: atual.solicitante || c.solicitante || "",
          setor: atual.setor || c.setor || "",
          telefone: atual.telefone || c.telefone || "",
          email: atual.email || c.email || "",
        }));
        mostrarToast("Dados da empresa preenchidos pelo CNPJ");
      } else {
        mostrarToast(
          "CNPJ não encontrado na base pública. Preencha os dados manualmente.",
          "erro",
        );
      }
    } catch {
      mostrarToast(
        "Não foi possível consultar o CNPJ agora. Tente novamente em instantes.",
        "erro",
      );
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const handleBuscarCep = async () => {
    if (p.cep.length < 8) return;
    const res = await consultarCEP(p.cep);
    if (res) setP({ ...p, ...res });
  };

  // ===== Equipamentos =====
  const setEquip = (i: number, patch: Partial<EquipamentoProposta>) => {
    setP((prev) => {
      const equipamentos = prev.equipamentos.map((e, idx) =>
        idx === i ? { ...e, ...patch } : e,
      );
      return { ...prev, equipamentos };
    });
  };

  const addEquip = () => {
    setP((prev) =>
      prev.equipamentos.length >= 50
        ? prev
        : { ...prev, equipamentos: [...prev.equipamentos, equipamentoVazio()] },
    );
  };

  const removeEquip = (i: number) => {
    setP((prev) => ({
      ...prev,
      equipamentos:
        prev.equipamentos.length <= 1
          ? prev.equipamentos
          : prev.equipamentos.filter((_, idx) => idx !== i),
    }));
  };

  // ===== Tipo de contrato → carrega o texto padrão =====
  const handleTipoContrato = (tipo: string) => {
    const padraoNovo = CONDICOES_PADRAO[tipo] ?? "";
    setP((prev) => {
      const padraoAtual = prev.condicoesPadraoSnap;
      const condicoesVazias = !prev.condicoesContrato.trim();
      const naoCustomizado = prev.condicoesContrato === padraoAtual;

      // Substitui o texto se ainda não houve customização; caso contrário pede
      // confirmação para não descartar edições manuais do usuário.
      let condicoes = prev.condicoesContrato;
      if (condicoesVazias || naoCustomizado) {
        condicoes = padraoNovo;
      } else if (
        window.confirm(
          "Trocar o tipo de contrato vai substituir as Condições do Contrato pelo texto padrão. Deseja continuar?",
        )
      ) {
        condicoes = padraoNovo;
      }

      const observacoesInternas = montarObservacoesInternas(
        condicoes,
        padraoNovo,
        prev.observacoesInternas,
      );

      return {
        ...prev,
        tipoContrato: tipo,
        condicoesContrato: condicoes,
        condicoesPadraoSnap: padraoNovo,
        observacoesInternas,
      };
    });
  };

  // ===== Condições do contrato → recomputa observações internas =====
  const handleCondicoes = (texto: string) => {
    setP((prev) => ({
      ...prev,
      condicoesContrato: texto,
      observacoesInternas: montarObservacoesInternas(
        texto,
        prev.condicoesPadraoSnap,
        prev.observacoesInternas,
      ),
    }));
  };

  // Monta o payload com os totais atualizados.
  const comTotais = (prop: Proposta): Proposta => ({
    ...prop,
    subtotal: subtotalProposta(prop.equipamentos),
    desconto: valorDescontoProposta(prop),
    total: totalPropostaFinal(prop),
  });

  // Salva a proposta (cria ou atualiza). Retorna a proposta resultante (com id).
  const salvarProposta = async (): Promise<Proposta | null> => {
    if (!p.numero || !p.empresa) {
      mostrarToast("Preencha ao menos o número e a empresa.", "erro");
      return null;
    }
    if (!API_ENABLED) {
      mostrarToast("Modo offline: a proposta não foi persistida.", "erro");
      return p;
    }
    const payload = comTotais(p);
    try {
      const existe = !!propostaParaEditar || (await jaExiste(p.numero));
      const salva = existe
        ? await api.atualizarProposta(p.id, payload)
        : await api.criarProposta(payload);
      setP(salva as Proposta);
      return salva as Proposta;
    } catch (e) {
      mostrarToast(
        e instanceof Error ? e.message : "Falha ao salvar a proposta.",
        "erro",
      );
      return null;
    }
  };

  // Verifica se já existe uma proposta com este número (para decidir POST/PUT).
  const jaExiste = async (numero: string): Promise<boolean> => {
    try {
      const existente = await api.buscarPropostaPorNumero(numero);
      if (existente?.id) {
        // Garante que atualizamos o id correto encontrado no servidor.
        setP((prev) => ({ ...prev, id: existente.id }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleSalvar = async () => {
    const salva = await salvarProposta();
    if (salva) mostrarToast("Proposta salva com sucesso!");
  };

  const handleGerarPdf = async () => {
    if (API_ENABLED && p.id && (propostaParaEditar || (await jaExiste(p.numero)))) {
      setGerandoPdf(true);
      try {
        await api.abrirPdfProposta(p.id);
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
    // Ainda não salva: abre a pré-visualização e usa a impressão do navegador.
    setShowPreview(true);
    setTimeout(() => window.print(), 350);
    if (API_ENABLED) {
      mostrarToast("Dica: salve a proposta para baixar o PDF oficial do servidor.");
    }
  };

  const handleEnviar = async () => {
    if (!API_ENABLED) {
      mostrarToast("Envio de e-mail indisponível no modo offline.", "erro");
      return;
    }
    setEnviando(true);
    try {
      const salva = await salvarProposta();
      if (!salva) return;
      const r = await api.enviarProposta(salva.id);
      mostrarToast(r.mensagem, r.ok ? "sucesso" : "erro");
      if (r.ok && r.proposta) setP(r.proposta as Proposta);
    } catch (e) {
      mostrarToast(
        e instanceof Error ? e.message : "Falha ao enviar a proposta.",
        "erro",
      );
    } finally {
      setEnviando(false);
    }
  };

  const subtotal = subtotalProposta(p.equipamentos);
  const desconto = valorDescontoProposta(p);
  const total = totalPropostaFinal(p);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {propostaParaEditar ? `Editar Proposta ${p.numero}` : "Proposta de Contrato"}
          </h1>
          <p className="text-sm text-slate-500">
            Preencha os dados abaixo para gerar a proposta de contrato.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<Eye size={16} />} onClick={() => setShowPreview(true)}>
            Visualizar
          </Button>
          <Button
            variant="secondary"
            icon={gerandoPdf ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
            onClick={handleGerarPdf}
            disabled={gerandoPdf}
          >
            {gerandoPdf ? "Gerando…" : "Gerar PDF"}
          </Button>
          <Button
            variant="secondary"
            icon={enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            onClick={handleEnviar}
            disabled={enviando}
          >
            {enviando ? "Enviando…" : "Enviar proposta"}
          </Button>
          <Button icon={<Save size={16} />} onClick={handleSalvar}>
            Salvar proposta
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Coluna Principal */}
        <div className="space-y-6 lg:col-span-8">
          <Block title="Dados da Proposta" step={1} icon={<FileText size={18} />}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Número"
                value={p.numero}
                onChange={(e) => setP({ ...p, numero: e.target.value })}
                onBlur={(e) => buscarPropostaPorNumero(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    buscarPropostaPorNumero(e.currentTarget.value);
                  }
                }}
                required
              />
              <Input
                label="Data"
                type="date"
                value={p.data}
                onChange={(e) => setP({ ...p, data: e.target.value })}
                required
              />
            </div>
          </Block>

          <Block title="Dados do Cliente" step={2} icon={<Building2 size={18} />}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Input
                  label="CNPJ"
                  value={p.cnpj}
                  onChange={(e) => setP({ ...p, cnpj: maskCNPJ(e.target.value) })}
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
              <Input
                label="Empresa / Cliente"
                value={p.empresa}
                onChange={(e) => setP({ ...p, empresa: e.target.value })}
                required
              />
            </div>
          </Block>

          <Block title="Endereço" step={3} icon={<MapPin size={18} />}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="sm:col-span-3">
                <Input
                  label="CEP"
                  value={p.cep}
                  onChange={(e) => setP({ ...p, cep: maskCEP(e.target.value) })}
                  onBlur={handleBuscarCep}
                  maxLength={9}
                />
              </div>
              <div className="sm:col-span-5">
                <Input
                  label="Endereço"
                  value={p.endereco}
                  onChange={(e) => setP({ ...p, endereco: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="Número"
                  value={p.enderecoNumero}
                  onChange={(e) => setP({ ...p, enderecoNumero: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="Complemento"
                  value={p.complemento}
                  onChange={(e) => setP({ ...p, complemento: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="sm:col-span-3">
                <Input
                  label="Bairro"
                  value={p.bairro}
                  onChange={(e) => setP({ ...p, bairro: e.target.value })}
                />
              </div>
              <div className="sm:col-span-4">
                <Input
                  label="Cidade"
                  value={p.cidade}
                  onChange={(e) => setP({ ...p, cidade: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Select
                  label="UF"
                  value={p.estado}
                  onChange={(e) => setP({ ...p, estado: e.target.value })}
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
                  value={p.pais}
                  onChange={(e) => setP({ ...p, pais: e.target.value })}
                />
              </div>
            </div>
          </Block>

          <Block title="Solicitante" step={4} icon={<User size={18} />}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Solicitante"
                value={p.solicitante}
                onChange={(e) => setP({ ...p, solicitante: e.target.value })}
              />
              <Input
                label="Setor"
                value={p.setor}
                onChange={(e) => setP({ ...p, setor: e.target.value })}
              />
              <Input
                label="Telefone"
                value={p.telefone}
                onChange={(e) => setP({ ...p, telefone: maskTelefone(e.target.value) })}
                maxLength={15}
              />
              <Input
                label="E-mail"
                type="email"
                value={p.email}
                onChange={(e) => setP({ ...p, email: e.target.value })}
              />
            </div>
          </Block>

          <Block
            title="Equipamentos"
            step={5}
            right={
              <Button variant="outline" icon={<Plus size={15} />} onClick={addEquip}>
                Adicionar equipamento
              </Button>
            }
          >
            <div className="space-y-4">
              {p.equipamentos.map((e, i) => (
                <div
                  key={e.id || i}
                  className="rounded-md border border-divider p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[12px] font-medium text-text-faint">
                      Equipamento {i + 1}
                    </span>
                    {p.equipamentos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEquip(i)}
                        title="Remover equipamento"
                        className="rounded p-1 text-text-faint transition hover:bg-surface-offset hover:text-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                    <Select
                      label="Modalidade"
                      value={e.modalidade}
                      onChange={(ev) => setEquip(i, { modalidade: ev.target.value })}
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
                      value={e.marca}
                      onChange={(ev) => setEquip(i, { marca: ev.target.value })}
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
                      value={e.modelo}
                      onChange={(ev) => setEquip(i, { modelo: ev.target.value })}
                    />
                    <Input
                      label="Nº de Série"
                      value={e.numeroSerie}
                      onChange={(ev) => setEquip(i, { numeroSerie: ev.target.value })}
                    />
                  </div>
                  {e.marca === "Outras" && (
                    <div className="mt-4">
                      <Input
                        label="Especifique a Marca"
                        value={e.marcaOutras}
                        onChange={(ev) => setEquip(i, { marcaOutras: ev.target.value })}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Block>

          <Block title="Modalidade do Contrato" step={6}>
            <div className="space-y-5">
              <Select
                label="Tipo de contrato"
                value={p.tipoContrato}
                onChange={(e) => handleTipoContrato(e.target.value)}
              >
                <option value="">Selecione...</option>
                {TIPOS_CONTRATO.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>

              {/* Valores por equipamento (mensal) */}
              <div>
                <div className="mb-2 text-[13px] font-medium text-text-muted">
                  Valor do Contrato (mensal) por equipamento
                </div>
                <div className="overflow-hidden rounded-md border border-divider">
                  <table className="w-full text-[13px]">
                    <thead className="bg-surface-offset text-text-muted">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Equipamento</th>
                        <th className="px-3 py-2 text-right font-medium w-44">
                          Valor mensal (R$)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.equipamentos.map((e, i) => (
                        <tr key={e.id || i} className="border-t border-divider">
                          <td className="px-3 py-2 text-text">
                            {descreverEquip(e) || `Equipamento ${i + 1}`}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              className="text-right"
                              value={moedaParaInput(e.valorContrato)}
                              onChange={(ev) =>
                                setEquip(i, {
                                  valorContrato: parseMoedaInput(ev.target.value),
                                })
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Condições do contrato */}
              <div>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-[13px] font-medium text-text-muted">
                    Condições do Contrato
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    preenchimento automático, editável por cliente
                  </span>
                </div>
                <Textarea
                  value={p.condicoesContrato}
                  onChange={(e) => handleCondicoes(e.target.value)}
                  rows={12}
                />
                <p className="mt-1.5 text-[12px] text-text-faint">
                  Tudo o que for alterado em relação ao padrão é replicado
                  automaticamente nas Observações Internas (bloco 7).
                </p>
              </div>
            </div>
          </Block>

          <Block title="Finalização e Observações" step={7}>
            <div className="space-y-4">
              <Textarea
                label="Observações Internas (Não aparecem no PDF)"
                value={p.observacoesInternas}
                onChange={(e) => setP({ ...p, observacoesInternas: e.target.value })}
                rows={6}
              />
              <Textarea
                label="Texto Final (Aparece no rodapé do PDF)"
                value={p.textoFinal}
                onChange={(e) => setP({ ...p, textoFinal: e.target.value })}
                rows={3}
              />
            </div>
          </Block>
        </div>

        {/* Coluna lateral — Resumo Financeiro */}
        <div className="space-y-6 lg:col-span-4">
          <Block title="Resumo Financeiro">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-text-muted">
                <span>Subtotal</span>
                <span>{formatBRL(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">Desconto</span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  className="w-20 text-right"
                  value={p.descontoPercent}
                  onChange={(e) =>
                    setP({ ...p, descontoPercent: Number(e.target.value) || 0 })
                  }
                  rightIcon={<span className="text-slate-400">%</span>}
                />
              </div>
              {p.descontoPercent > 0 && (
                <div className="flex items-center justify-between text-xs text-emerald-600">
                  <span>Valor do desconto</span>
                  <span>- {formatBRL(desconto)}</span>
                </div>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-divider pt-4 text-lg font-semibold text-text">
                <span>Total mensal</span>
                <span>{formatBRL(total)}</span>
              </div>
            </div>
          </Block>
        </div>
      </div>

      {/* Modal de visualização */}
      <Modal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        title="Visualização da proposta"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowPreview(false)}>
              Fechar
            </Button>
            {API_ENABLED && p.id && propostaParaEditar ? (
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
        <div className="bg-slate-100 p-4 print-area">
          <PropostaPreview p={p} subtotal={subtotal} desconto={desconto} total={total} />
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

// ===== Pré-visualização simples da proposta (espelha o PDF) =====
function PropostaPreview({
  p,
  subtotal,
  desconto,
  total,
}: {
  p: Proposta;
  subtotal: number;
  desconto: number;
  total: number;
}) {
  const temDesconto = (p.descontoPercent || 0) > 0;
  const equipamentos = p.equipamentos.filter(
    (e) => e.modalidade || e.marca || e.modelo || e.numeroSerie || e.valorContrato,
  );
  return (
    <div className="mx-auto max-w-3xl rounded-lg bg-white p-8 text-[13px] text-slate-700 shadow">
      <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
        <div>
          <div className="text-[15px] font-bold text-slate-900">Best Medical</div>
          <div className="text-slate-500">Manutenção de Equipamentos Médicos</div>
        </div>
        <div className="text-right">
          <div className="text-[13px] font-bold text-slate-900">PROPOSTA DE CONTRATO</div>
          {p.tipoContrato && (
            <div className="text-[11px] font-bold text-[#0d7d8a]">{p.tipoContrato}</div>
          )}
          <div className="mt-1 text-slate-600">
            Nº <strong>{p.numero}</strong>
          </div>
          <div className="text-slate-600">Data: {formatDataBR(p.data)}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-6">
        <div>
          <div className="text-[11px] font-bold text-slate-400">CLIENTE</div>
          <div className="font-bold text-slate-900">{p.empresa || "—"}</div>
          {p.cnpj && <div className="text-slate-600">CNPJ: {p.cnpj}</div>}
        </div>
        <div>
          <div className="text-[11px] font-bold text-slate-400">SOLICITANTE</div>
          <div className="font-bold text-slate-900">{p.solicitante || "—"}</div>
          {p.email && <div className="text-slate-600">{p.email}</div>}
        </div>
      </div>

      <div className="mt-5">
        <div className="text-[11px] font-bold text-slate-400">EQUIPAMENTOS COBERTOS</div>
        <table className="mt-1 w-full">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 text-left font-medium">Modalidade</th>
              <th className="py-1 text-left font-medium">Marca</th>
              <th className="py-1 text-left font-medium">Modelo</th>
              <th className="py-1 text-left font-medium">Nº de Série</th>
            </tr>
          </thead>
          <tbody>
            {equipamentos.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-2 text-center text-slate-400">
                  Nenhum equipamento informado.
                </td>
              </tr>
            ) : (
              equipamentos.map((e, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-1">{e.modalidade || "—"}</td>
                  <td className="py-1">
                    {(e.marca === "Outras" ? e.marcaOutras || "Outras" : e.marca) || "—"}
                  </td>
                  <td className="py-1">{e.modelo || "—"}</td>
                  <td className="py-1">{e.numeroSerie || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex justify-end">
        <div className="w-64 space-y-1">
          {temDesconto && (
            <>
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>{formatBRL(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Desconto ({p.descontoPercent}%)</span>
                <span>- {formatBRL(desconto)}</span>
              </div>
            </>
          )}
          <div className="flex items-center justify-between rounded-md bg-[#0d7d8a] px-3 py-2 text-white">
            <span className="text-[11px]">TOTAL MENSAL</span>
            <span className="text-[16px] font-bold">{formatBRL(total)}</span>
          </div>
        </div>
      </div>

      {p.condicoesContrato.trim() && (
        <div className="mt-5">
          <div className="text-[11px] font-bold text-slate-400">CONDIÇÕES DO ATENDIMENTO</div>
          <div className="mt-1 whitespace-pre-wrap text-slate-600">
            {p.condicoesContrato}
          </div>
        </div>
      )}

      {p.textoFinal && <div className="mt-4 text-slate-600">{p.textoFinal}</div>}

      <div className="mt-3 text-[12px] italic text-slate-400">
        Este documento é uma proposta comercial, não um contrato.
      </div>
    </div>
  );
}
