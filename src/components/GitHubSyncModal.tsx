import React, { useState } from 'react';
import { 
  Github, 
  GitBranch, 
  Copy, 
  Check, 
  ExternalLink, 
  Terminal, 
  ShieldCheck, 
  BookOpen, 
  CheckCircle2, 
  X, 
  FolderGit2, 
  HelpCircle,
  Sparkles,
  Lock
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface GitHubSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GitHubSyncModal({ isOpen, onClose }: GitHubSyncModalProps) {
  const [activeTab, setActiveTab] = useState<'initial' | 'daily' | 'token' | 'info'>('initial');
  const [repoUrl, setRepoUrl] = useState<string>('https://github.com/seu-usuario/gestao-financeira.git');
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => {
      setCopiedIndex(null);
    }, 2000);
  };

  const initialCommands = [
    { label: "1. Definir a branch principal como main", cmd: "git branch -M main" },
    { label: "2. Adicionar o repositório remoto do GitHub", cmd: `git remote add origin ${repoUrl.trim() || 'https://github.com/seu-usuario/gestao-financeira.git'}` },
    { label: "3. Enviar todos os arquivos e histórico para o GitHub", cmd: "git push -u origin main" }
  ];

  const fullInitialScript = `# 1. Definir branch main\ngit branch -M main\n\n# 2. Conectar ao seu repositório no GitHub\ngit remote add origin ${repoUrl.trim() || 'https://github.com/seu-usuario/gestao-financeira.git'}\n\n# 3. Enviar o código para o GitHub\ngit push -u origin main`;

  const dailyCommands = [
    { label: "1. Verificar o que foi alterado", cmd: "git status" },
    { label: "2. Preparar todas as alterações para o commit", cmd: "git add ." },
    { label: "3. Gravar o commit com mensagem explicativa", cmd: 'git commit -m "feat: atualizacoes no painel financeiro"' },
    { label: "4. Enviar as alterações para o GitHub", cmd: "git push origin main" }
  ];

  const pullCommand = { label: "Puxar novidades feitas no GitHub para seu computador", cmd: "git pull origin main" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-3xl bg-white dark:bg-[#121829] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-sm">
              <Github size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">Sincronização com o GitHub</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Git Pronto
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Conecte este sistema ao seu repositório no GitHub para backup, versionamento e deploy contínuo.
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Abas de Navegação */}
        <div className="flex items-center gap-1 sm:gap-2 px-4 sm:px-5 pt-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-xs font-semibold overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('initial')}
            className={cn(
              "flex items-center gap-1.5 py-2 px-3 border-b-2 transition-all whitespace-nowrap cursor-pointer",
              activeTab === 'initial'
                ? "border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 font-bold"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <GitBranch size={14} />
            <span>1º Envio (Conectar & Subir)</span>
          </button>

          <button
            onClick={() => setActiveTab('daily')}
            className={cn(
              "flex items-center gap-1.5 py-2 px-3 border-b-2 transition-all whitespace-nowrap cursor-pointer",
              activeTab === 'daily'
                ? "border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 font-bold"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <Terminal size={14} />
            <span>Rotina Diária (Push & Pull)</span>
          </button>

          <button
            onClick={() => setActiveTab('token')}
            className={cn(
              "flex items-center gap-1.5 py-2 px-3 border-b-2 transition-all whitespace-nowrap cursor-pointer",
              activeTab === 'token'
                ? "border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 font-bold"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <Lock size={14} />
            <span>Token de Acesso (PAT)</span>
          </button>

          <button
            onClick={() => setActiveTab('info')}
            className={cn(
              "flex items-center gap-1.5 py-2 px-3 border-b-2 transition-all whitespace-nowrap cursor-pointer",
              activeTab === 'info'
                ? "border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 font-bold"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <ShieldCheck size={14} />
            <span>Segurança (.gitignore) & Deploy</span>
          </button>
        </div>

        {/* Corpo com Conteúdo da Aba */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(85vh-140px)] space-y-5 text-slate-800 dark:text-slate-200">
          
          {/* ABA 1: PRIMEIRO ENVIO */}
          {activeTab === 'initial' && (
            <div className="space-y-5">
              {/* Etapa 1: Criar Repositório no GitHub */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                      Criar Repositório no GitHub
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Crie um repositório vazio (não adicione README nem .gitignore, o projeto já os possui).
                    </p>
                  </div>
                  <a
                    href="https://github.com/new"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition-all shadow-xs shrink-0"
                  >
                    <ExternalLink size={14} />
                    <span>Abrir GitHub (Criar Novo)</span>
                  </a>
                </div>
              </div>

              {/* Etapa 2: URL do Repositório do Usuário */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                    Cole a URL do seu Repositório criado no GitHub:
                  </span>
                  <span className="text-[11px] font-normal text-slate-400">
                    HTTPS ou SSH
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/seu-usuario/gestao-financeira.git"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs text-indigo-600 dark:text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Os comandos abaixo se ajustam automaticamente com o seu link informado acima.
                </p>
              </div>

              {/* Etapa 3: Comandos para executar */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                    Execute no Terminal da pasta do projeto:
                  </h4>
                  <button
                    onClick={() => handleCopy(fullInitialScript, 'full_init')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    {copiedIndex === 'full_init' ? (
                      <>
                        <Check size={13} className="text-emerald-300" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copiar Todos os Comandos</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-2.5">
                  {initialCommands.map((item, idx) => (
                    <div 
                      key={idx} 
                      className="p-3 rounded-xl bg-slate-900 dark:bg-black/80 border border-slate-800 text-slate-100 font-mono text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-slate-400 text-[11px] font-sans">
                        <span>{item.label}</span>
                        <button
                          onClick={() => handleCopy(item.cmd, `init_${idx}`)}
                          className="flex items-center gap-1 text-indigo-400 hover:text-white transition-colors cursor-pointer text-xs"
                        >
                          {copiedIndex === `init_${idx}` ? (
                            <>
                              <Check size={12} className="text-emerald-400" />
                              <span className="text-emerald-400">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="text-emerald-400 select-all font-mono py-0.5 break-all">
                        $ {item.cmd}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dica importante */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2.5">
                <HelpCircle size={16} className="shrink-0 mt-0.5 text-amber-500" />
                <div>
                  <span className="font-bold">O GitHub pediu senha no terminal?</span>
                  <p className="mt-0.5 text-[11px] opacity-90">
                    O GitHub não aceita mais a senha normal da sua conta em comandos git. Utilize um <strong>Personal Access Token (PAT)</strong> ou chave SSH. Veja as instruções na aba <strong>"Token de Acesso (PAT)"</strong> acima.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: ROTINA DIÁRIA */}
          {activeTab === 'daily' && (
            <div className="space-y-5">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Terminal size={16} className="text-indigo-600 dark:text-indigo-400" />
                  Como enviar atualizações após fazer alterações no código
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Sempre que editar telas, regras de negócio ou componentes, siga estes 4 passos simples:
                </p>
              </div>

              <div className="space-y-2.5">
                {dailyCommands.map((item, idx) => (
                  <div 
                    key={idx} 
                    className="p-3 rounded-xl bg-slate-900 dark:bg-black/80 border border-slate-800 text-slate-100 font-mono text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-slate-400 text-[11px] font-sans">
                      <span>{item.label}</span>
                      <button
                        onClick={() => handleCopy(item.cmd, `daily_${idx}`)}
                        className="flex items-center gap-1 text-indigo-400 hover:text-white transition-colors cursor-pointer text-xs"
                      >
                        {copiedIndex === `daily_${idx}` ? (
                          <>
                            <Check size={12} className="text-emerald-400" />
                            <span className="text-emerald-400">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="text-emerald-400 select-all font-mono py-0.5 break-all">
                      $ {item.cmd}
                    </div>
                  </div>
                ))}
              </div>

              {/* Puxar atualizações */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <GitBranch size={16} className="text-indigo-600 dark:text-indigo-400" />
                  Puxar alterações que você fez no GitHub ou em outro computador
                </h4>
                <div className="p-3 rounded-xl bg-slate-900 dark:bg-black/80 border border-slate-800 text-slate-100 font-mono text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] font-sans">
                    <span>{pullCommand.label}</span>
                    <button
                      onClick={() => handleCopy(pullCommand.cmd, 'pull_cmd')}
                      className="flex items-center gap-1 text-indigo-400 hover:text-white transition-colors cursor-pointer text-xs"
                    >
                      {copiedIndex === 'pull_cmd' ? (
                        <>
                          <Check size={12} className="text-emerald-400" />
                          <span className="text-emerald-400">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="text-emerald-400 select-all font-mono py-0.5 break-all">
                    $ {pullCommand.cmd}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABA 3: PERSONAL ACCESS TOKEN */}
          {activeTab === 'token' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50">
                <h4 className="font-bold text-sm text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                  <Lock size={16} className="text-indigo-600 dark:text-indigo-400" />
                  Por que é necessário um Personal Access Token (PAT)?
                </h4>
                <p className="text-xs text-indigo-900/80 dark:text-indigo-300/80 mt-1">
                  Por motivos de segurança, o GitHub desativou o uso de senhas comuns para autenticação Git via linha de comando em 2021. Você precisa gerar um token uma única vez.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <h5 className="font-bold text-slate-900 dark:text-white">Passo a Passo para Criar seu Token:</h5>
                <ol className="space-y-2.5 list-decimal list-inside text-slate-700 dark:text-slate-300">
                  <li className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                    Acesse o link direto: <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 font-bold underline inline-flex items-center gap-1 ml-1">github.com/settings/tokens <ExternalLink size={12} /></a>
                  </li>
                  <li className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                    Clique em <strong>Generate new token</strong> → <strong>Generate new token (classic)</strong>.
                  </li>
                  <li className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                    No campo <strong>Note</strong>, digite: <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded font-mono">Gestao Financeira Elite</code>
                  </li>
                  <li className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                    Marque a caixa de seleção: <strong className="text-emerald-600 dark:text-emerald-400">[x] repo</strong> (Acesso completo a repositórios privados e públicos).
                  </li>
                  <li className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                    Role a página até o fim e clique no botão verde <strong>Generate token</strong>.
                  </li>
                  <li className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200">
                    <strong>Copie o token gerado!</strong> Ele começa com <code className="font-mono">ghp_...</code>. Cole-o no terminal quando pedir a "Password" do GitHub.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* ABA 4: SEGURANÇA E DEPLOY */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
                <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-600" />
                  Arquivos Protegidos (.gitignore)
                </h4>
                <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80 mt-1">
                  O projeto já está com o <code className="font-mono bg-emerald-100 dark:bg-emerald-900/50 px-1 py-0.5 rounded">.gitignore</code> configurado para nunca enviar credenciais, chaves de API secretas ou arquivos pesados de build para o GitHub:
                </p>
                <div className="mt-2 text-[11px] font-mono text-emerald-900 dark:text-emerald-300 space-y-0.5">
                  <div>✓ .env* e chaves locais protegidas</div>
                  <div>✓ node_modules/ ignorado automaticamente</div>
                  <div>✓ dist/ e relatórios temporários protegidos</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles size={16} className="text-purple-500" />
                  Hospedagem e Deploy Automático com o GitHub
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Ao hospedar este projeto no GitHub, você pode conectá-lo com 1 clique a plataformas de nuvem:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900">
                    <span className="font-bold text-slate-900 dark:text-white block">Vercel</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Importe seu repositório em vercel.com para deploy automático a cada push.</span>
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900">
                    <span className="font-bold text-slate-900 dark:text-white block">Netlify</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Deploy instantâneo com comando de build <code>npm run build</code> e pasta <code>dist</code>.</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
                  <BookOpen size={16} className="text-indigo-600 shrink-0" />
                  <span>Guia completo disponível no arquivo <strong>GITHUB_SYNC.md</strong> na raiz do projeto.</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer do Modal */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
            <FolderGit2 size={14} className="text-indigo-500" />
            <span>Branch Local: <strong className="text-slate-800 dark:text-slate-200">main</strong></span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
