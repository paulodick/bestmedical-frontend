import { useEffect, useMemo, useRef, useState } from "react";
import {
  Save,
  Eye,
  FileDown,
  Send,
  CheckCircle2,
  Loader2,
  Building2,
  User,
  Printer,
  X
} from "lucide-react";
import { Block, Button, Field, Input, Select, Textarea } from "../components/ui";
import { ItensGrid } from "../components/ItensGrid";
import { Parcelamento } from "../components/Parcelamento";
import { Modal } from "../components/Modal";
import { OrcamentoPreview } from "../components/OrcamentoPreview";
import type { Orcamento, Parcela } from "../types";
import { MARCAS, MODALIDADES } from "../types";
import { useStore } from "../store";
import {
  hojeISO,
  maskCEP,
  maskCNPJ,
  maskTelefone,
  formatBRL,
  uid,
} from "../lib/format";
import { consultarCEP, ESTADOS_BR, proximoNumero } from "../lib/mock";
import {
  totalBruto,
  totalFinal,
  valorDesconto,
  redistribuirValores,
} from "../lib/calc";

export const TEXTO_FINAL_PADRAO =
  "Orçamento válido por 15 dias. Qualquer alteração no escopo do serviço poderá alterar os itens e/ou valores listados nesta proposta.";

interface NovoOrcamentoProps {
  orcamentoParaEditar?: Orcamento | null;
}

