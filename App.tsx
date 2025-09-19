

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Persona, ParsedStory, RedmineIssue, ConversationTurn, ComplexityAnalysisResult, SplitStory, BddFeatureSuggestion, GherkinScenario } from './types';
import { generateInitialQuestions, suggestNewStoryVersion, generateFollowUpQuestion, generateNewStory, refineSuggestedStory, generateTestScenarios, analyzeStoryComplexity, generateStoriesFromTranscript, generatePrototype, generateBddScenarios, generateBddFollowUpQuestion, generateGherkinFromConversation, generatePoChecklist, generateStepDefinitions, convertDocumentToBdd, analyzeAndBreakdownDocument, analyzePlanningTranscript, analyzeHomologationTranscript, generatePrototypeFromFeature, generateBddFollowUpQuestionForGroup, generateGherkinFromGroupConversation, extractTableColumnsFromQuestion, generateInitialScenarioOutline } from './services/geminiService';
import { personaDetails, UserIcon, BookOpenIcon, XIcon, MenuIcon, SparklesIcon, HomeIcon, ClipboardIcon, ClipboardCheckIcon, ClipboardListIcon, InformationCircleIcon, ScaleIcon, MicrophoneIcon, TemplateIcon, ViewBoardsIcon, DocumentTextIcon, CheckCircleIcon, PencilIcon, TrashIcon, CodeIcon, SwitchHorizontalIcon, DownloadIcon, TableIcon, PlusIcon, ArrowLeftIcon } from './components/icons';
import DataTableModal from './components/DataTableModal';
import Breadcrumbs from './components/Breadcrumbs';


type BddScenario = {
    id: number;
    title: string;
    gherkin: string | null;
    completed: boolean;
    type: 'scenario' | 'outline';
};

type ConfirmationAction = {
    title: string;
    message: string;
    onConfirm: () => void;
} | null;

type TranscriptionMode = 'requirements' | 'planning' | 'homologation';

type AppState = 'home' | 'refining' | 'generating' | 'transcribing_context' | 'transcribing_input' | 'transcribing_review' | 'bdd_input' | 'bdd_scenarios' | 'bdd_review' | 'bdd_converting_doc_input' | 'bdd_breakdown_review' | 'bdd_feature_selection' | 'bdd_converting_doc_review' | 'loading_generation' | 'loading_transcription' | 'loading_bdd_scenarios' | 'loading_bdd_breakdown' | 'loading_bdd_conversion' | 'loading_outline_generation' | 'scenario_outline_editor' | 'reviewing' | 'configuring' | 'loading' | 'planning' | 'error' | 'analyzing_complexity' | 'story_selection';

const translateStateToFriendlyName = (state: AppState): string => {
    const nameMap: Record<AppState, string> = {
        'home': 'Início',
        'refining': 'Refinar História',
        'generating': 'Gerar História',
        'transcribing_context': 'Analisar Transcrição',
        'transcribing_input': 'Entrada da Transcrição',
        'transcribing_review': 'Revisão da Análise',
        'bdd_input': 'Criar Feature BDD',
        'bdd_scenarios': 'Lista de Cenários',
        'bdd_review': 'Revisão BDD',
        'bdd_converting_doc_input': 'Converter Documento',
        'bdd_breakdown_review': 'Análise do Documento',
        'bdd_feature_selection': 'Seleção de Feature',
        'bdd_converting_doc_review': 'Revisão da Conversão',
        'reviewing': 'Revisar História Gerada',
        'configuring': 'Configurar Sessão',
        'planning': 'Sessão de Planejamento',
        'story_selection': 'Seleção de História',
        'scenario_outline_editor': 'Editor de Cenário',
        'loading_generation': 'Gerando...',
        'loading_transcription': 'Analisando...',
        'loading_bdd_scenarios': 'Gerando Cenários...',
        'loading_bdd_breakdown': 'Analisando Documento...',
        'loading_bdd_conversion': 'Convertendo...',
        'loading_outline_generation': 'Gerando Template...',
        'loading': 'Carregando...',
        'analyzing_complexity': 'Analisando...',
        'error': 'Erro'
    };
    return nameMap[state] || state;
};


const GherkinContent = ({ text }: { text: string }) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let inDocString = false;

    const docStringStyle = "block bg-gray-700/50 text-cyan-300 px-2";
    const tableRowStyle = "block font-mono";
    const normalStyle = "block";

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        const isBoundary = trimmedLine === '"""';
        const isTableRow = trimmedLine.startsWith('|') && trimmedLine.endsWith('|');

        if (isBoundary) {
            elements.push(<span key={i} className={docStringStyle}>{line}</span>);
            inDocString = !inDocString;
        } else if (inDocString) {
            elements.push(<span key={i} className={docStringStyle}>{line || '\u00A0'}</span>);
        } else if (isTableRow) {
            elements.push(<span key={i} className={tableRowStyle}>{line}</span>);
        } else {
            elements.push(<span key={i} className={normalStyle}>{line}</span>);
        }
    }
    return <>{elements}</>;
};

const personaToKey = (p: Persona): string => {
    switch(p) {
        case Persona.Dev: return 'developerQuestion';
        case Persona.QA: return 'qaQuestion';
        case Persona.Architect: return 'architectQuestion';
        case Persona.UX: return 'uxQuestion';
        case Persona.DevOps: return 'devopsQuestion';
        default: return 'genericQuestion';
    }
};

const Header = ({ onHomeClick, showHomeButton, homeButtonText, onBack, showBack }: { onHomeClick: () => void; showHomeButton: boolean; homeButtonText: string; onBack: () => void; showBack: boolean; }) => (
    <header className="relative bg-gray-900/80 backdrop-blur-sm p-4 border-b border-gray-700 sticky top-0 z-20 flex items-center justify-center h-[85px]">
        {showBack && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <button 
                    onClick={onBack}
                    className="flex items-center gap-2 text-sm text-gray-300 hover:text-purple-300 transition-colors py-1 px-3 rounded-md hover:bg-gray-700/50"
                    title="Voltar"
                >
                    <ArrowLeftIcon className="w-5 h-5" />
                    <span>Voltar</span>
                </button>
            </div>
        )}
        <div className="text-center">
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                Aprimorador de Histórias de Usuário
            </h1>
            <p className="text-center text-gray-400 text-sm mt-1">Gere e refine histórias de usuário com o poder da IA</p>
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-4">
            {showHomeButton && (
                <button 
                    onClick={onHomeClick}
                    className="flex items-center gap-2 text-sm text-gray-300 hover:text-purple-300 transition-colors py-1 px-3 rounded-md hover:bg-gray-700/50"
                    title={homeButtonText}
                >
                    <HomeIcon className="w-5 h-5" />
                    <span>{homeButtonText}</span>
                </button>
            )}
        </div>
    </header>
);

const FeaturesModal = ({ onClose }: { onClose: () => void; }) => (
    <div 
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 transition-opacity duration-300"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6 border border-gray-700 relative animate-fade-in-up"
        onClick={e => e.stopPropagation()} 
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-gray-700 z-10"
          aria-label="Fechar modal"
        >
          <XIcon className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-3 mb-4">
            <InformationCircleIcon className="w-8 h-8 text-cyan-300"/>
            <h3 className="text-xl font-semibold text-purple-300">Funcionalidades da Aplicação</h3>
        </div>
        <div className="max-h-[70vh] overflow-y-auto pr-4 space-y-4 text-gray-300">
            <div>
                <h4 className="font-bold text-cyan-300">Modos de Início</h4>
                <ul className="list-disc list-inside space-y-1 mt-1">
                    <li><span className="font-semibold">Refinar História Existente:</span> Cole o JSON do Redmine ou o texto bruto de uma história para análise.</li>
                    <li><span className="font-semibold">Gerar Nova História:</span> Descreva requisitos para que a IA crie uma história do zero.</li>
                    <li>
                        <span className="font-semibold">Analisar Transcrição (Contextual):</span> Analise transcrições com objetivos específicos.
                        <ul className="list-[circle] list-inside ml-4 mt-1 text-gray-400">
                            <li><span className="font-semibold text-gray-300">Levantamento de Requisitos:</span> Gera novas histórias a partir da discussão.</li>
                            <li><span className="font-semibold text-gray-300">Reunião de Planejamento:</span> Valida uma história existente contra o que foi discutido.</li>
                            <li><span className="font-semibold text-gray-300">Sessão de Homologação:</span> Extrai feedback e pontos de ação.</li>
                        </ul>
                    </li>
                    <li><span className="font-semibold">Criar Feature BDD:</span> A partir de uma descrição, a IA sugere cenários. Você pode então revisar, editar, adicionar, remover e detalhar cada cenário (incluindo a criação de 'Scenario Outlines' com tabelas de exemplos) para gerar um arquivo .feature completo.</li>
                    <li><span className="font-semibold">Converter Documento para BDD:</span> Cole um documento de requisitos tradicional para que a IA o analise, sugira uma quebra em features menores e o transforme em um arquivo .feature.</li>
                </ul>
            </div>
            <div>
                <h4 className="font-bold text-cyan-300">Configuração Global (na Tela Inicial)</h4>
                <ul className="list-disc list-inside space-y-1 mt-1">
                    <li><span className="font-semibold">Modelo de História:</span> Defina um modelo de formatação que a IA usará para todas as histórias geradas na sessão.</li>
                    <li><span className="font-semibold">Modelo de Protótipo:</span> Defina um código de exemplo para que a IA siga o seu design system.</li>
                </ul>
            </div>
            <div>
                <h4 className="font-bold text-cyan-300">Sessão de Planejamento Simulada</h4>
                <ul className="list-disc list-inside space-y-1 mt-1">
                    <li><span className="font-semibold">Configuração Flexível:</span> Selecione as personas (Dev, QA, Arquiteto, UX, DevOps) e arraste para definir a ordem das perguntas.</li>
                    <li><span className="font-semibold">Perguntas Contextuais:</span> A IA faz perguntas sequenciais com base nas personas e na conversa.</li>
                    <li><span className="font-semibold">Inserção de Tabelas:</span> Quando a IA pede dados tabulares, um botão aparece para abrir um modal de edição de tabelas, inserindo os dados formatados na sua resposta.</li>
                    <li><span className="font-semibold">Análise de Complexidade (Anti-Épico):</span> Identifique histórias muito grandes e receba sugestões para quebrá-las. Refine cada nova história individualmente.</li>
                    <li><span className="font-semibold">Planejamento BDD em Grupo:</span> Selecione múltiplos cenários para discuti-los em uma única sessão de planejamento, otimizando o tempo.</li>
                </ul>
            </div>
            <div>
                <h4 className="font-bold text-cyan-300">Refinamento Iterativo</h4>
                <ul className="list-disc list-inside space-y-1 mt-1">
                    <li><span className="font-semibold">Sugestão do PO Sênior:</span> Peça uma nova versão da história com base nas suas respostas.</li>
                    <li><span className="font-semibold">Modificações Contínuas:</span> Dê instruções para a IA refinar a sugestão quantas vezes forem necessárias.</li>
                </ul>
            </div>
             <div>
                <h4 className="font-bold text-cyan-300">Ferramentas de Validação e Suporte</h4>
                <ul className="list-disc list-inside space-y-1 mt-1">
                    <li><span className="font-semibold">Geração de Cenários de Teste:</span> Gere cenários de teste (caminho feliz, casos de borda, negativos) para a versão atual da história a qualquer momento.</li>
                     <li><span className="font-semibold">Prototipagem Visual com IA:</span> Crie um protótipo visual (HTML/Tailwind CSS) a partir da história de usuário ou de um arquivo .feature completo para acelerar o alinhamento. O protótipo é exibido em um modal com visualização ao vivo e opção de salvar como .html.</li>
                     <li><span className="font-semibold">Checklist de Pré-Homologação (BDD):</span> Gere um roteiro de teste em linguagem natural para o PO validar a entrega a partir do arquivo .feature.</li>
                     <li><span className="font-semibold">Definições de Steps (BDD):</span> Gere o código completo das Step Definitions (JS, Python, Java, PHP, C#) para acelerar a automação de testes.</li>
                </ul>
            </div>
            <div>
                <h4 className="font-bold text-cyan-300">Utilidades</h4>
                <ul className="list-disc list-inside space-y-1 mt-1">
                    <li><span className="font-semibold">Acesso Rápido:</span> Visualize a história original, o cenário atual ou a feature BDD em um modal a qualquer momento.</li>
                    <li><span className="font-semibold">Copiar para a Área de Transferência:</span> Copie facilmente a história original, perguntas, sugestões, testes e protótipos.</li>
                     <li><span className="font-semibold">Navegação Inteligente:</span> Reinicie o processo ou volte para a seleção de histórias quebradas com um botão que se adapta ao contexto.</li>
                </ul>
            </div>
        </div>
      </div>
    </div>
);


const HomeScreen = ({ onChoice, onShowFeatures, onShowModelModal, onShowPrototypeModal }: { onChoice: (choice: 'refining' | 'generating' | 'transcribing_context' | 'bdd_input' | 'bdd_converting_doc_input') => void; onShowFeatures: () => void; onShowModelModal: () => void; onShowPrototypeModal: () => void; }) => (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 -mt-20">
        <div className="w-full max-w-4xl bg-gray-800 rounded-lg shadow-xl p-6 text-center relative">
             <button 
                onClick={onShowFeatures}
                className="absolute top-4 right-4 text-gray-400 hover:text-purple-300 transition-colors"
                title="Funcionalidades da Aplicação"
            >
                <InformationCircleIcon className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-semibold mb-4 text-gray-200">Como você quer começar?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                <button
                    onClick={() => onChoice('refining')}
                    className="flex flex-col items-center justify-center bg-gray-700 hover:bg-gray-600 text-white font-bold py-6 px-6 rounded-md transition-transform transform hover:scale-105"
                >
                    <BookOpenIcon className="w-8 h-8 mx-auto mb-2 text-cyan-300" />
                    Refinar História Existente
                    <p className="text-sm font-normal text-gray-400 mt-1">Cole uma história pronta para ser analisada.</p>
                </button>
                <button
                    onClick={() => onChoice('generating')}
                    className="flex flex-col items-center justify-center bg-gray-700 hover:bg-gray-600 text-white font-bold py-6 px-6 rounded-md transition-transform transform hover:scale-105"
                >
                    <SparklesIcon className="w-8 h-8 mx-auto mb-2 text-purple-300" />
                    Gerar Nova História
                     <p className="text-sm font-normal text-gray-400 mt-1">Descreva os requisitos para a IA criar uma história.</p>
                </button>
                <button
                    onClick={() => onChoice('transcribing_context')}
                    className="flex flex-col items-center justify-center bg-gray-700 hover:bg-gray-600 text-white font-bold py-6 px-6 rounded-md transition-transform transform hover:scale-105"
                >
                    <MicrophoneIcon className="w-8 h-8 mx-auto mb-2 text-green-300" />
                    Analisar Transcrição
                     <p className="text-sm font-normal text-gray-400 mt-1">Transforme uma reunião em propostas de histórias.</p>
                </button>
                <button
                    onClick={() => onChoice('bdd_input')}
                    className="flex flex-col items-center justify-center bg-gray-700 hover:bg-gray-600 text-white font-bold py-6 px-6 rounded-md transition-transform transform hover:scale-105"
                >
                    <DocumentTextIcon className="w-8 h-8 mx-auto mb-2 text-yellow-300" />
                    Criar Feature BDD
                    <p className="text-sm font-normal text-gray-400 mt-1">Guie a IA para criar um arquivo .feature do zero.</p>
                </button>
                <button
                    onClick={() => onChoice('bdd_converting_doc_input')}
                    className="flex flex-col items-center justify-center bg-gray-700 hover:bg-gray-600 text-white font-bold py-6 px-6 rounded-md transition-transform transform hover:scale-105 md:col-span-2 lg:col-span-1"
                >
                    <SwitchHorizontalIcon className="w-8 h-8 mx-auto mb-2 text-orange-300" />
                    Converter Documento para BDD
                    <p className="text-sm font-normal text-gray-400 mt-1">Transforme requisitos legados em um .feature.</p>
                </button>
            </div>
        </div>
        <div className="mt-8 flex justify-center gap-6">
            <button 
                onClick={onShowModelModal}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-purple-300 transition-colors py-2 px-4 rounded-md hover:bg-gray-800/60"
                title="Definir modelo de história para a sessão"
            >
                <TemplateIcon className="w-5 h-5" />
                <span>Definir Modelo de História</span>
            </button>
                <button 
                onClick={onShowPrototypeModal}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-purple-300 transition-colors py-2 px-4 rounded-md hover:bg-gray-800/60"
                title="Definir modelo de protótipo para a sessão"
            >
                <ViewBoardsIcon className="w-5 h-5" />
                <span>Definir Modelo de Protótipo</span>
            </button>
        </div>
    </div>
);


const StoryInput = ({ onStorySubmit }: { onStorySubmit: (story: ParsedStory) => void; }) => {
    const [storyText, setStoryText] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (!storyText.trim()) {
            setError('Por favor, cole sua história de usuário.');
            return;
        }
        setError('');
        try {
            let parsed: ParsedStory;
            try {
                const json: RedmineIssue = JSON.parse(storyText);
                if (json.issue && json.issue.subject && json.issue.description) {
                    parsed = { title: json.issue.subject, description: json.issue.description };
                } else {
                    throw new Error('Invalid Redmine JSON format.');
                }
            } catch (e) {
                const lines = storyText.trim().split('\n');
                const title = lines[0]; 
                const description = lines.slice(1).join('\n');
                if (!title || !description) throw new Error("Could not parse title and description from raw text.");
                parsed = { title, description };
            }
            onStorySubmit(parsed);
        } catch (e) {
            setError("Não foi possível analisar a história. Verifique o formato. Para texto bruto, garanta que o título esteja na primeira linha e a descrição em seguida.");
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 -mt-20">
            <div className="w-full max-w-2xl bg-gray-800 rounded-lg shadow-xl p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-200">Cole sua História de Usuário</h2>
                <p className="text-gray-400 mb-4 text-sm">Você pode colar o JSON exportado do Redmine ou apenas o texto bruto da história.</p>
                <textarea
                    className="w-full h-64 p-3 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition text-gray-300 resize-none"
                    value={storyText}
                    onChange={(e) => setStoryText(e.target.value)}
                    placeholder="Cole sua história aqui..."
                />
                {error && <p className="text-red-400 mt-2 text-sm">{error}</p>}
                <button
                    onClick={handleSubmit}
                    className="mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md transition-transform transform hover:scale-105"
                >
                    Configurar Sessão
                </button>
            </div>
        </div>
    );
};

const GenerateStoryInput = ({ onGenerate }: { onGenerate: (requirements: string) => void; }) => {
    const [requirements, setRequirements] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (!requirements.trim()) {
            setError('Por favor, descreva os requisitos da história.');
            return;
        }
        setError('');
        onGenerate(requirements);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 -mt-20">
            <div className="w-full max-w-2xl bg-gray-800 rounded-lg shadow-xl p-6">
                <h2 className="text-xl font-semibold mb-2 text-gray-200">Gerar Nova História</h2>
                <p className="text-gray-400 mb-4 text-sm">Forneça os detalhes e a IA criará uma história de usuário estruturada para você.</p>
                
                <label className="block mb-2 text-sm font-medium text-gray-300" htmlFor="requirements">Requisitos</label>
                <textarea
                    id="requirements"
                    className="w-full h-40 p-3 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition text-gray-300 resize-y"
                    value={requirements}
                    onChange={(e) => setRequirements(e.target.value)}
                    placeholder="Ex: Como usuário, quero poder redefinir minha senha através de um link enviado para meu e-mail para recuperar o acesso à minha conta."
                />
                {error && <p className="text-red-400 mt-2 text-sm">{error}</p>}

                <button
                    onClick={handleSubmit}
                    className="mt-6 w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md transition-transform transform hover:scale-105"
                >
                    Gerar História
                </button>
            </div>
        </div>
    );
};

