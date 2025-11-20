
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Persona, ParsedStory, ConversationTurn, ComplexityAnalysisResult } from '../types';
import { personaDetails, UserIcon, SparklesIcon, ClipboardIcon, ClipboardCheckIcon, ClipboardListIcon, ScaleIcon, CodeIcon, DocumentTextIcon, CheckCircleIcon, InformationCircleIcon, SwitchHorizontalIcon, XIcon, LightBulbIcon, FlowIcon, ShareIcon, BookOpenIcon } from './icons';
import WizardStepper from './WizardStepper';
import DiagramViewer from './DiagramViewer';

type WorkspaceViewProps = {
    planningMode: 'story' | 'bdd';
    originalStory: ParsedStory | null;
    featureDescription: string;
    bddScenarios: { id: number; title: string; gherkin: string | null; completed: boolean; type: 'scenario' | 'outline' }[];
    conversation: ConversationTurn[];
    conversationInsights: string | null;
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
    userFlowDiagram?: string | null;
    isGeneratingDiagram?: boolean;

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
    handleGenerateDiagram?: () => void;
    onOpenExport?: () => void;
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

const PersonaConfiguration = ({ onStart }: { onStart: (personas: Persona[]) => void }) => {
    const [selected, setSelected] = useState<Persona[]>([Persona.Dev, Persona.QA]);
    
    const togglePersona = (p: Persona) => {
        if (selected.includes(p)) {
            setSelected(selected.filter(x => x !== p));
        } else {
            setSelected([...selected, p]);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full p-6">
            <h3 className="text-xl font-semibold text-purple-300 mb-6">Quem deve participar do refinamento?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 w-full max-w-2xl">
                {Object.values(Persona).map((p) => (
                    <button
                        key={p}
                        onClick={() => togglePersona(p)}
                        className={`flex items-center p-4 rounded-lg border transition-all ${
                            selected.includes(p) 
                                ? 'bg-purple-900/40 border-purple-500 shadow-lg shadow-purple-900/20' 
                                : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                        }`}
                    >
                        <div className={`w-6 h-6 rounded border flex items-center justify-center mr-3 ${
                            selected.includes(p) ? 'bg-purple-500 border-purple-500 text-white' : 'border-gray-500'
                        }`}>
                            {selected.includes(p) && <CheckCircleIcon className="w-4 h-4" />}
                        </div>
                        <span className={selected.includes(p) ? 'text-white font-medium' : 'text-gray-400'}>{p}</span>
                    </button>
                ))}
            </div>
            <button
                onClick={() => onStart(selected)}
                disabled={selected.length === 0}
                className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transform transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Iniciar Sessão de Planejamento
            </button>
        </div>
    );
};

const SuggestionReviewer = ({ suggestion, currentStoryText, onAccept, onDiscard, onRefine, isRefining }: any) => {
    const [mode, setMode] = useState<'preview' | 'diff'>('preview');
    const [refineInput, setRefineInput] = useState('');

    const handleRefine = () => {
        if(refineInput.trim()) { 
            onRefine(suggestion, refineInput); 
            setRefineInput(''); 
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
            <div className="flex justify-between items-center p-4 bg-gray-800 border-b border-gray-700">
                <h3 className="font-semibold text-purple-300 flex items-center gap-2">
                    <SparklesIcon className="w-5 h-5" />
                    Sugestão de Nova Versão
                </h3>
                <div className="flex bg-gray-900 rounded-lg p-1">
                    <button onClick={() => setMode('preview')} className={`px-3 py-1 text-sm rounded-md transition ${mode === 'preview' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}>Preview</button>
                    <button onClick={() => setMode('diff')} className={`px-3 py-1 text-sm rounded-md transition ${mode === 'diff' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}>Comparar</button>
                </div>
            </div>
            
            <div className="flex-grow overflow-auto p-4">
                {mode === 'preview' ? (
                    <div className="prose prose-invert max-w-none whitespace-pre-wrap text-sm text-gray-300">
                        {suggestion}
                    </div>
                ) : (
                     <div className="text-sm font-mono">
                        {generateDiff(currentStoryText, suggestion).map((line, i) => (
                            <div key={i} className={`${line.type === 'added' ? 'bg-green-900/30 text-green-300' : line.type === 'removed' ? 'bg-red-900/30 text-red-300' : 'text-gray-500'} px-2 py-0.5`}>
                                <span className="inline-block w-4 select-none opacity-50">{line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}</span>
                                {line.value}
                            </div>
                        ))}
                     </div>
                )}
            </div>

            <div className="p-4 bg-gray-800 border-t border-gray-700 space-y-4">
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={refineInput}
                        onChange={(e) => setRefineInput(e.target.value)}
                        placeholder="Ex: Adicione critério de performance, remova a parte de login..."
                        className="flex-grow bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-300 focus:ring-2 focus:ring-purple-500 outline-none"
                        onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                    />
                    <button 
                        onClick={handleRefine}
                        disabled={isRefining || !refineInput.trim()}
                        className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium transition disabled:opacity-50"
                    >
                        {isRefining ? 'Refinando...' : 'Refinar'}
                    </button>
                </div>
                <div className="flex justify-end gap-3">
                    <button onClick={onDiscard} className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md text-sm transition">Descartar</button>
                    <button onClick={() => onAccept(suggestion)} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md text-sm font-bold transition shadow-lg">Aceitar Nova Versão</button>
                </div>
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
    const [visibleInsights, setVisibleInsights] = useState<Record<number, boolean>>({});

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

    const toggleInsight = (id: number) => {
        setVisibleInsights(prev => ({ ...prev, [id]: !prev[id] }));
    };

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

                    const borderColorClass = personaDetails[turn.persona]?.color 
                        ? `border-l-4 ${personaDetails[turn.persona].color.replace('border-', 'border-l-')}`
                        : 'border-l-4 border-gray-700';

                    return (
                        <div key={turn.id}>
                            {/* Persona Question */}
                            <div className="flex items-start gap-4">
                                <PersonaAvatar persona={turn.persona} />
                                <div className={`flex-grow bg-gray-900/70 p-4 rounded-lg rounded-tl-none relative ${borderColorClass}`}>
                                    <div className="flex justify-between items-center">
                                        <p className="font-bold text-cyan-300">{turn.persona}</p>
                                        <button onClick={() => handleCopy(turn.question, turn.id)} className="text-gray-400 hover:text-white transition-colors">
                                            {copiedTurnId === turn.id ? <ClipboardCheckIcon className="w-4 h-4 text-green-400" /> : <ClipboardIcon className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <p className="text-gray-200 mt-2 text-sm whitespace-pre-wrap">{turn.question}</p>
                                    
                                    {turn.educationalInsight && (
                                        <div className="mt-3">
                                            <button 
                                                onClick={() => toggleInsight(turn.id)}
                                                className="text-xs flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors"
                                            >
                                                <InformationCircleIcon className="w-4 h-4" />
                                                {visibleInsights[turn.id] ? "Ocultar dica de Coach" : "Ver dica de Coach"}
                                            </button>
                                            {visibleInsights[turn.id] && (
                                                <div className="mt-2 p-3 bg-purple-900/20 rounded border border-purple-500/30 text-xs text-purple-200 animate-fade-in-up">
                                                    <span className="font-bold">Insight:</span> {turn.educationalInsight}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* User Answer */}
                            {turn.answer && (
                                <div className="flex items-start gap-4 mt-4 flex-row-reverse">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center border-2 border-gray-600">
                                        <UserIcon className="w-5 h-5 text-gray-400" />
                                    </div>
                                    <div className="flex-grow bg-gray-800 p-4 rounded-lg rounded-tr-none border-l-4 border-gray-600">
                                        <p className="font-bold text-gray-400 text-right">Você (PO)</p>
                                        <p className="text-gray-300 mt-2 text-sm whitespace-pre-wrap">{turn.answer}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
                <div ref={conversationEndRef} />
            </div>

            {/* Input Area */}
            {isAnswering && (
                <div className="mt-4 pt-4 border-t border-gray-800 animate-pulse">
                    <p className="text-center text-gray-400 text-sm">A IA está formulando a próxima pergunta...</p>
                </div>
            )}

            {!allSatisfied && currentTurn && !currentTurn.answer && !isAnswering && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                    <textarea
                        className="w-full p-3 bg-gray-800 border border-gray-700 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-gray-300 resize-none"
                        rows={3}
                        placeholder="Sua resposta..."
                        value={currentAnswer}
                        onChange={(e) => setCurrentAnswer(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAnswerSubmit();
                            }
                        }}
                    />
                    <div className="flex justify-end gap-3 mt-3">
                        <button 
                            onClick={handleSkip}
                            className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium transition"
                        >
                            Pular / Não sei
                        </button>
                        <button 
                            onClick={handleAnswerSubmit}
                            disabled={!currentAnswer.trim()}
                            className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-6 rounded-md shadow-lg transform transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            Enviar Resposta
                        </button>
                    </div>
                </div>
            )}

            {allSatisfied && !isAnswering && (
                <div className="mt-6 p-6 bg-gray-800 rounded-lg text-center border border-gray-700">
                    <SparklesIcon className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-white mb-2">Refinamento Concluído!</h3>
                    <p className="text-gray-400 text-sm mb-6">Você esclareceu todos os pontos com a equipe.</p>
                    
                    {planningMode === 'story' ? (
                        <button
                            onClick={handleGetSuggestion}
                            disabled={isSuggesting}
                            className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transform transition hover:scale-105 disabled:opacity-50 w-full md:w-auto"
                        >
                            {isSuggesting ? 'Gerando Nova Versão...' : 'Gerar Nova Versão da História'}
                        </button>
                    ) : (
                        <div className="flex flex-col gap-3 justify-center">
                             {generatedSingleGherkin ? (
                                <div className="w-full text-left bg-gray-900 p-4 rounded-md border border-gray-700 mb-4">
                                    <div className="flex justify-between mb-2">
                                        <span className="text-xs font-bold text-gray-500 uppercase">Gherkin Gerado</span>
                                        <button onClick={() => handleCopy(generatedSingleGherkin)} className="text-gray-400 hover:text-white"><ClipboardIcon className="w-4 h-4" /></button>
                                    </div>
                                    <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap overflow-auto max-h-40">{generatedSingleGherkin}</pre>
                                </div>
                            ) : null}
                            <button
                                onClick={handleGenerateGherkin}
                                disabled={isGeneratingGherkin}
                                className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transform transition hover:scale-105 disabled:opacity-50 w-full md:w-auto"
                            >
                                {isGeneratingGherkin ? 'Gerando Gherkin...' : 'Gerar Cenário Gherkin'}
                            </button>
                            {generatedSingleGherkin && (
                                <button
                                    onClick={handleCompleteBddPlanning}
                                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transform transition hover:scale-105 w-full md:w-auto"
                                >
                                    Concluir e Salvar Cenário
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};


const WorkspaceView: React.FC<WorkspaceViewProps> = (props) => {
    const {
        planningMode,
        originalStory,
        featureDescription,
        suggestedStory,
        bddScenarios,
        testScenarios,
        isGeneratingScenarios,
        handleGenerateScenarios,
        complexityAnalysis,
        isAnalyzingComplexity,
        handleAnalyzeComplexity,
        isGeneratingPrototype,
        handleGeneratePrototype,
        conversationInsights,
        setOriginalStory,
        setFeatureDescription,
        handleCopy,
        userFlowDiagram,
        isGeneratingDiagram,
        handleGenerateDiagram,
        onOpenExport
    } = props;

    const [activeTab, setActiveTab] = useState<'story' | 'assistant' | 'tools'>('assistant');
    const [showDiff, setShowDiff] = useState(false);

    // Determines what text to show in the story/feature panel
    const currentText = planningMode === 'story' 
        ? (suggestedStory || originalStory?.description || '') 
        : featureDescription;
    
    const title = planningMode === 'story' ? (originalStory?.title || 'Sem Título') : 'Planejamento BDD';

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] max-h-[calc(100vh-140px)]">
            <div className="flex justify-between items-center mb-6">
                <div className="flex-grow">
                    <WizardStepper mode={planningMode} activeStepName={activeTab === 'story' ? (planningMode === 'story' ? 'História' : 'Feature') : activeTab === 'assistant' ? (planningMode === 'story' ? 'Perguntas' : 'Cenários') : 'Testes'} />
                </div>
                {onOpenExport && (
                    <button
                        onClick={onOpenExport}
                        className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition-transform transform hover:scale-105 ml-4"
                        title="Exportar artefatos para Jira, Markdown ou HTML"
                    >
                        <ShareIcon className="w-5 h-5" />
                        <span className="hidden md:inline">Exportar Artefatos</span>
                    </button>
                )}
            </div>
            
            <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-6 h-full overflow-hidden">
                {/* Left Panel: Context (Story/Feature) - Hidden on mobile if not active tab */}
                <div className={`lg:col-span-4 flex flex-col bg-gray-800 rounded-lg shadow-xl border border-gray-700 h-full overflow-hidden ${activeTab !== 'story' ? 'hidden lg:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                        <h3 className="font-bold text-gray-200 flex items-center gap-2">
                            {planningMode === 'story' ? <BookOpenIcon className="w-5 h-5 text-cyan-300" /> : <DocumentTextIcon className="w-5 h-5 text-yellow-300" />}
                            {planningMode === 'story' ? 'História de Usuário' : 'Funcionalidade (BDD)'}
                        </h3>
                         <div className="flex gap-2">
                            {suggestedStory && planningMode === 'story' && (
                                <button onClick={() => setShowDiff(true)} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="Comparar com original">
                                    <SwitchHorizontalIcon className="w-5 h-5" />
                                </button>
                            )}
                            <button onClick={() => handleCopy(currentText)} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="Copiar texto">
                                <ClipboardIcon className="w-5 h-5" />
                            </button>
                         </div>
                    </div>
                    <div className="flex-grow p-4 overflow-y-auto">
                        {planningMode === 'story' && (
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Título</label>
                                <input
                                    type="text"
                                    value={originalStory?.title || ''}
                                    onChange={(e) => originalStory && setOriginalStory({ ...originalStory, title: e.target.value })}
                                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-200 focus:ring-1 focus:ring-purple-500 outline-none"
                                />
                            </div>
                        )}
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Descrição</label>
                        <textarea
                            value={currentText}
                            onChange={(e) => {
                                if (planningMode === 'story' && originalStory) {
                                    // If editing suggested story, we treat it as updating the suggestion essentially?
                                    // But props don't allow updating suggestion directly easily here without callback.
                                    // Assuming user edits original if no suggestion, or we need a way to update.
                                    // For simplicity, if suggestedStory exists, we can't edit it here directly in this view without a setter.
                                    // Let's assume we edit original description for now or feature description.
                                    if (!suggestedStory) setOriginalStory({ ...originalStory, description: e.target.value });
                                } else {
                                    setFeatureDescription(e.target.value);
                                }
                            }}
                            readOnly={!!suggestedStory && planningMode === 'story'} // Read only if it's a suggestion, use reviewer to edit
                            className="w-full h-[calc(100%-80px)] bg-gray-900 border border-gray-700 rounded p-3 text-gray-300 text-sm resize-none focus:ring-1 focus:ring-purple-500 outline-none"
                        />
                    </div>
                    
                    {/* Conversation Insights Summary (Mini) */}
                    {conversationInsights && (
                        <div className="p-4 border-t border-gray-700 bg-yellow-900/10">
                            <h4 className="text-xs font-bold text-yellow-500 uppercase mb-2 flex items-center gap-1">
                                <LightBulbIcon className="w-4 h-4" />
                                Pontos de Atenção
                            </h4>
                            <div className="text-xs text-gray-400 max-h-32 overflow-y-auto whitespace-pre-wrap">
                                {conversationInsights}
                            </div>
                        </div>
                    )}
                </div>

                {/* Center/Right Panel: Main Workspace (Chat or Tools) */}
                <div className={`lg:col-span-8 flex flex-col h-full overflow-hidden ${activeTab === 'story' ? 'hidden lg:flex' : 'flex'}`}>
                    {/* Mobile Tab Switcher */}
                    <div className="lg:hidden flex border-b border-gray-700 bg-gray-800 mb-2">
                        <button onClick={() => setActiveTab('story')} className={`flex-1 py-3 text-sm font-medium ${activeTab === 'story' ? 'text-purple-300 border-b-2 border-purple-500' : 'text-gray-400'}`}>Contexto</button>
                        <button onClick={() => setActiveTab('assistant')} className={`flex-1 py-3 text-sm font-medium ${activeTab === 'assistant' ? 'text-purple-300 border-b-2 border-purple-500' : 'text-gray-400'}`}>Assistente</button>
                        <button onClick={() => setActiveTab('tools')} className={`flex-1 py-3 text-sm font-medium ${activeTab === 'tools' ? 'text-purple-300 border-b-2 border-purple-500' : 'text-gray-400'}`}>Ferramentas</button>
                    </div>

                    {/* Desktop Tabs (only for Tools vs Assistant if needed, but let's keep them together or split) */}
                    {/* Let's use a unified view for desktop, but toggle between Chat and Tools if screen real estate is small, or side-by-side? */}
                    {/* Given the design, let's stick to tabs for the right panel content: Chat vs Tools */}
                    <div className="hidden lg:flex border-b border-gray-700 bg-gray-800 rounded-t-lg mx-1">
                        <button onClick={() => setActiveTab('assistant')} className={`px-6 py-3 text-sm font-medium flex items-center gap-2 ${activeTab === 'assistant' ? 'text-cyan-300 bg-gray-900 border-t-2 border-cyan-500' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>
                            <SparklesIcon className="w-4 h-4" />
                            Assistente de Refinamento
                        </button>
                        <button onClick={() => setActiveTab('tools')} className={`px-6 py-3 text-sm font-medium flex items-center gap-2 ${activeTab === 'tools' ? 'text-purple-300 bg-gray-900 border-t-2 border-purple-500' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>
                            <CodeIcon className="w-4 h-4" />
                            Ferramentas & Validação
                        </button>
                    </div>

                    <div className="flex-grow bg-gray-800 lg:rounded-b-lg lg:mx-1 shadow-xl border border-gray-700 border-t-0 p-4 overflow-hidden flex flex-col">
                        {activeTab === 'assistant' && (
                            <AIAssistantTab {...props} />
                        )}
                        
                        {activeTab === 'tools' && (
                             <div className="h-full overflow-y-auto pr-2 space-y-6">
                                {/* Tools Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* 1. Test Scenarios */}
                                    <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="font-bold text-green-400 flex items-center gap-2">
                                                <ClipboardListIcon className="w-5 h-5" />
                                                Cenários de Teste
                                            </h4>
                                            {testScenarios && (
                                                <button onClick={() => handleCopy(testScenarios)} className="text-gray-400 hover:text-white"><ClipboardIcon className="w-4 h-4" /></button>
                                            )}
                                        </div>
                                        {testScenarios ? (
                                            <pre className="text-xs text-gray-300 whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar">{testScenarios}</pre>
                                        ) : (
                                            <div className="text-center py-8 text-gray-500 text-sm">
                                                Nenhum cenário gerado ainda.
                                            </div>
                                        )}
                                        <button 
                                            onClick={handleGenerateScenarios} 
                                            disabled={isGeneratingScenarios}
                                            className="w-full mt-4 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-sm font-medium transition disabled:opacity-50"
                                        >
                                            {isGeneratingScenarios ? 'Gerando...' : 'Gerar Cenários de QA'}
                                        </button>
                                    </div>

                                    {/* 2. Complexity Analysis (Only for Story Mode) */}
                                    {planningMode === 'story' && (
                                        <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="font-bold text-yellow-400 flex items-center gap-2">
                                                    <ScaleIcon className="w-5 h-5" />
                                                    Análise de Complexidade
                                                </h4>
                                            </div>
                                            {complexityAnalysis ? (
                                                <div className="text-sm text-gray-300 space-y-2">
                                                    <p><span className="font-bold text-gray-400">Nível:</span> <span className={`${complexityAnalysis.complexity === 'Alta' ? 'text-red-400' : complexityAnalysis.complexity === 'Média' ? 'text-yellow-400' : 'text-green-400'}`}>{complexityAnalysis.complexity}</span></p>
                                                    <p><span className="font-bold text-gray-400">Justificativa:</span> {complexityAnalysis.justification}</p>
                                                    {complexityAnalysis.complexity === 'Alta' && <p className="text-xs text-red-300 mt-2 italic">Recomendado quebrar esta história.</p>}
                                                </div>
                                            ) : (
                                                <div className="text-center py-8 text-gray-500 text-sm">
                                                    Análise não realizada.
                                                </div>
                                            )}
                                            <button 
                                                onClick={handleAnalyzeComplexity} 
                                                disabled={isAnalyzingComplexity}
                                                className="w-full mt-4 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-sm font-medium transition disabled:opacity-50"
                                            >
                                                {isAnalyzingComplexity ? 'Analisando...' : 'Verificar Complexidade (INVEST)'}
                                            </button>
                                        </div>
                                    )}

                                    {/* 3. Visual Prototype */}
                                    <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="font-bold text-cyan-400 flex items-center gap-2">
                                                <CodeIcon className="w-5 h-5" />
                                                Protótipo Visual
                                            </h4>
                                        </div>
                                        <div className="text-center py-6 text-gray-500 text-sm">
                                            Gera uma visualização HTML/Tailwind baseada nos requisitos atuais.
                                        </div>
                                        <button 
                                            onClick={handleGeneratePrototype} 
                                            disabled={isGeneratingPrototype}
                                            className="w-full mt-auto bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-sm font-medium transition disabled:opacity-50"
                                        >
                                            {isGeneratingPrototype ? 'Criando...' : 'Gerar Protótipo (Preview)'}
                                        </button>
                                    </div>

                                    {/* 4. User Flow Diagram */}
                                     {planningMode === 'story' && (
                                        <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="font-bold text-pink-400 flex items-center gap-2">
                                                    <FlowIcon className="w-5 h-5" />
                                                    Fluxo do Usuário
                                                </h4>
                                            </div>
                                            <div className="h-48 bg-gray-800 rounded border border-gray-600 overflow-hidden flex items-center justify-center relative">
                                                 {userFlowDiagram ? (
                                                     <DiagramViewer code={userFlowDiagram} className="w-full h-full" />
                                                 ) : (
                                                     <span className="text-gray-500 text-xs">Gere o diagrama para visualizar o fluxo.</span>
                                                 )}
                                            </div>
                                            <button 
                                                onClick={handleGenerateDiagram} 
                                                disabled={isGeneratingDiagram}
                                                className="w-full mt-4 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-sm font-medium transition disabled:opacity-50"
                                            >
                                                {isGeneratingDiagram ? 'Gerando...' : 'Gerar Diagrama de Fluxo'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                             </div>
                        )}
                    </div>
                </div>
            </div>
            
            {showDiff && originalStory && planningMode === 'story' && suggestedStory && (
                <DiffModal 
                    oldText={originalStory.description} 
                    newText={suggestedStory} 
                    onClose={() => setShowDiff(false)} 
                />
            )}
        </div>
    );
};

export default WorkspaceView;