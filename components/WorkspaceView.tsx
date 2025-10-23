import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Persona, ParsedStory, ConversationTurn, ComplexityAnalysisResult } from '../types';
import { personaDetails, UserIcon, SparklesIcon, ClipboardIcon, ClipboardCheckIcon, ClipboardListIcon, ScaleIcon, CodeIcon, DocumentTextIcon, CheckCircleIcon, InformationCircleIcon, SwitchHorizontalIcon, XIcon } from './icons';
import WizardStepper from './WizardStepper';

type WorkspaceViewProps = {
    // State
    planningMode: 'story' | 'bdd';
    originalStory: ParsedStory | null;
    featureDescription: string;
    bddScenarios: { id: number; title: string; gherkin: string | null; completed: boolean; type: 'scenario' | 'outline' }[];
    conversation: ConversationTurn[];
    activePersonas: Persona[];
    satisfiedPersonas: Persona[];
    suggestedStory: string | null;
    isSuggesting: boolean;
    refinementPrompt: string;
    isRefining: boolean;
    testScenarios: string | null;
    isGeneratingScenarios: boolean;
    complexityAnalysis: ComplexityAnalysisResult | null;
    isAnalyzingComplexity: boolean;
    isGeneratingPrototype: boolean;
    isAnswering: boolean;
    currentAnswer: string;
    generatedSingleGherkin: string | null;
    isGeneratingGherkin: boolean;
    suggestionForReview: string | null;

    // Handlers
    setOriginalStory: (story: ParsedStory) => void;
    setFeatureDescription: (desc: string) => void;
    handleStartPlanning: (personas: Persona[]) => void;
    handleAnswerSubmit: () => void;
    handleSkip: () => void;
    setCurrentAnswer: (answer: string) => void;
    handleGetSuggestion: () => void;
    setRefinementPrompt: (prompt: string) => void;
    handleGenerateScenarios: () => void;
    handleAnalyzeComplexity: () => void;
    handleGeneratePrototype: () => void;
    handleGenerateGherkin: () => void;
    handleCompleteBddPlanning: () => void;
    handleCopy: (text: string, turnId?: number) => void;
    copiedTurnId: number | null;
    handleAcceptSuggestion: (newStory: string) => void;
    handleDiscardSuggestion: () => void;
    handleRefineSuggestionInReview: (currentSuggestion: string, prompt: string) => Promise<void>;
};


const generateDiff = (oldText: string, newText: string): { type: 'common' | 'added' | 'removed'; value: string }[] => {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const M = oldLines.length;
    const N = newLines.length;
    const dp = Array(M + 1).fill(0).map(() => Array(N + 1).fill(0));

    for (let i = 1; i <= M; i++) {
        for (let j = 1; j <= N; j++) {
            if (oldLines[i - 1] === newLines[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    const diff: { type: 'common' | 'added' | 'removed'; value: string }[] = [];
    let i = M, j = N;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            diff.unshift({ type: 'common', value: oldLines[i - 1] });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            diff.unshift({ type: 'added', value: newLines[j - 1] });
            j--;
        } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
            diff.unshift({ type: 'removed', value: oldLines[i - 1] });
            i--;
        } else {
            break;
        }
    }
    return diff;
};

const DiffModal = ({ oldText, newText, onClose }: { oldText: string, newText: string, onClose: () => void }) => {
    const diffResult = generateDiff(oldText, newText);

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full h-[85vh] flex flex-col p-6 border border-gray-700 relative animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700 z-20"><XIcon className="w-6 h-6" /></button>
                <h3 className="text-xl font-semibold text-purple-300 mb-4">Comparando Versões</h3>
                <div className="flex-grow overflow-auto bg-gray-900/50 p-4 rounded-md">
                    <pre className="text-sm whitespace-pre-wrap font-mono">
                        {diffResult.map((line, index) => {
                            const style = {
                                'common': 'text-gray-400',
                                'added': 'bg-green-900/40 text-green-300',
                                'removed': 'bg-red-900/40 text-red-300',
                            };
                            const prefix = { 'added': '+ ', 'removed': '- ', 'common': '  ' };
                            return (
                                <div key={index} className={style[line.type]}>
                                    <span>{prefix[line.type]}</span>
                                    <span>{line.value}</span>
                                </div>
                            );
                        })}
                    </pre>
                </div>
            </div>
        </div>
    );
};