const TranscriptionContextScreen = ({ onSelect }: { onSelect: (mode: TranscriptionMode) => void }) => (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 -mt-20">
        <div className="w-full max-w-2xl bg-gray-800 rounded-lg shadow-xl p-6 text-center">
            <h2 className="text-xl font-semibold mb-6 text-gray-200">Qual é o objetivo da análise desta transcrição?</h2>
            <div className="space-y-4">
                <button
                    onClick={() => onSelect('requirements')}
                    className="w-full text-left bg-gray-700 hover:bg-gray-600 text-white p-4 rounded-md transition-colors"
                >
                    <h3 className="font-bold text-cyan-300">Levantamento de Requisitos</h3>
                    <p className="text-sm text-gray-400 mt-1">Gerar novas histórias de usuário a partir da discussão.</p>
                </button>
                <button
                    onClick={() => onSelect('planning')}
                    className="w-full text-left bg-gray-700 hover:bg-gray-600 text-white p-4 rounded-md transition-colors"
                >
                    <h3 className="font-bold text-cyan-300">Reunião de Planejamento</h3>
                    <p className="text-sm text-gray-400 mt-1">Validar uma história de usuário existente contra o que foi discutido.</p>
                </button>
                <button
                    onClick={() => onSelect('homologation')}
                    className="w-full text-left bg-gray-700 hover:bg-gray-600 text-white p-4 rounded-md transition-colors"
                >
                    <h3 className="font-bold text-cyan-300">Sessão de Homologação</h3>
                    <p className="text-sm text-gray-400 mt-1">Extrair feedback e pontos de ação da discussão.</p>
                </button>
            </div>
        </div>
    </div>
);

const TranscriptionInputScreen = ({ 
    mode, 
    onRequirementsSubmit,
    onPlanningSubmit,
    onHomologationSubmit
}: { 
    mode: TranscriptionMode | null;
    onRequirementsSubmit: (transcript: string) => void;
    onPlanningSubmit: (transcript: string, story: string) => void;
    onHomologationSubmit: (transcript: string) => void;
}) => {
    const [transcript, setTranscript] = useState('');
    const [storyToValidate, setStoryToValidate] = useState('');
    const [transcriptError, setTranscriptError] = useState('');
    const [storyError, setStoryError] = useState('');

    if (!mode) return null;

    const titles = {
        requirements: "Analisar Transcrição: Levantamento de Requisitos",
        planning: "Analisar Transcrição: Reunião de Planejamento",
        homologation: "Analisar Transcrição: Sessão de Homologação",
    };

    const descriptions = {
        requirements: "Cole o texto bruto da transcrição e a IA irá identificar temas e sugerir histórias de usuário.",
        planning: "Forneça a transcrição da reunião e a história de usuário que foi discutida para validação.",
        homologation: "Cole a transcrição da sessão de validação para extrair feedbacks e próximos passos.",
    };

    const handleSubmit = () => {
        let hasError = false;
        setTranscriptError('');
        setStoryError('');

        if (!transcript.trim()) {
            setTranscriptError('O campo de transcrição não pode estar vazio.');
            hasError = true;
        }
        
        if (mode === 'planning' && !storyToValidate.trim()) {
            setStoryError('O campo da história de usuário não pode estar vazio.');
            hasError = true;
        }

        if (hasError) return;

        if (mode === 'requirements') {
            onRequirementsSubmit(transcript);
        } else if (mode === 'planning') {
            onPlanningSubmit(transcript, storyToValidate);
        } else if (mode === 'homologation') {
            onHomologationSubmit(transcript);
        }
    };
    
    const renderSingleTextarea = (
        title: string, 
        placeholder: string,
        value: string,
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void,
        error: string,
        id: string = "transcript"
    ) => (
        <>
            <label className="block mb-2 text-sm font-medium text-gray-300" htmlFor={id}>{title}</label>
            <textarea
                id={id}
                className="w-full h-80 p-3 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-purple-500 transition text-gray-300 resize-y"
                value={value}
                onChange={onChange}
                placeholder={placeholder}
            />
            {error && <p className="text-red-400 mt-2 text-sm">{error}</p>}
        </>
    );

    const buttonTexts = {
        requirements: 'Analisar e Gerar Histórias',
        planning: 'Analisar e Validar História',
        homologation: 'Analisar Feedback',
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 -mt-20">
            <div className="w-full max-w-4xl bg-gray-800 rounded-lg shadow-xl p-6">
                <h2 className="text-xl font-semibold mb-2 text-gray-200">{titles[mode]}</h2>
                <p className="text-gray-400 mb-4 text-sm">{descriptions[mode]}</p>
                
                {mode === 'planning' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            {renderSingleTextarea(
                                "Transcrição do Planejamento",
                                "Cole a transcrição completa aqui...",
                                transcript,
                                (e) => setTranscript(e.target.value),
                                transcriptError
                            )}
                        </div>
                        <div>
                             {renderSingleTextarea(
                                "História de Usuário a ser Validada",
                                "Cole a história de usuário (título e descrição) aqui...",
                                storyToValidate,
                                (e) => setStoryToValidate(e.target.value),
                                storyError,
                                "story"
                            )}
                        </div>
                    </div>
                ) : (
                    renderSingleTextarea(
                        mode === 'requirements' ? 'Transcrição da Reunião' : 'Transcrição da Homologação',
                        "Cole a transcrição completa aqui...",
                        transcript,
                        (e) => setTranscript(e.target.value),
                        transcriptError
                    )
                )}
                
                <button
                    onClick={handleSubmit}
                    title={"Analisar Transcrição"}
                    className="mt-6 w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md transition-transform transform hover:scale-105"
                >
                    {mode ? buttonTexts[mode] : 'Analisar'}
                </button>
            </div>
        </div>
    );
};

const TranscriptionReviewScreen = ({ mode, result, onBack, onCopy }: { mode: TranscriptionMode | null; result: string; onBack: () => void; onCopy: (text: string) => void; }) => {
    if (!mode) return null;

    const titles = {
        requirements: "Histórias Geradas da Transcrição",
        planning: "Análise da Reunião de Planejamento",
        homologation: "Análise da Sessão de Homologação",
    };
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        onCopy(result);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 -mt-20">
            <div className="w-full max-w-4xl bg-gray-800 rounded-lg shadow-xl p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-purple-300">{titles[mode]}</h2>
                    <button onClick={handleCopy} title="Copiar Análise" className="text-gray-400 hover:text-white transition">
                        {copied ? <ClipboardCheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                    </button>
                </div>
                <div className="max-h-[70vh] overflow-y-auto pr-2">
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans bg-gray-900/50 p-4 rounded-md">{result}</pre>
                </div>
                <div className="flex justify-end mt-6">
                    <button onClick={onBack} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">Analisar Outra Transcrição</button>
                </div>
            </div>
        </div>
    );
};


