

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
                    <li><span className="font-semibold">Criar Feature BDD:</span> A partir de uma descrição, a IA sugere cenários. Utilize o <strong>editor com realce de sintaxe (Gherkin)</strong> para detalhar cada cenário, incluindo suporte a tabelas de exemplos.</li>
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
                    <li><span className="font-semibold">Controle de Fluxo:</span> Encerre o refinamento manualmente quando estiver satisfeito ou aguarde o consenso automático das personas.</li>
                    <li><span className="font-semibold">Insights em Tempo Real:</span> Acompanhe um resumo dinâmico dos pontos de atenção e decisões tomadas durante a conversa (visualização expandida disponível).</li>
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
                    <li><span className="font-semibold">Exportação Profissional:</span> Exporte sua história refinada para o <strong>Jira (Wiki Markup)</strong>, <strong>Markdown</strong> (Git) ou gere um <strong>Relatório HTML</strong> completo com diagramas interativos e protótipos.</li>
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
                     <p className="text-sm font-normal text-gray-400 mt-1