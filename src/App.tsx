/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart3, 
  Building2, 
  Calendar, 
  ChevronLeft,
  ChevronRight, 
  History, 
  LayoutDashboard, 
  Minus,
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
  RefreshCw,
  Upload,
  FileUp,
  Loader2,
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  Layers,
  DollarSign,
  Package,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  Percent,
  SlidersHorizontal,
  Sparkles,
  Database,
  RotateCcw,
  Zap,
  Target,
  MousePointerClick,
  Sliders,
  MoveHorizontal,
  Eye,
  EyeOff,
  Activity,
  Check
} from 'lucide-react';
import { XMLParser } from 'fast-xml-parser';
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
  Legend,
  ComposedChart,
  Brush,
  ReferenceLine
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  db, 
  auth, 
  testConnection, 
  handleFirestoreError, 
  OperationType,
  loginWithGoogle,
  logoutUser
} from './lib/firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/** Utility for Tailwind class merging */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Tipos & Modelos ---

export interface Company {
  id: string;
  name: string;
  cnpj: string;
  color: string;
}

export interface Entry {
  id: string;
  companyId: string;
  year: number;
  month: number;
  purchases: number;
  sales: number;
  notesCount: number;
  productsCount: number;
  status: 'CONCLUIDO' | 'AGUARDANDO' | 'EM ANDAMENTO';
  updatedAt?: string;
}

type Tab = 'dashboard' | 'entries' | 'status' | 'companies';
type ChartMode = 'composed' | 'bars' | 'stacked' | 'area' | 'margin';
type ChartPeriod = 'all' | 'sem1' | 'sem2' | 'q1' | 'q2' | 'q3' | 'q4';

export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const MONTH_INITIALS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const COMPANY_COLORS = ['#4f46e5', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0284c7'];

// Dados Oficiais Padrão (CONSTRUNOVA e CONSTRUFER)
const INITIAL_DEMO_COMPANIES: Company[] = [
  { id: 'c97b89f6-a9e0-4c0e-95d8-2a2afd9b51b1', name: 'CONSTRUNOVA', cnpj: '11.734.806/0001-20', color: '#3b82f6' },
  { id: 'fdaabfce-0a0c-4833-b4b2-f0c5db6ae065', name: 'CONSTRUFER', cnpj: '51.623.859/0001-98', color: '#10b981' }
];

const INITIAL_DEMO_ENTRIES: Entry[] = [];

// Utilitários de Formatação de Moeda
export function formatBRL(value: number, includeDecimals = true): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0
  }).format(value || 0);
}

export function formatCompactBRL(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(1).replace('.', ',')}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `R$ ${(value / 1_000).toFixed(0)}k`;
  }
  return formatBRL(value, false);
}

