
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Persona, ParsedStory, RedmineIssue, ConversationTurn, ComplexityAnalysisResult, SplitStory, BddFeatureSuggestion, GherkinScenario, SessionData, QuestionResponse, BddScenario } from './types';
import { generateInitialQuestions, suggestNewStoryVersion, generateFollowUpQuestion, generateNewStory, refineSuggestedStory, generateTestScenarios, analyzeStoryComplexity, generateStoriesFromTranscript, generatePrototype, generateBddScenarios, generateBddFollowUpQuestion, generateGherkinFromConversation, generatePoChecklist, generateStepDefinitions, convertDocumentToBdd, analyzeAndBreakdownDocument, analyzePlanningTranscript, analyzeHomologationTranscript, generatePrototypeFromFeature, generateBddFollowUpQuestionForGroup, generateGherkinFromGroupConversation, extractTableColumnsFromQuestion, generateInitialScenarioOutline, generateConversationInsights, generateUserFlowDiagram } from './services/geminiService';
import { personaDetails, UserIcon, BookOpenIcon, XIcon, MenuIcon, SparklesIcon, HomeIcon, ClipboardIcon, ClipboardCheckIcon, ClipboardListIcon, InformationCircleIcon, ScaleIcon, MicrophoneIcon, TemplateIcon, ViewBoardsIcon, DocumentTextIcon, CheckCircleIcon, PencilIcon, TrashIcon, CodeIcon, SwitchHorizontalIcon, DownloadIcon, TableIcon, PlusIcon, ArrowLeftIcon, FlowIcon } from './components/icons';
import DataTableModal from './components/DataTableModal';
import Breadcrumbs from './components/Breadcrumbs';
import WorkspaceView from './components/WorkspaceView';
import HistorySidebar from './components/HistorySidebar';
import GherkinEditor from './components/GherkinEditor';
import ExportModal from './components/ExportModal';


type ConfirmationAction = {
    title: string;
    message: string;
    onConfirm: () => void;
} | null;

type TranscriptionMode = 'requirements' | 'planning' | 'homologation';

type AppState = 'home' | 'workspace' | 'refining' | 'generating' | 'transcribing_context' | 'transcribing_input' | 'transcribing_review' | 'bdd_input' | 'bdd_scenarios' | 'bdd_review' | 'bdd_converting_doc_input' | 'bdd_breakdown_review' | 'bdd_feature_selection' | 'bdd_converting_doc_review' | 'loading_generation' | 'loading_transcription' | 'loading_bdd_scenarios' | 'loading_bdd_breakdown' | 'loading_bdd_conversion' | 'loading_outline_generation' | 'scenario_outline_editor' | 'reviewing' | 'loading' | 'error' | 'analyzing_complexity' | 'story_selection';