function novoOrcamentoVazio(numero: string): Orcamento {
  return {
    id: uid(),
    numero,
    data: hojeISO(),
    cnpj: "",
    empresa: "",
    cep: "",
    endereco: "",
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

  // Função que busca o orçamento quando o utilizador digita o número no input
  const buscarOrcamentoPorNumero = (numeroDigitado: string) => {
    if (!numeroDigitado) return;
    
    const encontrado = orcamentos.find(
      (orc) => orc.numero.toLowerCase() === numeroDigitado.toLowerCase()
    );

    if (encontrado) {
      setO(encontrado);
      mostrarToast("Orçamento carregado para edição", "sucesso");
    }
  };

  const [showPreview, setShowPreview] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState<{ tipo: "sucesso" | "erro"; msg: string } | null>(
    null
  );
  const printRef = useRef<HTMLDivElement>(null);

  const mostrarToast = (msg: string, tipo: "sucesso" | "erro" = "sucesso") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSalvar = () => {
    if (!o.numero || !o.empresa) {
      mostrarToast("Preencha ao menos o número e a empresa.", "erro");
      return;
    }
    salvar(o);
    mostrarToast("Orçamento salvo com sucesso!");
  };

  const handleEnviar = () => {
    handleSalvar();
    setEnviando(true);
    setTimeout(() => {
      setEnviando(false);
      mostrarToast("E-mail enviado com sucesso!");
    }, 1500);
  };

  const handleBuscarCep = async () => {
    if (o.cep.length < 8) return;
    const res = await consultarCEP(o.cep);
    if (res) {
      setO({ ...o, ...res });
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {orcamentoParaEditar ? `Editar Orçamento ${o.numero}` : "Novo Orçamento"}
          </h1>
          <p className="text-sm text-slate-500">Preencha os dados abaixo para gerar a proposta.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<Eye size={16} />} onClick={() => setShowPreview(true)}>
            Visualizar
          </Button>
          <Button variant="secondary" icon={<FileDown size={16} />} onClick={() => window.print()}>
            Gerar PDF
          </Button>
          <Button
            variant="secondary"
            icon={enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            onClick={handleEnviar}
            disabled={enviando}
          >
            {enviando ? "Enviando…" : "Enviar orçamento"}
          </Button>
          <Button icon={<Save size={16} />} onClick={handleSalvar}>
            Salvar orçamento
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Coluna Principal (Formulário) */}
        <div className="space-y-6 lg:col-span-8">
          <Block title="Dados Básicos" icon={<Building2 size={18} />}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
              <Input
                label="Número"
                value={o.numero}
                onChange={(e) => setO({ ...o, numero: e.target.value })}
                onBlur={(e) => buscarOrcamentoPorNumero(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault(); // Evita que o Enter envie formulários ou recarregue a página
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
              <div className="sm:col-span-2">
                <Input
                  label="CNPJ"
                  value={o.cnpj}
                  onChange={(e) => setO({ ...o, cnpj: maskCNPJ(e.target.value) })}
                  maxLength={18}
                />
              </div>
            </div>
            <Input
              label="Empresa / Cliente"
              value={o.empresa}
              onChange={(e) => setO({ ...o, empresa: e.target.value })}
              required
            />
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
              <div className="sm:col-span-7">
                <Input
                  label="Endereço"
                  value={o.endereco}
                  onChange={(e) => setO({ ...o, endereco: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="Bairro"
                  value={o.bairro}
                  onChange={(e) => setO({ ...o, bairro: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="sm:col-span-6">
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
              <div className="sm:col-span-4">
                <Input
                  label="País"
                  value={o.pais}
                  onChange={(e) => setO({ ...o, pais: e.target.value })}
                />
              </div>
            </div>
          </Block>

          <Block title="Contato" icon={<User size={18} />}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Solicitante"
                value={o.solicitante}
                onChange={(e) => setO({ ...o, solicitante: e.target.value })}
              />
              <Input
                label="Setor"
                value={o.setor}
                onChange={(e) => setO({ ...o, setor: e.target.value })}
              />
              <Input
                label="Telefone"
                value={o.telefone}
                onChange={(e) => setO({ ...o, telefone: maskTelefone(e.target.value) })}
                maxLength={15}
              />
              <Input
                label="E-mail"
                type="email"
                value={o.email}
                onChange={(e) => setO({ ...o, email: e.target.value })}
              />
            </div>
          </Block>

          <Block title="Equipamento e Serviço">
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

          <Block title="Itens e Serviços">
            <ItensGrid
              itens={o.itens}
              onChange={(novosItens) => {
                const novosValores = redistribuirValores(
                  novosItens,
                  o.numParcelas,
                  o.descontoPercent
                );
                setO({ ...o, itens: novosItens, parcelas: novosValores.parcelas });
              }}
            />
          </Block>

          <Block title="Finalização e Observações">
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
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Subtotal</span>
                <span>{formatBRL(totalBruto(o.itens))}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Desconto</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    className="w-20 text-right"
                    value={o.descontoPercent}
                    onChange={(e) => {
                      const pct = Number(e.target.value) || 0;
                      const novosValores = redistribuirValores(o.itens, o.numParcelas, pct);
                      setO({
                        ...o,
                        descontoPercent: pct,
                        parcelas: novosValores.parcelas,
                      });
                    }}
                    rightIcon={<span className="text-slate-400">%</span>}
                  />
                </div>
              </div>
              {o.descontoPercent > 0 && (
                <div className="flex items-center justify-between text-xs text-emerald-600">
                  <span>Valor do desconto</span>
                  <span>- {formatBRL(valorDesconto(o.itens, o.descontoPercent))}</span>
                </div>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-lg font-semibold text-slate-900">
                <span>Total</span>
                <span>{formatBRL(totalFinal(o))}</span>
              </div>
            </div>
          </Block>

          <Block title="Condições de Pagamento">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-slate-700">Parcelas</label>
                <div className="flex-1">
                  <Select
                    value={o.numParcelas}
                    onChange={(e) => {
                      const num = Number(e.target.value) || 1;
                      const novosValores = redistribuirValores(o.itens, num, o.descontoPercent);
                      setO({
                        ...o,
                        numParcelas: num,
                        parcelas: novosValores.parcelas,
                      });
                    }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                      <option key={n} value={n}>
                        {n}x {n === 1 ? "(À vista)" : ""}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <Parcelamento
                parcelas={o.parcelas}
                onChange={(novasParcelas) => setO({ ...o, parcelas: novasParcelas })}
                total={totalFinal(o)}
              />
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
            <Button icon={<Printer size={16} />} onClick={() => window.print()}>
              Imprimir / PDF
            </Button>
          </>
        }
      >
        <div ref={printRef} className="bg-slate-100 p-4 print-area">
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