const ReviewGeneratedStory = ({ story, onConfirm, onEdit }: { story: ParsedStory; onConfirm: () => void; onEdit: (story: ParsedStory) => void; }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 -mt-20">
            <div className="w-full max-w-2xl bg-gray-800 rounded-lg shadow-xl p-6">
                <h2 className="text-xl font-semibold mb-2 text-gray-200">Revise a História Gerada</h2>
                <p className="text-gray-400 mb-4 text-sm">Você pode editar o título e a descrição antes de iniciar a sessão de planejamento.</p>

                <label className="block mb-2 text-sm font-medium text-gray-300" htmlFor="title">Título</label>
                <input
                    id="title"
                    type="text"
                    value={story.title}
                    onChange={(e) => onEdit({ ...story, title: e.target.value })}
                    className="w-full p-2 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition text-gray-300"
                />

                <label className="block mt-4 mb-2 text-sm font-medium text-gray-300" htmlFor="description">Descrição</label>
                <textarea
                    id="description"
                    value={story.description}
                    onChange={(e) => onEdit({ ...story, description: e.target.value })}
                    rows={12}
                    className="w-full p-2 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition text-gray-300 resize-y"
                />
                
                <button
                    onClick={onConfirm}
                    className="mt-6 w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md transition-transform transform hover:scale-105"
                >
                    Confirmar e Configurar Sessão
                </button>
            </div>
        </div>
    );
};