const translateStateToFriendlyName = (state: AppState): string => {
    const nameMap: Record<AppState, string> = {
        'home': 'Início',
        'workspace': 'Mesa de Trabalho',
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
    <header className="relative bg-gray-900/80 backdrop-blur-sm p-4 border-b border-gray-700 sticky top-0 z-20 flex items-center justify-center h-[85px] shrink-0">
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
                    <li><span className="font-semibold">Perguntas Contextuais e Coach Mode:</span> A IA faz perguntas sequenciais e fornece insights educacionais para explicar a importância de cada questão.</li>
                    <li><span className="font-semibold">Insights em Tempo Real:</span> Acompanhe um resumo dinâmico dos pontos de atenção e decisões tomadas durante a conversa.</li>
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
                    <li><span className="font-semibold">Fluxo Visual (Diagrama):</span> Gere automaticamente um diagrama de fluxo do usuário (Mermaid.js) baseado na história para identificar falhas lógicas.</li>
                    <li><span className="font-semibold">Geração de Cenários de Teste:</span> Gere cenários de teste (caminho feliz, casos de borda, negativos) para a versão atual da história a qualquer momento.</li>
                     <li><span className="font-semibold">Prototipagem Visual com IA:</span> Crie um protótipo visual (HTML/Tailwind CSS) a partir da história de usuário ou de um arquivo .feature completo para acelerar o alinhamento. O protótipo é exibido em um modal com visualização ao vivo e opção de salvar como .html.</li>
                     <li><span className="font-semibold">Checklist de Pré-Homologação (BDD):</span> Gere um roteiro de teste em linguagem natural para o PO validar a entrega a partir do arquivo .feature.</li>
                     <li><span className="font-semibold">Definições de Steps (BDD):</span> Gere o código completo das Step Definitions (JS, Python, Java, PHP, C#) para acelerar a automação de testes.</li>
                </ul>
            </div>
            <div>
                <h4 className="font-bold text-cyan-300">Utilitários e Exportação</h4>
                <ul className="list-disc list-inside space-y-1 mt-1">
                    <li><span className="font-semibold">Histórico de Sessão:</span> Salva automaticamente seu progresso. Retome sessões anteriores através da barra lateral.</li>
                    <li><span className="font-semibold">Exportação Profissional:</span> Exporte sua história refinada para Jira, Markdown ou gere um relatório HTML completo com diagramas e protótipos inclusos.</li>
                    <li><span className="font-semibold">Acesso Rápido:</span> Visualize a história original, o cenário atual ou a feature BDD em um modal a qualquer momento.</li>
                    <li><span className="font-semibold">Copiar para a Área de Transferência:</span> Copie facilmente a história original, perguntas, sugestões, testes e protótipos.</li>
                </ul>
            </div>
        </div>
      </div>
    </div>
);


const HomeScreen = ({ onChoice, onShowFeatures, onShowModelModal, onShowPrototypeModal }: { onChoice: (choice: 'refining' | 'generating' | 'transcribing_context' | 'bdd_input' | 'bdd_converting_doc_input') => void; onShowFeatures: () => void; onShowModelModal: () => void; onShowPrototypeModal: () => void; }) => (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-85px)] p-4">
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
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-85px)] p-4">
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
                    Iniciar Refinamento
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
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-85px)] p-4">
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
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-85px)] p-4">
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
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-85px)] p-4">
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
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-85px)] p-4">
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
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-85px)] p-4">
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
                    Confirmar e Iniciar Refinamento
                </button>
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
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-85px)] p-4">
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
    // Session Management State
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [sessions, setSessions] = useState<SessionData[]>([]);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    const [appState, setAppState] = useState<AppState>('home');
    const [navigationHistory, setNavigationHistory] = useState<AppState[]>(['home']);

    // Story refinement state
    const [originalStory, setOriginalStory] = useState<ParsedStory | null>(null);
    const [suggestedStory, setSuggestedStory] = useState<string | null>(null);
    const [splitStories, setSplitStories] = useState<SplitStory[]>([]);
    const [complexityAnalysis, setComplexityAnalysis] = useState<ComplexityAnalysisResult | null>(null);
    const [suggestionForReview, setSuggestionForReview] = useState<string | null>(null);
    const [storyHistory, setStoryHistory] = useState<string[]>([]);
    
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
    const [conversationInsights, setConversationInsights] = useState<string | null>(null);
    const [currentAnswer, setCurrentAnswer] = useState('');
    const [satisfiedPersonas, setSatisfiedPersonas] = useState<Persona[]>([]);
    
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
    
    // Editor Table Insertion State
    const [cursorPositionForTable, setCursorPositionForTable] = useState<number | null>(null);
    const [tableTarget, setTableTarget] = useState<'answer' | 'editor'>('answer');

    // User Flow Diagram State
    const [userFlowDiagram, setUserFlowDiagram] = useState<string | null>(null);
    const [isGeneratingDiagram, setIsGeneratingDiagram] = useState(false);

    // Export State
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    // Cache states
    const [complexityCache, setComplexityCache] = useState<{ description: string; result: ComplexityAnalysisResult; } | null>(null);
    const [testScenariosCache, setTestScenariosCache] = useState<{ description: string; scenarios: string; } | null>(null);
    const [prototypeCache, setPrototypeCache] = useState<{ description: string; model: string; prototype: string; } | null>(null);
    const [bddPrototypeCache, setBddPrototypeCache] = useState<{ featureContent: string; model: string; prototype: string; } | null>(null);
    const [gherkinCache, setGherkinCache] = useState<{ conversation: ConversationTurn[]; gherkin: string | GherkinScenario[]; } | null>(null);
    const [diagramCache, setDiagramCache] = useState<{ description: string; diagram: string; } | null>(null);

    const currentTurn = conversation[conversation.length - 1];

    // --- PERSISTENCE LOGIC ---

    // Load sessions on mount
    useEffect(() => {
        const savedSessions = localStorage.getItem('user-story-enhancer-sessions');
        if (savedSessions) {
            try {
                const parsedSessions: SessionData[] = JSON.parse(savedSessions);
                setSessions(parsedSessions);
                
                const activeSessionId = localStorage.getItem('activeSessionId');
                if (activeSessionId) {
                    const activeSession = parsedSessions.find(s => s.id === activeSessionId);
                    if (activeSession) {
                        restoreSession(activeSession);
                    }
                }
            } catch (e) {
                console.error("Failed to load sessions", e);
            }
        }
        setIsInitialLoad(false);
    }, []);

    // Debounce function
    const useDebounce = (value: any, delay: number) => {
        const [debouncedValue, setDebouncedValue] = useState(value);
        useEffect(() => {
            const handler = setTimeout(() => {
                setDebouncedValue(value);
            }, delay);
            return () => {
                clearTimeout(handler);
            };
        }, [value, delay]);
        return debouncedValue;
    };

    const currentSessionState: SessionData['data'] = {
        appState,
        navigationHistory,
        originalStory,
        suggestedStory,
        splitStories,
        complexityAnalysis,
        suggestionForReview,
        storyHistory,
        transcriptionMode,
        transcriptionAnalysisResult,
        planningMode,
        featureDescription,
        bddScenarios,
        currentScenarioIndex,
        generatedSingleGherkin,
        generatedGroupGherkin,
        poChecklistContent,
        stepDefContent,
        selectedTechnology,
        documentToConvert,
        featureSuggestions,
        convertedFeatureFile,
        selectedScenarioIds,
        planningScope,
        currentGroupIndexes,
        activePersonas,
        conversation,
        conversationInsights,
        currentAnswer,
        satisfiedPersonas,
        testScenarios,
        modelStory,
        prototypeModel,
        userFlowDiagram
    };

    const debouncedSessionState = useDebounce(currentSessionState, 1000);

    // Save session on state change
    useEffect(() => {
        if (isInitialLoad) return;

        // Only save if we have a current ID, or if we have data to save (create new ID)
        const hasData = originalStory || featureDescription || documentToConvert || transcriptionAnalysisResult;
        
        if (!currentSessionId && !hasData) return;

        let sessionId = currentSessionId;
        if (!sessionId && hasData) {
            sessionId = crypto.randomUUID();
            setCurrentSessionId(sessionId);
            localStorage.setItem('activeSessionId', sessionId);
        }

        if (sessionId) {
            let title = 'Nova Sessão';
            if (originalStory?.title) title = originalStory.title;
            else if (featureDescription) title = featureDescription.substring(0, 30) + (featureDescription.length > 30 ? '...' : '');
            else if (documentToConvert) title = "Análise de Documento";
            else if (transcriptionAnalysisResult) title = "Análise de Transcrição";

            const sessionData: SessionData = {
                id: sessionId,
                lastModified: Date.now(),
                title: title,
                data: debouncedSessionState
            };

            setSessions(prev => {
                const existingIndex = prev.findIndex(s => s.id === sessionId);
                let newSessions;
                if (existingIndex >= 0) {
                    newSessions = [...prev];
                    newSessions[existingIndex] = sessionData;
                } else {
                    newSessions = [sessionData, ...prev];
                }
                // Sort by last modified
                newSessions.sort((a, b) => b.lastModified - a.lastModified);
                // Keep only top 5
                if (newSessions.length > 5) newSessions = newSessions.slice(0, 5);
                
                localStorage.setItem('user-story-enhancer-sessions', JSON.stringify(newSessions));
                return newSessions;
            });
        }

    }, [debouncedSessionState, currentSessionId, isInitialLoad]);

    const restoreSession = (session: SessionData) => {
        setCurrentSessionId(session.id);
        localStorage.setItem('activeSessionId', session.id);
        
        const d = session.data;
        setAppState(d.appState as AppState);
        setNavigationHistory(d.navigationHistory as AppState[]);
        setOriginalStory(d.originalStory);
        setSuggestedStory(d.suggestedStory);
        setSplitStories(d.splitStories);
        setComplexityAnalysis(d.complexityAnalysis);
        setSuggestionForReview(d.suggestionForReview);
        setStoryHistory(d.storyHistory);
        setTranscriptionMode(d.transcriptionMode);
        setTranscriptionAnalysisResult(d.transcriptionAnalysisResult);
        setPlanningMode(d.planningMode);
        setFeatureDescription(d.featureDescription);
        setBddScenarios(d.bddScenarios);
        setCurrentScenarioIndex(d.currentScenarioIndex);
        setGeneratedSingleGherkin(d.generatedSingleGherkin);
        setGeneratedGroupGherkin(d.generatedGroupGherkin || null);
        setPoChecklistContent(d.poChecklistContent);
        setStepDefContent(d.stepDefContent);
        setSelectedTechnology(d.selectedTechnology);
        setDocumentToConvert(d.documentToConvert);
        setFeatureSuggestions(d.featureSuggestions);
        setConvertedFeatureFile(d.convertedFeatureFile);
        setSelectedScenarioIds(d.selectedScenarioIds);
        setPlanningScope(d.planningScope);
        setCurrentGroupIndexes(d.currentGroupIndexes);
        setActivePersonas(d.activePersonas);
        setConversation(d.conversation);
        setConversationInsights(d.conversationInsights);
        setCurrentAnswer(d.currentAnswer);
        setSatisfiedPersonas(d.satisfiedPersonas);
        setTestScenarios(d.testScenarios);
        setModelStory(d.modelStory);
        setPrototypeModel(d.prototypeModel);
        setUserFlowDiagram(d.userFlowDiagram || null);
        
        // Clear temp caches on session switch
        invalidateCaches();
    };

    const handleDeleteSession = (id: string) => {
        const newSessions = sessions.filter(s => s.id !== id);
        setSessions(newSessions);
        localStorage.setItem('user-story-enhancer-sessions', JSON.stringify(newSessions));
        
        if (currentSessionId === id) {
            resetApp();
        }
    };

    const resetTranscriptionState = () => {
        setTranscriptionMode(null);
        setTranscriptionAnalysisResult(null);
        setSplitStories([]);
    };

    const resetBddConversionState = () => {
        setDocumentToConvert('');
        setFeatureSuggestions([]);
        setConvertedFeatureFile('');
    };

    const invalidateCaches = () => {
        setComplexityCache(null);
        setTestScenariosCache(null);
        setPrototypeCache(null);
        setBddPrototypeCache(null);
        setGherkinCache(null);
        setPoChecklistCache(null);
        setStepDefCache(null);
        setDiagramCache(null);
    };

    const navigateTo = (newState: AppState) => {
        const startOfNonTranscriptionFlows: AppState[] = [
            'refining', 
            'generating', 
            'bdd_input', 
            'bdd_converting_doc_input'
        ];
    
        if (startOfNonTranscriptionFlows.includes(newState)) {
            resetTranscriptionState();
        }
    
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

    // --- REAL-TIME INSIGHTS LOGIC ---
    useEffect(() => {
        // Generate insights every 3 completed turns to avoid API spam
        const completedTurns = conversation.filter(t => t.answer).length;
        if (completedTurns > 0 && completedTurns % 3 === 0 && appState === 'workspace') {
            const updateInsights = async () => {
                const insights = await generateConversationInsights(conversation);
                setConversationInsights(insights);
            };
            updateInsights();
        }
    }, [conversation, appState]);

    useEffect(() => {
        // Check if it's a new turn that hasn't been processed for columns yet
        if (appState === 'workspace' && planningMode === 'bdd' && currentTurn && !currentTurn.answer && currentTurn.id !== currentTurnIdForColumnCheck) {
            const inferColumns = async () => {
                setCurrentTurnIdForColumnCheck(currentTurn.id); // Mark as processed
                setIsExtractingColumns(true);
                setTableTarget('answer');
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
        }
    };

    const handleStorySubmit = useCallback((story: ParsedStory) => {
        setPlanningMode('story');
        setOriginalStory(story);
        navigateTo('workspace');
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
        navigateTo('workspace');
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
        navigateTo('workspace');
    }, [bddScenarios, featureDescription, selectedScenarioIds]);

    const handleReviewConfirm = useCallback(() => {
        if (!originalStory) return;
        setPlanningMode('story');
        navigateTo('workspace');
    }, [originalStory]);

    const handleStartPlanning = useCallback(async (selectedPersonas: Persona[]) => {
        setSatisfiedPersonas([]);
        setConversationInsights(null);
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
        
        setActivePersonas(selectedPersonas);
        setError(null);
        setIsAnswering(true);
        try {
            const initialQs = await generateInitialQuestions(contextStory, selectedPersonas);
            
            const firstQuestion: ConversationTurn = {
                id: Date.now(),
                persona: selectedPersonas[0],
                question: initialQs[personaToKey(selectedPersonas[0])],
            };
            setConversation([firstQuestion]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
            navigateTo('error');
        } finally {
            setIsAnswering(false);
        }
    }, [originalStory, planningMode, currentScenarioIndex, bddScenarios, featureDescription, planningScope, currentGroupIndexes]);

    const submitAnswer = useCallback(async (answer: string) => {
        if (!originalStory || activePersonas.length === 0) return;

        setIsAnswering(true);
        setGherkinCache(null);
        setGeneratedSingleGherkin(null);
        setGeneratedGroupGherkin(null);

        const answeredTurnConversation = conversation.map((turn, index) =>
            index === conversation.length - 1 ? { ...turn, answer } : turn
        );

        let tempConversation = answeredTurnConversation;
        let tempSatisfiedPersonas = [...satisfiedPersonas];
        const lastAskingPersona = conversation[conversation.length - 1].persona;
        let nextPersonaIndex = activePersonas.findIndex(p => p === lastAskingPersona);

        try {
            for (let i = 0; i < activePersonas.length; i++) {
                nextPersonaIndex = (nextPersonaIndex + 1) % activePersonas.length;
                const nextPersona = activePersonas[nextPersonaIndex];

                if (tempSatisfiedPersonas.includes(nextPersona)) {
                    continue;
                }

                let aiResponse: QuestionResponse;
                 if (planningMode === 'bdd') {
                    const titles = planningScope === 'single' ? [originalStory.title] : currentGroupIndexes.map(i => bddScenarios[i].title);
                    if (planningScope === 'single') {
                        aiResponse = await generateBddFollowUpQuestion(featureDescription, titles[0], tempConversation, nextPersona);
                    } else {
                        aiResponse = await generateBddFollowUpQuestionForGroup(featureDescription, titles, tempConversation, nextPersona);
                    }
                } else {
                    aiResponse = await generateFollowUpQuestion(originalStory, tempConversation, nextPersona);
                }


                if (aiResponse.isConsensus) {
                    if (!tempSatisfiedPersonas.includes(nextPersona)) {
                      tempSatisfiedPersonas.push(nextPersona);
                    }

                    const conclusionTurn: ConversationTurn = {
                        id: Date.now() + i,
                        persona: nextPersona,
                        question: `Entendido. Da minha perspectiva como ${nextPersona}, não tenho mais dúvidas.`,
                        isSystemMessage: true,
                        educationalInsight: aiResponse.educationalInsight
                    };
                    tempConversation = [...tempConversation, conclusionTurn];

                    if (tempSatisfiedPersonas.length === activePersonas.length) {
                        break;
                    }
                    continue;
                } else {
                    const nextQuestionTurn: ConversationTurn = {
                        id: Date.now() + i,
                        persona: nextPersona,
                        question: aiResponse.question,
                        educationalInsight: aiResponse.educationalInsight
                    };
                    tempConversation = [...tempConversation, nextQuestionTurn];
                    break; 
                }
            }

            setConversation(tempConversation);
            setSatisfiedPersonas(tempSatisfiedPersonas);
            setCurrentAnswer('');

            if (tempSatisfiedPersonas.length === activePersonas.length && activePersonas.length > 0) {
                setConversation(prev => [...prev, {
                    id: Date.now() + 99,
                    persona: Persona.PO,
                    question: "Consenso atingido! Todas as personas estão satisfeitas. Você já pode sugerir uma nova versão da história.",
                    isSystemMessage: true
                }]);
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao obter a próxima pergunta.');
        } finally {
            setIsAnswering(false);
        }
    }, [conversation, originalStory, activePersonas, satisfiedPersonas, planningMode, featureDescription, planningScope, currentGroupIndexes, bddScenarios]);

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
        try {
            const lastTurn = conversation[conversation.length - 1];
            const conversationForSuggestion = lastTurn.answer ? conversation : conversation.slice(0, -1);
            const suggestion = await suggestNewStoryVersion(originalStory, conversationForSuggestion);
            setSuggestionForReview(suggestion);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao gerar a sugestão.');
        } finally {
            setIsSuggesting(false);
        }
    }, [originalStory, conversation]);
    
    const handleAcceptSuggestion = (newStory: string) => {
        const currentText = suggestedStory ?? (originalStory ? originalStory.description : '');
        if (currentText) {
            setStoryHistory(prev => [...prev, currentText]);
        }
        setSuggestedStory(newStory);
        setSuggestionForReview(null);
        // Invalidate caches that depend on the story description
        invalidateCaches();
    };

    const handleDiscardSuggestion = () => {
        setSuggestionForReview(null);
    };
    
    const handleRefineSuggestionInReview = useCallback(async (currentSuggestion: string, prompt: string) => {
        if (!prompt.trim()) return;
        setIsRefining(true);
        setError(null);
        try {
            const refined = await refineSuggestedStory(currentSuggestion, prompt);
            setSuggestionForReview(refined);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao refinar a sugestão.');
        } finally {
            setIsRefining(false);
        }
    }, []);

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
        setConversationInsights(null);
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
        setSatisfiedPersonas([]);
        setSuggestedStory(null);
        setError(null);
        setCurrentAnswer('');
        setTestScenarios(null);
        setSuggestedPrototype(null);
        setComplexityAnalysis(null);
        setLocalPrototypeModel('');
        setConversationInsights(null);
        setUserFlowDiagram(null); // Reset diagram
        // Reset Caches
        setComplexityCache(null);
        setTestScenariosCache(null);
        setPrototypeCache(null);
        setDiagramCache(null);
        
        // Set new story and move to config
        setOriginalStory(story);
        setPlanningMode('story');
        navigateTo('workspace');
    }, []);

    const handleSaveModelStory = (model: string) => {
        setModelStory(model);
        invalidateCaches();
    };

    const handleSavePrototypeModel = (model: string) => {
        setPrototypeModel(model);
        invalidateCaches();
    };

    const handleInsertTable = (cursorIndex: number, target: 'answer' | 'editor') => {
        setCursorPositionForTable(cursorIndex);
        setTableTarget(target);
        setIsDataTableModalOpen(true);
    };

    const handleGenerateDiagram = useCallback(async () => {
        if (!originalStory) return;
        const storyToDiagram = suggestedStory ? { title: originalStory.title, description: suggestedStory } : originalStory;

        if (diagramCache && diagramCache.description === storyToDiagram.description) {
            setUserFlowDiagram(diagramCache.diagram);
            return;
        }

        setIsGeneratingDiagram(true);
        setUserFlowDiagram(null);
        setError(null);
        try {
            const diagram = await generateUserFlowDiagram(storyToDiagram);
            setUserFlowDiagram(diagram);
            setDiagramCache({ description: storyToDiagram.description, diagram });
        } catch (err) {
             setError(err instanceof Error ? err.message : 'Falha ao gerar o diagrama de fluxo.');
        } finally {
            setIsGeneratingDiagram(false);
        }
    }, [originalStory, suggestedStory, diagramCache]);

    const resetApp = () => {
        setCurrentSessionId(null);
        localStorage.removeItem('activeSessionId');

        setAppState('home');
        setNavigationHistory(['home']);
        setOriginalStory(null);
        setSuggestedStory(null);
        setComplexityAnalysis(null);
        resetTranscriptionState();
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
        setConversationInsights(null);
        setSatisfiedPersonas([]);
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
        setUserFlowDiagram(null);
        setIsGeneratingDiagram(false);

        // Reset Caches
        setComplexityCache(null);
        setTestScenariosCache(null);
        setPrototypeCache(null);
        setBddPrototypeCache(null);
        setGherkinCache(null);
        setDiagramCache(null);
        // Reset Data Table state
        setIsDataTableModalOpen(false);
        setDataTableColumns([]);
        setIsExtractingColumns(false);
        setCurrentTurnIdForColumnCheck(null);
        setCursorPositionForTable(null);
    };

    const handleRestart = () => {
        setConfirmationAction({
            title: "Confirmar Reinício",
            message: "Tem certeza que deseja recomeçar esta sessão? Os dados atuais serão limpos.",
            onConfirm: resetApp
        });
    };

    const isRefiningSplitStory = (appState === 'workspace') && splitStories.length > 0;

    const handleBackToSelection = () => {
        const confirmLogic = () => {
           setConversation([]);
           setConversationInsights(null);
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
                    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-85px)] p-4">
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
                    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-85px)] p-4">
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
                    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-85px)] p-4">
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
                    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-85px)] p-4">
                        <div className="w-full max-w-4xl bg-gray-800 rounded-lg shadow-xl p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold text-purple-300">Arquivo .feature Gerado</h2>
                                <button onClick={() => handleCopy(convertedFeatureFile)} title="Copiar Feature" className="text-gray-400 hover:text-white transition">
                                    {copiedTurnId ? <ClipboardCheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                                </button>
                            </div>
                            <div className="max-h-[60vh] overflow-y-auto pr-2 bg-gray-900 rounded-md">
                                <GherkinEditor value={convertedFeatureFile} readOnly className="h-full min-h-[400px] border-none" />
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
                        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-85px)] p-4">
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
                    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-85px)] p-4">
                        <div className="w-full max-w-5xl bg-gray-800 rounded-lg shadow-xl p-6">
                            <h2 className="text-xl font-semibold text-purple-300 mb-4">{currentScenarioIndex !== null && bddScenarios[currentScenarioIndex]?.title}</h2>
                            
                            {/* Template Section with Gherkin Editor */}
                            <div className="mb-6">
                                <label className="flex justify-between items-center mb-2 text-sm font-medium text-gray-300">
                                    <span>Scenario Outline (Editor BDD)</span>
                                </label>
                                <GherkinEditor
                                    value={editingOutline.template}
                                    onChange={(newValue) => setEditingOutline({ ...editingOutline, template: newValue })}
                                    className="h-64"
                                    title="Editor de Template"
                                    onRequestTable={(cursor) => handleInsertTable(cursor, 'editor')}
                                />
                            </div>

                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-700">
                                <button onClick={() => navigateTo('bdd_scenarios')} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition">Cancelar</button>
                                <button onClick={handleSaveOutline} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition">Salvar e Concluir</button>
                            </div>
                        </div>
                    </div>
                );
            case 'reviewing':
                return originalStory && (
                    <ReviewGeneratedStory 
                        story={originalStory} 
                        onConfirm={handleReviewConfirm}
                        onEdit={setOriginalStory}
                    />
                );
             case 'story_selection':
                return (
                    <StorySelectionScreen 
                        stories={splitStories} 
                        onSelectStory={handleSelectSplitStory} 
                    />
                );
             case 'workspace':
                return (
                    <WorkspaceView
                        planningMode={planningMode}
                        originalStory={originalStory}
                        featureDescription={featureDescription}
                        bddScenarios={bddScenarios}
                        conversation={conversation}
                        conversationInsights={conversationInsights}
                        activePersonas={activePersonas}
                        satisfiedPersonas={satisfiedPersonas}
                        suggestedStory={suggestedStory}
                        isSuggesting={isSuggesting}
                        refinementPrompt={refinementPrompt}
                        isRefining={isRefining}
                        testScenarios={testScenarios}
                        isGeneratingScenarios={isGeneratingScenarios}
                        complexityAnalysis={complexityAnalysis}
                        isAnalyzingComplexity={isAnalyzingComplexity}
                        isGeneratingPrototype={isGeneratingPrototype}
                        isAnswering={isAnswering}
                        currentAnswer={currentAnswer}
                        generatedSingleGherkin={generatedSingleGherkin}
                        isGeneratingGherkin={isGeneratingGherkin}
                        suggestionForReview={suggestionForReview}
                        setOriginalStory={setOriginalStory}
                        setFeatureDescription={setFeatureDescription}
                        handleStartPlanning={handleStartPlanning}
                        handleAnswerSubmit={handleAnswerSubmit}
                        handleSkip={handleSkip}
                        setCurrentAnswer={setCurrentAnswer}
                        handleGetSuggestion={handleGetSuggestion}
                        setRefinementPrompt={setRefinementPrompt}
                        handleGenerateScenarios={handleGenerateScenarios}
                        handleAnalyzeComplexity={handleAnalyzeComplexity}
                        handleGeneratePrototype={handleGeneratePrototype}
                        handleGenerateGherkin={handleGenerateGherkin}
                        handleCompleteBddPlanning={handleCompleteBddPlanning}
                        handleCopy={handleCopy}
                        copiedTurnId={copiedTurnId}
                        handleAcceptSuggestion={handleAcceptSuggestion}
                        handleDiscardSuggestion={handleDiscardSuggestion}
                        handleRefineSuggestionInReview={handleRefineSuggestionInReview}
                        userFlowDiagram={userFlowDiagram}
                        isGeneratingDiagram={isGeneratingDiagram}
                        handleGenerateDiagram={handleGenerateDiagram}
                        onOpenExport={() => setIsExportModalOpen(true)}
                    />
                );
            case 'loading_generation':
                return <Loader text="Gerando história..." />;
            case 'loading_transcription':
                return <Loader text="Analisando transcrição..." />;
            case 'loading_bdd_scenarios':
                return <Loader text="Gerando cenários BDD..." />;
            case 'loading_bdd_breakdown':
                return <Loader text="Analisando e quebrando documento..." />;
            case 'loading_bdd_conversion':
                return <Loader text="Convertendo funcionalidade..." />;
            case 'loading_outline_generation':
                return <Loader text="Gerando template de Scenario Outline..." />;
            case 'analyzing_complexity':
                return <Loader text="Analisando complexidade..." />;
            case 'loading':
            default:
                return <Loader text="Carregando..." />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col md:flex-row">
            <HistorySidebar
                sessions={sessions}
                currentSessionId={currentSessionId}
                onSelectSession={restoreSession}
                onDeleteSession={handleDeleteSession}
                onNewSession={handleRestart}
            />
            <div className="flex-grow flex flex-col h-screen overflow-hidden">
                <Header 
                    onHomeClick={headerAction} 
                    showHomeButton={appState !== 'home'}
                    homeButtonText={headerText}
                    onBack={handleGoBack}
                    showBack={navigationHistory.length > 1}
                />
                <div className="flex-grow overflow-y-auto p-4">
                    <div className="max-w-[1600px] mx-auto h-full">
                        <Breadcrumbs 
                            history={navigationHistory} 
                            onNavigate={handleBreadcrumbNavigate} 
                            translate={translateStateToFriendlyName}
                        />
                        {renderContent()}
                    </div>
                </div>
            </div>
            
            {isOriginalStoryModalOpen && originalStory && (
                <OriginalStoryModal 
                    story={originalStory} 
                    onClose={() => setIsOriginalStoryModalOpen(false)} 
                    onDownload={() => handleDownload(originalStory.description, 'historia.txt')}
                />
            )}
            {isFeatureDescriptionModalOpen && featureDescription && (
                <FeatureDescriptionModal description={featureDescription} onClose={() => setIsFeatureDescriptionModalOpen(false)} />
            )}
            {isTechSelectionModalOpen && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setIsTechSelectionModalOpen(false)}>
                    <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-700 relative animate-fade-in-up" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-semibold text-purple-300 mb-4">Selecione a Tecnologia</h3>
                        <div className="space-y-2">
                            {['JavaScript - Cypress', 'Python - Behave', 'Java - Cucumber', 'PHP', 'C#'].map(tech => (
                                <button
                                    key={tech}
                                    onClick={() => { setSelectedTechnology(tech); handleGenerateStepDefs(`Funcionalidade: ${featureDescription}\n\n` + bddScenarios.map(s => s.gherkin).join('\n\n')); }}
                                    className="w-full text-left p-3 rounded-md hover:bg-gray-700 transition-colors text-gray-300"
                                >
                                    {tech}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {isPoChecklistModalOpen && poChecklistContent && (
                 <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setIsPoChecklistModalOpen(false)}>
                    <div className="bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full h-[80vh] flex flex-col p-6 border border-gray-700 relative animate-fade-in-up" onClick={e => e.stopPropagation()}>
                         <button onClick={() => setIsPoChecklistModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700 z-10"><XIcon className="w-6 h-6" /></button>
                        <h3 className="text-xl font-semibold text-purple-300 mb-4">Checklist de Pré-Homologação (PO)</h3>
                        <div className="flex-grow overflow-auto bg-gray-900/50 p-4 rounded-md border border-gray-700">
                             <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">{poChecklistContent}</pre>
                        </div>
                        <div className="flex justify-end gap-3 mt-4">
                            <button onClick={() => handleDownload(poChecklistContent, 'checklist_po.txt')} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition">
                                <DownloadIcon className="w-5 h-5" />
                                Baixar Checklist
                            </button>
                        </div>
                    </div>
                </div>
            )}
             {isStepDefModalOpen && stepDefContent && (
                 <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setIsStepDefModalOpen(false)}>
                    <div className="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full h-[85vh] flex flex-col p-6 border border-gray-700 relative animate-fade-in-up" onClick={e => e.stopPropagation()}>
                         <button onClick={() => setIsStepDefModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700 z-10"><XIcon className="w-6 h-6" /></button>
                        <h3 className="text-xl font-semibold text-purple-300 mb-2">Step Definitions ({selectedTechnology})</h3>
                        <div className="flex-grow overflow-auto bg-gray-900/50 p-4 rounded-md border border-gray-700">
                             <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">{stepDefContent}</pre>
                        </div>
                        <div className="flex justify-end gap-3 mt-4">
                            <button onClick={() => handleDownload(stepDefContent, `steps.${getFileExtension(selectedTechnology)}`)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition">
                                <DownloadIcon className="w-5 h-5" />
                                Baixar Código
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {isPrototypeModalOpen && suggestedPrototype && (
                <PrototypeModal 
                    prototypeCode={suggestedPrototype} 
                    onClose={() => setIsPrototypeModalOpen(false)}
                    title={planningMode === 'story' ? "Protótipo da História" : "Protótipo da Feature"}
                />
            )}
            {isExportModalOpen && (
                <ExportModal 
                    isOpen={isExportModalOpen}
                    onClose={() => setIsExportModalOpen(false)}
                    data={{
                        story: planningMode === 'story' ? (suggestedStory ? { ...originalStory!, description: suggestedStory } : originalStory) : null,
                        featureDescription,
                        bddScenarios,
                        poChecklist: poChecklistContent,
                        technicalNotes: stepDefContent,
                        prototypeCode: suggestedPrototype,
                        diagramCode: userFlowDiagram,
                    }}
                />
            )}
             {isFeaturesModalOpen && <FeaturesModal onClose={() => setIsFeaturesModalOpen(false)} />}
             {isModelStoryModalOpen && <ModelStoryModal initialModel={modelStory} onSave={handleSaveModelStory} onClose={() => setIsModelStoryModalOpen(false)} />}
             {isPrototypeModelModalOpen && <PrototypeModelModal initialModel={prototypeModel} onSave={handleSavePrototypeModel} onClose={() => setIsPrototypeModelModalOpen(false)} />}
             {complexityAnalysis && <ComplexityAnalysisModal result={complexityAnalysis} onClose={() => setComplexityAnalysis(null)} onAcceptSplit={handleAcceptSplit} />}
             <ConfirmationModal action={confirmationAction} onClose={() => setConfirmationAction(null)} />
             <DataTableModal
                title="Inserir Tabela de Dados"
                columns={dataTableColumns}
                isOpen={isDataTableModalOpen || isExtractingColumns}
                onClose={() => { setIsDataTableModalOpen(false); setIsExtractingColumns(false); setCursorPositionForTable(null); }}
                onConfirm={(tableString) => {
                    if (tableTarget === 'answer') {
                        setCurrentAnswer(prev => prev + tableString);
                    } else if (tableTarget === 'editor' && editingOutline && cursorPositionForTable !== null) {
                        const currentText = editingOutline.template;
                        const newText = currentText.slice(0, cursorPositionForTable) + tableString + currentText.slice(cursorPositionForTable);
                        setEditingOutline({ ...editingOutline, template: newText });
                    }
                    setCursorPositionForTable(null);
                }}
             />
             {isExtractingColumns && (
                 <div className="fixed bottom-4 right-4 z-50 bg-gray-800 p-4 rounded-lg shadow-xl border border-purple-500 animate-pulse">
                     <p className="text-purple-300 font-bold">A IA está sugerindo uma tabela...</p>
                 </div>
             )}
             {!isExtractingColumns && dataTableColumns.length > 0 && !isDataTableModalOpen && appState === 'workspace' && (
                 <div className="fixed bottom-24 right-8 z-40">
                     <button
                        onClick={() => { setTableTarget('answer'); setIsDataTableModalOpen(true); }}
                        className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold p-4 rounded-full shadow-lg flex items-center gap-2 transition-transform hover:scale-110 animate-bounce"
                        title="Inserir Tabela Sugerida"
                     >
                         <TableIcon className="w-6 h-6" />
                         <span className="hidden md:inline">Inserir Tabela</span>
                     </button>
                 </div>
             )}
        </div>
    );
};

export default App;