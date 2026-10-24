/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Send, 
  ExternalLink, 
  Building2, 
  Layers, 
  Calendar, 
  User, 
  Phone, 
  Sparkles,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import type { Company, Entry } from '../App';
import { MONTHS, formatBRL } from '../App';

interface WhatsAppSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  entries: Entry[];
  selectedYear: number;
  selectedMonth: number | 'all';
  selectedCompanyId: string;
}

// 3 modos simplificados e diretos solicitados pelo usuário
type ReportScope = 'individual' | 'all_companies' | 'consolidated';

export function WhatsAppSummaryModal({
  isOpen,
  onClose,
  companies,
  entries,
  selectedYear,
  selectedMonth: initialSelectedMonth,
  selectedCompanyId: initialSelectedCompanyId
}: WhatsAppSummaryModalProps) {
  // Escopo do relatório: individual, todas as empresas ou consolidada
  const [reportScope, setReportScope] = useState<ReportScope>(() => {
    return initialSelectedCompanyId === 'all' ? 'consolidated' : 'individual';
  });

  const [targetMonth, setTargetMonth] = useState<number>(() => {
    return initialSelectedMonth === 'all' ? new Date().getMonth() : initialSelectedMonth;
  });

  const [targetYear, setTargetYear] = useState<number>(selectedYear);

  const [targetCompanyId, setTargetCompanyId] = useState<string>(() => {
    if (initialSelectedCompanyId !== 'all' && companies.some(c => c.id === initialSelectedCompanyId)) {
      return initialSelectedCompanyId;
    }
    return companies[0]?.id || '';
  });

  // Estilo do texto: 'clean' (100% compatível, sem interrogações) vs 'emoji'
  const [useEmojis, setUseEmojis] = useState<boolean>(false);
  const [clientName, setClientName] = useState<string>('');
  const [clientPhone, setClientPhone] = useState<string>('');
  const [includeGreeting, setIncludeGreeting] = useState<boolean>(true);
  const [includeStatus, setIncludeStatus] = useState<boolean>(true);
  const [includeInsights, setIncludeInsights] = useState<boolean>(true);
  
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // Empresa selecionada no modo individual
  const activeCompany = useMemo(() => {
    return companies.find(c => c.id === targetCompanyId) || companies[0];
  }, [companies, targetCompanyId]);

  // Cálculos para 1 Empresa Específica (Modo Individual)
  const singleCompanyMonthData = useMemo(() => {
    if (!activeCompany) return null;
    const entry = entries.find(e => 
      e.companyId === activeCompany.id && 
      e.year === targetYear && 
      e.month === targetMonth
    );

    const vendas = entry?.sales || 0;
    const compras = entry?.purchases || 0;
    const saldo = vendas - compras;
    const margemPct = vendas > 0 ? (saldo / vendas) * 100 : 0;
    const razaoPct = vendas > 0 ? (compras / vendas) * 100 : (compras > 0 ? 100 : 0);
    const notas = entry?.notesCount || 0;
    const status = entry?.status || 'AGUARDANDO';

    return {
      vendas,
      compras,
      saldo,
      margemPct,
      razaoPct,
      notas,
      status
    };
  }, [activeCompany, entries, targetYear, targetMonth]);

  // Cálculos para Todas as Empresas Cadastradas (Modo Todas as Empresas)
  const allCompaniesData = useMemo(() => {
    const monthEntries = entries.filter(e => e.year === targetYear && e.month === targetMonth);
    
    return companies.map(comp => {
      const ent = monthEntries.find(e => e.companyId === comp.id);
      const vendas = ent?.sales || 0;
      const compras = ent?.purchases || 0;
      const saldo = vendas - compras;
      const margemPct = vendas > 0 ? (saldo / vendas) * 100 : 0;
      const razaoPct = vendas > 0 ? (compras / vendas) * 100 : (compras > 0 ? 100 : 0);
      const notas = ent?.notesCount || 0;
      const status = ent?.status || 'AGUARDANDO';

      return {
        id: comp.id,
        name: comp.name,
        cnpj: comp.cnpj,
        vendas,
        compras,
        saldo,
        margemPct,
        razaoPct,
        notas,
        status
      };
    });
  }, [entries, companies, targetYear, targetMonth]);

  // Cálculos para a Consolidação Geral do Grupo (Modo Consolidado)
  const consolidatedMonthData = useMemo(() => {
    const monthEntries = entries.filter(e => e.year === targetYear && e.month === targetMonth);
    const totalVendas = monthEntries.reduce((acc, curr) => acc + curr.sales, 0);
    const totalCompras = monthEntries.reduce((acc, curr) => acc + curr.purchases, 0);
    const totalSaldo = totalVendas - totalCompras;
    const totalMargemPct = totalVendas > 0 ? (totalSaldo / totalVendas) * 100 : 0;
    const totalRazaoPct = totalVendas > 0 ? (totalCompras / totalVendas) * 100 : (totalCompras > 0 ? 100 : 0);
    const totalNotas = monthEntries.reduce((acc, curr) => acc + curr.notesCount, 0);

    const breakdown = companies.map(comp => {
      const ent = monthEntries.find(e => e.companyId === comp.id);
      const v = ent?.sales || 0;
      const c = ent?.purchases || 0;
      const m = v - c;
      const pct = totalVendas > 0 ? (v / totalVendas) * 100 : 0;
      const st = ent?.status || 'AGUARDANDO';
      return {
        id: comp.id,
        name: comp.name,
        cnpj: comp.cnpj,
        vendas: v,
        compras: c,
        saldo: m,
        participacao: pct,
        status: st
      };
    });

    return {
      totalVendas,
      totalCompras,
      totalSaldo,
      totalMargemPct,
      totalRazaoPct,
      totalNotas,
      breakdown
    };
  }, [entries, companies, targetYear, targetMonth]);

  // -------------------------------------------------------------------------
  // GERADOR DO TEXTO DE WHATSAPP (100% SEGURO CONTRA CARACTERES E INTERROGAÇÕES)
  // -------------------------------------------------------------------------
  const generatedText = useMemo(() => {
    const monthName = MONTHS[targetMonth];
    const greetingHeader = clientName.trim() 
      ? `Olá, *${clientName.trim()}*! Tudo bem?\nSegue o resumo financeiro:`
      : `Olá! Segue o resumo financeiro:`;

    // Símbolos seguros
    const SEP = '----------------------------------------';
    const BULLET = '• ';
    const SUB_BULLET = '  - ';

    const getStatusText = (st: Entry['status']) => {
      if (st === 'CONCLUIDO') return useEmojis ? '✅ Concluído' : '[Concluído]';
      if (st === 'EM ANDAMENTO') return useEmojis ? '🔄 Em Andamento' : '[Em Andamento]';
      return useEmojis ? '⏳ Aguardando' : '[Aguardando]';
    };

    // 1. MODO: INDIVIDUAL (POR EMPRESA)
    if (reportScope === 'individual') {
      if (!activeCompany || !singleCompanyMonthData) return '';

      const lines: string[] = [];
      if (includeGreeting) {
        lines.push(greetingHeader);
        lines.push('');
      }

      const headerTitle = useEmojis ? '📊 *RELATÓRIO MENSAL INDIVIDUAL*' : '*RELATÓRIO MENSAL INDIVIDUAL*';
      lines.push(headerTitle);
      lines.push(`*Empresa:* ${activeCompany.name.toUpperCase()}`);
      if (activeCompany.cnpj) {
        lines.push(`*CNPJ:* ${activeCompany.cnpj}`);
      }
      lines.push(`*Mês de Referência:* ${monthName} / ${targetYear}`);
      lines.push(SEP);
      lines.push(`*Faturamento Bruto (Vendas):* ${formatBRL(singleCompanyMonthData.vendas)}`);
      lines.push(`*Custos Operacionais (Compras):* ${formatBRL(singleCompanyMonthData.compras)}`);
      lines.push(`*Resultado Líquido (Margem):* ${formatBRL(singleCompanyMonthData.saldo)} (${singleCompanyMonthData.margemPct.toFixed(1)}%)`);
      lines.push(SEP);
      lines.push(`*Índice Custos / Receita:* ${singleCompanyMonthData.razaoPct.toFixed(1)}%`);

      if (singleCompanyMonthData.notas > 0) {
        lines.push(`*Notas Fiscais Processadas:* ${singleCompanyMonthData.notas}`);
      }

      if (includeStatus) {
        lines.push('');
        lines.push(`*Status do Fechamento:* ${getStatusText(singleCompanyMonthData.status)}`);
      }

      if (includeInsights) {
        lines.push('');
        lines.push(`*Diagnóstico:*`);
        if (singleCompanyMonthData.razaoPct <= 60) {
          lines.push(`Operação Saudável: custos representam apenas ${singleCompanyMonthData.razaoPct.toFixed(1)}% da receita.`);
        } else if (singleCompanyMonthData.razaoPct <= 75) {
          lines.push(`Alerta Orçamentário: custos entre 60% e 75% da receita.`);
        } else {
          lines.push(`Atenção: custos operacionais superiores a 75% da receita.`);
        }
      }

      lines.push('');
      lines.push(SEP);
      lines.push(`Monitor Financeiro - Gerado em ${new Date().toLocaleDateString('pt-BR')}.`);

      return lines.join('\n');
    }

    // 2. MODO: TODAS AS EMPRESAS (DETALHAMENTO COMPLETO DE CADA UMA)
    if (reportScope === 'all_companies') {
      const lines: string[] = [];
      if (includeGreeting) {
        lines.push(greetingHeader);
        lines.push('');
      }

      const headerTitle = useEmojis ? '📋 *RELATÓRIO DE TODAS AS EMPRESAS*' : '*RELATÓRIO DE TODAS AS EMPRESAS*';
      lines.push(headerTitle);
      lines.push(`*Mês de Referência:* ${monthName} / ${targetYear}`);
      lines.push(SEP);

      allCompaniesData.forEach((comp, idx) => {
        lines.push(`${idx + 1}. *${comp.name.toUpperCase()}*`);
        if (comp.cnpj) lines.push(`   CNPJ: ${comp.cnpj}`);
        lines.push(`${SUB_BULLET}Vendas: ${formatBRL(comp.vendas)}`);
        lines.push(`${SUB_BULLET}Compras: ${formatBRL(comp.compras)}`);
        lines.push(`${SUB_BULLET}Margem Líquida: ${formatBRL(comp.saldo)} (${comp.margemPct.toFixed(1)}%)`);
        lines.push(`${SUB_BULLET}Índice de Custos: ${comp.razaoPct.toFixed(1)}%`);
        if (includeStatus) {
          lines.push(`${SUB_BULLET}Status: ${getStatusText(comp.status)}`);
        }
        lines.push('');
      });

      // Total acumulado de todas juntas
      const sumV = allCompaniesData.reduce((a, b) => a + b.vendas, 0);
      const sumC = allCompaniesData.reduce((a, b) => a + b.compras, 0);
      const sumM = sumV - sumC;
      const sumPct = sumV > 0 ? (sumM / sumV) * 100 : 0;

      lines.push(SEP);
      lines.push(`*TOTAL COMBINADO:*`);
      lines.push(`• Vendas Totais: ${formatBRL(sumV)}`);
      lines.push(`• Compras Totais: ${formatBRL(sumC)}`);
      lines.push(`• Margem Combinada: ${formatBRL(sumM)} (${sumPct.toFixed(1)}%)`);
      lines.push(SEP);
      lines.push(`Monitor Financeiro - Gerado em ${new Date().toLocaleDateString('pt-BR')}.`);

      return lines.join('\n');
    }

    // 3. MODO: CONSOLIDADA (GRUPO EMPRESARIAL)
    const lines: string[] = [];
    if (includeGreeting) {
      lines.push(greetingHeader);
      lines.push('');
    }

    const headerTitle = useEmojis ? '🌐 *RESUMO GLOBAL CONSOLIDADO*' : '*RESUMO GLOBAL CONSOLIDADO*';
    lines.push(headerTitle);
    lines.push(`*Grupo:* ${companies.map(c => c.name).join(' & ')}`);
    lines.push(`*Mês de Referência:* ${monthName} / ${targetYear}`);
    lines.push(SEP);
    lines.push(`*Faturamento Consolidado:* ${formatBRL(consolidatedMonthData.totalVendas)}`);
    lines.push(`*Compras Consolidadas:* ${formatBRL(consolidatedMonthData.totalCompras)}`);
    lines.push(`*Lucro Operacional Líquido:* ${formatBRL(consolidatedMonthData.totalSaldo)} (${consolidatedMonthData.totalMargemPct.toFixed(1)}%)`);
    lines.push(SEP);
    lines.push('');
    lines.push(`*DESEMPENHO INDIVIDUAL POR EMPRESA:*`);

    consolidatedMonthData.breakdown.forEach(b => {
      lines.push('');
      lines.push(`${BULLET}*${b.name.toUpperCase()}* (${b.participacao.toFixed(1)}% do faturamento):`);
      lines.push(`${SUB_BULLET}Vendas: ${formatBRL(b.vendas)}`);
      lines.push(`${SUB_BULLET}Compras: ${formatBRL(b.compras)}`);
      lines.push(`${SUB_BULLET}Margem: ${formatBRL(b.saldo)}`);
      if (includeStatus) {
        lines.push(`${SUB_BULLET}Status: ${getStatusText(b.status)}`);
      }
    });

    if (consolidatedMonthData.totalNotas > 0) {
      lines.push('');
      lines.push(`*Volume de Notas:* ${consolidatedMonthData.totalNotas} notas fiscais processadas`);
    }

    if (includeInsights) {
      lines.push('');
      lines.push(`*Visão Executiva:*`);
      if (consolidatedMonthData.totalRazaoPct <= 60) {
        lines.push(`Excelente eficiência global: custos representam apenas ${consolidatedMonthData.totalRazaoPct.toFixed(1)}% do faturamento do grupo.`);
      } else {
        lines.push(`Custos operacionais consolidados absorveram ${consolidatedMonthData.totalRazaoPct.toFixed(1)}% das vendas do grupo.`);
      }
    }

    lines.push('');
    lines.push(SEP);
    lines.push(`Monitor Financeiro - Gerado em ${new Date().toLocaleDateString('pt-BR')}.`);

    return lines.join('\n');
  }, [
    reportScope, 
    activeCompany, 
    singleCompanyMonthData, 
    allCompaniesData, 
    consolidatedMonthData, 
    companies, 
    targetMonth, 
    targetYear, 
    clientName, 
    includeGreeting, 
    includeStatus, 
    includeInsights,
    useEmojis
  ]);

  if (!isOpen) return null;

  // Handler para Copiar Mensagem de Texto
  const handleCopyText = async () => {
    try {
      const safeText = generatedText.normalize('NFC');
      await navigator.clipboard.writeText(safeText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2600);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = generatedText.normalize('NFC');
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2600);
    }
  };

  // Handler Seguro para Abrir no WhatsApp
  const handleOpenWhatsApp = () => {
    const cleanedPhone = clientPhone.replace(/\D/g, '');
    const finalPhone = cleanedPhone ? (cleanedPhone.length <= 11 ? `55${cleanedPhone}` : cleanedPhone) : '';
    
    const normalized = generatedText.normalize('NFC');
    const encoded = encodeURIComponent(normalized);

    const url = finalPhone 
      ? `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs select-none">
      <div 
        className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-[#0d1322] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Resumo para WhatsApp"
      >
        
        {/* CABEÇALHO DO MODAL */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-transparent to-teal-500/10 dark:from-emerald-950/30 dark:to-transparent shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#25D366] text-white flex items-center justify-center shadow-md shadow-emerald-500/25 shrink-0">
              <Send size={18} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Resumo Financeiro para o WhatsApp
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  Pronto para Copiar & Colar
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gere o texto estruturado com valores, margens e status, e copie para colar na conversa com sua cliente.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* 3 OPÇÕES DE ESCOPO: INDIVIDUAL, TODAS AS EMPRESAS E CONSOLIDADA */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0a0f1c]/60 shrink-0">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Escolha o tipo de resumo:
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            {/* Opção 1: Individual */}
            <button
              type="button"
              onClick={() => setReportScope('individual')}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                reportScope === 'individual'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/30 ring-2 ring-emerald-500/20'
                  : 'bg-white dark:bg-[#131b2e] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Building2 size={15} />
              <span>1. Individual por Empresa</span>
            </button>

            {/* Opção 2: Todas as Empresas */}
            <button
              type="button"
              onClick={() => setReportScope('all_companies')}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                reportScope === 'all_companies'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/30 ring-2 ring-indigo-500/20'
                  : 'bg-white dark:bg-[#131b2e] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FileSpreadsheet size={15} />
              <span>2. Todas as Empresas</span>
            </button>

            {/* Opção 3: Consolidada */}
            <button
              type="button"
              onClick={() => setReportScope('consolidated')}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                reportScope === 'consolidated'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-sm shadow-purple-600/30 ring-2 ring-purple-500/20'
                  : 'bg-white dark:bg-[#131b2e] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Layers size={15} />
              <span>3. Grupo Consolidado</span>
            </button>
          </div>
        </div>

        {/* CORPO DO MODAL */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* COLUNA ESQUERDA: PARÂMETROS E PERSONALIZAÇÃO (5 COLUNAS) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Bloco 1: Seleção de Período e Empresa */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={13} className="text-emerald-500" />
                Período e Empresa
              </h4>

              {/* Seletor de Empresa para modo Individual */}
              {reportScope === 'individual' && (
                <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-300/60 dark:border-emerald-800/60 space-y-1.5">
                  <label className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200 block">
                    Empresa:
                  </label>
                  <select
                    value={targetCompanyId}
                    onChange={(e) => setTargetCompanyId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#0a0f1c] border border-emerald-400 dark:border-emerald-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden cursor-pointer"
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.cnpj ? `(${c.cnpj})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Mês e Ano */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Mês de Referência
                  </label>
                  <select
                    value={targetMonth}
                    onChange={(e) => setTargetMonth(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#0a0f1c] border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden cursor-pointer"
                  >
                    {MONTHS.map((m, idx) => (
                      <option key={idx} value={idx}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Ano
                  </label>
                  <select
                    value={targetYear}
                    onChange={(e) => setTargetYear(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#0a0f1c] border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden cursor-pointer"
                  >
                    {[2024, 2025, 2026, 2027].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Bloco 2: Dados da Cliente */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <User size={13} className="text-emerald-500" />
                Personalização da Mensagem
              </h4>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Nome da Cliente (opcional)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ex: Dra. Mariana / Rodrigo"
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-[#0a0f1c] border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-hidden"
                  />
                  <User size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  WhatsApp da Cliente (opcional)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="Ex: 11987654321"
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-[#0a0f1c] border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-hidden font-mono"
                  />
                  <Phone size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Bloco 3: Configurações de Formatação */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} className="text-emerald-500" />
                Opções do Texto
              </h4>

              {/* Formatação 100% limpa */}
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 space-y-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  <input
                    type="checkbox"
                    checked={!useEmojis}
                    onChange={(e) => setUseEmojis(!e.target.checked)}
                    className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                  <span>Formato 100% Limpo (Sem interrogações)</span>
                </label>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-300 pl-5">
                  Usa negrito nativo e marcadores seguros que chegam perfeitamente no celular da cliente.
                </p>
              </div>

              <div className="space-y-2 pt-1 text-xs text-slate-700 dark:text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeGreeting}
                    onChange={(e) => setIncludeGreeting(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                  <span>Incluir saudação cordial no início</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeStatus}
                    onChange={(e) => setIncludeStatus(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                  <span>Incluir status do fechamento contábil</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeInsights}
                    onChange={(e) => setIncludeInsights(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                  <span>Incluir diagnóstico de eficiência operacional</span>
                </label>
              </div>
            </div>

          </div>

          {/* COLUNA DIREITA: BALÃO DE WHATSAPP (7 COLUNAS) */}
          <div className="lg:col-span-7 flex flex-col justify-between min-h-[420px]">
            <div>
              <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#25D366]" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Prévia do Texto para o WhatsApp
                  </span>
                  {!useEmojis && (
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full">
                      Formatação Segura
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {generatedText.length} caracteres
                </span>
              </div>

              {/* Balão do WhatsApp */}
              <div className="p-4 rounded-xl bg-[#e5ddd5] dark:bg-[#0b141a] border border-slate-300 dark:border-slate-800 flex flex-col justify-between overflow-hidden shadow-inner relative max-h-[480px] overflow-y-auto">
                
                <div className="max-w-[96%] self-start bg-white dark:bg-[#202c33] text-slate-900 dark:text-[#e9edef] rounded-2xl rounded-tl-xs p-4 shadow-sm border border-black/5 dark:border-white/5 space-y-2 relative">
                  
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    <span>
                      {reportScope === 'individual' && `Relatório Individual: ${activeCompany?.name}`}
                      {reportScope === 'all_companies' && 'Relatório Completo de Todas as Empresas'}
                      {reportScope === 'consolidated' && 'Relatório Global Consolidado'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <pre className="font-sans text-xs whitespace-pre-wrap leading-relaxed select-text select-all font-medium">
                    {generatedText}
                  </pre>

                  <div className="flex items-center justify-end gap-1 pt-1 text-[10px] text-sky-500 font-bold">
                    <span>Enviado</span>
                    <span>✓✓</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-300/60 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                  <span>
                    Dica: Clique em <strong>Copiar Texto da Mensagem</strong> abaixo e cole direto no WhatsApp com <strong>Ctrl + V</strong>.
                  </span>
                </div>
              </div>
            </div>

            {copiedText && (
              <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700/80 rounded-xl flex items-center gap-2.5 text-xs text-emerald-900 dark:text-emerald-100 shadow-sm animate-in fade-in">
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-bold">Texto copiado com sucesso! Agora basta dar Ctrl + V na conversa da sua cliente.</span>
              </div>
            )}
          </div>

        </div>

        {/* RODAPÉ DO MODAL COM BOTÕES DE AÇÃO */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0a0f1c] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {reportScope === 'individual' && `Empresa: ${activeCompany?.name} (${MONTHS[targetMonth]}/${targetYear})`}
            {reportScope === 'all_companies' && `Todas as ${companies.length} Empresas (${MONTHS[targetMonth]}/${targetYear})`}
            {reportScope === 'consolidated' && `Consolidação do Grupo (${MONTHS[targetMonth]}/${targetYear})`}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Botão Principal: Copiar Texto */}
            <button
              type="button"
              onClick={handleCopyText}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-md ${
                copiedText
                  ? 'bg-emerald-600 text-white shadow-emerald-600/30 ring-2 ring-emerald-500/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
              }`}
            >
              {copiedText ? (
                <>
                  <Check size={16} className="stroke-[3]" />
                  <span>Texto Copiado! Basta colar (Ctrl+V)</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  <span>Copiar Texto da Mensagem</span>
                </>
              )}
            </button>

            {/* Botão Secundário: Abrir no WhatsApp */}
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold transition-all cursor-pointer"
              title="Abre o WhatsApp no navegador com o texto pré-carregado"
            >
              <Send size={14} className="stroke-[2]" />
              <span>Abrir WhatsApp</span>
              <ExternalLink size={12} className="opacity-70" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