// --- Componente Raiz da Aplicação ---

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  const [sidebarPosition, setSidebarPosition] = useState<'right' | 'left'>('left');
  const [isSidebarTopExpanded, setIsSidebarTopExpanded] = useState<boolean>(true);
  const [isSidebarBottomExpanded, setIsSidebarBottomExpanded] = useState<boolean>(true);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'local' | 'syncing'>('syncing');

  // Controle de Tema no Documento
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      document.body.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      document.body.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Inicialização e Sincronização em Tempo Real com Firebase Firestore
  useEffect(() => {
    // Validação inicial de conexão com o Firestore conforme diretrizes do skill
    testConnection();

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    setLoading(true);
    setSyncStatus('syncing');

    // Listener em tempo real da coleção companies
    const companiesCollection = collection(db, 'companies');
    const unsubCompanies = onSnapshot(companiesCollection, (snapshot) => {
      if (!snapshot.empty) {
        const loaded: Company[] = snapshot.docs
          .filter(docSnap => !docSnap.id.startsWith('comp-'))
          .map(docSnap => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              name: data.name || 'Sem razão social',
              cnpj: data.cnpj || '',
              color: data.color || COMPANY_COLORS[0]
            };
          });
        
        // Se após filtrar dados demo houver empresas válidas, usa elas
        if (loaded.length > 0) {
          setCompanies(loaded);
          setSelectedCompanyId(prev => (prev === 'all' || (prev && loaded.some(c => c.id === prev))) ? prev : 'all');
        } else {
          // Caso só restem dados brutos do Firestore
          const allDocs = snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              name: data.name || 'Sem razão social',
              cnpj: data.cnpj || '',
              color: data.color || COMPANY_COLORS[0]
            };
          });
          setCompanies(allDocs);
          setSelectedCompanyId(prev => (prev === 'all' || (prev && allDocs.some(c => c.id === prev))) ? prev : 'all');
        }
      } else {
        setCompanies([]);
      }
      setSyncStatus('synced');
      setLoading(false);
      setLastUpdate(new Date());
    }, (error) => {
      console.warn('Erro ao carregar empresas do Firestore:', error);
      setSyncStatus('local');
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, 'companies');
    });

    // Listener em tempo real da coleção entries
    const entriesCollection = collection(db, 'entries');
    const unsubEntries = onSnapshot(entriesCollection, (snapshot) => {
      if (!snapshot.empty) {
        const loaded: Entry[] = snapshot.docs
          .filter(docSnap => !docSnap.id.startsWith('e-'))
          .map(docSnap => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              companyId: data.companyId,
              year: Number(data.year) || 2026,
              month: Number(data.month) || 0,
              purchases: Number(data.purchases) || 0,
              sales: Number(data.sales) || 0,
              notesCount: Number(data.notesCount) || 0,
              productsCount: Number(data.productsCount) || 0,
              status: data.status || 'AGUARDANDO',
              updatedAt: data.updatedAt || new Date().toISOString()
            };
          });
        setEntries(loaded);
      } else {
        setEntries([]);
      }
      setLastUpdate(new Date());
    }, (error) => {
      console.warn('Erro ao carregar lançamentos do Firestore:', error);
      handleFirestoreError(error, OperationType.GET, 'entries');
    });

    return () => {
      unsubAuth();
      unsubCompanies();
      unsubEntries();
    };
  }, []);

  const refreshData = async () => {
    setLoading(true);
    setSyncStatus('syncing');
    try {
      const compSnap = await getDocs(collection(db, 'companies'));
      const entSnap = await getDocs(collection(db, 'entries'));
      if (!compSnap.empty) {
        const loadedCompanies: Company[] = compSnap.docs.map(d => ({
          id: d.id,
          name: d.data().name || '',
          cnpj: d.data().cnpj || '',
          color: d.data().color || COMPANY_COLORS[0]
        }));
        setCompanies(loadedCompanies);
      }
      if (!entSnap.empty) {
        const loadedEntries: Entry[] = entSnap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            companyId: data.companyId,
            year: Number(data.year) || 2026,
            month: Number(data.month) || 0,
            purchases: Number(data.purchases) || 0,
            sales: Number(data.sales) || 0,
            notesCount: Number(data.notesCount) || 0,
            productsCount: Number(data.productsCount) || 0,
            status: data.status || 'AGUARDANDO',
            updatedAt: data.updatedAt
          };
        });
        setEntries(loadedEntries);
      }
      setSyncStatus('synced');
      setLastUpdate(new Date());
    } catch (err) {
      console.warn('Atualização pontual concluída com cache local:', err);
      handleFirestoreError(err, OperationType.GET, 'companies');
    } finally {
      setLoading(false);
    }
  };

  // Adicionar Empresa no Firebase Firestore
  const addCompany = async (name: string, cnpj: string) => {
    const color = COMPANY_COLORS[companies.length % COMPANY_COLORS.length];
    const newId = `comp-${Date.now()}`;
    const newCompany: Company = { id: newId, name, cnpj, color };

    setCompanies(prev => [...prev, newCompany]);
    setSelectedCompanyId(newCompany.id);
    setLastUpdate(new Date());

    try {
      await setDoc(doc(db, 'companies', newId), {
        id: newId,
        name,
        cnpj,
        color,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `companies/${newId}`);
    }
  };

  // Remover Empresa no Firebase Firestore
  const removeCompany = async (id: string) => {
    setCompanies(prev => prev.filter(c => c.id !== id));
    setEntries(prev => prev.filter(e => e.companyId !== id));
    if (selectedCompanyId === id) {
      const remaining = companies.filter(c => c.id !== id);
      setSelectedCompanyId(remaining.length > 0 ? remaining[0].id : '');
    }
    setLastUpdate(new Date());

    try {
      await deleteDoc(doc(db, 'companies', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `companies/${id}`);
    }
  };

  // Salvar ou Atualizar Lançamento no Firebase Firestore
  const saveEntry = async (
    companyId: string,
    year: number,
    month: number,
    purchases: number,
    sales: number,
    notesCount?: number,
    productsCount?: number,
    status?: Entry['status']
  ) => {
    const existing = entries.find(e => e.companyId === companyId && e.year === year && e.month === month);
    const entryId = existing ? existing.id : `e-${companyId}-${year}-${month}`;
    const entryData: Entry = {
      id: entryId,
      companyId,
      year,
      month,
      purchases: purchases ?? (existing?.purchases || 0),
      sales: sales ?? (existing?.sales || 0),
      notesCount: notesCount ?? (existing?.notesCount || 0),
      productsCount: productsCount ?? (existing?.productsCount || 0),
      status: status ?? (existing?.status || 'AGUARDANDO'),
      updatedAt: new Date().toISOString()
    };

    // Atualização Otimista Imediata
    setEntries(prev => {
      const idx = prev.findIndex(e => e.companyId === companyId && e.year === year && e.month === month);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = entryData;
        return next;
      }
      return [...prev, entryData];
    });
    setLastUpdate(new Date());

    try {
      await setDoc(doc(db, 'entries', entryId), {
        id: entryId,
        companyId,
        year,
        month,
        purchases: entryData.purchases,
        sales: entryData.sales,
        notesCount: entryData.notesCount,
        productsCount: entryData.productsCount,
        status: entryData.status,
        updatedAt: entryData.updatedAt
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `entries/${entryId}`);
    }
  };

  // Empresa Selecionada ou Consolidação Geral
  const selectedCompany = useMemo(() => {
    if (selectedCompanyId === 'all') {
      const names = companies.map(c => c.name).join(' & ');
      return {
        id: 'all',
        name: companies.length === 2 ? `Ambas as Empresas (${names})` : 'Consolidação Geral (Ambas as Empresas)',
        cnpj: 'Grupo Empresarial Consolidado',
        color: '#8b5cf6'
      };
    }
    return companies.find(c => c.id === selectedCompanyId) || null;
  }, [companies, selectedCompanyId]);

  // Estatísticas de Eficiência para a Barra Lateral
  const sidebarStats = useMemo(() => {
    if (!selectedCompanyId) return null;
    const companyYearEntries = selectedCompanyId === 'all'
      ? entries.filter(e => e.year === selectedYear)
      : entries.filter(e => e.companyId === selectedCompanyId && e.year === selectedYear);
    const filtered = selectedMonth === 'all'
      ? companyYearEntries
      : companyYearEntries.filter(e => e.month === selectedMonth);

    const totalPurchases = filtered.reduce((acc, curr) => acc + curr.purchases, 0);
    const totalSales = filtered.reduce((acc, curr) => acc + curr.sales, 0);
    const ratio = totalSales > 0 ? (totalPurchases / totalSales) * 100 : (totalPurchases > 0 ? 100 : 0);
    const margin = totalSales - totalPurchases;

    return {
      totalPurchases,
      totalSales,
      ratio,
      margin,
      isMonthly: selectedMonth !== 'all',
      isConsolidated: selectedCompanyId === 'all'
    };
  }, [entries, selectedCompanyId, selectedYear, selectedMonth]);

  return (
    <div className={cn("flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 transition-colors duration-200", theme === 'dark' && "dark")}>
      
      {/* ----------------- BARRA LATERAL (SIDEBAR ESQUERDA / ROXA) ----------------- */}
      <aside className={cn(
        "w-64 md:w-72 flex flex-col h-full shrink-0 z-40 select-none transition-all duration-200",
        "order-first border-r",
        "bg-[#281145] text-white border-purple-900/50 shadow-xl",
        "dark:bg-[#0e0719] dark:border-purple-950/70"
      )}>
        
        {/* Brand Zone */}
        <div className="p-4 border-b border-purple-800/40 dark:border-purple-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 via-indigo-500 to-fuchsia-500 text-white flex items-center justify-center font-black text-lg shadow-md shadow-purple-950/60 shrink-0">
              M
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-base tracking-tight leading-none text-white truncate">
                Monitor Financeiro
              </span>
              <span className="text-[11px] font-semibold text-purple-300 tracking-wider uppercase mt-1">
                Elite Enterprise
              </span>
            </div>
          </div>
        </div>

        {/* Barra de Ações Rápidas: Alternar Foco entre Parte de Cima (Menu) e Parte de Baixo (Métricas) */}
        <div className="px-3 py-1.5 flex items-center justify-between border-b border-purple-800/40 bg-purple-950/30 text-xs">
          <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">
            Painéis
          </span>
          <div className="flex items-center gap-1 bg-[#150629] p-0.5 rounded-lg border border-purple-800/50">
            <button
              type="button"
              onClick={() => { setIsSidebarTopExpanded(true); setIsSidebarBottomExpanded(false); }}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer",
                isSidebarTopExpanded && !isSidebarBottomExpanded 
                  ? "bg-purple-600 text-white shadow-xs" 
                  : "text-purple-300 hover:text-white hover:bg-purple-800/40"
              )}
              title="Expandir Menu de Cima e minimizar parte de baixo"
            >
              Foco Menu
            </button>
            <button
              type="button"
              onClick={() => { setIsSidebarTopExpanded(false); setIsSidebarBottomExpanded(true); }}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer",
                !isSidebarTopExpanded && isSidebarBottomExpanded 
                  ? "bg-purple-600 text-white shadow-xs" 
                  : "text-purple-300 hover:text-white hover:bg-purple-800/40"
              )}
              title="Expandir Métricas de Baixo e minimizar menu de cima"
            >
              Foco Métricas
            </button>
            <button
              type="button"
              onClick={() => { setIsSidebarTopExpanded(true); setIsSidebarBottomExpanded(true); }}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer",
                isSidebarTopExpanded && isSidebarBottomExpanded 
                  ? "bg-purple-600 text-white shadow-xs" 
                  : "text-purple-300 hover:text-white hover:bg-purple-800/40"
              )}
              title="Expandir ambas as partes simultaneamente"
            >
              Ambos
            </button>
          </div>
        </div>

        {/* ----------------- PARTE DE CIMA: MENU DE NAVEGAÇÃO ----------------- */}
        <div className="border-b border-purple-800/40 dark:border-purple-950/60">
          <div className="flex items-center justify-between px-3.5 py-1.5">
            <span className="text-[11px] font-extrabold text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
              <LayoutDashboard size={13} className="text-purple-300" />
              Menu Principal
            </span>
            <button
              type="button"
              onClick={() => {
                const next = !isSidebarTopExpanded;
                setIsSidebarTopExpanded(next);
                if (!next) setIsSidebarBottomExpanded(true);
              }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-900/60 hover:bg-purple-700/70 text-purple-200 hover:text-white border border-purple-700/50 transition-all cursor-pointer shadow-xs"
              title={isSidebarTopExpanded ? "Minimizar menu de cima (abrir parte de baixo)" : "Expandir menu de cima"}
            >
              {isSidebarTopExpanded ? (
                <>
                  <Minus size={12} />
                  <span>Minimizar</span>
                </>
              ) : (
                <>
                  <Plus size={12} className="text-emerald-300" />
                  <span className="text-emerald-200">Expandir (+)</span>
                </>
              )}
            </button>
          </div>

          {isSidebarTopExpanded ? (
            <div className="px-3 pb-2 space-y-1">
              <SidebarNavButton 
                icon={<LayoutDashboard size={18} />} 
                label="Painel Executivo" 
                active={activeTab === 'dashboard'} 
                onClick={() => setActiveTab('dashboard')} 
              />
              <SidebarNavButton 
                icon={<History size={18} />} 
                label="Lançamentos Mensais" 
                active={activeTab === 'entries'} 
                onClick={() => setActiveTab('entries')} 
              />
              <SidebarNavButton 
                icon={<FileText size={18} />} 
                label="Gestão de Itens & Status" 
                active={activeTab === 'status'} 
                onClick={() => setActiveTab('status')} 
              />
              <SidebarNavButton 
                icon={<Building2 size={18} />} 
                label="Empresas Cadastradas" 
                active={activeTab === 'companies'} 
                badge={companies.length.toString()}
                onClick={() => setActiveTab('companies')} 
              />
            </div>
          ) : (
            <div className="px-3 py-1.5 flex items-center justify-between bg-purple-950/40 rounded-lg mx-2.5 mb-2 border border-purple-800/40">
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setActiveTab('dashboard')} 
                  className={cn("p-1.5 rounded-md transition-colors cursor-pointer", activeTab === 'dashboard' ? "bg-purple-600 text-white shadow-xs" : "text-purple-300 hover:text-white hover:bg-purple-800/40")} 
                  title="Painel Executivo"
                >
                  <LayoutDashboard size={15} />
                </button>
                <button 
                  onClick={() => setActiveTab('entries')} 
                  className={cn("p-1.5 rounded-md transition-colors cursor-pointer", activeTab === 'entries' ? "bg-purple-600 text-white shadow-xs" : "text-purple-300 hover:text-white hover:bg-purple-800/40")} 
                  title="Lançamentos Mensais"
                >
                  <History size={15} />
                </button>
                <button 
                  onClick={() => setActiveTab('status')} 
                  className={cn("p-1.5 rounded-md transition-colors cursor-pointer", activeTab === 'status' ? "bg-purple-600 text-white shadow-xs" : "text-purple-300 hover:text-white hover:bg-purple-800/40")} 
                  title="Gestão de Itens & Status"
                >
                  <FileText size={15} />
                </button>
                <button 
                  onClick={() => setActiveTab('companies')} 
                  className={cn("p-1.5 rounded-md transition-colors cursor-pointer", activeTab === 'companies' ? "bg-purple-600 text-white shadow-xs" : "text-purple-300 hover:text-white hover:bg-purple-800/40")} 
                  title="Empresas Cadastradas"
                >
                  <Building2 size={15} />
                </button>
              </div>
              <button 
                onClick={() => setIsSidebarTopExpanded(true)}
                className="text-[10px] text-purple-200 hover:text-white flex items-center gap-1 font-bold bg-purple-800/60 hover:bg-purple-700/80 px-2 py-1 rounded-md transition-all cursor-pointer"
                title="Expandir Menu completo"
              >
                <Plus size={11} className="text-emerald-300" />
                <span>Mais</span>
              </button>
            </div>
          )}
        </div>

        {/* ----------------- PARTE DE BAIXO: FILTROS & MÉTRICAS ----------------- */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-purple-800/30">
            <span className="text-[11px] font-extrabold text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
              <SlidersHorizontal size={13} className="text-purple-300" />
              Filtros & Métricas
            </span>
            <button
              type="button"
              onClick={() => {
                const next = !isSidebarBottomExpanded;
                setIsSidebarBottomExpanded(next);
                if (!next) setIsSidebarTopExpanded(true);
              }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-900/60 hover:bg-purple-700/70 text-purple-200 hover:text-white border border-purple-700/50 transition-all cursor-pointer shadow-xs"
              title={isSidebarBottomExpanded ? "Minimizar parte de baixo (abrir menu de cima)" : "Expandir filtros e métricas (+)"}
            >
              {isSidebarBottomExpanded ? (
                <>
                  <Minus size={12} />
                  <span>Minimizar</span>
                </>
              ) : (
                <>
                  <Plus size={12} className="text-emerald-300" />
                  <span className="text-emerald-200">Expandir (+)</span>
                </>
              )}
            </button>
          </div>

          {isSidebarBottomExpanded ? (
            <div className="px-3.5 py-2.5 space-y-3 flex-1 overflow-y-auto sidebar-purple-scroll">
              
              {/* Seletor de Empresa com Opção de Consolidação */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-purple-200 uppercase tracking-wider block">
                    Empresa em Foco
                  </label>
                  {selectedCompanyId === 'all' && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/30 text-purple-200 border border-purple-400/40">
                      Consolidado
                    </span>
                  )}
                </div>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="w-full bg-[#1b0a33] dark:bg-[#120822] border border-purple-700/60 dark:border-purple-900/60 rounded-xl py-2 px-3 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all cursor-pointer"
                >
                  <option value="all" className="bg-[#1b0a33] dark:bg-[#120822] text-white font-bold">
                    🏢 Ambas as Empresas (Consolidação Geral)
                  </option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id} className="bg-[#1b0a33] dark:bg-[#120822] text-white">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Seletor de Período (Mês) */}
              <div>
                <label className="text-[11px] font-bold text-purple-200 uppercase tracking-wider block mb-1.5">
                  Filtro por Período
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                  className="w-full bg-[#1b0a33] dark:bg-[#120822] border border-purple-700/60 dark:border-purple-900/60 rounded-xl py-2 px-3 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all cursor-pointer"
                >
                  <option value="all" className="bg-[#1b0a33] dark:bg-[#120822] text-white font-bold">
                    Consolidado Anual ({selectedYear})
                  </option>
                  {MONTHS.map((m, idx) => (
                    <option key={idx} value={idx} className="bg-[#1b0a33] dark:bg-[#120822] text-white">
                      {m} / {selectedYear}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cartão de Eficiência / Meta Orçamentária */}
              {sidebarStats && (
                <div className="p-3.5 rounded-xl bg-[#1b0833]/95 dark:bg-[#120722]/95 border border-purple-800/50 dark:border-purple-900/40 space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-purple-200 uppercase tracking-wider">
                      Eficiência {sidebarStats.isMonthly ? 'do Mês' : 'do Ano'}
                    </span>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border",
                      sidebarStats.ratio <= 60 
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" 
                        : sidebarStats.ratio <= 75 
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40" 
                          : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    )}>
                      {sidebarStats.ratio <= 60 ? 'Saudável' : sidebarStats.ratio <= 75 ? 'Alerta' : 'Crítico'}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <div className="text-2xl font-black font-mono tabular-nums text-white">
                      {sidebarStats.ratio.toFixed(1)}%
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-purple-300 font-semibold uppercase tracking-wider block">Meta Máx.</span>
                      <span className="text-xs font-mono font-bold text-white">60.0%</span>
                    </div>
                  </div>

                  {/* Barra de Progresso com Marcador */}
                  <div className="space-y-1">
                    <div className="h-2 w-full bg-[#110420] dark:bg-[#090212] rounded-full overflow-hidden relative border border-purple-900/60">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          sidebarStats.ratio <= 60 
                            ? "bg-emerald-400" 
                            : sidebarStats.ratio <= 75 
                              ? "bg-amber-400" 
                              : "bg-rose-400"
                        )}
                        style={{ width: `${Math.min(sidebarStats.ratio, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-medium text-purple-300">
                      <span>0%</span>
                      <span className="font-bold text-purple-200">Meta: 60%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-purple-800/40 dark:border-purple-900/40 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-purple-300 block uppercase font-medium">Vendas</span>
                      <span className="font-mono font-bold text-emerald-300 truncate block">
                        {formatCompactBRL(sidebarStats.totalSales)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-purple-300 block uppercase font-medium">Compras</span>
                      <span className="font-mono font-bold text-purple-200 truncate block">
                        {formatCompactBRL(sidebarStats.totalPurchases)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="p-3 mx-2.5 my-2 rounded-xl bg-[#1b0833]/90 border border-purple-800/50 flex items-center justify-between shadow-xs">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5 text-xs text-white font-bold truncate">
                  <Building2 size={13} className="text-purple-300 shrink-0" />
                  <span className="truncate">{selectedCompany?.name || 'Consolidação Geral'}</span>
                </div>
                {sidebarStats && (
                  <span className="text-[10px] text-purple-200 font-mono font-bold block mt-0.5">
                    Eficiência: {sidebarStats.ratio.toFixed(1)}% ({sidebarStats.ratio <= 60 ? 'Saudável' : 'Alerta'})
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsSidebarBottomExpanded(true)}
                className="px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1 shrink-0 shadow-sm transition-all cursor-pointer"
                title="Abrir filtros e métricas completas"
              >
                <Plus size={13} className="text-emerald-300" />
                <span>Mais</span>
              </button>
            </div>
          )}

        </div>

        {/* Footer da Barra Lateral (Status de Sincronia e Tema) */}
        <div className="p-3 border-t border-purple-800/40 dark:border-purple-950/60 bg-[#1d0a35]/60 dark:bg-[#090313] space-y-2">
          
          <div className="flex items-center justify-between text-xs text-purple-300 px-1">
            <div className="flex items-center gap-1.5">
              <span className={cn(
                "w-2 h-2 rounded-full",
                syncStatus === 'synced' ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : syncStatus === 'syncing' ? "bg-amber-400 animate-ping" : "bg-purple-300"
              )} />
              <span className="font-medium text-[11px] text-purple-200">
                {syncStatus === 'synced' ? 'Firebase Conectado' : syncStatus === 'syncing' ? 'Sincronizando' : 'Modo Operacional'}
              </span>
            </div>
            {lastUpdate && (
              <span className="font-mono text-[10px] text-purple-300 tabular-nums">
                {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1 bg-[#140524] dark:bg-[#07010e] p-0.5 rounded-lg border border-purple-800/60 dark:border-purple-950">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={cn(
                  "p-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                  theme === 'light' 
                    ? "bg-purple-600 text-white shadow-xs font-bold" 
                    : "text-purple-300 hover:text-white"
                )}
                title="Modo Claro"
              >
                <Sun size={14} className={cn(theme === 'light' ? "text-amber-300" : "text-purple-300")} />
                <span>Claro</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={cn(
                  "p-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                  theme === 'dark' 
                    ? "bg-purple-600 text-white shadow-xs font-bold" 
                    : "text-purple-300 hover:text-white"
                )}
                title="Modo Escuro"
              >
                <Moon size={14} className={cn(theme === 'dark' ? "text-white" : "text-purple-300")} />
                <span>Escuro</span>
              </button>
            </div>

            <button
              onClick={refreshData}
              disabled={loading}
              className="p-2 rounded-lg text-purple-300 hover:text-white hover:bg-purple-800/40 transition-colors cursor-pointer"
              title="Atualizar dados agora"
            >
              <RefreshCw size={15} className={cn(loading && "animate-spin text-white")} />
            </button>
          </div>

        </div>

      </aside>

      {/* ----------------- ÁREA DE CONTEÚDO PRINCIPAL ----------------- */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden order-2">
        
        {/* Top Header Bar */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-[#0d1322]/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-30">
          
          {/* Breadcrumb Trail */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-500 dark:text-slate-400">Monitor Financeiro</span>
            <span className="text-slate-400 dark:text-slate-600">/</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {activeTab === 'dashboard' && 'Painel Executivo'}
              {activeTab === 'entries' && 'Lançamentos Mensais'}
              {activeTab === 'status' && 'Gestão de Itens & Status'}
              {activeTab === 'companies' && 'Empresas Cadastradas'}
            </span>
            {selectedCompany && (
              <>
                <span className="text-slate-400 dark:text-slate-600">/</span>
                <span className={cn(
                  "font-bold truncate max-w-[240px] px-2 py-0.5 rounded-md",
                  selectedCompanyId === 'all'
                    ? "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60"
                    : "text-indigo-600 dark:text-indigo-400"
                )}>
                  {selectedCompany.name}
                </span>
              </>
            )}
          </div>

          {/* Top Actions: Year Selector & Quick Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Seletor de Ano Rápido */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/60 text-xs font-semibold">
              {[2024, 2025, 2026, 2027].map(year => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={cn(
                    "px-2.5 py-1 rounded-md transition-all font-mono",
                    selectedYear === year
                      ? "bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  {year}
                </button>
              ))}
            </div>

            {/* Alternador de Tema Rápido no Header */}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer shadow-xs"
              title={theme === 'dark' ? "Alternar para Modo Claro" : "Alternar para Modo Escuro"}
            >
              {theme === 'dark' ? (
                <>
                  <Sun size={14} className="text-amber-400" />
                  <span className="hidden sm:inline">Claro</span>
                </>
              ) : (
                <>
                  <Moon size={14} className="text-indigo-600" />
                  <span className="hidden sm:inline">Escuro</span>
                </>
              )}
            </button>

            {/* Botão de Relatório PDF */}
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm shadow-indigo-600/30 whitespace-nowrap cursor-pointer"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Exportar PDF</span>
            </button>

            {/* Autenticação Google / Firebase */}
            {currentUser ? (
              <div className="flex items-center gap-2 pl-1 border-l border-slate-200 dark:border-slate-800">
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                  {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : (currentUser.email?.charAt(0).toUpperCase() || 'U')}
                </div>
                <button
                  onClick={logoutUser}
                  className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors hidden md:inline cursor-pointer"
                  title="Encerrar sessão"
                >
                  Sair
                </button>
              </div>
            ) : (
              <button
                onClick={loginWithGoogle}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all cursor-pointer"
                title="Conectar com conta Google"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="hidden md:inline">Google Auth</span>
              </button>
            )}

          </div>

        </header>

        {/* Dynamic Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loading && companies.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-sm font-medium text-slate-500">Carregando painel financeiro...</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && (
                <ModernDashboardView 
                  companies={companies} 
                  entries={entries} 
                  selectedYear={selectedYear}
                  selectedMonth={selectedMonth}
                  selectedCompanyId={selectedCompanyId}
                  setSelectedCompanyId={setSelectedCompanyId}
                  onOpenReport={() => setIsReportModalOpen(true)}
                  onNavigateTab={setActiveTab}
                />
              )}

              {activeTab === 'entries' && (
                <ModernEntriesView 
                  companies={companies} 
                  entries={entries} 
                  selectedYear={selectedYear}
                  selectedCompanyId={selectedCompanyId}
                  setSelectedCompanyId={setSelectedCompanyId}
                  onSave={saveEntry}
                  onRefresh={refreshData}
                />
              )}

              {activeTab === 'status' && (
                <ModernStatusView 
                  companies={companies} 
                  entries={entries} 
                  selectedYear={selectedYear}
                  onSave={saveEntry}
                />
              )}

              {activeTab === 'companies' && (
                <ModernCompaniesView 
                  companies={companies} 
                  entries={entries}
                  selectedYear={selectedYear}
                  onAdd={addCompany} 
                  onRemove={removeCompany} 
                  onSelectCompany={(id) => {
                    setSelectedCompanyId(id);
                    setActiveTab('dashboard');
                  }}
                  onToggleStatus={(companyId, month) => {
                    const entry = entries.find(e => e.companyId === companyId && e.month === month && e.year === selectedYear);
                    const current = entry?.status || 'AGUARDANDO';
                    const next: Entry['status'] = current === 'AGUARDANDO' ? 'EM ANDAMENTO' : current === 'EM ANDAMENTO' ? 'CONCLUIDO' : 'AGUARDANDO';
                    saveEntry(companyId, selectedYear, month, entry?.purchases || 0, entry?.sales || 0, entry?.notesCount || 0, 0, next);
                  }}
                />
              )}
            </AnimatePresence>
          )}
        </div>

      </main>

      {/* Modal de Relatório PDF */}
      <ReportModal 
        isOpen={isReportModalOpen} 
        onClose={() => setIsReportModalOpen(false)} 
        entries={entries}
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        selectedYear={selectedYear}
      />

    </div>
  );
}

// -------------------------------------------------------------
// COMPONENTE: PAINEL EXECUTIVO (DASHBOARD VIEW)
// -------------------------------------------------------------

function ModernDashboardView({ 
  companies, 
  entries, 
  selectedYear, 
  selectedMonth,
  selectedCompanyId, 
  setSelectedCompanyId,
  onOpenReport,
  onNavigateTab
}: { 
  companies: Company[], 
  entries: Entry[], 
  selectedYear: number,
  selectedMonth: number | 'all',
  selectedCompanyId: string, 
  setSelectedCompanyId: (id: string) => void,
  onOpenReport: () => void,
  onNavigateTab: (tab: Tab) => void
}) {
  // Estados de Interatividade e Animação do Gráfico
  const [chartMode, setChartMode] = useState<ChartMode>('composed');
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('all');
  const [isShaking, setIsShaking] = useState(false);
  const [animTrigger, setAnimTrigger] = useState(0);
  const [showBrush, setShowBrush] = useState(false);
  const [focusedMonthIndex, setFocusedMonthIndex] = useState<number | null>(null);
  const [showTargetSimulator, setShowTargetSimulator] = useState(false);
  const [targetGoal, setTargetGoal] = useState<number>(0);
  const [visibleSeries, setVisibleSeries] = useState({
    vendas: true,
    compras: true,
    margem: true,
  });

  const isConsolidated = selectedCompanyId === 'all';

  const filteredEntries = useMemo(() => {
    if (!selectedCompanyId) return [];
    if (selectedCompanyId === 'all') {
      return entries.filter(e => e.year === selectedYear);
    }
    return entries.filter(e => e.companyId === selectedCompanyId && e.year === selectedYear);
  }, [entries, selectedCompanyId, selectedYear]);

  // YoY entries (Ano Anterior)
  const prevYearEntries = useMemo(() => {
    if (!selectedCompanyId) return [];
    if (selectedCompanyId === 'all') {
      return entries.filter(e => e.year === selectedYear - 1);
    }
    return entries.filter(e => e.companyId === selectedCompanyId && e.year === selectedYear - 1);
  }, [entries, selectedCompanyId, selectedYear]);

  // Dados para gráficos mensais (12 meses com Consolidação das Empresas)
  const monthlyData = useMemo(() => {
    return MONTHS.map((name, index) => {
      const monthEntries = filteredEntries.filter(e => e.month === index);
      const prevMonthEntries = prevYearEntries.filter(e => e.month === index);

      const compras = monthEntries.reduce((acc, curr) => acc + curr.purchases, 0);
      const vendas = monthEntries.reduce((acc, curr) => acc + curr.sales, 0);
      const margem = vendas - compras;
      const margemPct = vendas > 0 ? (margem / vendas) * 100 : 0;
      const proporcao = vendas > 0 ? (compras / vendas) * 100 : (compras > 0 ? 100 : 0);

      const notas = monthEntries.reduce((acc, curr) => acc + curr.notesCount, 0);
      const produtos = monthEntries.reduce((acc, curr) => acc + curr.productsCount, 0);

      const allConcluded = monthEntries.length > 0 && monthEntries.every(e => e.status === 'CONCLUIDO');
      const anyInProgress = monthEntries.some(e => e.status === 'EM ANDAMENTO');
      const status: Entry['status'] = allConcluded ? 'CONCLUIDO' : (anyInProgress ? 'EM ANDAMENTO' : 'AGUARDANDO');

      const prevCompras = prevMonthEntries.reduce((acc, curr) => acc + curr.purchases, 0);
      const prevVendas = prevMonthEntries.reduce((acc, curr) => acc + curr.sales, 0);
      const prevTotal = prevVendas - prevCompras;

      // Detalhamento individual de cada empresa para este mês
      const companyBreakdown = companies.map(c => {
        const ent = monthEntries.find(e => e.companyId === c.id);
        return {
          companyId: c.id,
          name: c.name,
          color: c.color,
          purchases: ent?.purchases || 0,
          sales: ent?.sales || 0,
          margin: (ent?.sales || 0) - (ent?.purchases || 0)
        };
      });

      return {
        monthIndex: index,
        name: MONTH_INITIALS[index],
        fullName: name,
        compras,
        vendas,
        margem,
        margemPct,
        proporcao,
        notas,
        produtos,
        status,
        prevTotal,
        companyBreakdown
      };
    });
  }, [filteredEntries, prevYearEntries, companies]);

  // Efeito elástico para fazer o gráfico se mover e vibrar
  const triggerWaveEffect = () => {
    setIsShaking(true);
    setAnimTrigger(prev => prev + 1);
    setTimeout(() => {
      setIsShaking(false);
    }, 850);
  };

  // Re-executar animações das barras
  const triggerReanimate = () => {
    setAnimTrigger(prev => prev + 1);
  };

  // Cálculo da maior venda para configurar o slider de simulação de meta
  const maxSales = useMemo(() => {
    return Math.max(...monthlyData.map(m => m.vendas), 10000);
  }, [monthlyData]);

  // Inicializa meta em 75% da maior venda
  useEffect(() => {
    if (targetGoal === 0 && maxSales > 10000) {
      setTargetGoal(Math.round((maxSales * 0.75) / 1000) * 1000);
    }
  }, [maxSales]);

  // Dados filtrados de acordo com o período selecionado para o gráfico
  const chartDisplayData = useMemo(() => {
    if (chartPeriod === 'sem1') return monthlyData.slice(0, 6);
    if (chartPeriod === 'sem2') return monthlyData.slice(6, 12);
    if (chartPeriod === 'q1') return monthlyData.slice(0, 3);
    if (chartPeriod === 'q2') return monthlyData.slice(3, 6);
    if (chartPeriod === 'q3') return monthlyData.slice(6, 9);
    if (chartPeriod === 'q4') return monthlyData.slice(9, 12);
    return monthlyData;
  }, [monthlyData, chartPeriod]);

  // Contagem de meses que atingiram a meta projetada
  const monthsAchievedTarget = useMemo(() => {
    if (!targetGoal || targetGoal <= 0) return 0;
    return chartDisplayData.filter(m => m.vendas >= targetGoal).length;
  }, [chartDisplayData, targetGoal]);

  // Dados do mês focado para o card animado de Raio-X
  const focusedMonthData = useMemo(() => {
    if (focusedMonthIndex === null) return null;
    return monthlyData.find(m => m.monthIndex === focusedMonthIndex) || null;
  }, [monthlyData, focusedMonthIndex]);

  // Métricas Consolidadas do Período Selecionado
  const activeMetrics = useMemo(() => {
    const list = selectedMonth === 'all' 
      ? monthlyData 
      : monthlyData.filter(d => d.monthIndex === selectedMonth);

    const totalVendas = list.reduce((acc, curr) => acc + curr.vendas, 0);
    const totalCompras = list.reduce((acc, curr) => acc + curr.compras, 0);
    const totalMargem = totalVendas - totalCompras;
    const margemMediaPct = totalVendas > 0 ? (totalMargem / totalVendas) * 100 : 0;
    const proporcaoGeral = totalVendas > 0 ? (totalCompras / totalVendas) * 100 : 0;
    const totalNotas = list.reduce((acc, curr) => acc + curr.notas, 0);
    const totalProdutos = list.reduce((acc, curr) => acc + curr.produtos, 0);

    // Comparativo YoY (Ano Anterior)
    const prevList = selectedMonth === 'all'
      ? prevYearEntries
      : prevYearEntries.filter(e => e.month === selectedMonth);

    const prevVendas = prevList.reduce((acc, curr) => acc + curr.sales, 0);
    const salesGrowth = prevVendas > 0 ? ((totalVendas - prevVendas) / prevVendas) * 100 : null;

    // Melhor Mês em Vendas
    const bestMonth = [...monthlyData].sort((a, b) => b.vendas - a.vendas)[0];

    return {
      totalVendas,
      totalCompras,
      totalMargem,
      margemMediaPct,
      proporcaoGeral,
      totalNotas,
      totalProdutos,
      salesGrowth,
      bestMonth
    };
  }, [monthlyData, selectedMonth, prevYearEntries]);

  if (companies.length === 0) {
    return (
      <div className="p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1322] space-y-4">
        <Building2 className="w-12 h-12 text-slate-400 mx-auto" />
        <h3 className="text-lg font-bold">Nenhuma Empresa Cadastrada</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Cadastre sua primeira empresa para começar a visualizar os indicadores financeiros e gráficos de performance.
        </p>
        <button
          onClick={() => onNavigateTab('companies')}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-600/20 hover:bg-indigo-500"
        >
          Cadastrar Empresa Agora
        </button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      
      {/* BANNER DE CONSOLIDAÇÃO ATIVA QUANDO AMBAS AS EMPRESAS ESTÃO SELECIONADAS */}
      {isConsolidated && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50/50 to-purple-50 dark:from-purple-950/40 dark:via-indigo-950/20 dark:to-purple-950/40 border border-purple-200 dark:border-purple-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shrink-0 shadow-md shadow-purple-600/30">
              <Layers size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xs text-purple-900 dark:text-purple-200">
                  Consolidação Geral de Ambas as Empresas
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-300">
                  {companies.map(c => c.name).join(' + ')}
                </span>
              </div>
              <p className="text-[11px] text-purple-700 dark:text-purple-300">
                Visualizando resultados somados de faturamento, custos e lucratividade do grupo corporativo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {companies.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCompanyId(c.id)}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800/80 text-purple-800 dark:text-purple-200 text-xs font-bold hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-all cursor-pointer shadow-2xs"
              >
                Ver {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4 CARDS DE INDICADORES EXECUTIVOS (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Faturamento Bruto (Vendas) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0d1322] border border-slate-200/90 dark:border-slate-800/80 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total em Vendas
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          
          <div className="mt-3">
            <div className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
              {formatBRL(activeMetrics.totalVendas)}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              {activeMetrics.salesGrowth !== null ? (
                <span className={cn(
                  "flex items-center gap-0.5 font-bold font-mono",
                  activeMetrics.salesGrowth >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                )}>
                  {activeMetrics.salesGrowth >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {activeMetrics.salesGrowth.toFixed(1)}% YoY
                </span>
              ) : (
                <span>Base do ano</span>
              )}
              <span>·</span>
              <span>{selectedMonth === 'all' ? '12 meses' : MONTHS[selectedMonth]}</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Compras Operacionais */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0d1322] border border-slate-200/90 dark:border-slate-800/80 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total em Compras
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Package size={16} />
            </div>
          </div>
          
          <div className="mt-3">
            <div className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
              {formatBRL(activeMetrics.totalCompras)}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                {activeMetrics.proporcaoGeral.toFixed(1)}%
              </span>
              <span>das vendas totais</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Resultado Operacional Líquido */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0d1322] border border-slate-200/90 dark:border-slate-800/80 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Resultado Líquido
            </span>
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              activeMetrics.totalMargem >= 0 
                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400" 
                : "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400"
            )}>
              <DollarSign size={16} />
            </div>
          </div>
          
          <div className="mt-3">
            <div className={cn(
              "text-2xl font-black font-mono tabular-nums",
              activeMetrics.totalMargem >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            )}>
              {formatBRL(activeMetrics.totalMargem)}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Margem: {activeMetrics.margemMediaPct.toFixed(1)}%
              </span>
              <span>·</span>
              <span>{activeMetrics.totalMargem >= 0 ? 'Superávit' : 'Déficit'}</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Volume Operacional (Notas e Itens) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0d1322] border border-slate-200/90 dark:border-slate-800/80 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Volume Físico
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Layers size={16} />
            </div>
          </div>
          
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                {activeMetrics.totalProdutos.toLocaleString('pt-BR')}
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">itens</span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                {activeMetrics.totalNotas} notas fiscais
              </span>
              <span>processadas</span>
            </div>
          </div>
        </div>

      </div>

      {/* ÁREA CENTRAL DE GRÁFICOS INTERATIVOS */}
      <div className="rounded-2xl bg-white dark:bg-[#0d1322] border border-slate-200/90 dark:border-slate-800/80 shadow-sm p-6 space-y-5">
        
        {/* Cabeçalho do Gráfico com Título e Botões de Animação/Movimento */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Performance Financeira Interativa ({selectedYear})
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center gap-1">
                <Sparkles size={11} /> Gráfico Dinâmico
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Clique nas barras, alterne modos, arraste o cursor ou use os botões para fazer o gráfico se mover e reagir!
            </p>
          </div>

          {/* Botões de Ação Dinâmica: Mexer Gráfico, Reanimar, Arrastar, Meta */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Botão Mexer / Balançar Gráfico com Efeito Onda */}
            <button
              type="button"
              onClick={triggerWaveEffect}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer",
                isShaking 
                  ? "bg-amber-500 text-white scale-105 shadow-amber-500/30" 
                  : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:hover:bg-indigo-900/80 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60"
              )}
              title="Faz o gráfico se mover e vibrar com efeito de onda física elástica!"
            >
              <Zap size={14} className={isShaking ? "animate-bounce text-white" : "text-amber-500 fill-amber-500"} />
              <span>{isShaking ? "Mexendo..." : "🌊 Mexer Gráfico"}</span>
            </button>

            {/* Botão Reanimar Barras */}
            <button
              type="button"
              onClick={triggerReanimate}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
              title="Dispara a animação de subida das barras novamente"
            >
              <RotateCcw size={13} />
              <span>⚡ Reanimar</span>
            </button>

            {/* Alternar Barra Deslizante de Arrastar (Brush) */}
            <button
              type="button"
              onClick={() => setShowBrush(!showBrush)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer",
                showBrush 
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
              )}
              title="Ativa a barra deslizante no rodapé para arrastar e dar zoom nos meses com o mouse"
            >
              <MoveHorizontal size={13} />
              <span>{showBrush ? "Ocultar Arraste" : "↔️ Arrastar Meses"}</span>
            </button>

            {/* Alternar Simulador de Meta */}
            <button
              type="button"
              onClick={() => setShowTargetSimulator(!showTargetSimulator)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer",
                showTargetSimulator 
                  ? "bg-amber-600 text-white border-amber-600 shadow-sm" 
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
              )}
              title="Abre o controle deslizante para mover uma linha de meta pelo gráfico"
            >
              <Target size={13} />
              <span>{showTargetSimulator ? "Fechar Meta" : "🎯 Mover Meta"}</span>
            </button>
          </div>
        </div>

        {/* Barra Secundária: Modos de Gráfico + Filtro de Período */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          
          {/* Seletor de Modo de Gráfico */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1 hidden sm:inline">Modo:</span>
            <div className="flex bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/60 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setChartMode('composed')}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all cursor-pointer",
                  chartMode === 'composed' 
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm font-bold" 
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                Misto (Barras + Linha)
              </button>
              <button
                type="button"
                onClick={() => setChartMode('bars')}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all cursor-pointer",
                  chartMode === 'bars' 
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm font-bold" 
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                Barras Comparativas
              </button>
              <button
                type="button"
                onClick={() => setChartMode('stacked')}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all cursor-pointer",
                  chartMode === 'stacked' 
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm font-bold" 
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                Empilhado
              </button>
              <button
                type="button"
                onClick={() => setChartMode('area')}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all cursor-pointer",
                  chartMode === 'area' 
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm font-bold" 
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                Área Fluida
              </button>
              <button
                type="button"
                onClick={() => setChartMode('margin')}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all cursor-pointer",
                  chartMode === 'margin' 
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm font-bold" 
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                Rentabilidade
              </button>
            </div>
          </div>

          {/* Filtro de Período (12M, 1º Semestre, 2º Semestre, Trimestres) */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700/60 text-[11px] font-semibold">
            {[
              { id: 'all', label: '12 Meses' },
              { id: 'sem1', label: '1º Sem' },
              { id: 'sem2', label: '2º Sem' },
              { id: 'q1', label: 'Q1' },
              { id: 'q2', label: 'Q2' },
              { id: 'q3', label: 'Q3' },
              { id: 'q4', label: 'Q4' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setChartPeriod(p.id as ChartPeriod);
                  setAnimTrigger(prev => prev + 1);
                }}
                className={cn(
                  "px-2 py-1 rounded transition-all cursor-pointer",
                  chartPeriod === p.id 
                    ? "bg-indigo-600 text-white shadow-xs font-bold" 
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

        </div>

        {/* Painel do Simulador de Meta Interativa (se ativado) */}
        <AnimatePresence>
          {showTargetSimulator && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="font-bold text-slate-900 dark:text-white">
                    Mover Linha de Meta no Gráfico:
                  </span>
                  <span className="font-mono font-black text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded">
                    {formatBRL(targetGoal)}
                  </span>
                </div>
                <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  Desempenho: <strong className="text-amber-600 dark:text-amber-400 font-bold">{monthsAchievedTarget} de {chartDisplayData.length} meses</strong> superaram esta meta!
                </div>
              </div>

              {/* Slider de Alcance da Meta */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-slate-500">R$ 0</span>
                <input
                  type="range"
                  min="0"
                  max={Math.max(maxSales * 1.25, 50000)}
                  step="5000"
                  value={targetGoal}
                  onChange={(e) => setTargetGoal(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                />
                <span className="text-[10px] font-mono text-slate-500">
                  {formatCompactBRL(Math.max(maxSales * 1.25, 50000))}
                </span>
              </div>

              {/* Presets Rápidos de Meta */}
              <div className="flex items-center gap-2 pt-1 text-[10px] flex-wrap">
                <span className="text-slate-500 font-semibold">Atalhos de Meta:</span>
                <button
                  type="button"
                  onClick={() => setTargetGoal(Math.round((maxSales * 0.5) / 1000) * 1000)}
                  className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-500 cursor-pointer"
                >
                  50% da Máxima ({formatCompactBRL(maxSales * 0.5)})
                </button>
                <button
                  type="button"
                  onClick={() => setTargetGoal(Math.round((maxSales * 0.75) / 1000) * 1000)}
                  className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-500 cursor-pointer"
                >
                  75% da Máxima ({formatCompactBRL(maxSales * 0.75)})
                </button>
                <button
                  type="button"
                  onClick={() => setTargetGoal(Math.round(maxSales / 1000) * 1000)}
                  className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-500 font-bold cursor-pointer"
                >
                  Meta 100% Pico ({formatCompactBRL(maxSales)})
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Viewport do Gráfico com Animação Elástica Motion */}
        <motion.div 
          key={animTrigger}
          animate={isShaking ? {
            rotate: [0, -1.2, 1.2, -0.8, 0.8, -0.4, 0.4, 0],
            scale: [1, 1.022, 0.985, 1.012, 0.995, 1],
            y: [0, -8, 6, -4, 3, 0],
            x: [0, -4, 4, -3, 3, 0]
          } : {
            rotate: 0,
            scale: 1,
            y: 0,
            x: 0
          }}
          transition={{ duration: 0.85, ease: "easeInOut" }}
          className="h-[340px] w-full relative transition-all"
        >
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === 'composed' ? (
              <ComposedChart 
                data={chartDisplayData} 
                margin={{ top: 15, right: 15, left: -10, bottom: showBrush ? 12 : 0 }}
                onClick={(e: any) => {
                  if (e && e.activeTooltipIndex !== undefined && chartDisplayData[e.activeTooltipIndex]) {
                    setFocusedMonthIndex(chartDisplayData[e.activeTooltipIndex].monthIndex);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} 
                  tickFormatter={(val) => formatCompactBRL(val)}
                />
                <Tooltip content={<CustomChartTooltip targetGoal={showTargetSimulator ? targetGoal : undefined} />} />
                {showTargetSimulator && targetGoal > 0 && (
                  <ReferenceLine 
                    y={targetGoal} 
                    stroke="#f59e0b" 
                    strokeDasharray="4 4" 
                    strokeWidth={2}
                    label={{ value: `Meta: ${formatCompactBRL(targetGoal)}`, fill: '#f59e0b', fontSize: 11, position: 'insideTopRight' }}
                  />
                )}
                {visibleSeries.compras && (
                  <Bar_Recharts 
                    dataKey="compras" 
                    name="Compras" 
                    fill="#6366f1" 
                    radius={[4, 4, 0, 0]} 
                    maxBarSize={32}
                    animationDuration={850}
                    className="cursor-pointer"
                  >
                    {chartDisplayData.map((entry) => (
                      <Cell 
                        key={`cell-c-${entry.monthIndex}`} 
                        fill={focusedMonthIndex === null || focusedMonthIndex === entry.monthIndex ? '#6366f1' : '#6366f140'} 
                      />
                    ))}
                  </Bar_Recharts>
                )}
                {visibleSeries.vendas && (
                  <Bar_Recharts 
                    dataKey="vendas" 
                    name="Vendas" 
                    fill="#10b981" 
                    radius={[4, 4, 0, 0]} 
                    maxBarSize={32}
                    animationDuration={950}
                    className="cursor-pointer"
                  >
                    {chartDisplayData.map((entry) => (
                      <Cell 
                        key={`cell-v-${entry.monthIndex}`} 
                        fill={focusedMonthIndex === null || focusedMonthIndex === entry.monthIndex ? '#10b981' : '#10b98140'} 
                      />
                    ))}
                  </Bar_Recharts>
                )}
                {visibleSeries.margem && (
                  <Line 
                    type="monotone" 
                    dataKey="margem" 
                    name="Resultado Líquido" 
                    stroke="#3b82f6" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} 
                    activeDot={{ r: 7 }} 
                    animationDuration={1100}
                  />
                )}
                {showBrush && (
                  <Brush 
                    dataKey="name" 
                    height={26} 
                    stroke="#6366f1" 
                    fill="rgba(99, 102, 241, 0.08)"
                    startIndex={0} 
                    endIndex={chartDisplayData.length - 1}
                  />
                )}
              </ComposedChart>
            ) : chartMode === 'bars' ? (
              <BarChart3_Recharts 
                data={chartDisplayData} 
                margin={{ top: 15, right: 15, left: -10, bottom: showBrush ? 12 : 0 }}
                onClick={(e: any) => {
                  if (e && e.activeTooltipIndex !== undefined && chartDisplayData[e.activeTooltipIndex]) {
                    setFocusedMonthIndex(chartDisplayData[e.activeTooltipIndex].monthIndex);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} 
                  tickFormatter={(val) => formatCompactBRL(val)}
                />
                <Tooltip content={<CustomChartTooltip targetGoal={showTargetSimulator ? targetGoal : undefined} />} />
                {showTargetSimulator && targetGoal > 0 && (
                  <ReferenceLine 
                    y={targetGoal} 
                    stroke="#f59e0b" 
                    strokeDasharray="4 4" 
                    strokeWidth={2}
                    label={{ value: `Meta: ${formatCompactBRL(targetGoal)}`, fill: '#f59e0b', fontSize: 11, position: 'insideTopRight' }}
                  />
                )}
                {visibleSeries.compras && (
                  <Bar_Recharts 
                    dataKey="compras" 
                    name="Compras" 
                    fill="#6366f1" 
                    radius={[4, 4, 0, 0]} 
                    maxBarSize={32}
                    animationDuration={850}
                    className="cursor-pointer"
                  >
                    {chartDisplayData.map((entry) => (
                      <Cell 
                        key={`cell-c-${entry.monthIndex}`} 
                        fill={focusedMonthIndex === null || focusedMonthIndex === entry.monthIndex ? '#6366f1' : '#6366f140'} 
                      />
                    ))}
                  </Bar_Recharts>
                )}
                {visibleSeries.vendas && (
                  <Bar_Recharts 
                    dataKey="vendas" 
                    name="Vendas" 
                    fill="#10b981" 
                    radius={[4, 4, 0, 0]} 
                    maxBarSize={32}
                    animationDuration={950}
                    className="cursor-pointer"
                  >
                    {chartDisplayData.map((entry) => (
                      <Cell 
                        key={`cell-v-${entry.monthIndex}`} 
                        fill={focusedMonthIndex === null || focusedMonthIndex === entry.monthIndex ? '#10b981' : '#10b98140'} 
                      />
                    ))}
                  </Bar_Recharts>
                )}
                {showBrush && (
                  <Brush 
                    dataKey="name" 
                    height={26} 
                    stroke="#6366f1" 
                    fill="rgba(99, 102, 241, 0.08)"
                    startIndex={0} 
                    endIndex={chartDisplayData.length - 1}
                  />
                )}
              </BarChart3_Recharts>
            ) : chartMode === 'stacked' ? (
              <BarChart3_Recharts 
                data={chartDisplayData} 
                margin={{ top: 15, right: 15, left: -10, bottom: showBrush ? 12 : 0 }}
                onClick={(e: any) => {
                  if (e && e.activeTooltipIndex !== undefined && chartDisplayData[e.activeTooltipIndex]) {
                    setFocusedMonthIndex(chartDisplayData[e.activeTooltipIndex].monthIndex);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} 
                  tickFormatter={(val) => formatCompactBRL(val)}
                />
                <Tooltip content={<CustomChartTooltip targetGoal={showTargetSimulator ? targetGoal : undefined} />} />
                {showTargetSimulator && targetGoal > 0 && (
                  <ReferenceLine 
                    y={targetGoal} 
                    stroke="#f59e0b" 
                    strokeDasharray="4 4" 
                    strokeWidth={2}
                    label={{ value: `Meta: ${formatCompactBRL(targetGoal)}`, fill: '#f59e0b', fontSize: 11, position: 'insideTopRight' }}
                  />
                )}
                {visibleSeries.compras && (
                  <Bar_Recharts 
                    dataKey="compras" 
                    name="Compras" 
                    stackId="a" 
                    fill="#6366f1" 
                    radius={[0, 0, 0, 0]} 
                    maxBarSize={36} 
                    animationDuration={850}
                    className="cursor-pointer"
                  />
                )}
                {visibleSeries.vendas && (
                  <Bar_Recharts 
                    dataKey="vendas" 
                    name="Vendas" 
                    stackId="a" 
                    fill="#10b981" 
                    radius={[4, 4, 0, 0]} 
                    maxBarSize={36} 
                    animationDuration={950}
                    className="cursor-pointer"
                  />
                )}
                {showBrush && (
                  <Brush 
                    dataKey="name" 
                    height={26} 
                    stroke="#6366f1" 
                    fill="rgba(99, 102, 241, 0.08)"
                    startIndex={0} 
                    endIndex={chartDisplayData.length - 1}
                  />
                )}
              </BarChart3_Recharts>
            ) : chartMode === 'area' ? (
              <AreaChart 
                data={chartDisplayData} 
                margin={{ top: 15, right: 15, left: -10, bottom: showBrush ? 12 : 0 }}
                onClick={(e: any) => {
                  if (e && e.activeTooltipIndex !== undefined && chartDisplayData[e.activeTooltipIndex]) {
                    setFocusedMonthIndex(chartDisplayData[e.activeTooltipIndex].monthIndex);
                  }
                }}
              >
                <defs>
                  <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.38}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorCompras" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.38}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} tickFormatter={(val) => formatCompactBRL(val)} />
                <Tooltip content={<CustomChartTooltip targetGoal={showTargetSimulator ? targetGoal : undefined} />} />
                {showTargetSimulator && targetGoal > 0 && (
                  <ReferenceLine 
                    y={targetGoal} 
                    stroke="#f59e0b" 
                    strokeDasharray="4 4" 
                    strokeWidth={2}
                    label={{ value: `Meta: ${formatCompactBRL(targetGoal)}`, fill: '#f59e0b', fontSize: 11, position: 'insideTopRight' }}
                  />
                )}
                {visibleSeries.vendas && (
                  <Area 
                    type="monotone" 
                    dataKey="vendas" 
                    name="Vendas" 
                    stroke="#10b981" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#colorVendas)" 
                    animationDuration={1000}
                  />
                )}
                {visibleSeries.compras && (
                  <Area 
                    type="monotone" 
                    dataKey="compras" 
                    name="Compras" 
                    stroke="#6366f1" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#colorCompras)" 
                    animationDuration={1000}
                  />
                )}
                {showBrush && (
                  <Brush 
                    dataKey="name" 
                    height={26} 
                    stroke="#6366f1" 
                    fill="rgba(99, 102, 241, 0.08)"
                    startIndex={0} 
                    endIndex={chartDisplayData.length - 1}
                  />
                )}
              </AreaChart>
            ) : (
              <LineChart 
                data={chartDisplayData} 
                margin={{ top: 15, right: 15, left: -10, bottom: showBrush ? 12 : 0 }}
                onClick={(e: any) => {
                  if (e && e.activeTooltipIndex !== undefined && chartDisplayData[e.activeTooltipIndex]) {
                    setFocusedMonthIndex(chartDisplayData[e.activeTooltipIndex].monthIndex);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} tickFormatter={(val) => formatCompactBRL(val)} />
                <Tooltip content={<CustomChartTooltip targetGoal={showTargetSimulator ? targetGoal : undefined} />} />
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="2 2" />
                {showTargetSimulator && targetGoal > 0 && (
                  <ReferenceLine 
                    y={targetGoal} 
                    stroke="#f59e0b" 
                    strokeDasharray="4 4" 
                    strokeWidth={2}
                    label={{ value: `Meta: ${formatCompactBRL(targetGoal)}`, fill: '#f59e0b', fontSize: 11, position: 'insideTopRight' }}
                  />
                )}
                <Line 
                  type="monotone" 
                  dataKey="margem" 
                  name="Resultado Líquido" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} 
                  activeDot={{ r: 7 }} 
                  animationDuration={950}
                />
                {showBrush && (
                  <Brush 
                    dataKey="name" 
                    height={26} 
                    stroke="#6366f1" 
                    fill="rgba(99, 102, 241, 0.08)"
                    startIndex={0} 
                    endIndex={chartDisplayData.length - 1}
                  />
                )}
              </LineChart>
            )}
          </ResponsiveContainer>
        </motion.div>

        {/* Barra de Séries Clicáveis (Ligar/Desligar com 1 toque) */}
        <div className="flex flex-wrap items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/60 text-xs gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500">Séries:</span>
            
            {/* Toggle Vendas */}
            <button
              type="button"
              onClick={() => setVisibleSeries(prev => ({ ...prev, vendas: !prev.vendas }))}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all border cursor-pointer",
                visibleSeries.vendas
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300/60 dark:border-emerald-800/60 shadow-xs"
                  : "bg-slate-50 text-slate-400 dark:bg-slate-800/40 dark:text-slate-500 border-slate-200 dark:border-slate-700 line-through opacity-70"
              )}
            >
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              <span>Vendas (Receitas)</span>
              {visibleSeries.vendas ? <Check size={12} /> : <EyeOff size={12} />}
            </button>

            {/* Toggle Compras */}
            <button
              type="button"
              onClick={() => setVisibleSeries(prev => ({ ...prev, compras: !prev.compras }))}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all border cursor-pointer",
                visibleSeries.compras
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300/60 dark:border-indigo-800/60 shadow-xs"
                  : "bg-slate-50 text-slate-400 dark:bg-slate-800/40 dark:text-slate-500 border-slate-200 dark:border-slate-700 line-through opacity-70"
              )}
            >
              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
              <span>Compras (Custos)</span>
              {visibleSeries.compras ? <Check size={12} /> : <EyeOff size={12} />}
            </button>

            {/* Toggle Margem */}
            <button
              type="button"
              onClick={() => setVisibleSeries(prev => ({ ...prev, margem: !prev.margem }))}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all border cursor-pointer",
                visibleSeries.margem
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300/60 dark:border-blue-800/60 shadow-xs"
                  : "bg-slate-50 text-slate-400 dark:bg-slate-800/40 dark:text-slate-500 border-slate-200 dark:border-slate-700 line-through opacity-70"
              )}
            >
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
              <span>Margem Operacional</span>
              {visibleSeries.margem ? <Check size={12} /> : <EyeOff size={12} />}
            </button>
          </div>

          <div className="text-slate-600 dark:text-slate-300 font-mono text-[11px]">
            Destaque: <strong className="text-slate-900 dark:text-white">{activeMetrics.bestMonth?.fullName}</strong> ({formatCompactBRL(activeMetrics.bestMonth?.vendas || 0)})
          </div>
        </div>

        {/* RÉGUA INTERATIVA DE MESES (Clique para navegar e focar o gráfico) */}
        <div className="pt-2 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
            <span className="flex items-center gap-1">
              <MousePointerClick size={13} className="text-indigo-500" />
              Régua de Meses Interativa (Clique para destacar a barra):
            </span>
            {focusedMonthIndex !== null && (
              <button
                type="button"
                onClick={() => setFocusedMonthIndex(null)}
                className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
              >
                ✕ Limpar foco ({MONTHS[focusedMonthIndex]})
              </button>
            )}
          </div>

          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
            {chartDisplayData.map((m) => {
              const isFocused = focusedMonthIndex === m.monthIndex;
              return (
                <button
                  key={m.monthIndex}
                  type="button"
                  onClick={() => {
                    setFocusedMonthIndex(isFocused ? null : m.monthIndex);
                    if (!isFocused) {
                      setIsShaking(true);
                      setTimeout(() => setIsShaking(false), 350);
                    }
                  }}
                  className={cn(
                    "flex flex-col items-center py-2 px-1 rounded-xl transition-all border text-center cursor-pointer group",
                    isFocused
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/30 scale-105 font-bold"
                      : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-700/60 text-slate-700 dark:text-slate-300"
                  )}
                >
                  <span className="text-[11px] font-bold">{m.name}</span>
                  <div className="flex items-center gap-1 mt-1">
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      m.status === 'CONCLUIDO' 
                        ? (isFocused ? "bg-white" : "bg-emerald-500") 
                        : m.status === 'EM ANDAMENTO' 
                          ? (isFocused ? "bg-amber-200" : "bg-amber-500") 
                          : (isFocused ? "bg-slate-300" : "bg-slate-400")
                    )} />
                  </div>
                  <span className={cn(
                    "text-[9px] font-mono mt-0.5",
                    isFocused ? "text-indigo-100" : "text-slate-400 dark:text-slate-500"
                  )}>
                    {formatCompactBRL(m.vendas)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* CARD EXPANSÍVEL: RAIO-X INTERATIVO DO MÊS SELECIONADO */}
        <AnimatePresence>
          {focusedMonthData && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              className="p-4 rounded-xl bg-gradient-to-r from-indigo-50/80 via-slate-50 to-emerald-50/80 dark:from-indigo-950/30 dark:via-slate-900/40 dark:to-emerald-950/30 border border-indigo-200 dark:border-indigo-800/70 shadow-sm space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 dark:border-indigo-900/60 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                    {focusedMonthData.name}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      Raio-X Operacional: {focusedMonthData.fullName} de {selectedYear}
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                        focusedMonthData.status === 'CONCLUIDO' 
                          ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400" 
                          : focusedMonthData.status === 'EM ANDAMENTO' 
                            ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400" 
                            : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      )}>
                        {focusedMonthData.status === 'CONCLUIDO' ? 'Concluído' : focusedMonthData.status === 'EM ANDAMENTO' ? 'Em Andamento' : 'Aguardando'}
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Detalhamento do fechamento e rentabilidade deste período
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const prevIndex = focusedMonthData.monthIndex > 0 ? focusedMonthData.monthIndex - 1 : 11;
                      setFocusedMonthIndex(prevIndex);
                    }}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft size={14} /> Mês Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextIndex = focusedMonthData.monthIndex < 11 ? focusedMonthData.monthIndex + 1 : 0;
                      setFocusedMonthIndex(nextIndex);
                    }}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    Próximo Mês <ChevronRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFocusedMonthIndex(null)}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 text-slate-500 border border-slate-200 dark:border-slate-700 cursor-pointer"
                    title="Fechar foco"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* 4 Mini Cards do Mês */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-500 font-semibold block">Vendas (Faturamento)</span>
                  <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {formatBRL(focusedMonthData.vendas)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-500 font-semibold block">Compras (Custos)</span>
                  <span className="text-sm font-bold font-mono text-indigo-600 dark:text-indigo-400">
                    {formatBRL(focusedMonthData.compras)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-500 font-semibold block">Margem Líquida</span>
                  <span className={cn(
                    "text-sm font-bold font-mono",
                    focusedMonthData.margem >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  )}>
                    {formatBRL(focusedMonthData.margem)} ({focusedMonthData.margemPct.toFixed(1)}%)
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-500 font-semibold block">Volume Físico</span>
                  <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                    {focusedMonthData.notas} notas / {focusedMonthData.produtos} itens
                  </span>
                </div>
              </div>

              {/* Detalhamento por Empresa no Raio-X quando Consolidado */}
              {isConsolidated && focusedMonthData.companyBreakdown && focusedMonthData.companyBreakdown.length > 1 && (
                <div className="pt-2.5 border-t border-indigo-100 dark:border-indigo-900/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 block mb-2">
                    Composição deste Mês por Empresa:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {focusedMonthData.companyBreakdown.map((cb: any, i: number) => (
                      <div key={i} className="p-2.5 rounded-lg bg-white/90 dark:bg-slate-800/90 border border-purple-200/70 dark:border-purple-800/50 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cb.color || '#8b5cf6' }} />
                          <span className="font-bold text-slate-800 dark:text-white">{cb.name}</span>
                        </div>
                        <div className="text-right font-mono text-[11px]">
                          <div>Vendas: <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCompactBRL(cb.sales)}</span></div>
                          <div>Compras: <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatCompactBRL(cb.purchases)}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* GRADE MENSAL DE AUDITORIA E RESUMO */}
      <div className="rounded-2xl bg-white dark:bg-[#0d1322] border border-slate-200/90 dark:border-slate-800/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Demonstrativo Mensal Sintético ({selectedYear})
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Detalhamento de faturamento, custos e status de fechamento
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('entries')}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            Editar lançamentos <ChevronRight size={14} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 border-b border-slate-200/80 dark:border-slate-800/60 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Mês</th>
                <th className="py-3 px-4 text-right">Vendas</th>
                <th className="py-3 px-4 text-right">Compras</th>
                <th className="py-3 px-4 text-right">Resultado</th>
                <th className="py-3 px-4 text-center">Proporção C/V</th>
                <th className="py-3 px-4 text-center">Volume Físico</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {monthlyData.map((m) => (
                <tr key={m.monthIndex} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/20 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    {m.fullName}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-bold">
                    {formatBRL(m.vendas)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {formatBRL(m.compras)}
                  </td>
                  <td className={cn(
                    "py-3 px-4 text-right font-mono tabular-nums font-bold",
                    m.margem >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  )}>
                    {formatBRL(m.margem)}
                  </td>
                  <td className="py-3 px-4 text-center font-mono tabular-nums">
                    <span className={cn(
                      "text-[11px] font-bold px-2 py-0.5 rounded",
                      m.proporcao <= 60 
                        ? "text-emerald-600 dark:text-emerald-400" 
                        : m.proporcao <= 75 
                          ? "text-amber-600 dark:text-amber-400" 
                          : "text-rose-600 dark:text-rose-400"
                    )}>
                      {m.proporcao.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-500">
                    {m.notas} notas / {m.produtos} itens
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                      m.status === 'CONCLUIDO' 
                        ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400" 
                        : m.status === 'EM ANDAMENTO' 
                          ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400" 
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    )}>
                      {m.status === 'CONCLUIDO' ? 'Concluído' : m.status === 'EM ANDAMENTO' ? 'Em Andamento' : 'Aguardando'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </motion.div>
  );
}

// Custom Tooltip para Gráficos
function CustomChartTooltip({ active, payload, label, targetGoal }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isTargetMet = targetGoal && targetGoal > 0 ? data.vendas >= targetGoal : null;
    return (
      <div className="p-3.5 bg-white/95 dark:bg-[#0d1322]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl text-xs space-y-2.5 min-w-[210px] pointer-events-none">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
          <span className="font-bold text-slate-900 dark:text-white">{data.fullName}</span>
          <span className={cn(
            "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
            data.status === 'CONCLUIDO' 
              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400" 
              : data.status === 'EM ANDAMENTO' 
                ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400" 
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
          )}>
            {data.status === 'CONCLUIDO' ? 'Concluído' : data.status === 'EM ANDAMENTO' ? 'Andamento' : 'Aguardando'}
          </span>
        </div>
        <div className="space-y-1 font-mono">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span>Vendas:</span>
            <span className="font-bold">{formatBRL(data.vendas)}</span>
          </div>
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
            <span>Compras:</span>
            <span className="font-bold">{formatBRL(data.compras)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 pt-1 border-t border-slate-100 dark:border-slate-800">
            <span>Resultado:</span>
            <span className={cn("font-bold", data.margem >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
              {formatBRL(data.margem)}
            </span>
          </div>
        </div>
        {data.companyBreakdown && data.companyBreakdown.length > 1 && (
          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/80 space-y-1">
            <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 block uppercase tracking-wider">
              Detalhamento por Empresa
            </span>
            {data.companyBreakdown.map((cb: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-[11px] bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cb.color }} />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{cb.name}:</span>
                </div>
                <div className="font-mono text-right">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatCompactBRL(cb.sales)}</span>
                  <span className="text-slate-400 mx-1">/</span>
                  <span className="text-slate-600 dark:text-slate-300">{formatCompactBRL(cb.purchases)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {targetGoal && targetGoal > 0 && (
          <div className="pt-1 border-t border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-amber-600 dark:text-amber-400 font-medium">Meta ({formatCompactBRL(targetGoal)}):</span>
            <span className={cn("font-bold font-mono", isTargetMet ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500")}>
              {isTargetMet ? "✓ Superou" : "✕ Abaixo"}
            </span>
          </div>
        )}
        <div className="text-[10px] text-slate-400 pt-1 flex justify-between">
          <span>Eficiência C/V:</span>
          <span className="font-bold text-slate-600 dark:text-slate-300">{data.proporcao.toFixed(1)}%</span>
        </div>
        <div className="text-[9px] text-indigo-500 dark:text-indigo-400 font-medium text-center pt-0.5">
          👆 Clique na barra para fixar o mês
        </div>
      </div>
    );
  }
  return null;
}

// -------------------------------------------------------------
// COMPONENTE: LANÇAMENTOS MENSAIS (ENTRIES VIEW)
// -------------------------------------------------------------

function ModernEntriesView({ 
  companies, 
  entries, 
  selectedYear, 
  selectedCompanyId, 
  setSelectedCompanyId,
  onSave,
  onRefresh
}: { 
  companies: Company[], 
  entries: Entry[], 
  selectedYear: number, 
  selectedCompanyId: string, 
  setSelectedCompanyId: (id: string) => void,
  onSave: (cId: string, y: number, m: number, p: number, s: number, n?: number, pr?: number, st?: Entry['status']) => void,
  onRefresh: () => Promise<void>
}) {
  const [filterTerm, setFilterTerm] = useState('');

  const isConsolidated = selectedCompanyId === 'all';

  const companyEntries = useMemo(() => {
    if (!selectedCompanyId) return [];
    if (selectedCompanyId === 'all') {
      return entries.filter(e => e.year === selectedYear);
    }
    return entries.filter(e => e.companyId === selectedCompanyId && e.year === selectedYear);
  }, [entries, selectedCompanyId, selectedYear]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="space-y-6"
    >
      
      {/* Barra de Filtro e Seleção */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0d1322] border border-slate-200/90 dark:border-slate-800/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Lançamentos Financeiros ({selectedYear})
            </h3>
            {isConsolidated && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                Consolidação Geral
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isConsolidated 
              ? 'Exibindo valores combinados das empresas. Escolha uma empresa específica para editar lançamentos.' 
              : 'Informe ou edite os valores de Compras e Vendas para cada competência'}
          </p>
        </div>

        {/* Alternador Rápido de Empresas */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/60 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setSelectedCompanyId('all')}
              className={cn(
                "px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer",
                isConsolidated
                  ? "bg-purple-600 text-white shadow-xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <Layers size={13} />
              <span>Consolidado</span>
            </button>
            {companies.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCompanyId(c.id)}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all cursor-pointer truncate max-w-[120px]",
                  selectedCompanyId === c.id
                    ? "bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                {c.name}
              </button>
            ))}
          </div>

          <select 
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="md:hidden bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-lg py-2 px-3 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
          >
            <option value="all">🏢 Ambas as Empresas (Consolidação)</option>
            {companies.map(c => (
              <option key={c.id} value={c.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grade de 12 Meses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {MONTHS.map((month, idx) => {
          if (isConsolidated) {
            const monthEntries = companyEntries.filter(e => e.month === idx);
            const totalP = monthEntries.reduce((a, b) => a + b.purchases, 0);
            const totalS = monthEntries.reduce((a, b) => a + b.sales, 0);
            const totalN = monthEntries.reduce((a, b) => a + b.notesCount, 0);
            const allConcluded = monthEntries.length > 0 && monthEntries.every(e => e.status === 'CONCLUIDO');
            const anyInProgress = monthEntries.some(e => e.status === 'EM ANDAMENTO');
            const status: Entry['status'] = allConcluded ? 'CONCLUIDO' : (anyInProgress ? 'EM ANDAMENTO' : 'AGUARDANDO');

            return (
              <div key={idx} className="p-4 rounded-2xl bg-white dark:bg-[#0d1322] border border-slate-200/90 dark:border-slate-800/80 shadow-sm space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <span className="font-bold text-sm text-slate-900 dark:text-white">{month}</span>
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                    status === 'CONCLUIDO' 
                      ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400" 
                      : status === 'EM ANDAMENTO' 
                        ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400" 
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  )}>
                    {status === 'CONCLUIDO' ? 'Fechado' : status === 'EM ANDAMENTO' ? 'Em Andamento' : 'Aguardando'}
                  </span>
                </div>

                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg">
                    <span className="text-[11px] text-slate-500 font-sans font-semibold">Total Vendas:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatBRL(totalS)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg">
                    <span className="text-[11px] text-slate-500 font-sans font-semibold">Total Compras:</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatBRL(totalP)}</span>
                  </div>
                </div>

                {/* Sub-valores de cada empresa */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Editar por Empresa:
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {companies.map(c => {
                      const cEntry = monthEntries.find(e => e.companyId === c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedCompanyId(c.id)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-purple-400 text-left text-[10px] transition-all bg-slate-50/50 dark:bg-slate-800/30 cursor-pointer"
                          title={`Editar lançamentos de ${c.name} para ${month}`}
                        >
                          <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{c.name}</div>
                          <div className="font-mono text-emerald-600 dark:text-emerald-400 text-[9px]">{formatCompactBRL(cEntry?.sales || 0)}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          }

          const entry = companyEntries.find(e => e.month === idx);
          return (
            <ModernMonthCard 
              key={idx}
              monthIndex={idx}
              monthName={month}
              purchases={entry?.purchases || 0}
              sales={entry?.sales || 0}
              notesCount={entry?.notesCount || 0}
              status={entry?.status || 'AGUARDANDO'}
              onSave={(p, s, n, pr, st) => onSave(selectedCompanyId, selectedYear, idx, p, s, n, pr, st)}
            />
          );
        })}
      </div>

    </motion.div>
  );
}

interface ModernMonthCardProps {
  key?: React.Key;
  monthIndex: number;
  monthName: string;
  purchases: number;
  sales: number;
  notesCount?: number;
  status: Entry['status'];
  onSave: (p: number, s: number, n: number, pr: number, st: Entry['status']) => void;
}

// Card de Cada Mês para Lançamento
function ModernMonthCard({ 
  monthIndex,
  monthName, 
  purchases, 
  sales, 
  notesCount = 0, 
  status, 
  onSave 
}: ModernMonthCardProps) {
  const [pText, setPText] = useState(purchases ? purchases.toString() : '');
  const [sText, setSText] = useState(sales ? sales.toString() : '');

  useEffect(() => {
    setPText(purchases ? purchases.toString() : '');
    setSText(sales ? sales.toString() : '');
  }, [purchases, sales]);

  const isLocked = status === 'CONCLUIDO';
  const margin = (sales || 0) - (purchases || 0);
  const ratio = sales > 0 ? (purchases / sales) * 100 : (purchases > 0 ? 100 : 0);

  const handleBlur = () => {
    const pNum = parseFloat(pText.replace(',', '.')) || 0;
    const sNum = parseFloat(sText.replace(',', '.')) || 0;
    onSave(pNum, sNum, notesCount, 0, status);
  };

  const toggleLock = () => {
    const nextStatus: Entry['status'] = isLocked ? 'EM ANDAMENTO' : 'CONCLUIDO';
    const pNum = parseFloat(pText.replace(',', '.')) || 0;
    const sNum = parseFloat(sText.replace(',', '.')) || 0;
    onSave(pNum, sNum, notesCount, 0, nextStatus);
  };

  return (
    <div className={cn(
      "rounded-2xl p-4 transition-all duration-200 border",
      isLocked 
        ? "bg-slate-50/70 dark:bg-[#0c1220]/70 border-emerald-500/40 dark:border-emerald-500/30" 
        : "bg-white dark:bg-[#0d1322] border-slate-200/90 dark:border-slate-800/80 shadow-sm hover:border-slate-300 dark:hover:border-slate-700"
    )}>
      
      {/* Top Header do Mês */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-sm text-slate-900 dark:text-white">
            {monthName}
          </span>
          <span className={cn(
            "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
            status === 'CONCLUIDO' 
              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400" 
              : status === 'EM ANDAMENTO' 
                ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400" 
                : "bg-slate-100 dark:bg-slate-800 text-slate-500"
          )}>
            {status === 'CONCLUIDO' ? 'Fechado' : status === 'EM ANDAMENTO' ? 'Aberto' : 'Vazio'}
          </span>
        </div>

        <button
          onClick={toggleLock}
          className={cn(
            "p-1.5 rounded-lg transition-colors",
            isLocked 
              ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50" 
              : "text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          )}
          title={isLocked ? "Competência Concluída (Clique para destravar)" : "Travar como Concluído"}
        >
          {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
        </button>
      </div>

      {/* Inputs de Compras e Vendas */}
      <div className="space-y-3">
        
        {/* Vendas Input */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
            Vendas (R$)
          </label>
          <div className="relative">
            <input
              type="number"
              step="any"
              disabled={isLocked}
              value={sText}
              onChange={(e) => setSText(e.target.value)}
              onBlur={handleBlur}
              placeholder="0,00"
              className={cn(
                "w-full bg-slate-50 dark:bg-slate-800/60 border rounded-lg py-2 px-3 text-xs font-mono font-bold transition-all tabular-nums",
                isLocked 
                  ? "border-transparent text-emerald-600 dark:text-emerald-400 opacity-90 cursor-not-allowed" 
                  : "border-slate-200 dark:border-slate-700/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              )}
            />
          </div>
        </div>

        {/* Compras Input */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
            Compras (R$)
          </label>
          <div className="relative">
            <input
              type="number"
              step="any"
              disabled={isLocked}
              value={pText}
              onChange={(e) => setPText(e.target.value)}
              onBlur={handleBlur}
              placeholder="0,00"
              className={cn(
                "w-full bg-slate-50 dark:bg-slate-800/60 border rounded-lg py-2 px-3 text-xs font-mono font-bold transition-all tabular-nums",
                isLocked 
                  ? "border-transparent text-indigo-600 dark:text-indigo-400 opacity-90 cursor-not-allowed" 
                  : "border-slate-200 dark:border-slate-700/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              )}
            />
          </div>
        </div>

      </div>

      {/* Rodapé do Card com Resumo do Mês */}
      <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs">
        <div>
          <span className="text-[10px] text-slate-600 dark:text-slate-300 block uppercase font-medium">Margem</span>
          <span className={cn(
            "font-mono font-bold tabular-nums text-[11px]",
            margin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          )}>
            {formatCompactBRL(margin)}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-600 dark:text-slate-300 block uppercase font-medium">C/V</span>
          <span className="font-mono font-bold tabular-nums text-[11px] text-slate-700 dark:text-slate-300">
            {ratio.toFixed(0)}%
          </span>
        </div>
      </div>

    </div>
  );
}

// -------------------------------------------------------------
// COMPONENTE: GESTÃO DE ITENS & STATUS (STATUS VIEW COM XML)
// -------------------------------------------------------------

function ModernStatusView({ 
  companies, 
  entries, 
  selectedYear, 
  onSave 
}: { 
  companies: Company[], 
  entries: Entry[], 
  selectedYear: number, 
  onSave: (cId: string, y: number, m: number, p: number, s: number, n: number, pr: number, st: Entry['status']) => void 
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ total: number, processed: number } | null>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const scrollHorizontally = (delta: number) => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
    }
  };

  const scrollToSemester = (sem: 1 | 2) => {
    if (tableScrollRef.current) {
      const { scrollWidth, clientWidth } = tableScrollRef.current;
      const target = sem === 1 ? 0 : scrollWidth - clientWidth;
      tableScrollRef.current.scrollTo({ left: target, behavior: 'smooth' });
    }
  };

  const scrollToMonth = (monthIdx: number) => {
    if (tableScrollRef.current) {
      const { scrollWidth, clientWidth } = tableScrollRef.current;
      const maxScroll = Math.max(0, scrollWidth - clientWidth);
      const target = (monthIdx / 11) * maxScroll;
      tableScrollRef.current.scrollTo({ left: target, behavior: 'smooth' });
    }
  };

  const getEntry = (companyId: string, month: number) => {
    return entries.find(e => e.companyId === companyId && e.month === month && e.year === selectedYear);
  };

  const handleStatusChange = (month: number, status: Entry['status']) => {
    companies.forEach(company => {
      const entry = getEntry(company.id, month);
      onSave(
        company.id, 
        selectedYear, 
        month, 
        entry?.purchases || 0, 
        entry?.sales || 0, 
        entry?.notesCount || 0, 
        0,
        status
      );
    });
  };

  const handleCellStatusToggle = (companyId: string, month: number) => {
    const entry = getEntry(companyId, month);
    const current = entry?.status || 'AGUARDANDO';
    const next: Entry['status'] = current === 'AGUARDANDO' ? 'EM ANDAMENTO' : current === 'EM ANDAMENTO' ? 'CONCLUIDO' : 'AGUARDANDO';
    onSave(
      companyId,
      selectedYear,
      month,
      entry?.purchases || 0,
      entry?.sales || 0,
      entry?.notesCount || 0,
      0,
      next
    );
  };

  // Importação e Análise de Arquivos XML (NF-e)
  const handleXmlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress({ total: files.length, processed: 0 });

    const parser = new XMLParser();
    const companyMonthlyData: Record<string, Record<string, { purchases: number, sales: number, notes: number }>> = {};

    const cleanCnpj = (c: any) => String(c || '').replace(/\D/g, '');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const text = await file.text();
        const jsonObj = parser.parse(text);
        
        const nfe = jsonObj.nfeProc?.NFe || jsonObj.NFe;
        if (!nfe) continue;

        const infNFe = nfe.infNFe;
        const ide = infNFe.ide;
        const total = infNFe.total?.ICMSTot;
        
        const dateStr = ide.dhEmi || ide.dEmi;
        if (!dateStr) continue;
        
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = date.getMonth();
        
        if (year !== selectedYear) continue;

        const emitCnpj = cleanCnpj(infNFe.emit?.CNPJ);
        const destCnpj = cleanCnpj(infNFe.dest?.CNPJ);

        const matchingCompany = companies.find(c => {
          const companyCnpj = cleanCnpj(c.cnpj);
          return companyCnpj === emitCnpj || companyCnpj === destCnpj;
        });

        if (!matchingCompany) continue;

        // Se o mês já estiver CONCLUIDO, ignora a sobreescrita
        const existingStatus = entries.find(e => 
          e.companyId === matchingCompany.id && 
          e.month === month && 
          e.year === selectedYear
        )?.status;

        if (existingStatus === 'CONCLUIDO') {
          continue;
        }

        const companyId = matchingCompany.id;
        const monthKey = `${month}`;

        if (!companyMonthlyData[companyId]) companyMonthlyData[companyId] = {};
        if (!companyMonthlyData[companyId][monthKey]) {
          companyMonthlyData[companyId][monthKey] = { purchases: 0, sales: 0, notes: 0 };
        }

        const value = parseFloat(String(total?.vNF || 0));
        const companyCnpjClean = cleanCnpj(matchingCompany.cnpj);

        if (destCnpj === companyCnpjClean) {
          companyMonthlyData[companyId][monthKey].purchases += value;
        } else if (emitCnpj === companyCnpjClean) {
          companyMonthlyData[companyId][monthKey].sales += value;
        }
        
        companyMonthlyData[companyId][monthKey].notes += 1;
      } catch (err) {
        console.error("Erro ao analisar arquivo XML:", file.name, err);
      }
      setUploadProgress(prev => prev ? { ...prev, processed: i + 1 } : null);
    }

    for (const [companyId, months] of Object.entries(companyMonthlyData)) {
      for (const [monthStr, data] of Object.entries(months)) {
        const month = parseInt(monthStr);
        const existing = entries.find(e => e.companyId === companyId && e.month === month && e.year === selectedYear);
        
        await onSave(
          companyId, 
          selectedYear, 
          month, 
          data.purchases || (existing?.purchases || 0), 
          data.sales || (existing?.sales || 0), 
          data.notes || (existing?.notesCount || 0),
          0,
          'EM ANDAMENTO'
        );
      }
    }

    setIsUploading(false);
    setUploadProgress(null);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      
      {/* Top Banner de Gestão com Botão de Importação XML */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#0d1322] border border-slate-200/90 dark:border-slate-800/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Matriz de Fechamento & Status ({selectedYear})
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Controle de status por competência com trava de segurança (sem digitação manual)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className={cn(
            "flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl cursor-pointer transition-all text-indigo-700 dark:text-indigo-400 text-xs font-bold shadow-sm",
            isUploading && "opacity-50 cursor-not-allowed"
          )}>
            {isUploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Processando XML ({uploadProgress?.processed}/{uploadProgress?.total})</span>
              </>
            ) : (
              <>
                <FileUp size={16} />
                <span>Importar Notas XML</span>
              </>
            )}
            <input 
              type="file" 
              multiple 
              accept=".xml" 
              hidden 
              disabled={isUploading} 
              onChange={handleXmlUpload}
            />
          </label>
        </div>
      </div>

      {/* Tabela de Matriz Operacional com Trava de Meses */}
      <div className="rounded-2xl bg-white dark:bg-[#0d1322] border border-slate-200/90 dark:border-slate-800/80 shadow-sm overflow-hidden flex flex-col">
        {/* Cabeçalho da Barra de Trava com Dica */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/60 dark:bg-[#0b101c] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Lock size={15} className="text-indigo-600 dark:text-indigo-400" />
            <span className="font-bold text-slate-800 dark:text-slate-200">
              Matriz de Bloqueio & Fechamento dos Meses ({selectedYear})
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span className="hidden md:inline">Role horizontalmente ou use o rodapé de navegação para alternar entre os meses</span>
          </div>
        </div>

        {/* Contêiner da Tabela com Barra de Rolagem Horizontal Destacada */}
        <div 
          ref={tableScrollRef}
          className="overflow-x-auto scrollbar-prominent select-none"
        >
          <table className="w-full text-left text-xs border-collapse min-w-[1080px]">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/90 dark:border-slate-800/80">
              <tr>
                <th className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] sticky left-0 bg-slate-50 dark:bg-[#0d1322] z-20">
                  Empresa
                </th>
                {MONTHS.map((month, idx) => {
                  const monthEntries = entries.filter(e => e.month === idx && e.year === selectedYear);
                  const statusCounts = monthEntries.reduce((acc, curr) => {
                    acc[curr.status] = (acc[curr.status] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>);
                  const dominantStatus = (Object.entries(statusCounts).sort((a,b) => b[1] - a[1])[0]?.[0] as Entry['status']) || 'AGUARDANDO';

                  return (
                    <th key={idx} className="py-3 px-2 text-center min-w-[105px]">
                      <div className="flex flex-col gap-1 items-center">
                        <span className="font-extrabold text-[11px] text-slate-800 dark:text-slate-200">{month.substring(0, 3)}</span>
                        <select 
                          value={dominantStatus}
                          onChange={(e) => handleStatusChange(idx, e.target.value as any)}
                          title="Alterar status de todas as empresas no mês"
                          className={cn(
                            "text-[9px] font-bold uppercase tracking-wider py-0.5 px-1.5 rounded border transition-colors cursor-pointer outline-none",
                            dominantStatus === 'CONCLUIDO' ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700" :
                            dominantStatus === 'EM ANDAMENTO' ? "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700" :
                            "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700"
                          )}
                        >
                          <option value="AGUARDANDO">Aguardando</option>
                          <option value="EM ANDAMENTO">Andamento</option>
                          <option value="CONCLUIDO">Concluído</option>
                        </select>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {companies.map(company => (
                <tr key={company.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors">
                  <td className="py-3 px-4 sticky left-0 bg-white dark:bg-[#0d1322] z-10 border-r border-slate-200/80 dark:border-slate-800/60 shadow-[4px_0_12px_rgba(0,0,0,0.03)]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: company.color }} />
                      <span className="font-bold text-slate-900 dark:text-white truncate max-w-[160px]">
                        {company.name}
                      </span>
                    </div>
                  </td>
                  {MONTHS.map((_, idx) => {
                    const entry = getEntry(company.id, idx);
                    const currentStatus = entry?.status || 'AGUARDANDO';
                    const isClosed = currentStatus === 'CONCLUIDO';

                    return (
                      <td key={idx} className="py-2 px-1 text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCellStatusToggle(company.id, idx)}
                            className={cn(
                              "w-full max-w-[95px] py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-1 cursor-pointer",
                              isClosed
                                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 shadow-xs font-black"
                                : currentStatus === 'EM ANDAMENTO'
                                  ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 shadow-xs font-bold"
                                  : "bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                            )}
                            title={isClosed ? "Competência Concluída e Travada (Clique para destravar)" : "Clique para alternar status"}
                          >
                            {isClosed ? (
                              <>
                                <Lock size={11} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span>Fechado</span>
                              </>
                            ) : currentStatus === 'EM ANDAMENTO' ? (
                              <span>Andamento</span>
                            ) : (
                              <span>Aguardando</span>
                            )}
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Linha de Totais / Resumo de Fechamento */}
              <tr className="bg-slate-50 dark:bg-slate-800/40 font-bold border-t border-slate-200 dark:border-slate-800">
                <td className="py-3 px-4 sticky left-0 bg-slate-50 dark:bg-slate-800/80 z-10 text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Fechamentos
                </td>
                {MONTHS.map((_, idx) => {
                  const monthEntries = entries.filter(e => e.month === idx && e.year === selectedYear);
                  const closedCount = monthEntries.filter(e => e.status === 'CONCLUIDO').length;
                  const totalCount = companies.length;
                  return (
                    <td key={idx} className="py-3 px-1 text-center">
                      <span className={cn(
                        "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full inline-block",
                        closedCount === totalCount && totalCount > 0
                          ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400"
                          : closedCount > 0
                            ? "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      )}>
                        {closedCount}/{totalCount}
                      </span>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Rodapé da Barra de Bloqueio com Rolagem e Atalhos dos Meses */}
        <div className="p-4 bg-slate-50/90 dark:bg-[#0b101c] border-t border-slate-200/90 dark:border-slate-800/80 flex flex-col lg:flex-row items-center justify-between gap-4">
          
          {/* Controles de Navegação Horizontal */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap">
              Rolagem dos Meses:
            </span>
            <button
              type="button"
              onClick={() => scrollHorizontally(-280)}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
              title="Rolar para meses anteriores"
            >
              <ChevronLeft size={14} />
              <span>Anterior</span>
            </button>
            <button
              type="button"
              onClick={() => scrollHorizontally(280)}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
              title="Rolar para próximos meses"
            >
              <span>Próximo</span>
              <ChevronRight size={14} />
            </button>
            
            <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1 hidden sm:block" />
            
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => scrollToSemester(1)}
                className="px-2.5 py-1 rounded-md bg-slate-200/80 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 transition-colors cursor-pointer"
              >
                1º Sem (Jan-Jun)
              </button>
              <button
                type="button"
                onClick={() => scrollToSemester(2)}
                className="px-2.5 py-1 rounded-md bg-slate-200/80 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 transition-colors cursor-pointer"
              >
                2º Sem (Jul-Dez)
              </button>
            </div>
          </div>

          {/* Régua Miniatura dos 12 Meses no Rodapé (Atalho com indicação de fechamento) */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 scrollbar-prominent">
            {MONTHS.map((m, idx) => {
              const monthEntries = entries.filter(e => e.month === idx && e.year === selectedYear);
              const closedCount = monthEntries.filter(e => e.status === 'CONCLUIDO').length;
              const isAllClosed = closedCount === companies.length && companies.length > 0;
              const hasSomeClosed = closedCount > 0;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => scrollToMonth(idx)}
                  className={cn(
                    "px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap shadow-xs",
                    isAllClosed
                      ? "bg-emerald-600 text-white"
                      : hasSomeClosed
                        ? "bg-amber-500 text-white"
                        : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                  )}
                  title={`Pular para ${m} (${closedCount}/${companies.length} fechados)`}
                >
                  {isAllClosed && <Lock size={9} className="text-white" />}
                  <span>{m.substring(0, 3).toUpperCase()}</span>
                </button>
              );
            })}
          </div>

        </div>
      </div>

    </motion.div>
  );
}

// -------------------------------------------------------------
// COMPONENTE: EMPRESAS CADASTRADAS (COMPANIES VIEW)
// -------------------------------------------------------------

function ModernCompaniesView({ 
  companies, 
  entries,
  selectedYear = 2026,
  onAdd, 
  onRemove,
  onSelectCompany,
  onToggleStatus
}: { 
  companies: Company[], 
  entries: Entry[],
  selectedYear?: number,
  onAdd: (name: string, cnpj: string) => void, 
  onRemove: (id: string) => void,
  onSelectCompany: (id: string) => void,
  onToggleStatus?: (companyId: string, month: number) => void
}) {
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && cnpj.trim()) {
      onAdd(name.trim(), cnpj.trim());
      setName('');
      setCnpj('');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="max-w-5xl mx-auto space-y-6"
    >
      
      {/* Formulário de Cadastro */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#0d1322] border border-slate-200/90 dark:border-slate-800/80 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Plus className="text-indigo-600" size={18} /> Adicionar Nova Empresa
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Cadastre novas filiais ou parceiros comerciais para monitoramento individual
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              Razão Social / Nome Fantasia
            </label>
            <input 
              type="text" 
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Distribuidora Nacional LTDA"
              className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 rounded-xl py-2.5 px-3.5 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              CNPJ
            </label>
            <input 
              type="text" 
              required
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0001-00"
              className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 rounded-xl py-2.5 px-3.5 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          <div className="md:col-span-2 pt-1">
            <button 
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-sm shadow-indigo-600/30 cursor-pointer"
            >
              Confirmar Cadastro
            </button>
          </div>
        </form>
      </div>

      {/* Grade de Empresas Cadastradas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {companies.map(company => {
          const compEntries = entries.filter(e => e.companyId === company.id);
          const totalVendas = compEntries.reduce((acc, curr) => acc + curr.sales, 0);
          const totalCompras = compEntries.reduce((acc, curr) => acc + curr.purchases, 0);
          const closedCount = compEntries.filter(e => e.status === 'CONCLUIDO' && e.year === selectedYear).length;

          return (
            <div 
              key={company.id}
              className="p-5 rounded-2xl bg-white dark:bg-[#0d1322] border border-slate-200/90 dark:border-slate-800/80 shadow-sm flex flex-col justify-between group hover:border-slate-300 dark:hover:border-slate-700 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0"
                      style={{ backgroundColor: company.color }}
                    >
                      {company.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {company.name}
                      </h4>
                      <p className="text-xs font-mono text-slate-400 truncate">
                        {company.cnpj}
                      </p>
                    </div>
                  </div>

                  <button 
                    onClick={() => onRemove(company.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                    title="Remover empresa"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Métricas Consolidadas */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-600 dark:text-slate-300 block uppercase font-medium">Vendas Total</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCompactBRL(totalVendas)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-600 dark:text-slate-300 block uppercase font-medium">Compras Total</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      {formatCompactBRL(totalCompras)}
                    </span>
                  </div>
                </div>

                {/* Régua Minimalista dos 12 Meses com Rolagem no Rodapé */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Trava dos Meses ({selectedYear})
                    </span>
                    <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {closedCount}/12 Fechados
                    </span>
                  </div>

                  {/* Régua com rolagem horizontal destacada no rodapé */}
                  <div className="overflow-x-auto scrollbar-prominent pb-2">
                    <div className="flex items-center gap-1 min-w-max">
                      {MONTHS.map((monthName, idx) => {
                        const entry = entries.find(e => e.companyId === company.id && e.month === idx && e.year === selectedYear);
                        const status = entry?.status || 'AGUARDANDO';
                        const isClosed = status === 'CONCLUIDO';
                        const isOngoing = status === 'EM ANDAMENTO';

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => onToggleStatus && onToggleStatus(company.id, idx)}
                            className={cn(
                              "px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 text-white shadow-xs transition-all cursor-pointer select-none",
                              isClosed 
                                ? "bg-emerald-600 hover:bg-emerald-500 ring-1 ring-emerald-500/50" 
                                : isOngoing 
                                  ? "bg-amber-500 hover:bg-amber-400 ring-1 ring-amber-400/50" 
                                  : "bg-slate-400 dark:bg-slate-700 hover:bg-slate-500 text-white"
                            )}
                            title={`${monthName} / ${selectedYear}: ${isClosed ? 'Fechado/Concluído (Clique para alterar)' : isOngoing ? 'Em Andamento' : 'Aguardando'}`}
                          >
                            {isClosed ? <Lock size={10} className="text-white" /> : null}
                            <span className="text-white font-extrabold">{monthName.substring(0, 3).toUpperCase()}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                <button
                  onClick={() => onSelectCompany(company.id)}
                  className="w-full py-2 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-bold transition-colors text-center cursor-pointer"
                >
                  Abrir no Painel
                </button>
              </div>

            </div>
          );
        })}
      </div>

    </motion.div>
  );
}

// -------------------------------------------------------------
// COMPONENTE: MODAL DE RELATÓRIO PDF (REPORT MODAL)
// -------------------------------------------------------------

function ReportModal({ 
  isOpen, 
  onClose, 
  entries, 
  companies, 
  selectedCompanyId,
  selectedYear 
}: { 
  isOpen: boolean, 
  onClose: () => void,
  entries: Entry[],
  companies: Company[],
  selectedCompanyId: string,
  selectedYear: number
}) {
  const [reportType, setReportType] = useState<'both' | 'sales' | 'purchases'>('both');
  const [targetCompanyId, setTargetCompanyId] = useState<string>(selectedCompanyId || 'all');

  useEffect(() => {
    setTargetCompanyId(selectedCompanyId || 'all');
  }, [selectedCompanyId, isOpen]);

  const isConsolidated = targetCompanyId === 'all';
  const targetCompany = companies.find(c => c.id === targetCompanyId);

  const handleDownload = () => {
    try {
      const doc = new jsPDF();
      const isBoth = targetCompanyId === 'all';
      const companyEntries = isBoth 
        ? entries.filter(e => e.year === selectedYear)
        : entries.filter(e => e.companyId === targetCompanyId && e.year === selectedYear);

      // Cabeçalho Corporativo
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.text(isBoth ? 'Relatório Financeiro Consolidado' : 'Relatório Gerencial Financeiro', 14, 20);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      
      const compName = isBoth 
        ? `CONSOLIDAÇÃO GERAL (${companies.map(c => c.name).join(' & ')})` 
        : (targetCompany?.name || 'Empresa');
      const compCnpj = isBoth 
        ? `Grupo Econômico Consolidado (${companies.map(c => `${c.name}: ${c.cnpj}`).join(' | ')})` 
        : (targetCompany?.cnpj || '');

      doc.text(`Empresa: ${compName}`, 14, 28);
      doc.text(`CNPJ: ${compCnpj}`, 14, 34);
      doc.text(`Competência: ${selectedYear}`, 14, 40);
      doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 46);

      // Montagem da Tabela (com soma caso consolidado)
      const tableData = MONTHS.map((monthName, index) => {
        const monthList = isBoth
          ? companyEntries.filter(e => e.month === index)
          : companyEntries.filter(e => e.month === index);

        const compras = monthList.reduce((a, b) => a + b.purchases, 0);
        const vendas = monthList.reduce((a, b) => a + b.sales, 0);
        const resultado = vendas - compras;

        const row: any[] = [monthName];

        if (reportType === 'purchases' || reportType === 'both') {
          row.push(formatBRL(compras));
        }
        if (reportType === 'sales' || reportType === 'both') {
          row.push(formatBRL(vendas));
        }
        if (reportType === 'both') {
          row.push(formatBRL(resultado));
        }

        const allConcluded = monthList.length > 0 && monthList.every(e => e.status === 'CONCLUIDO');
        row.push(allConcluded ? 'Concluído' : 'Aguardando / Em Aberto');
        return row;
      });

      const headers = ['Mês'];
      if (reportType === 'purchases' || reportType === 'both') headers.push('Compras');
      if (reportType === 'sales' || reportType === 'both') headers.push('Vendas');
      if (reportType === 'both') headers.push('Resultado');
      headers.push('Status');

      autoTable(doc, {
        startY: 52,
        head: [headers],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: isBoth ? [124, 58, 237] : [79, 70, 229], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3 },
      });

      // Totais Consolidados
      const totalCompras = companyEntries.reduce((acc, curr) => acc + curr.purchases, 0);
      const totalVendas = companyEntries.reduce((acc, curr) => acc + curr.sales, 0);
      const docAny = doc as any;
      let finalY = (docAny.lastAutoTable?.finalY || 52) + 10;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);

      let curY = finalY;
      if (reportType === 'purchases' || reportType === 'both') {
        doc.text(`Total Compras: ${formatBRL(totalCompras)}`, 14, curY);
        curY += 6;
      }
      if (reportType === 'sales' || reportType === 'both') {
        doc.text(`Total Vendas: ${formatBRL(totalVendas)}`, 14, curY);
        curY += 6;
      }
      if (reportType === 'both') {
        doc.setTextColor(totalVendas >= totalCompras ? 16 : 220, totalVendas >= totalCompras ? 185 : 38, totalVendas >= totalCompras ? 129 : 38);
        doc.text(`Resultado Líquido Final: ${formatBRL(totalVendas - totalCompras)}`, 14, curY);
        curY += 8;
      }

      // Se consolidado, adicionar resumo individual de cada empresa
      if (isBoth && companies.length > 1) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(88, 28, 135);
        doc.text('Detalhamento por Empresa Integrante:', 14, curY);
        curY += 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);

        companies.forEach(comp => {
          const cEnts = entries.filter(e => e.companyId === comp.id && e.year === selectedYear);
          const cV = cEnts.reduce((a, b) => a + b.sales, 0);
          const cP = cEnts.reduce((a, b) => a + b.purchases, 0);
          const cM = cV - cP;
          doc.text(`• ${comp.name} (${comp.cnpj}): Vendas: ${formatBRL(cV)} | Compras: ${formatBRL(cP)} | Margem: ${formatBRL(cM)}`, 14, curY);
          curY += 5;
        });
      }

      const fileName = isBoth 
        ? `relatorio_consolidado_ambas_empresas_${selectedYear}.pdf`
        : `relatorio_${(targetCompany?.name || 'empresa').toLowerCase().replace(/\s+/g, '_')}_${selectedYear}.pdf`;

      doc.save(fileName);
      onClose();
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Exportar Relatório PDF</h3>
            <p className="text-xs text-slate-500">Selecione os parâmetros e o escopo de consolidação</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1.5 uppercase tracking-wider">
              Empresa / Escopo do Relatório
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                onClick={() => setTargetCompanyId('all')}
                className={cn(
                  "p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer",
                  targetCompanyId === 'all'
                    ? "border-purple-600 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold shadow-xs"
                    : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                )}
              >
                <div className="flex items-center gap-2">
                  <Layers size={14} className="text-purple-600 dark:text-purple-400" />
                  <span>🏢 Ambas as Empresas (Consolidação Geral)</span>
                </div>
                {targetCompanyId === 'all' && <Check size={14} className="text-purple-600" />}
              </button>

              {companies.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setTargetCompanyId(c.id)}
                  className={cn(
                    "p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer",
                    targetCompanyId === c.id
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-bold shadow-xs"
                      : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                    <span>{c.name} ({c.cnpj})</span>
                  </div>
                  {targetCompanyId === c.id && <Check size={14} className="text-indigo-600" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Tipo de Demonstrativo</label>
            <div className="grid grid-cols-1 gap-2">
              {[
                { id: 'both', label: 'Completo (Compras, Vendas e Margem Líquida)' },
                { id: 'sales', label: 'Apenas Faturamento (Vendas)' },
                { id: 'purchases', label: 'Apenas Custos (Compras)' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setReportType(opt.id as any)}
                  className={cn(
                    "p-3 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer",
                    reportType === opt.id 
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-bold" 
                      : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleDownload}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Download size={16} /> Gerar e Baixar PDF Consolidado
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// SUBCOMPONENTES: BOTÃO DA BARRA LATERAL
// -------------------------------------------------------------

function SidebarNavButton({ 
  icon, 
  label, 
  active, 
  badge,
  onClick 
}: { 
  icon: React.ReactNode, 
  label: string, 
  active?: boolean, 
  badge?: string,
  onClick?: () => void 
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 group cursor-pointer",
        active
          ? "bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white font-bold shadow-md shadow-purple-950/60 border border-purple-400/40 ring-1 ring-white/10"
          : "text-purple-100/90 hover:bg-purple-800/40 hover:text-white"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={cn(
          "transition-colors duration-150",
          active ? "text-white drop-shadow-xs" : "text-purple-300 group-hover:text-purple-100"
        )}>
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {badge && (
          <span className={cn(
            "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full transition-colors",
            active 
              ? "bg-white/20 text-white border border-white/30" 
              : "bg-purple-900/80 text-purple-200 border border-purple-700/60 group-hover:border-purple-600"
          )}>
            {badge}
          </span>
        )}
        {active && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/80 animate-pulse" />
        )}
      </div>
    </button>
  );
}