const PersonaConfiguration = ({ onStart, onCancel }: { onStart: (personas: Persona[]) => void; onCancel: () => void; }) => {
    const allPersonas = [Persona.Dev, Persona.QA, Persona.Architect, Persona.UX, Persona.DevOps];
    const [selected, setSelected] = useState<Persona[]>([Persona.Dev, Persona.QA, Persona.Architect]);
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    const handleSelect = (persona: Persona) => {
        setSelected(prev => 
            prev.includes(persona) ? prev.filter(p => p !== persona) : [...prev, persona]
        );
    };
    
    const handleRemove = (persona: Persona) => {
        setSelected(prev => prev.filter(p => p !== persona));
    };

    const handleDragSort = () => {
        if(dragItem.current === null || dragOverItem.current === null) return;
        const selectedCopy = [...selected];
        const draggedItemContent = selectedCopy.splice(dragItem.current, 1)[0];
        selectedCopy.splice(dragOverItem.current, 0, draggedItemContent);
        dragItem.current = null;
        dragOverItem.current = null;
        setSelected(selectedCopy);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 -mt-20">
            <div className="w-full max-w-2xl bg-gray-800 rounded-lg shadow-xl p-6">
                <h2 className="text-xl font-semibold mb-2 text-gray-200">Configure a Sessão de Planejamento</h2>
                <p className="text-gray-400 mb-4 text-sm">Selecione as personas e arraste-as para definir a ordem das perguntas.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <h3 className="text-lg font-medium text-cyan-300 mb-3">Personas Disponíveis</h3>
                        <div className="space-y-2">
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
                    </div>

                    <div>
                         <h3 className="text-lg font-medium text-cyan-300 mb-3">Ordem da Sessão</h3>
                         <div className="bg-gray-900/50 p-2 rounded-md min-h-[200px]">
                            {selected.map((p, index) => {
                                const details = personaDetails[p];
                                return (
                                    <div 
                                        key={p} 
                                        className="flex items-center p-2 mb-2 bg-gray-700 rounded-md group"
                                    >
                                        <div 
                                          className="flex-shrink-0 cursor-grab"
                                          draggable
                                          onDragStart={() => dragItem.current = index}
                                          onDragEnter={() => dragOverItem.current = index}
                                          onDragEnd={handleDragSort}
                                          onDragOver={(e) => e.preventDefault()}
                                        >
                                            <MenuIcon className="w-5 h-5 text-gray-400 mr-2"/>
                                        </div>
                                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 ${details.color} bg-gray-800`}>
                                            <details.icon className="w-4 h-4 text-gray-300" />
                                        </div>
                                        <span className="ml-2 text-gray-300 flex-grow">{p}</span>
                                        <button 
                                            onClick={() => handleRemove(p)} 
                                            className="ml-2 p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-opacity"
                                            aria-label={`Remover ${p}`}
                                            title={`Remover ${p}`}
                                        >
                                            <XIcon className="w-4 h-4 text-red-400"/>
                                        </button>
                                    </div>
                                );
                            })}
                            {selected.length === 0 && <p className="text-center text-gray-500 p-8">Selecione personas para começar.</p>}
                         </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition">Cancelar</button>
                    <button onClick={() => onStart(selected)} disabled={selected.length === 0} className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 text-white font-bold py-2 px-4 rounded transition">Iniciar Sessão</button>
                </div>
            </div>
        </div>
    );
};


const Loader = ({ text }: { text: string }) => (
    <div className="flex flex-col items-center justify-center h-full gap-4">
        <svg className="animate-spin h-8 w-8 text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-gray-400">{text}</p>
    </div>
);


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

const OriginalStoryModal = ({ story, onClose, titleOverride, onDownload }: { story: ParsedStory; onClose: () => void; titleOverride?: string; onDownload?: () => void; }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(story.description);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [story]);
    
    return (
        <div 
        className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 transition-opacity duration-300"
        onClick={onClose}
        aria-modal="true"
        role="dialog"
        >
        <div 
            className="bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full p-6 border border-gray-700 relative animate-fade-in-up"
            onClick={e => e.stopPropagation()} 
        >
            <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-gray-700 z-10"
            aria-label="Fechar modal"
            >
            <XIcon className="w-6 h-6" />
            </button>
            <div className="flex justify-between items-center mb-1 pr-12">
                <h3 className="text-lg font-semibold text-purple-300">{titleOverride || "História Original"}</h3>
                <div className="flex items-center gap-4">
                    <button onClick={handleCopy} title="Copiar" className="text-gray-400 hover:text-white transition">
                        {copied ? <ClipboardCheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                    </button>
                    {onDownload && (
                         <button onClick={onDownload} title="Download" className="text-gray-400 hover:text-white transition">
                            <DownloadIcon className="w-5 h-5" />
                         </button>
                    )}
                </div>
            </div>
            <h4 className="text-md font-bold mb-3">{story.title}</h4>
            <div className="max-h-[70vh] overflow-y-auto pr-2">
            <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans bg-gray-900/50 p-3 rounded-md">
                {story.description}
            </pre>
            </div>
        </div>
        </div>
    );
};

const FeatureDescriptionModal = ({ description, onClose }: { description: string; onClose: () => void; }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(description);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [description]);
    
    return (
        <div 
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 transition-opacity duration-300"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div 
                className="bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full p-6 border border-gray-700 relative animate-fade-in-up"
                onClick={e => e.stopPropagation()} 
            >
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-gray-700 z-10"
                    aria-label="Fechar modal"
                >
                    <XIcon className="w-6 h-6" />
                </button>
                <div className="flex justify-between items-center mb-4 pr-12">
                    <h3 className="text-lg font-semibold text-purple-300">Descrição da Funcionalidade</h3>
                    <button onClick={handleCopy} title="Copiar" className="text-gray-400 hover:text-white transition">
                        {copied ? <ClipboardCheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                    </button>
                </div>
                <div className="max-h-[70vh] overflow-y-auto pr-2">
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans bg-gray-900/50 p-3 rounded-md">
                        {description}
                    </pre>
                </div>
            </div>
        </div>
    );
};

const ComplexityAnalysisModal = ({ result, onClose, onAcceptSplit }: { result: ComplexityAnalysisResult; onClose: () => void; onAcceptSplit: () => void; }) => (
    <div 
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 transition-opacity duration-300"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full p-6 border border-gray-700 relative animate-fade-in-up"
        onClick={e => e.stopPropagation()} 
      >
        <div className="flex items-center gap-3 mb-4">
            <ScaleIcon className="w-8 h-8 text-cyan-300"/>
            <h3 className="text-xl font-semibold text-purple-300">Análise de Complexidade</h3>
        </div>
         <div className="max-h-[70vh] overflow-y-auto pr-4 space-y-4 text-gray-300">
            <p><strong>Classificação:</strong> <span className={`font-bold ${result.complexity === 'Alta' ? 'text-red-400' : result.complexity === 'Média' ? 'text-yellow-400' : 'text-green-400'}`}>{result.complexity}</span></p>
            <p><strong>Justificativa:</strong> {result.justification}</p>
            {result.complexity === 'Alta' && result.suggestedStories && (
                <div>
                    <h4 className="font-bold text-cyan-300 mt-4 mb-2">Sugestão de Quebra em Histórias Menores:</h4>
                    <div className="space-y-3">
                        {result.suggestedStories.map((story, index) => (
                            <details key={index} className="bg-gray-900/50 p-3 rounded-md">
                                <summary className="font-semibold cursor-pointer">{story.title}</summary>
                                <pre className="text-sm whitespace-pre-wrap font-sans mt-2 pl-4 border-l-2 border-gray-600">{story.description}</pre>
                            </details>
                        ))}
                    </div>
                </div>
            )}
        </div>
        <div className="flex justify-end gap-3 mt-6">
            <button onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition">Fechar</button>
            {result.complexity === 'Alta' && (
                <button onClick={onAcceptSplit} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition">Aceitar e Quebrar História</button>
            )}
        </div>
      </div>
    </div>
);

const StorySelectionScreen = ({ stories, onSelectStory }: { stories: SplitStory[], onSelectStory: (story: ParsedStory) => void }) => (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 -mt-20">
        <div className="w-full max-w-3xl bg-gray-800 rounded-lg shadow-xl p-6">
            <h2 className="text-xl font-semibold mb-2 text-gray-200">Selecione uma História para Refinar</h2>
            <p className="text-gray-400 mb-6 text-sm">A IA gerou as seguintes propostas. Escolha uma para iniciar uma sessão de planejamento individual.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stories.map((story, index) => (
                    <button 
                        key={index} 
                        onClick={() => onSelectStory(story)}
                        className="bg-gray-700 hover:bg-gray-600 text-left p-4 rounded-md transition-transform transform hover:scale-105"
                    >
                        <h3 className="font-bold text-purple-300">{story.title}</h3>
                        <p className="text-sm text-gray-400 mt-2 line-clamp-3">{story.description}</p>
                    </button>
                ))}
            </div>
        </div>
    </div>
);

const ModelStoryModal = ({ initialModel, onSave, onClose }: { initialModel: string; onSave: (model: string) => void; onClose: () => void; }) => {
    const [currentModel, setCurrentModel] = useState(initialModel);

    const handleSave = () => {
        onSave(currentModel);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6 border border-gray-700 relative animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                    <TemplateIcon className="w-8 h-8 text-cyan-300" />
                    <h3 className="text-xl font-semibold text-purple-300">Definir Modelo de História Global</h3>
                </div>
                <p className="text-gray-400 mb-4 text-sm">Cole uma história de usuário aqui. A IA usará sua estrutura e formatação como modelo para todas as novas histórias geradas nesta sessão.</p>
                <textarea
                    value={currentModel}
                    onChange={(e) => setCurrentModel(e.target.value)}
                    rows={12}
                    className="w-full p-2 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-purple-500 transition text-gray-300 resize-y"
                    placeholder="Cole a história modelo aqui..."
                />
                <div className="flex justify-end gap-3 mt-4">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition">Cancelar</button>
                    <button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition">Salvar Modelo</button>
                </div>
            </div>
        </div>
    );
};

const PrototypeModelModal = ({ initialModel, onSave, onClose }: { initialModel: string; onSave: (model: string) => void; onClose: () => void; }) => {
    const [currentModel, setCurrentModel] = useState(initialModel);

    const handleSave = () => {
        onSave(currentModel);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6 border border-gray-700 relative animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                    <ViewBoardsIcon className="w-8 h-8 text-cyan-300" />
                    <h3 className="text-xl font-semibold text-purple-300">Definir Modelo de Protótipo Global</h3>
                </div>
                <p className="text-gray-400 mb-4 text-sm">Cole um trecho de código HTML com classes Tailwind CSS aqui. A IA usará este código como referência de estilo e estrutura para todos os protótipos gerados nesta sessão.</p>
                <textarea
                    value={currentModel}
                    onChange={(e) => setCurrentModel(e.target.value)}
                    rows={12}
                    className="w-full p-2 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-purple-500 transition text-gray-300 resize-y font-mono text-sm"
                    placeholder="Cole o código do protótipo modelo aqui..."
                />
                <div className="flex justify-end gap-3 mt-4">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition">Cancelar</button>
                    <button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition">Salvar Modelo</button>
                </div>
            </div>
        </div>
    );
};

const ConfirmationModal = ({ action, onClose }: { action: ConfirmationAction; onClose: () => void; }) => {
    if (!action) return null;

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 transition-opacity duration-300">
            <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-700 animate-fade-in-up"
                 onClick={e => e.stopPropagation()}
            >
                <h3 className="text-xl font-semibold text-yellow-300 mb-4">{action.title}</h3>
                <p className="text-gray-300 mb-6">{action.message}</p>
                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition">Cancelar</button>
                    <button onClick={() => { action.onConfirm(); onClose(); }} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition">Confirmar</button>
                </div>
            </div>
        </div>
    );
};

const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const getFileExtension = (technology: string): string => {
    if (technology.includes('JavaScript')) return 'js';
    if (technology.includes('Python')) return 'py';
    if (technology.includes('Java')) return 'java';
    if (technology.includes('PHP')) return 'php';
    if (technology.includes('C#')) return 'cs';
    return 'txt';
};

const App: React.FC = () => {
    const [appState, setAppState] = useState<AppState>('home');
    const [navigationHistory, setNavigationHistory] = useState<AppState[]>(['home']);

    // Story refinement state
    const [originalStory, setOriginalStory] = useState<ParsedStory | null>(null);
    const [suggestedStory, setSuggestedStory] = useState<string | null>(null);
    const [splitStories, setSplitStories] = useState<SplitStory[]>([]);
    const [complexityAnalysis, setComplexityAnalysis] = useState<ComplexityAnalysisResult | null>(null);
    
    // Transcription state
    const [transcriptionMode, setTranscriptionMode] = useState<TranscriptionMode | null>(null);
    const [transcriptionAnalysisResult, setTranscriptionAnalysisResult] = useState<string | null>(null);


    // BDD state
    const [planningMode, setPlanningMode] = useState<'story' | 'bdd'>('story');
    const [featureDescription, setFeatureDescription] = useState<string>('');
    const [bddScenarios, setBddScenarios] = useState<BddScenario[]>([]);
    const [currentScenarioIndex, setCurrentScenarioIndex] = useState<number | null>(null);
    const [generatedSingleGherkin, setGeneratedSingleGherkin] = useState<string | null>(null);
    const [poChecklistContent, setPoChecklistContent] = useState<string | null>(null);
    const [stepDefContent, setStepDefContent] = useState<string | null>(null);
    const [selectedTechnology, setSelectedTechnology] = useState('JavaScript - Cypress');
    const [documentToConvert, setDocumentToConvert] = useState('');
    const [featureSuggestions, setFeatureSuggestions] = useState<BddFeatureSuggestion[]>([]);
    const [convertedFeatureFile, setConvertedFeatureFile] = useState('');
    const [poChecklistCache, setPoChecklistCache] = useState<{ featureContent: string; checklist: string; } | null>(null);
    const [stepDefCache, setStepDefCache] = useState<{ featureContent: string; technology: string; steps: string; } | null>(null);
    const [editingOutline, setEditingOutline] = useState<{ template: string; headers: string[]; rows: string[][]; } | null>(null);
    
    // New states for grouped planning
    const [selectedScenarioIds, setSelectedScenarioIds] = useState<number[]>([]);
    const [planningScope, setPlanningScope] = useState<'single' | 'group'>('single');
    const [currentGroupIndexes, setCurrentGroupIndexes] = useState<number[]>([]);
    const [generatedGroupGherkin, setGeneratedGroupGherkin] = useState<GherkinScenario[] | null>(null);

    // Shared planning state
    const [activePersonas, setActivePersonas] = useState<Persona[]>([]);
    const [conversation, setConversation] = useState<ConversationTurn[]>([]);
    const [currentAnswer, setCurrentAnswer] = useState('');
    
    // UI and loading state
    const [isAnswering, setIsAnswering] = useState(false);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [isRefining, setIsRefining] = useState(false);
    const [isGeneratingScenarios, setIsGeneratingScenarios] = useState(false);
    const [isGeneratingPrototype, setIsGeneratingPrototype] = useState(false);
    const [isGeneratingBddPrototype, setIsGeneratingBddPrototype] = useState(false);
    const [isAnalyzingComplexity, setIsAnalyzingComplexity] = useState(false);
    const [isGeneratingGherkin, setIsGeneratingGherkin] = useState(false);
    const [isGeneratingChecklist, setIsGeneratingChecklist] = useState(false);
    const [isGeneratingSteps, setIsGeneratingSteps] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Modals and utils
    const [isOriginalStoryModalOpen, setIsOriginalStoryModalOpen] = useState(false);
    const [isFeatureDescriptionModalOpen, setIsFeatureDescriptionModalOpen] = useState(false);
    const [isTechSelectionModalOpen, setIsTechSelectionModalOpen] = useState(false);
    const [isPoChecklistModalOpen, setIsPoChecklistModalOpen] = useState(false);
    const [isStepDefModalOpen, setIsStepDefModalOpen] = useState(false);
    const [isPrototypeModalOpen, setIsPrototypeModalOpen] = useState(false);
    const [refinementPrompt, setRefinementPrompt] = useState('');
    const [copied, setCopied] = useState(false);
    const [copiedTurnId, setCopiedTurnId] = useState<number | null>(null);
    const [testScenarios, setTestScenarios] = useState<string | null>(null);
    const [isFeaturesModalOpen, setIsFeaturesModalOpen] = useState(false);
    const [modelStory, setModelStory] = useState<string>('');
    const [isModelStoryModalOpen, setIsModelStoryModalOpen] = useState(false);
    const [prototypeModel, setPrototypeModel] = useState<string>('');
    const [localPrototypeModel, setLocalPrototypeModel] = useState<string>('');
    const [isPrototypeModelModalOpen, setIsPrototypeModelModalOpen] = useState(false);
    const [suggestedPrototype, setSuggestedPrototype] = useState<string | null>(null);
    const [confirmationAction, setConfirmationAction] = useState<ConfirmationAction>(null);
    
    // Data Table state
    const [isDataTableModalOpen, setIsDataTableModalOpen] = useState(false);
    const [dataTableColumns, setDataTableColumns] = useState<string[]>([]);
    const [isExtractingColumns, setIsExtractingColumns] = useState(false);
    const [currentTurnIdForColumnCheck, setCurrentTurnIdForColumnCheck] = useState<number | null>(null);

    // Cache states
    const [complexityCache, setComplexityCache] = useState<{ description: string; result: ComplexityAnalysisResult; } | null>(null);
    const [testScenariosCache, setTestScenariosCache] = useState<{ description: string; scenarios: string; } | null>(null);
    const [prototypeCache, setPrototypeCache] = useState<{ description: string; model: string; prototype: string; } | null>(null);
    const [bddPrototypeCache, setBddPrototypeCache] = useState<{ featureContent: string; model: string; prototype: string; } | null>(null);
    const [gherkinCache, setGherkinCache] = useState<{ conversation: ConversationTurn[]; gherkin: string | GherkinScenario[]; } | null>(null);

    const conversationEndRef = useRef<HTMLDivElement>(null);
    
    const currentTurn = conversation[conversation.length - 1];

    const resetBddConversionState = () => {
        setDocumentToConvert('');
        setFeatureSuggestions([]);
        setConvertedFeatureFile('');
    };

    const navigateTo = (newState: AppState) => {
        setAppState(newState);
        setNavigationHistory(prev => [...prev, newState]);
    };

    const handleGoBack = () => {
        if (navigationHistory.length > 1) {
            const bddConversionStates: AppState[] = ['bdd_converting_doc_input', 'bdd_breakdown_review', 'bdd_converting_doc_review'];
            const currentState = navigationHistory[navigationHistory.length - 1];
            const previousState = navigationHistory[navigationHistory.length - 2];

            // If leaving the BDD conversion flow, clean up its state.
            if (bddConversionStates.includes(currentState) && !bddConversionStates.includes(previousState)) {
                resetBddConversionState();
            }

            const newHistory = [...navigationHistory];
            newHistory.pop();
            setNavigationHistory(newHistory);
            setAppState(newHistory[newHistory.length - 1]);
        }
    };

    const handleBreadcrumbNavigate = (index: number) => {
        if (index < navigationHistory.length - 1) {
            const bddConversionStates: AppState[] = ['bdd_converting_doc_input', 'bdd_breakdown_review', 'bdd_converting_doc_review'];
            const currentState = navigationHistory[navigationHistory.length - 1];
            const targetState = navigationHistory[index];

            // If navigating out of the BDD conversion flow, clean up its state.
            if (bddConversionStates.includes(currentState) && !bddConversionStates.includes(targetState)) {
                resetBddConversionState();
            }

            const newHistory = navigationHistory.slice(0, index + 1);
            setNavigationHistory(newHistory);
            setAppState(newHistory[newHistory.length - 1]);
        }
    };

    useEffect(() => {
        conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversation]);

    useEffect(() => {
        // Check if it's a new turn that hasn't been processed for columns yet
        if (appState === 'planning' && planningMode === 'bdd' && currentTurn && !currentTurn.answer && currentTurn.id !== currentTurnIdForColumnCheck) {
            const inferColumns = async () => {
                setCurrentTurnIdForColumnCheck(currentTurn.id); // Mark as processed
                setIsExtractingColumns(true);
                setDataTableColumns([]); // Reset from previous turn
                try {
                    const columns = await extractTableColumnsFromQuestion(currentTurn.question);
                    if (columns && columns.length > 0) {
                        setDataTableColumns(columns);
                    }
                } catch (e) {
                    console.error("Failed to infer columns", e);
                } finally {
                    setIsExtractingColumns(false);
                }
            };
            inferColumns();
        }
    }, [appState, planningMode, currentTurn, currentTurnIdForColumnCheck]);
    
    const handleCopy = (text: string, turnId?: number) => {
        navigator.clipboard.writeText(text);
        if (turnId) {
            setCopiedTurnId(turnId);
            setTimeout(() => setCopiedTurnId(null), 2000);
        } else {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleStorySubmit = useCallback((story: ParsedStory) => {
        setPlanningMode('story');
        setOriginalStory(story);
        navigateTo('configuring');
    }, []);

    const handleGenerateStory = useCallback(async (requirements: string) => {
        navigateTo('loading_generation');
        setError(null);
        try {
            const generated = await generateNewStory(requirements, modelStory);
            setOriginalStory(generated);
            navigateTo('reviewing');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao gerar a história.');
            navigateTo('error');
        }
    }, [modelStory]);

     const handleRequirementsTranscriptSubmit = useCallback(async (transcript: string) => {
        navigateTo('loading_transcription');
        setError(null);
        try {
            const generatedStories = await generateStoriesFromTranscript(transcript, modelStory);
            if (generatedStories.length === 0) {
                setError('A IA não conseguiu gerar histórias a partir da transcrição fornecida. Tente com um texto mais detalhado.');
                navigateTo('transcribing_input');
                return;
            }
            setSplitStories(generatedStories);
            navigateTo('story_selection');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao analisar a transcrição.');
            navigateTo('error');
        }
    }, [modelStory]);

    const handlePlanningTranscriptSubmit = useCallback(async (transcript: string, storyToValidate: string) => {
        navigateTo('loading_transcription');
        setError(null);
        try {
            const result = await analyzePlanningTranscript(transcript, storyToValidate);
            setTranscriptionAnalysisResult(result);
            navigateTo('transcribing_review');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao analisar a transcrição.');
            navigateTo('transcribing_input');
        }
    }, []);

    const handleHomologationTranscriptSubmit = useCallback(async (transcript: string) => {
        navigateTo('loading_transcription');
        setError(null);
        try {
            const result = await analyzeHomologationTranscript(transcript);
            setTranscriptionAnalysisResult(result);
            navigateTo('transcribing_review');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao analisar a transcrição.');
            navigateTo('transcribing_input');
        }
    }, []);

    const handleTranscriptionContextSelect = (mode: TranscriptionMode) => {
        setTranscriptionMode(mode);
        navigateTo('transcribing_input');
    };

    const handleFeatureSubmit = useCallback(async (description: string) => {
        navigateTo('loading_bdd_scenarios');
        setFeatureDescription(description);
        setError(null);
        try {
            const scenarios = await generateBddScenarios(description);
            // FIX: Explicitly cast the 'type' property to satisfy the BddScenario type.
            setBddScenarios(scenarios.map((title, i) => ({ 
                id: Date.now() + i, 
                title, 
                gherkin: null, 
                completed: false,
                type: (title.toLowerCase().includes('scenario outline') ? 'outline' : 'scenario') as 'scenario' | 'outline'
            })));
            navigateTo('bdd_scenarios');
        } catch (err) {
             setError(err instanceof Error ? err.message : 'Falha ao gerar cenários BDD.');
             navigateTo('bdd_input');
        }
    }, []);

    const handleAnalyzeDocument = useCallback(async (document: string) => {
        navigateTo('loading_bdd_breakdown');
        setDocumentToConvert(document);
        setError(null);
        try {
            const suggestions = await analyzeAndBreakdownDocument(document);
            setFeatureSuggestions(suggestions);
            navigateTo('bdd_breakdown_review');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao analisar o documento.');
            navigateTo('bdd_converting_doc_input');
        }
    }, []);

    const handleConvertSelectedFeature = useCallback(async (featureTitle: string) => {
        navigateTo('loading_bdd_conversion');
        setError(null);
        try {
            const featureFile = await convertDocumentToBdd(documentToConvert, featureTitle);
            setConvertedFeatureFile(featureFile);
            navigateTo('bdd_converting_doc_review');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao converter a feature selecionada.');
            navigateTo('bdd_breakdown_review');
        }
    }, [documentToConvert]);


    const handleRefineConvertedFeature = useCallback(() => {
        const lines = convertedFeatureFile.trim().split('\n');
        const featureLine = lines.find(line => line.trim().startsWith('Funcionalidade:')) || 'Funcionalidade: Feature a ser refinada';
        const description = featureLine.replace('Funcionalidade:', '').trim();
        setFeatureDescription(description);

        const scenarioRegex = /Cenário:\s*(.*)/g;
        let match;
        const scenarios: string[] = [];
        while ((match = scenarioRegex.exec(convertedFeatureFile)) !== null) {
            scenarios.push(match[1].trim());
        }

        const initialBddScenarios = scenarios.map((title, i) => ({
            id: Date.now() + i,
            title,
            gherkin: null, 
            completed: false,
            type: (title.toLowerCase().includes('scenario outline') ? 'outline' : 'scenario') as 'scenario' | 'outline'
        }));

        setBddScenarios(initialBddScenarios);
        navigateTo('bdd_scenarios');
    }, [convertedFeatureFile]);

    const handleDetailScenario = useCallback((index: number) => {
        setGherkinCache(null);
        setGeneratedSingleGherkin(null);
        setCurrentScenarioIndex(index);
        const scenario = bddScenarios[index];
        setOriginalStory({ title: scenario.title, description: `Este é um cenário para a funcionalidade: "${featureDescription}"` });
        setPlanningMode('bdd');
        setPlanningScope('single');
        navigateTo('configuring');
    }, [bddScenarios, featureDescription]);

    const handleStartOutlineEditing = useCallback(async (index: number) => {
        setCurrentScenarioIndex(index);
        navigateTo('loading_outline_generation');
        setError(null);
        try {
            const scenario = bddScenarios[index];
            const result = await generateInitialScenarioOutline(featureDescription, scenario.title);
            setEditingOutline({
                template: result.template,
                headers: result.headers,
                rows: [Array(result.headers.length).fill('')] // Start with one empty row
            });
            navigateTo('scenario_outline_editor');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao gerar o template do Scenario Outline.');
            navigateTo('bdd_scenarios');
        }
    }, [bddScenarios, featureDescription]);

    const handleSaveOutline = useCallback(() => {
        if (!editingOutline || currentScenarioIndex === null) return;

        const { template, headers, rows } = editingOutline;

        // Format Gherkin
        let gherkin = template;
        if (headers.length > 0 && rows.length > 0) {
            gherkin += '\n\n  Examples:';
            gherkin += `\n    | ${headers.join(' | ')} |`;
            rows.forEach(row => {
                gherkin += `\n    | ${row.join(' | ')} |`;
            });
        }
        
        // Update scenarios
        const updatedScenarios = [...bddScenarios];
        updatedScenarios[currentScenarioIndex] = {
            ...updatedScenarios[currentScenarioIndex],
            gherkin: gherkin.trim(),
            completed: true
        };
        setBddScenarios(updatedScenarios);

        // Reset state
        setEditingOutline(null);
        setCurrentScenarioIndex(null);
        navigateTo('bdd_scenarios');

    }, [editingOutline, currentScenarioIndex, bddScenarios]);
    
    const handleDetailGroupedScenarios = useCallback(() => {
        if (selectedScenarioIds.length === 0) return;

        setGherkinCache(null);
        setGeneratedGroupGherkin(null);
        
        const indexes: number[] = [];
        const titles: string[] = [];
        selectedScenarioIds.forEach(id => {
            const index = bddScenarios.findIndex(s => s.id === id);
            if (index > -1) {
                indexes.push(index);
                titles.push(bddScenarios[index].title);
            }
        });
        
        setCurrentGroupIndexes(indexes);
        setOriginalStory({ title: `Detalhamento de Múltiplos Cenários`, description: `Funcionalidade: ${featureDescription}\n\nCenários:\n- ${titles.join('\n- ')}` });
        setPlanningMode('bdd');
        setPlanningScope('group');
        navigateTo('configuring');
    }, [bddScenarios, featureDescription, selectedScenarioIds]);

    const handleReviewConfirm = useCallback(() => {
        if (!originalStory) return;
        navigateTo('configuring');
    }, [originalStory]);

    const handleStartPlanning = useCallback(async (selectedPersonas: Persona[]) => {
        let contextStory: ParsedStory | null = null;
        if (planningMode === 'story') {
            contextStory = originalStory;
        } else if (planningScope === 'single' && currentScenarioIndex !== null) {
            contextStory = { title: bddScenarios[currentScenarioIndex].title, description: featureDescription };
        } else if (planningScope === 'group' && currentGroupIndexes.length > 0) {
            const titles = currentGroupIndexes.map(i => bddScenarios[i].title);
            contextStory = { title: `Grupo de cenários: ${titles.join(', ')}`, description: featureDescription };
        }
        
        if (!contextStory || selectedPersonas.length === 0) return;
        
        navigateTo('loading');
        setActivePersonas(selectedPersonas);
        setError(null);
        try {
            const initialQs = await generateInitialQuestions(contextStory, selectedPersonas);
            
            const firstQuestion: ConversationTurn = {
                id: Date.now(),
                persona: selectedPersonas[0],
                question: initialQs[personaToKey(selectedPersonas[0])],
            };
            setConversation([firstQuestion]);
            navigateTo('planning');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
            navigateTo('error');
        }
    }, [originalStory, planningMode, currentScenarioIndex, bddScenarios, featureDescription, planningScope, currentGroupIndexes]);

    const handleCancelConfiguration = useCallback(() => {
        if (planningMode === 'bdd') {
            navigateTo('bdd_scenarios');
        } else if (splitStories.length > 0) {
            navigateTo('story_selection');
        } else {
            navigateTo('home');
        }
        setOriginalStory(null);
        setSelectedScenarioIds([]);
    }, [splitStories, planningMode]);

    const submitAnswer = useCallback(async (answer: string) => {
        const contextStory = originalStory;

        if (!contextStory || activePersonas.length === 0) return;

        setIsAnswering(true);
        setGherkinCache(null);
        setGeneratedSingleGherkin(null);
        setGeneratedGroupGherkin(null);
        
        const updatedConversation = conversation.map((turn, index) => 
            index === conversation.length - 1 ? { ...turn, answer } : turn
        );
        setConversation(updatedConversation);
        setCurrentAnswer('');

        try {
            const currentTurnIndex = updatedConversation.length - 1;
            const currentPersonaIndex = activePersonas.indexOf(updatedConversation[currentTurnIndex].persona);
            const nextPersona = activePersonas[(currentPersonaIndex + 1) % activePersonas.length];

            const nextQuestionText = planningMode === 'bdd'
                ? planningScope === 'single'
                    ? await generateBddFollowUpQuestion(featureDescription, contextStory.title, updatedConversation, nextPersona)
                    : await generateBddFollowUpQuestionForGroup(featureDescription, currentGroupIndexes.map(i => bddScenarios[i].title), updatedConversation, nextPersona)
                : await generateFollowUpQuestion(contextStory, updatedConversation, nextPersona);
                
            const nextTurn: ConversationTurn = { id: Date.now(), persona: nextPersona, question: nextQuestionText };
            setConversation(prev => [...prev, nextTurn]);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao obter a próxima pergunta.');
        } finally {
            setIsAnswering(false);
        }
    }, [conversation, originalStory, activePersonas, planningMode, featureDescription, planningScope, currentGroupIndexes, bddScenarios]);

    const handleAnswerSubmit = () => {
        if (!currentAnswer.trim() || isAnswering) return;
        submitAnswer(currentAnswer);
    };

    const handleSkip = () => {
        if (isAnswering) return;
        submitAnswer('Pulado');
    };
    
    const handleGetSuggestion = useCallback(async () => {
        if (!originalStory || conversation.length === 0) return;
        setIsSuggesting(true);
        setError(null);
        // Invalidate caches
        setTestScenariosCache(null);
        setPrototypeCache(null);
        setComplexityCache(null);
        setTestScenarios(null);
        setSuggestedPrototype(null);
        setComplexityAnalysis(null);
        try {
            const lastTurn = conversation[conversation.length - 1];
            const conversationForSuggestion = lastTurn.answer ? conversation : conversation.slice(0, -1);
            const suggestion = await suggestNewStoryVersion(originalStory, conversationForSuggestion);
            setSuggestedStory(suggestion);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao gerar a sugestão.');
        } finally {
            setIsSuggesting(false);
        }
    }, [originalStory, conversation]);
    
    const handleRefineSuggestion = useCallback(async () => {
        if (!suggestedStory || !refinementPrompt.trim()) return;
        setIsRefining(true);
        setError(null);
        // Invalidate caches
        setTestScenariosCache(null);
        setPrototypeCache(null);
        setComplexityCache(null);
        setTestScenarios(null);
        setSuggestedPrototype(null);
        setComplexityAnalysis(null);
        try {
            const refined = await refineSuggestedStory(suggestedStory, refinementPrompt);
            setSuggestedStory(refined);
            setRefinementPrompt('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao refinar a sugestão.');
        } finally {
            setIsRefining(false);
        }
    }, [suggestedStory, refinementPrompt]);

    const handleGenerateGherkin = useCallback(async () => {
        if (planningMode !== 'bdd' || conversation.length === 0) return;
        
        const lastTurn = conversation[conversation.length - 1];
        const convForGherkin = lastTurn.answer ? conversation : conversation.slice(0, -1);
        if (convForGherkin.length === 0) {
            setError("Responda a pelo menos uma pergunta para gerar o Gherkin.");
            return;
        }

        if (gherkinCache && JSON.stringify(gherkinCache.conversation) === JSON.stringify(convForGherkin)) {
            if (planningScope === 'single' && typeof gherkinCache.gherkin === 'string') {
                setGeneratedSingleGherkin(gherkinCache.gherkin);
                return;
            } else if (planningScope === 'group' && Array.isArray(gherkinCache.gherkin)) {
                setGeneratedGroupGherkin(gherkinCache.gherkin);
                return;
            }
        }
        
        setIsGeneratingGherkin(true);
        setGeneratedSingleGherkin(null);
        setGeneratedGroupGherkin(null);
        setError(null);
        
        try {
            if (planningScope === 'single' && currentScenarioIndex !== null) {
                const scenario = bddScenarios[currentScenarioIndex];
                const gherkin = await generateGherkinFromConversation(featureDescription, scenario.title, convForGherkin);
                setGeneratedSingleGherkin(gherkin);
                setGherkinCache({ conversation: convForGherkin, gherkin });
            } else if (planningScope === 'group' && currentGroupIndexes.length > 0) {
                const scenarioTitles = currentGroupIndexes.map(i => bddScenarios[i].title);
                const gherkins = await generateGherkinFromGroupConversation(featureDescription, scenarioTitles, convForGherkin);
                setGeneratedGroupGherkin(gherkins);
                setGherkinCache({ conversation: convForGherkin, gherkin: gherkins });
            }
        } catch (err) {
             setError(err instanceof Error ? err.message : 'Falha ao gerar o Gherkin.');
        } finally {
            setIsGeneratingGherkin(false);
        }
    }, [planningMode, conversation, gherkinCache, planningScope, currentScenarioIndex, bddScenarios, featureDescription, currentGroupIndexes]);

    const handleCompleteBddPlanning = useCallback(() => {
        const updatedScenarios = [...bddScenarios];
        let scenariosUpdated = false;

        if (planningScope === 'single' && currentScenarioIndex !== null && generatedSingleGherkin) {
            updatedScenarios[currentScenarioIndex] = {
                ...updatedScenarios[currentScenarioIndex],
                gherkin: generatedSingleGherkin,
                completed: true
            };
            scenariosUpdated = true;
        } else if (planningScope === 'group' && generatedGroupGherkin) {
            generatedGroupGherkin.forEach(result => {
                const index = bddScenarios.findIndex(s => s.title === result.title);
                if (index > -1) {
                    updatedScenarios[index] = {
                        ...updatedScenarios[index],
                        gherkin: result.gherkin,
                        completed: true,
                    };
                }
            });
            scenariosUpdated = true;
        }
        
        if (scenariosUpdated) {
            setBddScenarios(updatedScenarios);
        }

        setConversation([]);
        setCurrentScenarioIndex(null);
        setCurrentGroupIndexes([]);
        setGeneratedSingleGherkin(null);
        setGeneratedGroupGherkin(null);
        setSelectedScenarioIds([]);
        navigateTo('bdd_scenarios');
    }, [currentScenarioIndex, generatedSingleGherkin, bddScenarios, planningScope, generatedGroupGherkin]);
    
    const handleGenerateScenarios = useCallback(async () => {
        if (!originalStory) return;
        const storyToTest = suggestedStory ?? originalStory.description;

        if (testScenariosCache && testScenariosCache.description === storyToTest) {
            setTestScenarios(testScenariosCache.scenarios);
            return;
        }

        setIsGeneratingScenarios(true);
        setTestScenarios(null);
        setError(null);
        try {
            const scenarios = await generateTestScenarios(storyToTest);
            setTestScenarios(scenarios);
            setTestScenariosCache({ description: storyToTest, scenarios });
        } catch (err) {
             setError(err instanceof Error ? err.message : 'Falha ao gerar cenários de teste.');
        } finally {
            setIsGeneratingScenarios(false);
        }
    }, [originalStory, suggestedStory, testScenariosCache]);

    const handleAnalyzeComplexity = useCallback(async () => {
        if (!originalStory) return;
        const storyToAnalyze = suggestedStory ? { title: originalStory.title, description: suggestedStory } : originalStory;

        if (complexityCache && complexityCache.description === storyToAnalyze.description) {
            setComplexityAnalysis(complexityCache.result);
            return;
        }

        setIsAnalyzingComplexity(true);
        setComplexityAnalysis(null);
        setError(null);
        try {
            const result = await analyzeStoryComplexity(storyToAnalyze);
            setComplexityAnalysis(result);
            setComplexityCache({ description: storyToAnalyze.description, result });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao analisar a complexidade.');
        } finally {
            setIsAnalyzingComplexity(false);
        }
    }, [originalStory, suggestedStory, complexityCache]);

    const handleGeneratePrototype = useCallback(async () => {
        const modelToUse = localPrototypeModel || prototypeModel;
        
        if (planningMode === 'story') {
            if (!originalStory) return;
            const storyToPrototype = suggestedStory ?? originalStory.description;

            if (prototypeCache && prototypeCache.description === storyToPrototype && prototypeCache.model === modelToUse) {
                setSuggestedPrototype(prototypeCache.prototype);
                setIsPrototypeModalOpen(true);
                return;
            }

            setIsGeneratingPrototype(true);
            setSuggestedPrototype(null);
            setError(null);
            try {
                const prototypeCode = await generatePrototype(storyToPrototype, modelToUse);
                setSuggestedPrototype(prototypeCode);
                setPrototypeCache({ description: storyToPrototype, model: modelToUse, prototype: prototypeCode });
                setIsPrototypeModalOpen(true);
            } catch (err) {
                 setError(err instanceof Error ? err.message : 'Falha ao gerar o protótipo.');
            } finally {
                setIsGeneratingPrototype(false);
            }
        } else if (planningMode === 'bdd') {
            const featureFileContent = `Funcionalidade: ${featureDescription}\n\n` + 
                bddScenarios.map(s => s.gherkin ?? `Cenário: ${s.title}`).join('\n\n');

            if (bddPrototypeCache && bddPrototypeCache.featureContent === featureFileContent && bddPrototypeCache.model === modelToUse) {
                setSuggestedPrototype(bddPrototypeCache.prototype);
                setIsPrototypeModalOpen(true);
                return;
            }

            setIsGeneratingPrototype(true);
            setSuggestedPrototype(null);
            setError(null);
            try {
                const prototypeCode = await generatePrototypeFromFeature(featureFileContent, modelToUse);
                setSuggestedPrototype(prototypeCode);
                setBddPrototypeCache({ featureContent: featureFileContent, model: modelToUse, prototype: prototypeCode });
                setIsPrototypeModalOpen(true);
            } catch (err) {
                 setError(err instanceof Error ? err.message : 'Falha ao gerar o protótipo.');
            } finally {
                setIsGeneratingPrototype(false);
            }
        }
    }, [
        planningMode,
        originalStory,
        suggestedStory,
        prototypeModel,
        localPrototypeModel,
        prototypeCache,
        bddPrototypeCache,
        featureDescription,
        bddScenarios,
    ]);

    const handleGenerateBddPrototype = useCallback(async (featureFileContent: string) => {
        const modelToUse = localPrototypeModel || prototypeModel;

        if (bddPrototypeCache && bddPrototypeCache.featureContent === featureFileContent && bddPrototypeCache.model === modelToUse) {
            setSuggestedPrototype(bddPrototypeCache.prototype);
            setIsPrototypeModalOpen(true);
            return;
        }

        setIsGeneratingBddPrototype(true);
        setSuggestedPrototype(null);
        setError(null);
        try {
            const prototypeCode = await generatePrototypeFromFeature(featureFileContent, modelToUse);
            setSuggestedPrototype(prototypeCode);
            setBddPrototypeCache({ featureContent: featureFileContent, model: modelToUse, prototype: prototypeCode });
            setIsPrototypeModalOpen(true);
        } catch (err) {
             setError(err instanceof Error ? err.message : 'Falha ao gerar o protótipo.');
        } finally {
            setIsGeneratingBddPrototype(false);
        }
    }, [prototypeModel, localPrototypeModel, bddPrototypeCache]);

    const handleGeneratePoChecklist = useCallback(async (featureFileContent: string) => {
        if (poChecklistCache && poChecklistCache.featureContent === featureFileContent) {
            setPoChecklistContent(poChecklistCache.checklist);
            setIsPoChecklistModalOpen(true);
            return;
        }
        setIsGeneratingChecklist(true);
        setPoChecklistContent(null);
        setError(null);
        try {
            const checklist = await generatePoChecklist(featureFileContent);
            setPoChecklistContent(checklist);
            setPoChecklistCache({ featureContent: featureFileContent, checklist });
            setIsPoChecklistModalOpen(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao gerar o checklist.');
        } finally {
            setIsGeneratingChecklist(false);
        }
    }, [poChecklistCache]);

    const handleGenerateStepDefs = useCallback(async (featureFileContent: string) => {
        if (stepDefCache && stepDefCache.featureContent === featureFileContent && stepDefCache.technology === selectedTechnology) {
            setStepDefContent(stepDefCache.steps);
            setIsStepDefModalOpen(true);
            setIsTechSelectionModalOpen(false);
            return;
        }
        setIsTechSelectionModalOpen(false);
        setIsGeneratingSteps(true);
        setStepDefContent(null);
        setError(null);
        try {
            const steps = await generateStepDefinitions(featureFileContent, selectedTechnology);
            setStepDefContent(steps);
            setStepDefCache({ featureContent: featureFileContent, technology: selectedTechnology, steps });
            setIsStepDefModalOpen(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao gerar as definições de steps.');
        } finally {
            setIsGeneratingSteps(false);
        }
    }, [selectedTechnology, stepDefCache]);

    const handleAcceptSplit = useCallback(() => {
        if (complexityAnalysis?.suggestedStories) {
            setSplitStories(complexityAnalysis.suggestedStories);
            navigateTo('story_selection');
        }
        setComplexityAnalysis(null);
    }, [complexityAnalysis]);

    const handleSelectSplitStory = useCallback((story: SplitStory) => {
        // Reset story-specific state
        setConversation([]);
        setActivePersonas([]);
        setSuggestedStory(null);
        setError(null);
        setCurrentAnswer('');
        setTestScenarios(null);
        setSuggestedPrototype(null);
        setComplexityAnalysis(null);
        setLocalPrototypeModel('');
        // Reset Caches
        setComplexityCache(null);
        setTestScenariosCache(null);
        setPrototypeCache(null);
        
        // Set new story and move to config
        setOriginalStory(story);
        setPlanningMode('story');
        navigateTo('configuring');
    }, []);

    const resetApp = () => {
        setAppState('home');
        setNavigationHistory(['home']);
        setOriginalStory(null);
        setSuggestedStory(null);
        setSplitStories([]);
        setComplexityAnalysis(null);
        setTranscriptionMode(null);
        setTranscriptionAnalysisResult(null);
        setPlanningMode('story');
        setFeatureDescription('');
        setBddScenarios([]);
        setCurrentScenarioIndex(null);
        setGeneratedSingleGherkin(null);
        setPoChecklistContent(null);
        setStepDefContent(null);
        resetBddConversionState();
        setEditingOutline(null);
        setActivePersonas([]);
        setConversation([]);
        setCurrentAnswer('');
        setIsAnswering(false);
        setIsSuggesting(false);
        setIsRefining(false);
        setIsGeneratingScenarios(false);
        setIsGeneratingPrototype(false);
        setIsGeneratingBddPrototype(false);
        setIsAnalyzingComplexity(false);
        setIsGeneratingGherkin(false);
        setIsGeneratingChecklist(false);
        setIsGeneratingSteps(false);
        setError(null);
        setIsOriginalStoryModalOpen(false);
        setIsFeatureDescriptionModalOpen(false);
        setIsTechSelectionModalOpen(false);
        setIsPoChecklistModalOpen(false);
        setIsStepDefModalOpen(false);
        setIsPrototypeModalOpen(false);
        setRefinementPrompt('');
        setCopied(false);
        setCopiedTurnId(null);
        setTestScenarios(null);
        setIsFeaturesModalOpen(false);
        setModelStory('');
        setIsModelStoryModalOpen(false);
        setPrototypeModel('');
        setLocalPrototypeModel('');
        setIsPrototypeModelModalOpen(false);
        setSuggestedPrototype(null);
        setConfirmationAction(null);
        setPoChecklistCache(null);
        setStepDefCache(null);
        setSelectedScenarioIds([]);
        setPlanningScope('single');
        setCurrentGroupIndexes([]);
        setGeneratedGroupGherkin(null);
        // Reset Caches
        setComplexityCache(null);
        setTestScenariosCache(null);
        setPrototypeCache(null);
        setBddPrototypeCache(null);
        setGherkinCache(null);
        // Reset Data Table state
        setIsDataTableModalOpen(false);
        setDataTableColumns([]);
        setIsExtractingColumns(false);
        setCurrentTurnIdForColumnCheck(null);
    };

    const handleRestart = () => {
        setConfirmationAction({
            title: "Confirmar Reinício",
            message: "Tem certeza que deseja recomeçar? Todo o progresso será perdido.",
            onConfirm: resetApp
        });
    };

    const isRefiningSplitStory = (appState === 'planning' || appState === 'configuring') && splitStories.length > 0;

    const handleBackToSelection = () => {
        const confirmLogic = () => {
           setConversation([]);
           setSuggestedStory(null);
           setError(null);
           setCurrentAnswer('');
           setTestScenarios(null);
           setOriginalStory(null); 
           navigateTo('story_selection');
        };
        setConfirmationAction({
            title: "Voltar para Seleção",
            message: "Tem certeza que deseja voltar? O progresso nesta história será perdido.",
            onConfirm: confirmLogic
        });
    };

    const handleDeleteBddScenario = (id: number) => {
        setConfirmationAction({
            title: "Remover Cenário",
            message: "Tem certeza que deseja remover este cenário?",
            onConfirm: () => {
                setBddScenarios(prev => prev.filter(s => s.id !== id));
            }
        });
    };


    const headerAction = isRefiningSplitStory ? handleBackToSelection : handleRestart;
    const headerText = isRefiningSplitStory ? 'Voltar para Seleção' : 'Recomeçar';
    
    if (appState === 'error') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
                <h2 className="text-2xl text-red-400 mb-4">Ocorreu um Erro</h2>
                <p className="text-gray-400 mb-6">{error}</p>
                <button onClick={resetApp} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded">
                    Começar de Novo
                </button>
            </div>
        );
    }

    const PrototypeModal = ({ prototypeCode, onClose, title }: { prototypeCode: string; onClose: () => void; title: string; }) => {
        const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
        const [copied, setCopied] = useState(false);
    
        const handleCopy = () => {
            navigator.clipboard.writeText(prototypeCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        };

        const handleSave = () => {
            const blob = new Blob([prototypeCode], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'prototype.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };
    
        return (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
                <div className="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full h-[85vh] flex flex-col p-6 border border-gray-700 relative animate-fade-in-up" onClick={e => e.stopPropagation()}>
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700 z-20"><XIcon className="w-6 h-6" /></button>
                    <h3 className="text-xl font-semibold text-purple-300 mb-4 pr-10">{title}</h3>
                    <div className="flex border-b border-gray-700 mb-4">
                        <button className={`py-2 px-4 text-sm font-medium ${activeTab === 'preview' ? 'text-cyan-300 border-b-2 border-cyan-300' : 'text-gray-400'}`} onClick={() => setActiveTab('preview')}>Visualização</button>
                        <button className={`py-2 px-4 text-sm font-medium ${activeTab === 'code' ? 'text-cyan-300 border-b-2 border-cyan-300' : 'text-gray-400'}`} onClick={() => setActiveTab('code')}>Código</button>
                    </div>
                    <div className="flex-grow overflow-auto relative">
                        {activeTab === 'preview' && (
                            <iframe srcDoc={`<script src="https://cdn.tailwindcss.com"></script>${prototypeCode}`} title="Prototype Preview" className="w-full h-full bg-white rounded-md" sandbox="allow-scripts" />
                        )}
                        {activeTab === 'code' && (
                            <div className="relative h-full">
                                <button onClick={handleCopy} title="Copiar Código" className="absolute top-2 right-2 text-gray-400 hover:text-white transition bg-gray-900/50 p-1.5 rounded-md">
                                    {copied ? <ClipboardCheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                                </button>
                                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono bg-gray-900/50 p-4 rounded-md h-full overflow-auto">{prototypeCode}</pre>
                            </div>
                        )}
                    </div>
                     <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-700">
                        <button onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition">Fechar</button>
                        <button onClick={handleSave} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition">
                            <DownloadIcon className="w-5 h-5" />
                            Salvar como HTML
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderContent = () => {
        switch (appState) {
            case 'home':
                return <HomeScreen 
                            onChoice={navigateTo} 
                            onShowFeatures={() => setIsFeaturesModalOpen(true)}
                            onShowModelModal={() => setIsModelStoryModalOpen(true)}
                            onShowPrototypeModal={() => setIsPrototypeModelModalOpen(true)}
                        />;
            case 'refining':
                return <StoryInput onStorySubmit={handleStorySubmit} />;
            case 'generating':
                return <GenerateStoryInput onGenerate={handleGenerateStory} />;
            case 'transcribing_context':
                return <TranscriptionContextScreen onSelect={handleTranscriptionContextSelect} />;
            case 'transcribing_input':
                return <TranscriptionInputScreen
                            mode={transcriptionMode}
                            onRequirementsSubmit={handleRequirementsTranscriptSubmit}
                            onPlanningSubmit={handlePlanningTranscriptSubmit}
                            onHomologationSubmit={handleHomologationTranscriptSubmit}
                        />;
            case 'transcribing_review':
                return transcriptionAnalysisResult && (
                    <TranscriptionReviewScreen 
                        mode={transcriptionMode} 
                        result={transcriptionAnalysisResult} 
                        onBack={() => navigateTo('transcribing_context')} 
                        onCopy={handleCopy} 
                    />
                );
            case 'bdd_input':
                return (
                    <div className="flex flex-col items-center justify-center min-h-screen p-4 -mt-20">
                        <div className="w-full max-w-2xl bg-gray-800 rounded-lg shadow-xl p-6">
                            <h2 className="text-xl font-semibold mb-2 text-gray-200">Criar Feature BDD</h2>
                            <p className="text-gray-400 mb-4 text-sm">Descreva a funcionalidade em alto nível. A IA irá sugerir os cenários de teste.</p>
                            <textarea
                                className="w-full h-40 p-3 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-purple-500 transition text-gray-300 resize-y"
                                value={featureDescription}
                                onChange={(e) => setFeatureDescription(e.target.value)}
                                placeholder="Ex: Um CRUD de Pessoas onde o campo nome é obrigatório e o email deve ser único."
                            />
                            {error && <p className="text-red-400 mt-2 text-sm">{error}</p>}
                            <button
                                onClick={() => handleFeatureSubmit(featureDescription)}
                                disabled={!featureDescription.trim()}
                                className="mt-6 w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 text-white font-bold py-2 px-4 rounded-md transition-transform transform hover:scale-105"
                            >
                                Brainstorm de Cenários
                            </button>
                        </div>
                    </div>
                );
            case 'bdd_converting_doc_input':
                return (
                    <div className="flex flex-col items-center justify-center min-h-screen p-4 -mt-20">
                        <div className="w-full max-w-3xl bg-gray-800 rounded-lg shadow-xl p-6">
                            <h2 className="text-xl font-semibold mb-2 text-gray-200">Converter Documento para BDD</h2>
                            <p className="text-gray-400 mb-4 text-sm">Cole um documento de requisitos tradicional. A IA irá analisá-lo e sugerir uma quebra em features menores e coesas.</p>
                            <textarea
                                className="w-full h-80 p-3 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-purple-500 transition text-gray-300 resize-y"
                                value={documentToConvert}
                                onChange={(e) => setDocumentToConvert(e.target.value)}
                                placeholder="Cole o documento de requisitos aqui..."
                            />
                            {error && <p className="text-red-400 mt-2 text-sm">{error}</p>}
                            <button
                                onClick={() => handleAnalyzeDocument(documentToConvert)}
                                disabled={!documentToConvert.trim()}
                                className="mt-6 w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 text-white font-bold py-2 px-4 rounded-md transition-transform transform hover:scale-105"
                            >
                                Analisar e Quebrar Documento
                            </button>
                        </div>
                    </div>
                );
            case 'bdd_breakdown_review':
                return (
                    <div className="flex flex-col items-center justify-center min-h-screen p-4 -mt-20">
                        <div className="w-full max-w-3xl bg-gray-800 rounded-lg shadow-xl p-6">
                            <h2 className="text-xl font-semibold mb-2 text-gray-200">Análise do Documento</h2>
                            <p className="text-gray-400 mb-6 text-sm">A IA analisou o documento e sugeriu a seguinte quebra em features. Escolha uma para converter em um arquivo BDD (.feature).</p>
                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                                {featureSuggestions.map((feature, index) => (
                                    <button 
                                        key={index} 
                                        onClick={() => handleConvertSelectedFeature(feature.title)}
                                        className="w-full bg-gray-700 hover:bg-gray-600 text-left p-4 rounded-md transition-transform transform hover:scale-105"
                                    >
                                        <h3 className="font-bold text-purple-300">{feature.title}</h3>
                                        <p className="text-sm text-gray-400 mt-2">{feature.summary}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            case 'bdd_converting_doc_review':
                return (
                    <div className="flex flex-col items-center justify-center min-h-screen p-4 -mt-20">
                        <div className="w-full max-w-4xl bg-gray-800 rounded-lg shadow-xl p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold text-purple-300">Arquivo .feature Gerado</h2>
                                <button onClick={() => handleCopy(convertedFeatureFile)} title="Copiar Feature" className="text-gray-400 hover:text-white transition">
                                    {copied ? <ClipboardCheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                                </button>
                            </div>
                            <div className="max-h-[60vh] overflow-y-auto pr-2 bg-gray-900/50 p-4 rounded-md">
                                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                                    <GherkinContent text={convertedFeatureFile} />
                                </pre>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button onClick={() => navigateTo('bdd_breakdown_review')} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">Voltar</button>
                                <button onClick={handleRefineConvertedFeature} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded">Aperfeiçoar Cenários</button>
                            </div>
                        </div>
                    </div>
                );
             case 'bdd_scenarios':
                const BddScenarioList = () => {
                    const [editingIndex, setEditingIndex] = useState<number | null>(null);
                    const [editingText, setEditingText] = useState('');

                    const handleEdit = (index: number) => {
                        setEditingIndex(index);
                        setEditingText(bddScenarios[index].title);
                    };

                    const handleSaveEdit = (index: number) => {
                        const updated = [...bddScenarios];
                        updated[index].title = editingText;
                        setBddScenarios(updated);
                        setEditingIndex(null);
                    };

                    const handleAdd = () => {
                        const newScenario: BddScenario = { id: Date.now(), title: "Novo Cenário", gherkin: null, completed: false, type: 'scenario' };
                        setBddScenarios(prev => [...prev, newScenario]);
                    };
                    const toggleScenarioSelection = (id: number) => {
                        setSelectedScenarioIds(prev =>
                            prev.includes(id) ? prev.filter(scenarioId => scenarioId !== id) : [...prev, id]
                        );
                    };
                    
                    return (
                        <div className="flex flex-col items-center justify-center min-h-screen p-4 -mt-20">
                            <div className="w-full max-w-4xl bg-gray-800 rounded-lg shadow-xl p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h2 className="text-xl font-semibold text-purple-300">Cenários de Teste Sugeridos</h2>
                                        <p className="text-gray-400 text-sm mt-1">Revise, edite e selecione os cenários para detalhar.</p>
                                    </div>
                                    <button onClick={() => setIsFeatureDescriptionModalOpen(true)} className="flex items-center gap-2 text-sm text-gray-300 hover:text-purple-300 transition-colors py-1 px-3 rounded-md hover:bg-gray-700/50">
                                        <DocumentTextIcon className="w-5 h-5" />
                                        <span>Ver Feature</span>
                                    </button>
                                </div>
                                <div className="space-y-3 mb-6 max-h-[50vh] overflow-y-auto pr-2">
                                    {bddScenarios.map((scenario, index) => {
                                        const detailHandler = scenario.type === 'outline'
                                            ? () => handleStartOutlineEditing(index)
                                            : () => handleDetailScenario(index);

                                        const isDisabled = scenario.completed || scenario.type === 'outline';
                                        let tooltipText = '';
                                        if (scenario.completed) {
                                            tooltipText = 'Cenários completos não podem ser selecionados para planejamento em grupo.';
                                        } else if (scenario.type === 'outline') {
                                            tooltipText = 'Scenario Outlines devem ser detalhados individualmente.';
                                        }

                                        return (
                                        <div key={scenario.id} className={`flex items-center p-3 rounded-md transition-colors ${scenario.completed ? 'bg-green-900/40' : 'bg-gray-700/50'}`}>
                                            <div className="relative group mr-4">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedScenarioIds.includes(scenario.id)}
                                                    onChange={() => toggleScenarioSelection(scenario.id)}
                                                    className="h-4 w-4 rounded bg-gray-800 border-gray-600 text-purple-600 focus:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                                                    disabled={isDisabled}
                                                />
                                                {isDisabled && (
                                                    <div role="tooltip" className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max max-w-xs bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10 border border-gray-600 shadow-lg">
                                                        {tooltipText}
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900"></div>
                                                    </div>
                                                )}
                                            </div>
                                            {editingIndex === index ? (
                                                <input
                                                    type="text"
                                                    value={editingText}
                                                    onChange={(e) => setEditingText(e.target.value)}
                                                    onBlur={() => handleSaveEdit(index)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(index)}
                                                    className="flex-grow bg-gray-900 border border-purple-500 rounded px-2 py-1 text-gray-200"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span className={`flex-grow ${scenario.completed ? 'text-gray-400 line-through' : 'text-gray-300'}`}>{scenario.title}</span>
                                            )}
                                            <div className="flex items-center ml-4 space-x-2">
                                                {scenario.completed && <CheckCircleIcon className="w-5 h-5 text-green-400" title="Completo" />}
                                                <button onClick={detailHandler} className="text-gray-400 hover:text-cyan-300 p-1 rounded-full hover:bg-gray-600/50" title="Detalhar este cenário"><PencilIcon className="w-4 h-4" /></button>
                                                <button onClick={() => handleEdit(index)} className="text-gray-400 hover:text-yellow-300 p-1 rounded-full hover:bg-gray-600/50" title="Editar título"><PencilIcon className="w-4 h-4" /></button>
                                                <button onClick={() => handleDeleteBddScenario(scenario.id)} className="text-gray-400 hover:text-red-400 p-1 rounded-full hover:bg-gray-600/50" title="Remover"><TrashIcon className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                                <div className="flex justify-between items-center pt-4 border-t border-gray-700">
                                    <button onClick={handleAdd} className="flex items-center gap-2 text-sm bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-3 rounded transition">
                                        <PlusIcon className="w-5 h-5" />
                                        Adicionar Cenário
                                    </button>
                                    <button
                                        onClick={handleDetailGroupedScenarios}
                                        disabled={selectedScenarioIds.length < 2}
                                        className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 text-white font-bold py-2 px-4 rounded transition"
                                    >
                                        Detalhar {selectedScenarioIds.length > 0 ? `${selectedScenarioIds.length} ` : ''}Cenários Selecionados
                                    </button>
                                </div>
                                {bddScenarios.every(s => s.completed) && bddScenarios.length > 0 && (
                                    <div className="mt-8 p-4 bg-gray-900/50 rounded-lg">
                                        <h3 className="text-lg font-semibold text-cyan-300 mb-3">Todos os cenários foram detalhados!</h3>
                                        <p className="text-gray-400 mb-4">Agora você pode gerar o arquivo .feature completo e outras ferramentas de suporte.</p>
                                        <div className="flex flex-wrap gap-4">
                                            <button onClick={() => {
                                                const fullFeature = `Funcionalidade: ${featureDescription}\n\n` + bddScenarios.map(s => s.gherkin).join('\n\n');
                                                handleCopy(fullFeature);
                                            }} className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition">
                                                <ClipboardIcon className="w-5 h-5" />
                                                Copiar .feature Completo
                                            </button>
                                            <button onClick={() => {
                                                const fullFeature = `Funcionalidade: ${featureDescription}\n\n` + bddScenarios.map(s => s.gherkin).join('\n\n');
                                                handleGenerateBddPrototype(fullFeature);
                                            }} disabled={isGeneratingBddPrototype} className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition">
                                                <CodeIcon className="w-5 h-5" />
                                                {isGeneratingBddPrototype ? 'Gerando...' : 'Gerar Protótipo Visual'}
                                            </button>
                                            <button onClick={() => {
                                                const fullFeature = `Funcionalidade: ${featureDescription}\n\n` + bddScenarios.map(s => s.gherkin).join('\n\n');
                                                handleGeneratePoChecklist(fullFeature);
                                            }} disabled={isGeneratingChecklist} className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition">
                                                <ClipboardListIcon className="w-5 h-5" />
                                                {isGeneratingChecklist ? 'Gerando...' : 'Gerar Checklist de PO'}
                                            </button>
                                            <button onClick={() => setIsTechSelectionModalOpen(true)} className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition">
                                                <CodeIcon className="w-5 h-5" />
                                                Gerar Definições de Steps
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                };
                return <BddScenarioList />;
            case 'scenario_outline_editor':
                if (!editingOutline) return null;
                return (
                    <div className="flex flex-col items-center justify-center min-h-screen p-4 -mt-20">
                        <div className="w-full max-w-5xl bg-gray-800 rounded-lg shadow-xl p-6">
                            <h2 className="text-xl font-semibold text-purple-300 mb-4">{currentScenarioIndex !== null && bddScenarios[currentScenarioIndex]?.title}</h2>
                            
                            {/* Template Section */}
                            <div className="mb-6">
                                <label className="flex justify-between items-center mb-2 text-sm font-medium text-gray-300">
                                    <span>Scenario Outline</span>
                                    <button onClick={() => handleCopy(editingOutline.template)} title="Copiar Template" className="text-gray-400 hover:text-white transition">
                                        {copied ? <ClipboardCheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                                    </button>
                                </label>
                                <textarea
                                    value={editingOutline.template}
                                    onChange={(e) => setEditingOutline({ ...editingOutline, template: e.target.value })}
                                    rows={8}
                                    className="w-full p-3 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-purple-500 transition text-gray-300 resize-y font-mono"
                                />
                            </div>

                            {/* Examples Section */}
                            <div>
                                <h3 className="text-lg font-semibold text-cyan-300 mb-4">Examples</h3>
                                <div className="max-h-[40vh] overflow-auto border border-gray-700 rounded-lg">
                                    <table className="w-full text-sm text-left text-gray-400">
                                        <thead className="text-xs text-gray-300 uppercase bg-gray-700/50 sticky top-0">
                                            <tr>
                                                {editingOutline.headers.map((header, colIndex) => (
                                                    <th key={colIndex} scope="col" className="px-4 py-3">
                                                         <input
                                                            type="text"
                                                            value={header}
                                                            onChange={(e) => {
                                                                const newHeaders = [...editingOutline.headers];
                                                                newHeaders[colIndex] = e.target.value;
                                                                setEditingOutline({...editingOutline, headers: newHeaders});
                                                            }}
                                                            className="w-full bg-transparent border-0 border-b-2 border-gray-600 focus:border-purple-400 focus:outline-none focus:ring-0 p-0"
                                                        />
                                                    </th>
                                                ))}
                                                <th scope="col" className="px-4 py-3 w-12 text-center">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {editingOutline.rows.map((row, rowIndex) => (
                                                <tr key={rowIndex} className="border-b border-gray-700 hover:bg-gray-700/50">
                                                    {row.map((cell, colIndex) => (
                                                        <td key={colIndex} className="px-2 py-1">
                                                            <input
                                                                type="text"
                                                                value={cell}
                                                                onChange={(e) => {
                                                                    const newRows = [...editingOutline.rows];
                                                                    newRows[rowIndex][colIndex] = e.target.value;
                                                                    setEditingOutline({...editingOutline, rows: newRows});
                                                                }}
                                                                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                            />
                                                        </td>
                                                    ))}
                                                    <td className="px-2 py-1 text-center">
                                                        <button onClick={() => {
                                                            if (editingOutline.rows.length > 1) {
                                                                const newRows = editingOutline.rows.filter((_, i) => i !== rowIndex);
                                                                setEditingOutline({...editingOutline, rows: newRows});
                                                            }
                                                        }} disabled={editingOutline.rows.length <= 1} className="text-gray-400 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed p-1" title="Remover linha">
                                                            <TrashIcon className="w-5 h-5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <button onClick={() => {
                                    const newRows = [...editingOutline.rows, Array(editingOutline.headers.length).fill('')];
                                    setEditingOutline({...editingOutline, rows: newRows});
                                }} className="flex items-center gap-2 mt-4 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-3 rounded transition text-sm">
                                    <PlusIcon className="w-4 h-4" />
                                    Adicionar Linha
                                </button>
                            </div>

                             <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-700">
                                <button onClick={() => navigateTo('bdd_scenarios')} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition">Cancelar</button>
                                <button onClick={handleSaveOutline} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition">Salvar e Voltar</button>
                            </div>
                        </div>
                    </div>
                );
            case 'reviewing':
                return originalStory && <ReviewGeneratedStory story={originalStory} onConfirm={handleReviewConfirm} onEdit={(story) => setOriginalStory(story)} />;
            case 'configuring':
                return <PersonaConfiguration onStart={handleStartPlanning} onCancel={handleCancelConfiguration} />;
            case 'loading_generation':
            case 'loading_transcription':
            case 'loading_bdd_scenarios':
            case 'loading_bdd_breakdown':
            case 'loading_bdd_conversion':
            case 'loading_outline_generation':
            case 'loading':
                return (
                    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)]">
                        <Loader text="A IA está trabalhando..." />
                    </div>
                );
            case 'planning':
                if (!currentTurn) {
                    return <Loader text="Carregando sessão..." />;
                }
                return (
                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            {/* Conversation History */}
                            <div className="bg-gray-800/50 p-4 sm:p-6 rounded-lg space-y-6">
                                {conversation.map((turn, index) => (
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
                                        {index < conversation.length - 1 && <hr className="border-gray-700 my-6"/>}
                                    </div>
                                ))}
                                <div ref={conversationEndRef}></div>
                            </div>

                            {/* Answer Input Area */}
                            {!currentTurn.answer && (
                                <div className="bg-gray-800/50 p-4 sm:p-6 rounded-lg" id="answer-section">
                                    <h3 className="text-lg font-semibold text-purple-300 mb-3">Sua Resposta</h3>
                                    <textarea
                                        value={currentAnswer}
                                        onChange={(e) => setCurrentAnswer(e.target.value)}
                                        rows={5}
                                        className="w-full p-3 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-purple-500 transition text-gray-300 resize-y"
                                        placeholder={`Responda como se estivesse falando com o(a) ${currentTurn.persona}...`}
                                        disabled={isAnswering}
                                    />
                                    <div className="flex justify-between items-center mt-4">
                                        <div>
                                            {planningMode === 'bdd' && dataTableColumns.length > 0 && !isExtractingColumns && (
                                                <button
                                                    onClick={() => setIsDataTableModalOpen(true)}
                                                    className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded transition text-sm"
                                                    disabled={isAnswering}
                                                >
                                                    <TableIcon className="w-5 h-5" />
                                                    Inserir Tabela de Dados
                                                </button>
                                            )}
                                            {planningMode === 'bdd' && isExtractingColumns && <p className="text-sm text-gray-400 animate-pulse">Analisando por dados tabulares...</p>}
                                        </div>
                                        <div className="flex gap-4">
                                            <button onClick={handleSkip} disabled={isAnswering} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded transition disabled:opacity-50">Pular</button>
                                            <button onClick={handleAnswerSubmit} disabled={!currentAnswer.trim() || isAnswering} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded transition disabled:bg-gray-500">
                                                {isAnswering ? 'Aguarde...' : 'Enviar Resposta'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* Sidebar */}
                        <div className="bg-gray-800/50 p-6 rounded-lg self-start sticky top-28 space-y-4">
                            <h3 className="text-lg font-semibold text-cyan-300 mb-2">Ferramentas</h3>
                            
                            {planningMode === 'story' && (
                                <>
                                    <button onClick={handleGetSuggestion} disabled={isSuggesting || conversation.length <= 1} className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded transition">
                                        <SparklesIcon className="w-5 h-5" />
                                        {isSuggesting ? 'Sugerindo...' : 'Sugerir Nova Versão'}
                                    </button>
                                    <button onClick={handleGenerateScenarios} disabled={isGeneratingScenarios} className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-bold py-2 px-4 rounded transition">
                                        <ClipboardListIcon className="w-5 h-5" />
                                        {isGeneratingScenarios ? 'Gerando...' : 'Gerar Cenários de Teste'}
                                    </button>
                                    <button onClick={handleAnalyzeComplexity} disabled={isAnalyzingComplexity} className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-bold py-2 px-4 rounded transition">
                                        <ScaleIcon className="w-5 h-5" />
                                        {isAnalyzingComplexity ? 'Analisando...' : 'Analisar Complexidade'}
                                    </button>
                                </>
                            )}

                            {planningMode === 'bdd' && (
                                <button onClick={handleGenerateGherkin} disabled={isGeneratingGherkin || conversation.length <= 1} className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-bold py-2 px-4 rounded transition">
                                    <DocumentTextIcon className="w-5 h-5" />
                                    {isGeneratingGherkin ? 'Gerando...' : 'Gerar Gherkin'}
                                </button>
                            )}
                            
                            <button onClick={handleGeneratePrototype} disabled={isGeneratingPrototype} className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-bold py-2 px-4 rounded transition">
                                <CodeIcon className="w-5 h-5" />
                                {isGeneratingPrototype ? 'Gerando...' : 'Gerar Protótipo'}
                            </button>
                            <button onClick={() => planningMode === 'bdd' ? setIsFeatureDescriptionModalOpen(true) : setIsOriginalStoryModalOpen(true)} className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition">
                                <BookOpenIcon className="w-5 h-5" />
                                {planningMode === 'bdd' ? 'Ver Feature' : 'Ver História Original'}
                            </button>
                             
                            {suggestedStory && planningMode === 'story' && (
                                <div className="pt-4 border-t border-gray-700">
                                    <h4 className="text-md font-semibold text-purple-300 mb-2">História Sugerida</h4>
                                    <div className="bg-gray-900/50 p-3 rounded-md max-h-48 overflow-y-auto">
                                        <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">{suggestedStory}</pre>
                                    </div>
                                    <div className="mt-3">
                                        <textarea
                                            value={refinementPrompt}
                                            onChange={(e) => setRefinementPrompt(e.target.value)}
                                            rows={2}
                                            className="w-full p-2 bg-gray-900 border border-gray-700 rounded-md focus:ring-1 focus:ring-purple-500 transition text-sm text-gray-300 resize-y"
                                            placeholder="Instruções para refinar..."
                                            disabled={isRefining}
                                        />
                                        <button onClick={handleRefineSuggestion} disabled={!refinementPrompt.trim() || isRefining} className="w-full mt-2 bg-purple-700 hover:bg-purple-800 disabled:bg-gray-600 text-white font-bold py-1.5 px-3 rounded transition text-sm">
                                            {isRefining ? 'Refinando...' : 'Refinar Sugestão'}
                                        </button>
                                    </div>
                                </div>
                            )}
                             
                            {generatedSingleGherkin && planningMode === 'bdd' && (
                                <div className="pt-4 border-t border-gray-700">
                                    <div className="flex justify-between items-center mb-2">
                                         <h4 className="text-md font-semibold text-purple-300">Gherkin Gerado</h4>
                                         <button onClick={() => handleCopy(generatedSingleGherkin)} className="text-gray-400 hover:text-white transition-colors">
                                            {copied ? <ClipboardCheckIcon className="w-4 h-4 text-green-400" /> : <ClipboardIcon className="w-4 h-4" />}
                                         </button>
                                    </div>
                                    <div className="bg-gray-900/50 p-3 rounded-md max-h-60 overflow-y-auto">
                                        <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono"><GherkinContent text={generatedSingleGherkin} /></pre>
                                    </div>
                                    <button onClick={handleCompleteBddPlanning} className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition">
                                        Completar e Voltar
                                    </button>
                                </div>
                            )}

                            {generatedGroupGherkin && planningMode === 'bdd' && (
                                <div className="pt-4 border-t border-gray-700">
                                    <h4 className="text-md font-semibold text-purple-300 mb-2">Cenários Gerados</h4>
                                     <div className="bg-gray-900/50 p-3 rounded-md max-h-60 overflow-y-auto space-y-4">
                                        {generatedGroupGherkin.map(g => (
                                            <details key={g.title} className="bg-gray-700/50 p-2 rounded">
                                                <summary className="font-semibold cursor-pointer text-sm">{g.title}</summary>
                                                <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono mt-2 pl-2 border-l-2 border-gray-500"><GherkinContent text={g.gherkin} /></pre>
                                            </details>
                                        ))}
                                    </div>
                                    <button onClick={handleCompleteBddPlanning} className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition">
                                        Completar e Voltar
                                    </button>
                                </div>
                            )}

                            {testScenarios && (
                                <div className="pt-4 border-t border-gray-700">
                                    <div className="flex justify-between items-center mb-2">
                                         <h4 className="text-md font-semibold text-purple-300">Cenários de Teste</h4>
                                         <button onClick={() => handleCopy(testScenarios)} className="text-gray-400 hover:text-white transition-colors">
                                            {copied ? <ClipboardCheckIcon className="w-4 h-4 text-green-400" /> : <ClipboardIcon className="w-4 h-4" />}
                                         </button>
                                    </div>
                                    <div className="bg-gray-900/50 p-3 rounded-md max-h-48 overflow-y-auto">
                                        <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">{testScenarios}</pre>
                                    </div>
                                </div>
                            )}
                        </div>
                     </div>
                );
            case 'story_selection':
                return <StorySelectionScreen stories={splitStories} onSelectStory={handleSelectSplitStory} />;
            default:
                return <div>Estado não implementado: {appState}</div>
        }
    };

    return (
        <div className="bg-gray-900 text-gray-200 min-h-screen font-sans">
            <Header onHomeClick={headerAction} showHomeButton={appState !== 'home'} homeButtonText={headerText} onBack={handleGoBack} showBack={navigationHistory.length > 1} />
            <main className="container mx-auto p-4">
                <Breadcrumbs 
                    history={navigationHistory}
                    onNavigate={handleBreadcrumbNavigate}
                    translate={translateStateToFriendlyName}
                />
                {renderContent()}
            </main>

            {isFeaturesModalOpen && <FeaturesModal onClose={() => setIsFeaturesModalOpen(false)} />}
            {isModelStoryModalOpen && <ModelStoryModal initialModel={modelStory} onSave={setModelStory} onClose={() => setIsModelStoryModalOpen(false)} />}
            {isPrototypeModelModalOpen && <PrototypeModelModal initialModel={prototypeModel} onSave={setPrototypeModel} onClose={() => setIsPrototypeModelModalOpen(false)} />}
            {confirmationAction && <ConfirmationModal action={confirmationAction} onClose={() => setConfirmationAction(null)} />}
            
            {originalStory && isOriginalStoryModalOpen && (
                <OriginalStoryModal story={originalStory} onClose={() => setIsOriginalStoryModalOpen(false)} />
            )}

            {isFeatureDescriptionModalOpen && (
                <FeatureDescriptionModal description={featureDescription} onClose={() => setIsFeatureDescriptionModalOpen(false)} />
            )}
            
            {complexityAnalysis && <ComplexityAnalysisModal result={complexityAnalysis} onClose={() => setComplexityAnalysis(null)} onAcceptSplit={handleAcceptSplit} />}
            
            {suggestedPrototype && isPrototypeModalOpen && (
                <PrototypeModal prototypeCode={suggestedPrototype} onClose={() => setIsPrototypeModalOpen(false)} title="Protótipo Visual da Funcionalidade" />
            )}
            
            {poChecklistContent && isPoChecklistModalOpen && (
                 <OriginalStoryModal 
                    story={{ title: "Checklist de Pré-Homologação", description: poChecklistContent }} 
                    onClose={() => setIsPoChecklistModalOpen(false)} 
                    titleOverride="Checklist de Pré-Homologação" 
                    onDownload={() => handleDownload(poChecklistContent, 'po-checklist.txt')}
                 />
            )}
            
            {stepDefContent && isStepDefModalOpen && (
                <OriginalStoryModal 
                    story={{ title: `Step Definitions (${selectedTechnology})`, description: stepDefContent }} 
                    onClose={() => setIsStepDefModalOpen(false)}
                    titleOverride={`Step Definitions (${selectedTechnology})`} 
                    onDownload={() => handleDownload(stepDefContent, `steps.${getFileExtension(selectedTechnology)}`)}
                />
            )}
            
            {isTechSelectionModalOpen && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                     <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-700 animate-fade-in-up">
                        <h3 className="text-xl font-semibold text-purple-300 mb-4">Selecione a Tecnologia</h3>
                        <select
                            value={selectedTechnology}
                            onChange={(e) => setSelectedTechnology(e.target.value)}
                            className="w-full p-2 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-purple-500 transition text-gray-300"
                        >
                            <option>JavaScript - Cypress</option>
                            <option>Python - Behave</option>
                            <option>Java - Cucumber</option>
                            <option>PHP</option>
                            <option>C#</option>
                        </select>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setIsTechSelectionModalOpen(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition">Cancelar</button>
                            <button onClick={() => {
                                if (!bddScenarios.every(s => s.completed)) return;
                                const fullFeature = `Funcionalidade: ${featureDescription}\n\n` + bddScenarios.map(s => s.gherkin).join('\n\n');
                                handleGenerateStepDefs(fullFeature);
                            }} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition">Gerar</button>
                        </div>
                     </div>
                </div>
            )}

            <DataTableModal
                title="Inserir Dados Tabulares"
                columns={dataTableColumns}
                isOpen={isDataTableModalOpen}
                onClose={() => setIsDataTableModalOpen(false)}
                onConfirm={(tableString) => {
                    setCurrentAnswer(prev => prev + tableString);
                }}
            />
        </div>
    );
};

export default App;