const PersonaAvatar = ({ persona }: { persona: Persona }) => {
    const details = personaDetails[persona];
    if (!details) return null;
    const Icon = details.icon;
    return (
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 ${details.color} bg-gray-800`}>
            <Icon className="w-5 h-5 text-gray-300" />
        </div>
    );
};

const PersonaStatusBar = ({ activePersonas, satisfiedPersonas }: { activePersonas: Persona[], satisfiedPersonas: Persona[] }) => {
    if (activePersonas.length === 0) return null;

    return (
        <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mb-4 p-2 bg-gray-900/50 rounded-md">
            <span className="text-sm font-semibold text-gray-400">Status das Personas:</span>
            <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
                {activePersonas.map(persona => {
                    const isSatisfied = satisfiedPersonas.includes(persona);
                    const details = personaDetails[persona];
                    return (
                        <div key={persona} title={isSatisfied ? `${persona} - Satisfeito(a)` : `${persona} - Aguardando`} className="flex items-center gap-1.5">
                            <details.icon className={`w-4 h-4 ${isSatisfied ? 'text-green-400' : 'text-gray-400'}`} />
                            <span className={`text-xs ${isSatisfied ? 'text-green-400' : 'text-gray-400'}`}>{persona.split(' ')[0]}</span>
                            {isSatisfied && <CheckCircleIcon className="w-4 h-4 text-green-400" />}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


const AIAssistantTab = (props: WorkspaceViewProps) => {
    const {
        conversation,
        handleStartPlanning,
        handleAnswerSubmit,
        handleSkip,
        currentAnswer,
        setCurrentAnswer,
        isAnswering,
        handleCopy,
        copiedTurnId,
        planningMode,
        handleGenerateGherkin,
        isGeneratingGherkin,
        generatedSingleGherkin,
        handleCompleteBddPlanning,
        suggestionForReview,
        isSuggesting,
        isRefining,
        handleGetSuggestion,
        handleAcceptSuggestion,
        handleDiscardSuggestion,
        handleRefineSuggestionInReview,
        originalStory,
        suggestedStory,
        activePersonas,
        satisfiedPersonas
    } = props;
    
    const conversationEndRef = useRef<HTMLDivElement>(null);
    const [isConfiguring, setIsConfiguring] = useState(true);

    useEffect(() => {
        if (conversation.length > 0) {
            setIsConfiguring(false);
        } else {
            setIsConfiguring(true);
        }
    }, [conversation]);
    
    useEffect(() => {
        conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversation]);

    const currentTurn = conversation[conversation.length - 1];
    const allSatisfied = activePersonas.length > 0 && activePersonas.every(p => satisfiedPersonas.includes(p));

    if (suggestionForReview) {
        return <SuggestionReviewer
            suggestion={suggestionForReview}
            currentStoryText={suggestedStory ?? (originalStory ? originalStory.description : '')}
            onAccept={handleAcceptSuggestion}
            onDiscard={handleDiscardSuggestion}
            onRefine={handleRefineSuggestionInReview}
            isRefining={isRefining}
        />;
    }

    if (isConfiguring) {
        return <PersonaConfiguration onStart={handleStartPlanning} />;
    }

    return (
        <div className="flex flex-col h-full">
            <PersonaStatusBar activePersonas={activePersonas} satisfiedPersonas={satisfiedPersonas} />
            <div className="flex-grow overflow-y-auto pr-2 space-y-6">
                {conversation.map((turn, index) => {
                    if (turn.isSystemMessage) {
                        return (
                            <div key={turn.id} className="flex items-center gap-2 justify-center text-center my-4">
                                <CheckCircleIcon className="w-5 h-5 text-green-400" />
                                <p className="text-sm text-gray-400 italic">{turn.question}</p>
                            </div>
                        );
                    }
                    return (
                        <div key={turn.id}>
                            {/* Persona Question */}
                            <div className="flex items-start gap-4">
                                <PersonaAvatar persona={turn.persona} />
                                <div className="flex-grow bg-gray-900/70 p-4 rounded-lg rounded-tl-none relative">
                                    <div className="flex justify-between items-center">
                                        <p className="font-bold text-cyan-300">{turn.persona}</p>
                                        <button onClick={() => handleCopy(turn.question, turn.id)} className="text-gray-400 hover:text-white transition-colors">
                                            {copiedTurnId === turn.id ? <ClipboardCheckIcon className="w-4 h-4 text-green-400" /> : <ClipboardIcon className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <p className="mt-2 text-gray-300 whitespace-pre-wrap">{turn.question}</p>
                                </div>
                            </div>
                            
                            {/* User Answer */}
                            {turn.answer && (
                                <div className="flex items-start gap-4 mt-4 justify-end">
                                     <div className="flex-grow bg-purple-900/50 p-4 rounded-lg rounded-br-none max-w-[85%]">
                                        <p className="font-bold text-purple-300">Sua Resposta</p>
                                        <p className="mt-2 text-gray-300 whitespace-pre-wrap">{turn.answer}</p>
                                    </div>
                                    <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 border-purple-500 bg-gray-800">
                                        <UserIcon className="w-5 h-5 text-gray-300" />
                                    </div>
                                </div>
                            )}

                            {/* Divider */}
                            {index < conversation.length - 1 && !conversation[index+1].isSystemMessage && <hr className="border-gray-700 my-6"/>}
                        </div>
                    )
                })}
                <div ref={conversationEndRef}></div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-700 space-y-4">
                {(!currentTurn.answer && !currentTurn.isSystemMessage) ? (
                     <div>
                        <h3 className="text-lg font-semibold text-purple-300 mb-3">Sua Resposta</h3>
                        <textarea
                            value={currentAnswer}
                            onChange={(e) => setCurrentAnswer(e.target.value)}
                            rows={4}
                            className="w-full p-3 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-purple-500 transition text-gray-300 resize-y"
                            placeholder={`Responda como se estivesse falando com o(a) ${currentTurn.persona}...`}
                            disabled={isAnswering}
                        />
                        <div className="flex justify-end gap-4 mt-4">
                            <button onClick={handleSkip} disabled={isAnswering} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded transition disabled:opacity-50">Pular</button>
                            <button onClick={handleAnswerSubmit} disabled={!currentAnswer.trim() || isAnswering} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded transition disabled:bg-gray-500">
                                {isAnswering ? 'Aguarde...' : 'Enviar Resposta'}
                            </button>
                        </div>
                    </div>
                ) : planningMode === 'bdd' ? (
                     <div>
                        <button onClick={handleGenerateGherkin} disabled={isGeneratingGherkin || conversation.length < 1 || allSatisfied} className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-bold py-2 px-4 rounded transition">
                            <DocumentTextIcon className="w-5 h-5" />
                            {isGeneratingGherkin ? 'Gerando...' : 'Gerar Gherkin'}
                        </button>
                        {generatedSingleGherkin && (
                            <div className="mt-4">
                                <button onClick={handleCompleteBddPlanning} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition">
                                    Completar e Voltar para Cenários
                                </button>
                            </div>
                        )}
                     </div>
                ) : null }
                 {planningMode === 'story' && (
                    <button onClick={handleGetSuggestion} disabled={isSuggesting || conversation.length < 1 || !!suggestionForReview || !allSatisfied} className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded transition" title={!allSatisfied ? "Aguarde o consenso de todas as personas" : ""}>
                        <SparklesIcon className="w-5 h-5" />
                        {isSuggesting ? 'Sugerindo...' : 'Sugerir Nova Versão da História'}
                    </button>
                 )}
            </div>
        </div>
    )
};

const PersonaConfiguration = ({ onStart }: { onStart: (personas: Persona[]) => void; }) => {
    const allPersonas = [Persona.Dev, Persona.QA, Persona.Architect, Persona.UX, Persona.DevOps];
    const [selected, setSelected] = useState<Persona[]>([Persona.Dev, Persona.QA, Persona.Architect]);

    const handleSelect = (persona: Persona) => {
        setSelected(prev => 
            prev.includes(persona) ? prev.filter(p => p !== persona) : [...prev, persona]
        );
    };

    return (
        <div>
            <h3 className="text-lg font-semibold text-cyan-300 mb-2">Configurar Sessão de IA</h3>
            <p className="text-gray-400 mb-4 text-sm">Selecione as personas para iniciar a sessão de planejamento simulada.</p>
            <div className="space-y-2 mb-4">
                {allPersonas.map(p => {
                    const details = personaDetails[p];
                    const isSelected = selected.includes(p);
                    return (
                        <label key={p} className={`flex items-center p-2 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-gray-700' : 'bg-gray-900/50 hover:bg-gray-700/50'}`}>
                            <input type="checkbox" checked={isSelected} onChange={() => handleSelect(p)} className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500" />
                            <div className={`ml-3 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 ${details.color} bg-gray-800`}>
                                <details.icon className="w-4 h-4 text-gray-300" />
                            </div>
                            <span className="ml-2 text-gray-300">{p}</span>
                        </label>
                    );
                })}
            </div>
             <button onClick={() => onStart(selected)} disabled={selected.length === 0} className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 text-white font-bold py-2 px-4 rounded transition">
                Iniciar Sessão
            </button>
        </div>
    )
};

