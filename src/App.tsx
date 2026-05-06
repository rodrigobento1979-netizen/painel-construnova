/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  Building2, 
  Calendar, 
  ChevronRight, 
  History, 
  LayoutDashboard, 
  Moon, 
  Plus, 
  Sun, 
  TrendingUp, 
  TrendingDown, 
  ChevronDown,
  Trash2,
  AlertCircle,
  FileText,
  Download,
  X,
  RefreshCw
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  BarChart as BarChart3_Recharts,
  Bar as Bar_Recharts,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from './lib/supabase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/** Utility for Tailwind class merging */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Tipos ---

interface Company {
  id: string;
  name: string;
  cnpj: string;
  color: string;
}

interface Entry {
  id: string;
  companyId: string;
  year: number;
  month: number;
  purchases: number;
  sales: number;
  updatedAt?: string;
}

type Tab = 'dashboard' | 'companies' | 'entries';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MONTH_INITIALS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// --- Componente Principal ---

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    }
    return 'light';
  });
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>(new Date().getMonth());
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Cálculo de Proporção (Compras vs Vendas)
  const stats = useMemo(() => {
    if (!selectedCompanyId) return null;
    
    const companyYearEntries = entries.filter(e => e.companyId === selectedCompanyId && e.year === selectedYear);
    
    // Filtrar por mês se não for "Todos"
    const filteredEntries = selectedMonth === 'all' 
      ? companyYearEntries 
      : companyYearEntries.filter(e => e.month === selectedMonth);

    const totalPurchases = filteredEntries.reduce((acc, curr) => acc + curr.purchases, 0);
    const totalSales = filteredEntries.reduce((acc, curr) => acc + curr.sales, 0);
    
    // Nova lógica sugerida pelo usuário: Compras / Vendas
    const ratio = totalSales > 0 ? (totalPurchases / totalSales) * 100 : (totalPurchases > 0 ? 100 : 0);
    
    return {
      totalPurchases,
      totalSales,
      ratio,
      isMonthly: selectedMonth !== 'all'
    };
  }, [entries, selectedCompanyId, selectedYear, selectedMonth]);

  // Funções de Busca
  const refreshData = async () => {
    setLoading(true);
    try {
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .order('name');
      
      if (companiesError) throw companiesError;

      const { data: entriesData, error: entriesError } = await supabase
        .from('entries')
        .select('*');
      
      if (entriesError) throw entriesError;

      setCompanies(companiesData.map(c => ({
        id: c.id,
        name: c.name,
        cnpj: c.cnpj,
        color: c.color
      })));

      setEntries(entriesData.map(e => ({
        id: e.id,
        companyId: e.company_id,
        year: e.year,
        month: e.month,
        purchases: e.purchases,
        sales: e.sales,
        updatedAt: e.updated_at || e.created_at
      })));
      
      const now = new Date();
      setLastUpdate(now);
      console.log("Data refreshed at:", now.toLocaleTimeString());

      if (companiesData.length > 0 && !selectedCompanyId) {
        setSelectedCompanyId(companiesData[0].id);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados iniciais
  useEffect(() => {
    refreshData();
  }, []);

  // Handle Theme
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  // --- Funções de Manipulação ---

  const addCompany = async (name: string, cnpj: string) => {
    const newCompanyData = {
      name,
      cnpj,
      color: COLORS[companies.length % COLORS.length]
    };

    const { data, error } = await supabase
      .from('companies')
      .insert([newCompanyData])
      .select();

    if (error) {
      console.error('Error adding company:', error);
      alert('Erro ao adicionar empresa. Verifique se o CNPJ já existe ou se as tabelas foram criadas no Supabase.');
      return;
    }

    if (data) {
      const created = data[0];
      const newCompany = {
        id: created.id,
        name: created.name,
        cnpj: created.cnpj,
        color: created.color
      };
      setCompanies(prev => [...prev, newCompany]);
      setLastUpdate(new Date()); // Update sync time locally
      if (!selectedCompanyId) setSelectedCompanyId(newCompany.id);
    }
  };

  const removeCompany = async (id: string) => {
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error removing company:', error);
      return;
    }

    setCompanies(prev => prev.filter(c => c.id !== id));
    setEntries(prev => prev.filter(e => e.companyId !== id));
    setLastUpdate(new Date()); // Update sync time locally
    if (selectedCompanyId === id) setSelectedCompanyId('');
  };

  const saveEntry = async (companyId: string, year: number, month: number, purchases: number, sales: number) => {
    const entryData = {
      company_id: companyId,
      year,
      month,
      purchases,
      sales
    };

    console.log("Salvando valores:", {
      company_id: companyId,
      year,
      month,
      purchases,
      sales
    });

    const { data, error } = await supabase
      .from('entries')
      .upsert(entryData, { onConflict: 'company_id,year,month' })
      .select();

    if (error) {
      console.error('Error saving entry:', error);
      alert('Erro ao salvar os dados. Verifique sua conexão ou se a tabela no Supabase possui as colunas compras e vendas.');
      return;
    }

    if (data) {
      const updatedEntry = data[0];
      const entryObj = {
        id: updatedEntry.id,
        companyId: updatedEntry.company_id,
        year: updatedEntry.year,
        month: updatedEntry.month,
        purchases: updatedEntry.purchases,
        sales: updatedEntry.sales,
        updatedAt: updatedEntry.created_at // Usando created_at como referência já que updated_at não existe
      };

      const now = new Date();
      setLastUpdate(now); // Força a atualização do "Sincronizado" na hora
      console.log("Sync atualizado via salvamento em:", now.toLocaleTimeString());
      setEntries(prev => {
        const existingIndex = prev.findIndex(e => e.companyId === companyId && e.year === year && e.month === month);
        if (existingIndex > -1) {
          const updated = [...prev];
          updated[existingIndex] = entryObj;
          return updated;
        } else {
          return [...prev, entryObj];
        }
      });
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)] font-sans transition-colors duration-300 relative">
      {/* Background Mesh */}
      <div className="mesh-bg" />

      {/* Barra Lateral */}
      <nav className="w-64 glass hidden md:flex flex-col h-full border-r border-[var(--border)] z-50 shrink-0">
        <div className="p-5 flex-1 overflow-y-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-indigo-500/20">
              M
            </div>
            <h1 className="font-bold text-xl tracking-tight">Monitor</h1>
            <span className="text-[10px] font-mono opacity-20 ml-auto">v1.1.4.1</span>
          </div>
          
          <div className="space-y-1">
            <SidebarItem 
              icon={<LayoutDashboard size={20} />} 
              label="Painel" 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
            />
            <SidebarItem 
              icon={<Building2 size={20} />} 
              label="Empresas" 
              active={activeTab === 'companies'} 
              onClick={() => setActiveTab('companies')} 
            />
            <SidebarItem 
              icon={<History size={20} />} 
              label="Lançamentos" 
              active={activeTab === 'entries'} 
              onClick={() => setActiveTab('entries')} 
            />
            
            {lastUpdate && (
              <motion.div 
                key={lastUpdate.getTime()}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-2 ml-4 flex items-center gap-2 py-1 px-3 rounded-lg bg-[#39ff14]/5 border border-[#39ff14]/20 shadow-[0_0_10px_rgba(57,255,20,0.05)]"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#39ff14] shadow-[0_0_8px_#39ff14] animate-pulse" />
                <div className="flex flex-col leading-tight">
                  <span className="text-[7px] font-black uppercase tracking-widest text-[#39ff14]/60">Sincronizado</span>
                  <span className="text-[9px] font-mono font-bold text-[#39ff14]/80">
                    {lastUpdate.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Sao_Paulo' })}
                  </span>
                </div>
              </motion.div>
            )}

            <div className="mt-4 px-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[8px] font-black uppercase tracking-widest opacity-40 ml-1">Período de Análise</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[11px] text-white/80 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white' stroke-opacity='0.2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }}
                >
                  <option value="all" className="bg-[#0a0a0a]">Todos os meses</option>
                  {[
                    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
                  ].map((month, idx) => (
                    <option key={idx} value={idx} className="bg-[#0a0a0a]">{month}</option>
                  ))}
                </select>
              </div>
            </div>

            {stats && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={`stats-${selectedMonth}-${selectedYear}`}
                className="mt-2 mx-3 p-3 rounded-xl bg-white/5 border border-white/10 shadow-lg relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-3xl -mr-12 -mt-12 pointer-events-none rounded-full" />
                
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[8px] font-bold uppercase tracking-widest opacity-40">
                    {stats.isMonthly ? `Eficiência Mensal` : `Eficiência Anual`}
                  </span>
                  <div className={cn(
                    "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider transition-colors",
                    stats.ratio >= 60 
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                      : stats.ratio >= 45 
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  )}>
                    {stats.ratio >= 60 ? 'Meta Atingida' : stats.ratio >= 45 ? 'Em Evolução' : 'Abaixo da Meta'}
                  </div>
                </div>

                <div className="flex flex-col">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={cn(
                      "text-3xl font-bold font-mono tracking-tighter leading-none transition-colors",
                      stats.ratio >= 60 ? "text-emerald-400" : stats.ratio >= 45 ? "text-amber-400" : "text-rose-400"
                    )}>
                      {stats.ratio.toFixed(1)}%
                    </span>
                    <div className="text-right">
                      <span className="text-[9px] opacity-30 block font-semibold uppercase tracking-widest">Objetivo</span>
                      <span className="text-[10px] font-mono font-bold opacity-60">60.0%</span>
                    </div>
                  </div>
                  
                  {/* Barra de Progresso com Meta Destacada */}
                  <div className="mt-6 relative">
                    {/* Marcador de Meta Superior (Seta) */}
                    <div className="absolute -top-4 left-[60%] -ml-1.5 flex flex-col items-center z-30">
                      <ChevronDown size={10} className="text-white/80 animate-pulse" />
                    </div>
                    
                    <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden relative border border-white/5">
                      {/* Linha da Meta interna */}
                      <div className="absolute top-0 left-[60%] w-0.5 h-full bg-white/40 z-20 shadow-[0_0_8px_rgba(255,255,255,0.3)]" /> 
                      
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(stats.ratio, 100)}%` }}
                        className={cn(
                          "h-full rounded-full transition-colors relative",
                          stats.ratio >= 60 ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]" : stats.ratio >= 45 ? "bg-amber-500" : "bg-rose-500"
                        )}
                      >
                        <div className="absolute inset-0 bg-white/10 mix-blend-overlay" />
                      </motion.div>
                    </div>
                  </div>
                  <span className="text-[9px] opacity-30 mt-2 uppercase tracking-wider font-semibold">Proporção Compras sobre Vendas</span>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[7px] font-black uppercase tracking-widest opacity-30">Total Vendas</span>
                    <span className="text-xs font-mono font-medium text-white/80">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(stats.totalSales)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 text-right">
                    <span className="text-[7px] font-black uppercase tracking-widest opacity-30">Total Compras</span>
                    <span className="text-xs font-mono font-medium text-white/50">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(stats.totalPurchases)}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
        
      </nav>

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10 p-4 gap-4 overflow-y-auto">
        <header className="h-12 flex items-center justify-between px-2">
          <div className="md:hidden flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-xl text-white">M</div>
            <span className="font-bold text-xl">Monitor</span>
          </div>
          
          <div className="hidden md:block">
            <h2 className="text-xl font-bold tracking-tight">
              {activeTab === 'dashboard' ? 'Painel Principal' : activeTab === 'companies' ? 'Empresas' : 'Lançamentos'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {activeTab === 'dashboard' && (
              <button 
                onClick={() => setIsReportModalOpen(true)}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-500/20"
              >
                <FileText size={16} />
                <span className="hidden sm:inline">Relatório</span>
              </button>
            )}

            <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
              <button 
                onClick={() => setTheme('light')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                  theme === 'light' ? "bg-white/10 shadow-sm" : "opacity-50 hover:opacity-100"
                )}
              >
                Claro
              </button>
              <button 
                onClick={() => setTheme('dark')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                  theme === 'dark' ? "bg-white/10 shadow-sm" : "opacity-50 hover:opacity-100"
                )}
              >
                Escuro
              </button>
            </div>
            <button 
              onClick={toggleTheme}
              className="w-10 h-10 glass flex items-center justify-center rounded-xl hover:bg-white/5 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
          </div>
        </header>

        <div className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && (
                <DashboardView 
                  companies={companies} 
                  entries={entries} 
                  selectedYear={selectedYear}
                  setSelectedYear={setSelectedYear}
                  selectedCompanyId={selectedCompanyId}
                  setSelectedCompanyId={setSelectedCompanyId}
                />
              )}
              {activeTab === 'companies' && (
                <CompaniesView companies={companies} onAdd={addCompany} onRemove={removeCompany} />
              )}
              {activeTab === 'entries' && (
                <EntriesView 
                  companies={companies} 
                  entries={entries} 
                  selectedYear={selectedYear}
                  setSelectedYear={setSelectedYear}
                  selectedCompanyId={selectedCompanyId}
                  setSelectedCompanyId={setSelectedCompanyId}
                  onSave={saveEntry}
                  onRefresh={refreshData}
                />
              )}
            </AnimatePresence>
          )}
        </div>
      </main>

      <ReportModal 
        isOpen={isReportModalOpen} 
        onClose={() => setIsReportModalOpen(false)} 
        entries={entries}
        companies={companies}
        selectedCompanyId={selectedCompanyId}
      />
    </div>
  );
}

// --- Sub-components ---

function ReportModal({ isOpen, onClose, entries, companies, selectedCompanyId }: { 
  isOpen: boolean, 
  onClose: () => void,
  entries: Entry[],
  companies: Company[],
  selectedCompanyId: string
}) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [reportType, setReportType] = useState<'purchases' | 'sales' | 'both'>('both');

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  const handleDownload = () => {
    if (!selectedCompany) return;

    const doc = new jsPDF();
    const companyEntries = entries.filter(e => e.companyId === selectedCompanyId && e.year === year);
    
    try {
      // Header
      doc.setFontSize(20);
      doc.text('Relatório Financeiro', 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Empresa: ${selectedCompany.name}`, 14, 30);
      doc.text(`CNPJ: ${selectedCompany.cnpj}`, 14, 35);
      doc.text(`Ano de Referência: ${year}`, 14, 40);
      doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, 45);

      const tableData = MONTHS.map((monthName, index) => {
        const entry = companyEntries.find(e => e.month === index);
        const row: any[] = [monthName];
        
        if (reportType === 'purchases' || reportType === 'both') {
          row.push(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry?.purchases || 0));
        }
        
        if (reportType === 'sales' || reportType === 'both') {
          row.push(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry?.sales || 0));
        }

        if (reportType === 'both') {
          const balance = (entry?.sales || 0) - (entry?.purchases || 0);
          row.push(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(balance));
        }

        return row;
      });

      const headers = ['Mês'];
      if (reportType === 'purchases' || reportType === 'both') headers.push('Compras');
      if (reportType === 'sales' || reportType === 'both') headers.push('Vendas');
      if (reportType === 'both') headers.push('Resultado');

      autoTable(doc, {
        startY: 55,
        head: [headers],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 9 },
        margin: { top: 55 },
      });

      // Totals
      const totalPurchases = companyEntries.reduce((acc, curr) => acc + curr.purchases, 0);
      const totalSales = companyEntries.reduce((acc, curr) => acc + curr.sales, 0);
      
      const docAny = doc as any;
      const finalY = (docAny.lastAutoTable?.finalY || 55) + 10;
      doc.setFontSize(12);
      doc.setTextColor(0);
      
      let currentY = finalY;
      if (reportType === 'purchases' || reportType === 'both') {
        doc.text(`Total Compras: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPurchases)}`, 14, currentY);
        currentY += 7;
      }
      if (reportType === 'sales' || reportType === 'both') {
        doc.text(`Total Vendas: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalSales)}`, 14, currentY);
        currentY += 7;
      }
      if (reportType === 'both') {
        doc.setFont('helvetica', 'bold');
        doc.text(`Resultado Final: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalSales - totalPurchases)}`, 14, currentY);
      }

      doc.save(`relatorio_${selectedCompany.name.toLowerCase().replace(/\s+/g, '_')}_${year}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert('Erro ao gerar o PDF. Tente novamente.');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md glass rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-white/10"
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Gerar Relatório</h3>
                <p className="text-xs opacity-50">Escolha o período e os dados para exportar</p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold opacity-50">Ano de Referência</label>
                <select 
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-indigo-500/50 transition-all font-medium appearance-none"
                >
                  {Array.from(new Set([...entries.map(e => e.year), new Date().getFullYear()])).sort((a,b) => b-a).map(y => (
                    <option key={y} value={y} className="bg-slate-800 text-white">{y}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold opacity-50">Tipo de Dado</label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'both', label: 'Ambos (Compras e Vendas)' },
                    { id: 'sales', label: 'Apenas Vendas' },
                    { id: 'purchases', label: 'Apenas Compras' }
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setReportType(type.id as any)}
                      className={cn(
                        "w-full py-3 px-4 rounded-xl text-sm font-bold transition-all border text-left",
                        reportType === type.id 
                          ? "bg-indigo-600/20 border-indigo-500 text-indigo-400" 
                          : "bg-white/5 border-white/10 opacity-60 hover:opacity-100"
                      )}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={handleDownload}
                  className="w-full bg-indigo-600 text-white rounded-xl py-4 font-bold hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                >
                  <Download size={18} />
                  Baixar Relatório (PDF)
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// --- Sub-components ---

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full p-3 rounded-lg transition-all group",
        active 
          ? "bg-white/5 border-l-2 border-indigo-500 rounded-r-lg" 
          : "text-[var(--muted)] hover:bg-white/5 hover:text-[var(--foreground)]"
      )}
    >
      <span className={cn("transition-transform group-hover:scale-110", active ? "text-indigo-400" : "text-[var(--muted-foreground)]")}>
        {icon}
      </span>
      <span className="font-medium text-sm">{label}</span>
    </button>
  );
}

// --- Visualizações ---

function DashboardView({ 
  companies, 
  entries, 
  selectedYear, 
  setSelectedYear,
  selectedCompanyId,
  setSelectedCompanyId
}: { 
  companies: Company[], 
  entries: Entry[],
  selectedYear: number,
  setSelectedYear: (y: number) => void,
  selectedCompanyId: string,
  setSelectedCompanyId: (id: string) => void
}) {
  const years = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
  }, []);

  const filteredEntries = useMemo(() => {
    if (!selectedCompanyId) return [];
    return entries.filter(e => e.companyId === selectedCompanyId);
  }, [entries, selectedCompanyId]);

  const chartData = useMemo(() => {
    return MONTHS.map((_, index) => {
      const monthEntries = filteredEntries.filter(e => e.month === index && e.year === selectedYear);
      return {
        name: MONTH_INITIALS[index],
        compras: monthEntries.reduce((acc, curr) => acc + curr.purchases, 0),
        vendas: monthEntries.reduce((acc, curr) => acc + curr.sales, 0),
      };
    });
  }, [filteredEntries, selectedYear]);

  const yoyData = useMemo(() => {
    return MONTHS.map((_, index) => {
      const currentYearEntries = filteredEntries.filter(e => e.month === index && e.year === selectedYear);
      const previousYearEntries = filteredEntries.filter(e => e.month === index && e.year === selectedYear - 1);
      
      const currentTotal = currentYearEntries.reduce((acc, curr) => acc + curr.sales + curr.purchases, 0);
      const previousTotal = previousYearEntries.reduce((acc, curr) => acc + curr.sales + curr.purchases, 0);
      
      let growth = 0;
      if (previousTotal > 0) {
        growth = ((currentTotal - previousTotal) / previousTotal) * 100;
      }

      return {
        name: MONTH_INITIALS[index],
        atual: currentTotal,
        anterior: previousTotal,
        crescimento: growth
      };
    });
  }, [filteredEntries, selectedYear]);

  const pieData = useMemo(() => {
    const totalPurchases = chartData.reduce((acc, curr) => acc + curr.compras, 0);
    const totalSales = chartData.reduce((acc, curr) => acc + curr.vendas, 0);
    return [
      { name: 'Compras', value: totalPurchases, fill: '#6366f1' },
      { name: 'Vendas', value: totalSales, fill: '#10b981' }
    ];
  }, [chartData]);

  const kpis = useMemo(() => {
    const totalSales = pieData[1].value;
    
    // Find best month
    let bestMonth = { name: '-', value: 0 };
    const monthsWithData = chartData.filter(d => {
      if (d.vendas > bestMonth.value) {
        bestMonth = { name: d.name, value: d.vendas };
      }
      return d.vendas > 0 || d.compras > 0;
    }).length;

    const avgMonthlySales = monthsWithData > 0 ? totalSales / monthsWithData : 0;

    // Global Totals (All Companies)
    const globalTotalPurchases = entries.filter(e => e.year === selectedYear).reduce((acc, curr) => acc + curr.purchases, 0);
    const globalTotalSales = entries.filter(e => e.year === selectedYear).reduce((acc, curr) => acc + curr.sales, 0);

    return {
      bestMonth,
      avgMonthlySales,
      monthsWithData,
      globalTotalPurchases,
      globalTotalSales
    };
  }, [pieData, chartData, entries, selectedYear]);

  if (companies.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center min-h-[60vh] text-center"
      >
        <div className="w-20 h-20 glass rounded-3xl flex items-center justify-center mb-6 shadow-xl p-4">
          <AlertCircle className="w-10 h-10 text-[var(--muted)]" />
        </div>
        <h3 className="text-2xl font-bold mb-2">Nenhuma empresa encontrada</h3>
        <p className="text-[var(--muted)] max-w-sm">
          Cadastre sua primeira empresa para começar a visualizar os indicadores financeiros no dashboard.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white/5 p-3 rounded-xl border border-white/10 mb-4 relative shrink-0">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex flex-col gap-1.5 min-w-[200px]">
            <select 
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg py-2 px-3 outline-none font-bold text-sm focus:border-indigo-500/50 transition-all cursor-pointer"
            >
              <option value="" className="bg-slate-900">Selecione uma Empresa</option>
              {companies.map(c => <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>)}
            </select>
          </div>
        </div>
        
        <div className="flex gap-2">
          {years.map(y => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-bold transition-all",
                selectedYear === y 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
                  : "bg-white/5 hover:bg-white/10 opacity-60 hover:opacity-100"
              )}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {!selectedCompanyId ? (
        <div className="glass p-20 text-center rounded-[var(--radius)]">
          <Building2 size={48} className="mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-bold opacity-60">Selecione uma empresa para visualizar os dados</h3>
          <p className="text-sm opacity-40">Os gráficos serão gerados automaticamente.</p>
        </div>
      ) : (
        <div className="space-y-4 h-full">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="glass p-2.5 rounded-xl flex items-center gap-2 border border-white/5 shadow-lg shadow-black/10">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                <Calendar size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[8px] uppercase font-bold tracking-wider opacity-40 truncate">Melhor Mês</p>
                <p className="text-base font-bold text-white truncate">
                  {kpis.bestMonth.name}
                </p>
              </div>
            </div>

            <div className="glass p-2.5 rounded-xl flex items-center gap-2 border border-white/5 shadow-lg shadow-black/10">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                <Building2 size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[8px] uppercase font-bold tracking-wider opacity-40 truncate">Total Consolidado (Geral)</p>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-emerald-400">V: </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-400/90 truncate">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(kpis.globalTotalSales)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-indigo-400">C: </span>
                    <span className="text-[10px] font-mono font-bold text-indigo-400/90 truncate">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(kpis.globalTotalPurchases)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass p-2.5 rounded-xl flex items-center gap-2 border border-white/5 shadow-lg shadow-black/10">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                <History size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[8px] uppercase font-bold tracking-wider opacity-40 truncate">Média Vendas ({kpis.monthsWithData} m)</p>
                <p className="text-base font-bold text-white truncate">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(kpis.avgMonthlySales)}
                </p>
              </div>
            </div>
          </div>

          {/* Top Section: Summary & Pie Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 glass p-4 rounded-2xl shadow-lg shadow-black/10 flex flex-col justify-center">
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-bold opacity-60 uppercase tracking-widest">Resumo Anual ({selectedYear})</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold opacity-40 uppercase tracking-tighter">Total Compras</p>
                    <p className="text-lg font-bold font-mono text-[#6366f1]">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pieData[0].value)}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold opacity-40 uppercase tracking-tighter">Total Vendas</p>
                    <p className="text-lg font-bold font-mono text-[#10b981]">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pieData[1].value)}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/5">
                  <p className="text-xs">
                    <span className="opacity-50">Resultado: </span>
                    <span className={cn("font-bold", (pieData[1].value - pieData[0].value) >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pieData[1].value - pieData[0].value)}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="glass p-3 rounded-2xl shadow-lg shadow-black/10 flex flex-col items-center justify-center">
              <h3 className="text-[9px] font-bold uppercase tracking-widest opacity-50 mb-1">Distribuição</h3>
              <div className="h-[100px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={55}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 mt-2">
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[10px] font-bold">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: d.fill }}></div>
                    <span className="opacity-60">{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Chart Section: Monthly Bar & YoY Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
            {/* Monthly Comparison (Bars) */}
            <div className="glass p-4 rounded-2xl shadow-lg shadow-black/10 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Mensal ({selectedYear})</h3>
                <div className="flex items-center gap-3 text-[9px] uppercase tracking-widest font-bold opacity-60">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1]"></span>
                    <span>Compras</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>
                    <span>Vendas</span>
                  </div>
                </div>
              </div>
              <div className="flex-1 min-h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart3_Recharts data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: 'var(--muted)', fontWeight: 600 }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: 'var(--muted)', fontWeight: 600 }} 
                      tickFormatter={(val) => `R$${val/1000}k`}
                    />
                    <Tooltip 
                      formatter={(val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)}
                      cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                      contentStyle={{ 
                        backgroundColor: 'rgba(2, 6, 23, 0.9)', 
                        backdropFilter: 'blur(10px)',
                        borderColor: 'rgba(255,255,255,0.1)', 
                        borderRadius: '8px',
                        fontSize: '10px'
                      }} 
                    />
                    <Bar_Recharts dataKey="compras" fill="#6366f1" radius={[2, 2, 0, 0]} name="Compras" />
                    <Bar_Recharts dataKey="vendas" fill="#10b981" radius={[2, 2, 0, 0]} name="Vendas" />
                  </BarChart3_Recharts>
                </ResponsiveContainer>
              </div>
            </div>

            {/* YoY Comparison (Growth Line) */}
            <div className="glass p-4 rounded-2xl shadow-lg shadow-black/10 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Crescimento %</h3>
                <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-bold opacity-60">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  <span>Var. %</span>
                </div>
              </div>
              <div className="flex-1 min-h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={yoyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: 'var(--muted)', fontWeight: 600 }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: 'var(--muted)', fontWeight: 600 }} 
                      tickFormatter={(val) => `${val}%`}
                    />
                    <Tooltip 
                      formatter={(val: number) => `${val.toFixed(2)}%`}
                      cursor={{ stroke: 'rgba(255, 255, 255, 0.1)', strokeWidth: 1 }}
                      contentStyle={{ 
                        backgroundColor: 'rgba(2, 6, 23, 0.9)', 
                        backdropFilter: 'blur(10px)',
                        borderColor: 'rgba(255,255,255,0.1)', 
                        borderRadius: '8px',
                        fontSize: '10px'
                      }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="crescimento" 
                      stroke="#818cf8" 
                      strokeWidth={2} 
                      dot={{ r: 3, fill: '#818cf8', strokeWidth: 1, stroke: '#fff' }}
                      name="Var. %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
  </motion.div>
);
}

function CompaniesView({ companies, onAdd, onRemove }: { 
  companies: Company[], 
  onAdd: (n: string, c: string) => void, 
  onRemove: (id: string) => void 
}) {
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && cnpj) {
      onAdd(name, cnpj);
      setName('');
      setCnpj('');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-4xl mx-auto space-y-4"
    >
      <div className="glass p-5 rounded-[var(--radius)] shadow-lg shadow-black/10">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-indigo-400" /> Adicionar Nova Empresa
        </h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold opacity-50">Nome Fantasia</label>
            <input 
              type="text" 
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Minha Empresa LTDA"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-indigo-500/50 transition-all font-medium"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold opacity-50">CNPJ</label>
            <input 
              type="text" 
              required
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0001-00"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-indigo-500/50 transition-all font-medium"
            />
          </div>
          <button className="md:col-span-2 bg-indigo-600 text-white rounded-xl py-3.5 font-bold hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
            Cadastrar Empresa
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {companies.map(company => (
          <motion.div 
            layout
            key={company.id}
            className="glass p-5 rounded-[var(--radius)] flex items-center justify-between group hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold text-white shadow-inner" 
                style={{ backgroundColor: company.color }}
              >
                {company.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="font-bold">{company.name}</h4>
                <p className="text-xs opacity-50 font-mono tracking-tighter">{company.cnpj}</p>
              </div>
            </div>
            <button 
              onClick={() => onRemove(company.id)}
              className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 size={18} />
            </button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function EntriesView({ 
  companies, 
  entries, 
  selectedYear,
  setSelectedYear,
  selectedCompanyId,
  setSelectedCompanyId,
  onSave,
  onRefresh
}: { 
  companies: Company[], 
  entries: Entry[], 
  selectedYear: number,
  setSelectedYear: (y: number) => void,
  selectedCompanyId: string,
  setSelectedCompanyId: (id: string) => void,
  onSave: (cId: string, y: number, m: number, p: number, s: number) => void,
  onRefresh: () => Promise<void>
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 glass p-4 rounded-[var(--radius)] shadow-lg shadow-black/10">
        <div className="flex flex-col gap-2 flex-1">
          <div className="flex items-center gap-3">
            <Calendar className="text-indigo-400" size={20} />
            <h3 className="text-base font-bold">Lançamentos ({selectedYear})</h3>
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={cn(
                "p-2 hover:bg-white/10 rounded-lg transition-all",
                isRefreshing && "animate-spin opacity-50"
              )}
              title="Sincronizar agora"
            >
              <RefreshCw size={18} className="text-indigo-400" />
            </button>
          </div>
          
          <div className="flex gap-2">
            {years.map(y => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-bold transition-all",
                  selectedYear === y 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
                    : "bg-white/5 hover:bg-white/10 opacity-60 hover:opacity-100"
                )}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        <select 
          value={selectedCompanyId}
          onChange={(e) => setSelectedCompanyId(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl py-2 px-4 outline-none font-medium min-w-[240px] focus:border-indigo-500/50 transition-all text-sm self-start"
        >
          <option value="">Selecione uma empresa</option>
          {companies.map(c => <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>)}
        </select>
      </div>

      {!selectedCompanyId ? (
        <div className="text-center py-20 bg-white/5 rounded-[var(--radius)] border border-dashed border-white/10">
          <p className="text-[var(--muted)]">Selecione uma empresa acima para realizar os lançamentos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {MONTHS.map((month, idx) => {
            const entry = entries.find(e => e.companyId === selectedCompanyId && e.month === idx && e.year === selectedYear);
            return (
              <div key={idx}>
                <EntryCard 
                  month={month} 
                  purchases={entry?.purchases || 0} 
                  sales={entry?.sales || 0}
                  onSave={(p, s) => onSave(selectedCompanyId, selectedYear, idx, p, s)}
                />
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// --- Utilitários ---

function formatCurrency(value: number | string): string {
  const amount = typeof value === 'number' ? value : (parseFloat(value.replace(/\D/g, '')) / 100);
  if (isNaN(amount)) return 'R$ 0,00';
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2
  }).format(amount);
}

function parseCurrency(value: string): number {
  const cleanValue = value.replace(/\D/g, '');
  return cleanValue ? (parseFloat(cleanValue) / 100) : 0;
}

function EntryCard({ month, purchases, sales, onSave }: { 
  month: string, 
  purchases: number, 
  sales: number, 
  onSave: (p: number, s: number) => void 
}) {
  const [pVal, setPVal] = useState(formatCurrency(purchases));
  const [sVal, setSVal] = useState(formatCurrency(sales));

  useEffect(() => {
    setPVal(formatCurrency(purchases));
    setSVal(formatCurrency(sales));
  }, [purchases, sales]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) => {
    const value = e.target.value.replace(/\D/g, '');
    if (!value) {
      setter('R$ 0,00');
      return;
    }
    const numberValue = parseFloat(value) / 100;
    setter(formatCurrency(numberValue));
  };

  const handleBlur = () => {
    const pNum = parseCurrency(pVal);
    const sNum = parseCurrency(sVal);
    console.log('Saving values:', { pNum, sNum });
    onSave(pNum, sNum);
  };

  return (
    <div className="glass p-5 rounded-[var(--radius)] space-y-4 hover:border-indigo-500/30 transition-all group">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <h4 className="font-bold text-xs uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">{month}</h4>
        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <label className="text-[10px] font-bold opacity-40 uppercase tracking-tighter">Compras (R$)</label>
            <TrendingDown size={12} className="text-red-400 opacity-60" />
          </div>
          <input 
            type="text" 
            value={pVal}
            onChange={(e) => handleInputChange(e, setPVal)}
            onBlur={handleBlur}
            placeholder="R$ 0,00"
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500/30 font-mono text-sm font-semibold transition-all"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <label className="text-[10px] font-bold opacity-40 uppercase tracking-tighter">Vendas (R$)</label>
            <TrendingUp size={12} className="text-emerald-400 opacity-60" />
          </div>
          <input 
            type="text" 
            value={sVal}
            onChange={(e) => handleInputChange(e, setSVal)}
            onBlur={handleBlur}
            placeholder="R$ 0,00"
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500/30 font-mono text-sm font-semibold transition-all"
          />
        </div>
      </div>
    </div>
  );
}

// Comentário de controle para sincronização com o GitHub - v1.1.4.1