const SuggestionReviewer = ({ suggestion, currentStoryText, onAccept, onDiscard, onRefine, isRefining }: {
    suggestion: string;
    currentStoryText: string;
    onAccept: (newStory: string) => void;
    onDiscard: () => void;
    onRefine: (currentSuggestion: string, prompt: string) => Promise<void>;
    isRefining: boolean;
}) => {
    const [localSuggestion, setLocalSuggestion] = useState(suggestion);
    const [showDiffModal, setShowDiffModal] = useState(false);
    const [refinementPrompt, setRefinementPrompt] = useState('');

    useEffect(() => {
        setLocalSuggestion(suggestion);
    }, [suggestion]);

    const handleRefineClick = async () => {
        await onRefine(localSuggestion, refinementPrompt);
        setRefinementPrompt('');
    };

    return (
        <div className="h-full flex flex-col bg-gray-900/50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-cyan-300 mb-3">Sugestão de Nova Versão</h3>
            <div className="flex-grow flex flex-col">
                <textarea
                    value={localSuggestion}
                    onChange={(e) => setLocalSuggestion(e.target.value)}
                    className="w-full p-2 bg-gray-900 border border-gray-700 rounded-md focus:ring-1 focus:ring-purple-500 transition text-sm text-gray-300 resize-y flex-grow"
                />
                <div className="mt-3">
                    <textarea
                        value={refinementPrompt}
                        onChange={(e) => setRefinementPrompt(e.target.value)}
                        rows={2}
                        className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md focus:ring-1 focus:ring-purple-500 transition text-sm text-gray-300 resize-y"
                        placeholder="Instruções para refinar a sugestão acima..."
                        disabled={isRefining}
                    />
                    <button onClick={handleRefineClick} disabled={!refinementPrompt.trim() || isRefining} className="w-full mt-2 bg-purple-700 hover:bg-purple-800 disabled:bg-gray-600 text-white font-bold py-1.5 px-3 rounded transition text-sm">
                        {isRefining ? 'Refinando...' : 'Refinar Sugestão'}
                    </button>
                </div>
            </div>
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-700">
                <button onClick={() => setShowDiffModal(true)} className="flex items-center gap-2 text-sm text-gray-300 hover:text-purple-300 transition-colors py-2 px-4 rounded-md hover:bg-gray-700/50">
                    <SwitchHorizontalIcon className="w-5 h-5" />
                    <span>Comparar</span>
                </button>
                <div className="flex gap-3">
                    <button onClick={onDiscard} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition">Descartar</button>
                    <button onClick={() => onAccept(localSuggestion)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition">Aceitar</button>
                </div>
            </div>
            {showDiffModal && <DiffModal oldText={currentStoryText} newText={localSuggestion} onClose={() => setShowDiffModal(false)} />}
        </div>
    );
};

const WorkspaceView = (props: WorkspaceViewProps) => {
    const { planningMode, originalStory, setOriginalStory, featureDescription, bddScenarios, suggestedStory, activePersonas, satisfiedPersonas } = props;
    const [activeTab, setActiveTab] = useState<'assistant' | 'tests' | 'complexity' | 'prototype'>('assistant');
    const [copied, setCopied] = useState(false);

    const handleCopyToClipboard = (text: string | null) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getActiveStepName = () => {
        const allSatisfied = activePersonas.length > 0 && activePersonas.every(p => satisfiedPersonas.includes(p));

        if (planningMode === 'story') {
            switch (activeTab) {
                case 'assistant':
                    return allSatisfied ? 'Complexidade' : 'Perguntas';
                case 'tests':
                    return 'Testes';
                case 'complexity':
                    return 'Complexidade';
                case 'prototype':
                     return allSatisfied ? 'Complexidade' : 'Perguntas';
                default:
                    return 'Perguntas';
            }
        } else { // bdd mode
            switch (activeTab) {
                case 'assistant':
                case 'prototype':
                case 'complexity':
                    return allSatisfied ? 'Steps' : 'Gherkin';
                case 'tests':
                    return 'Steps';
                default:
                    return 'Gherkin';
            }
        }
    };

    const fullFeatureFile = `Funcionalidade: ${featureDescription}\n\n${bddScenarios.map(s => s.gherkin ?? `Cenário: ${s.title}`).join('\n\n')}`;


    const TabButton = ({ tabName, label }: { tabName: typeof activeTab; label: string; }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`py-2 px-4 text-sm font-medium transition-colors ${activeTab === tabName ? 'text-cyan-300 border-b-2 border-cyan-300' : 'text-gray-400 hover:text-white'}`}
        >
            {label}
        </button>
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-150px)]">
            {/* Left Panel: Editor */}
            <div className="bg-gray-800/50 p-6 rounded-lg flex flex-col">
                <h2 className="text-xl font-semibold text-purple-300 mb-4">{planningMode === 'story' ? "Editor de História" : "Visualizador de Feature BDD"}</h2>
                {planningMode === 'story' && originalStory ? (
                    <div className="flex flex-col flex-grow">
                        <label htmlFor="storyTitle" className="block text-sm font-medium text-gray-400 mb-1">Título</label>
                        <input
                            id="storyTitle"
                            type="text"
                            value={originalStory.title}
                            onChange={(e) => setOriginalStory({ ...originalStory, title: e.target.value })}
                            className="w-full p-2 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-purple-500 transition text-gray-300"
                        />
                        <label htmlFor="storyDescription" className="block text-sm font-medium text-gray-400 mt-4 mb-1">Descrição</label>
                        <textarea
                            id="storyDescription"
                            value={suggestedStory ?? originalStory.description}
                            onChange={(e) => props.setOriginalStory({ ...originalStory, description: e.target.value })}
                            className="w-full p-3 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-purple-500 transition text-gray-300 resize-y flex-grow"
                        />
                    </div>
                ) : (
                    <div className="flex flex-col flex-grow">
                         <div className="flex justify-between items-center mb-2">
                             <h3 className="text-lg font-medium text-gray-300">{featureDescription}</h3>
                             <button onClick={() => handleCopyToClipboard(fullFeatureFile)} title="Copiar Feature Completa" className="text-gray-400 hover:text-white transition">
                                {copied ? <ClipboardCheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                            </button>
                         </div>
                        <div className="bg-gray-900/50 p-3 rounded-md flex-grow overflow-y-auto">
                            <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                                {bddScenarios.map(s => s.gherkin ?? `Cenário: ${s.title}`).join('\n\n')}
                            </pre>
                        </div>
                    </div>
                )}
            </div>

            {/* Right Panel: AI Tools */}
            <div className="bg-gray-800/50 p-6 rounded-lg flex flex-col">
                <WizardStepper mode={planningMode} activeStepName={getActiveStepName()} />
                <div className="border-b border-gray-700 mb-4">
                    <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                        <TabButton tabName="assistant" label="Assistente IA" />
                        <TabButton tabName="tests" label={planningMode === 'story' ? "Testes" : "Steps"} />
                        {planningMode === 'story' && <TabButton tabName="complexity" label="Complexidade" />}
                        <TabButton tabName="prototype" label="Protótipo" />
                    </nav>
                </div>
                <div className="flex-grow overflow-y-auto">
                    {activeTab === 'assistant' && <AIAssistantTab {...props} />}
                    
                    {activeTab === 'tests' && (
                         <div>
                            <h3 className="text-lg font-semibold text-cyan-300 mb-2">Gerador de Cenários de Teste</h3>
                            <p className="text-gray-400 mb-4 text-sm">Crie cenários de teste (caminho feliz, casos de borda, negativos) com base no estado atual da história.</p>
                             <button onClick={props.handleGenerateScenarios} disabled={props.isGeneratingScenarios} className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-bold py-2 px-4 rounded transition">
                                <ClipboardListIcon className="w-5 h-5" />
                                {props.isGeneratingScenarios ? 'Gerando...' : 'Gerar Cenários de Teste'}
                            </button>
                            {props.testScenarios && (
                                <div className="mt-4 p-3 bg-gray-900/50 rounded-md">
                                    <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">{props.testScenarios}</pre>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'complexity' && (
                        <div>
                            <h3 className="text-lg font-semibold text-cyan-300 mb-2">Análise de Complexidade</h3>
                            <p className="text-gray-400 mb-4 text-sm">Verifique se a história é muito complexa (um épico) e receba sugestões para quebrá-la.</p>
                             <button onClick={props.handleAnalyzeComplexity} disabled={props.isAnalyzingComplexity} className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-bold py-2 px-4 rounded transition">
                                <ScaleIcon className="w-5 h-5" />
                                {props.isAnalyzingComplexity ? 'Analisando...' : 'Analisar Complexidade'}
                            </button>
                             {props.complexityAnalysis && (
                                <div className="mt-4 p-3 bg-gray-900/50 rounded-md space-y-2">
                                     <p><strong>Classificação:</strong> <span className={`font-bold ${props.complexityAnalysis.complexity === 'Alta' ? 'text-red-400' : props.complexityAnalysis.complexity === 'Média' ? 'text-yellow-400' : 'text-green-400'}`}>{props.complexityAnalysis.complexity}</span></p>
                                     <p><strong>Justificativa:</strong> {props.complexityAnalysis.justification}</p>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {activeTab === 'prototype' && (
                        <div>
                            <h3 className="text-lg font-semibold text-cyan-300 mb-2">Protótipo Visual</h3>
                            <p className="text-gray-400 mb-4 text-sm">Gere um protótipo visual (HTML/Tailwind) para validar a interface e o fluxo do usuário.</p>
                             <button onClick={props.handleGeneratePrototype} disabled={props.isGeneratingPrototype} className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-bold py-2 px-4 rounded transition">
                                <CodeIcon className="w-5 h-5" />
                                {props.isGeneratingPrototype ? 'Gerando...' : 'Gerar Protótipo'}
                            </button>
                            <div className="mt-4 text-xs text-gray-500 flex items-center gap-2">
                                <InformationCircleIcon className="w-4 h-4" />
                                <span>O protótipo será aberto em um modal.</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WorkspaceView;