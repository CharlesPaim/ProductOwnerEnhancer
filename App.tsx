
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Persona, ParsedStory, RedmineIssue, ConversationTurn, ComplexityAnalysisResult, SplitStory, BddFeatureSuggestion } from './types';
import { generateInitialQuestions, suggestNewStoryVersion, generateFollowUpQuestion, generateNewStory, refineSuggestedStory, generateTestScenarios, analyzeStoryComplexity, generateStoriesFromTranscript, generatePrototype, generateBddScenarios, generateBddFollowUpQuestion, generateGherkinFromConversation, generatePoChecklist, generateStepDefinitions, convertDocumentToBdd, analyzeAndBreakdownDocument, analyzePlanningTranscript, analyzeHomologationTranscript } from './services/geminiService';
import { personaDetails, UserIcon, BookOpenIcon, XIcon, MenuIcon, SparklesIcon, HomeIcon, ClipboardIcon, ClipboardCheckIcon, ClipboardListIcon, InformationCircleIcon, ScaleIcon, MicrophoneIcon, TemplateIcon, ViewBoardsIcon, DocumentTextIcon, CheckCircleIcon, PencilIcon, TrashIcon, CodeIcon, SwitchHorizontalIcon } from './components/icons';

type BddScenario = {
    id: number;
    title: string;
    gherkin: string | null;
    completed: boolean;
};

type ConfirmationAction = {
    title: string;
    message: string;
    onConfirm: () => void;
} | null;

type TranscriptionMode = 'requirements' | 'planning' | 'homologation';

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

const Header = ({ onRestart, showRestart, text }: { onRestart: () => void; showRestart: boolean; text: string; }) => (
    <header className="relative bg-gray-900/80 backdrop-blur-sm p-4 border-b border-gray-700 sticky top-0 z-20 flex items-center justify-center h-[85px]">
        <div className="text-center">
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                Aprimorador de Histórias de Usuário
            </h1>
            <p className="text-center text-gray-400 text-sm mt-1">Gere e refine histórias de usuário com o poder da IA</p>
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-4">
            {showRestart && (
                <button 
                    onClick={onRestart}
                    className="flex items-center gap-2 text-sm text-gray-300 hover:text-purple-300 transition-colors py-1 px-3 rounded-md hover:bg-gray-700/50"
                    title={text}
                >
                    <HomeIcon className="w-5 h-5" />
                    <span>{text}</span>
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
                            <li><span className="font-semibold text-gray-300">Reunião de Planeamento:</span> Valida uma história existente contra o que foi discutido.</li>
                            <li><span className="font-semibold text-gray-300">Sessão de Homologação:</span> Extrai feedback e pontos de ação.</li>
                        </ul>
                    </li>
                    <li><span className="font-semibold">Criar Feature BDD:</span> Guie a IA para criar um arquivo .feature completo a partir de uma descrição de alto nível.</li>
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
                    <li><span className="font-semibold">Análise de Complexidade (Anti-Épico):</span> Identifique histórias muito grandes e receba sugestões para quebrá-las. Refine cada nova história individualmente.</li>
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
                     <li><span className="font-semibold">Prototipagem Visual com IA:</span> Crie um protótipo visual (HTML/Tailwind CSS) a partir da história de usuário para acelerar o alinhamento.</li>
                     <li><span className="font-semibold">Checklist de Pré-Homologação (BDD):</span> Gere um roteiro de teste em linguagem natural para o PO validar a entrega a partir do arquivo .feature.</li>
                     <li><span className="font-semibold">Esqueletos de Steps (BDD):</span> Gere o código-esqueleto das Step Definitions (JS, Python, Java, PHP, C#) para acelerar a automação de testes.</li>
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
                    <h3 className="font-bold text-cyan-300">Reunião de Planeamento</h3>
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
        planning: "Analisar Transcrição: Reunião de Planeamento",
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
                                "Transcrição do Planeamento",
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
        planning: "Análise da Reunião de Planeamento",
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

const OriginalStoryModal = ({ story, onClose, titleOverride }: { story: ParsedStory; onClose: () => void; titleOverride?: string; }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        const textToCopy = `${story.title}\n\n${story.description}`;
        navigator.clipboard.writeText(textToCopy);
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
                <button onClick={handleCopy} title="Copiar" className="text-gray-400 hover:text-white transition">
                    {copied ? <ClipboardCheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                </button>
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


const App: React.FC = () => {
    type AppState = 'home' | 'refining' | 'generating' | 'transcribing_context' | 'transcribing_input' | 'transcribing_review' | 'bdd_input' | 'bdd_scenarios' | 'bdd_review' | 'bdd_converting_doc_input' | 'bdd_breakdown_review' | 'bdd_feature_selection' | 'bdd_converting_doc_review' | 'loading_generation' | 'loading_transcription' | 'loading_bdd_scenarios' | 'loading_bdd_breakdown' | 'loading_bdd_conversion' | 'reviewing' | 'configuring' | 'loading' | 'planning' | 'error' | 'analyzing_complexity' | 'story_selection';
    const [appState, setAppState] = useState<AppState>('home');

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
    const [generatedGherkin, setGeneratedGherkin] = useState<string | null>(null);
    const [poChecklistContent, setPoChecklistContent] = useState<string | null>(null);
    const [stepDefContent, setStepDefContent] = useState<string | null>(null);
    const [selectedTechnology, setSelectedTechnology] = useState('JavaScript - Cypress');
    const [documentToConvert, setDocumentToConvert] = useState('');
    const [featureSuggestions, setFeatureSuggestions] = useState<BddFeatureSuggestion[]>([]);
    const [convertedFeatureFile, setConvertedFeatureFile] = useState('');
    const [poChecklistCache, setPoChecklistCache] = useState<{ featureContent: string; checklist: string; } | null>(null);
    const [stepDefCache, setStepDefCache] = useState<{ featureContent: string; technology: string; steps: string; } | null>(null);

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
    
    // Cache states
    const [complexityCache, setComplexityCache] = useState<{ description: string; result: ComplexityAnalysisResult; } | null>(null);
    const [testScenariosCache, setTestScenariosCache] = useState<{ description: string; scenarios: string; } | null>(null);
    const [prototypeCache, setPrototypeCache] = useState<{ description: string; model: string; prototype: string; } | null>(null);

    const conversationEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversation]);
    
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
        setAppState('configuring');
    }, []);

    const handleGenerateStory = useCallback(async (requirements: string) => {
        setAppState('loading_generation');
        setError(null);
        try {
            const generated = await generateNewStory(requirements, modelStory);
            setOriginalStory(generated);
            setAppState('reviewing');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao gerar a história.');
            setAppState('error');
        }
    }, [modelStory]);

     const handleRequirementsTranscriptSubmit = useCallback(async (transcript: string) => {
        setAppState('loading_transcription');
        setError(null);
        try {
            const generatedStories = await generateStoriesFromTranscript(transcript, modelStory);
            if (generatedStories.length === 0) {
                setError('A IA não conseguiu gerar histórias a partir da transcrição fornecida. Tente com um texto mais detalhado.');
                setAppState('transcribing_input');
                return;
            }
            setSplitStories(generatedStories);
            setAppState('story_selection');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao analisar a transcrição.');
            setAppState('error');
        }
    }, [modelStory]);

    const handlePlanningTranscriptSubmit = useCallback(async (transcript: string, storyToValidate: string) => {
        setAppState('loading_transcription');
        setError(null);
        try {
            const result = await analyzePlanningTranscript(transcript, storyToValidate);
            setTranscriptionAnalysisResult(result);
            setAppState('transcribing_review');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao analisar a transcrição.');
            setAppState('transcribing_input');
        }
    }, []);

    const handleHomologationTranscriptSubmit = useCallback(async (transcript: string) => {
        setAppState('loading_transcription');
        setError(null);
        try {
            const result = await analyzeHomologationTranscript(transcript);
            setTranscriptionAnalysisResult(result);
            setAppState('transcribing_review');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao analisar a transcrição.');
            setAppState('transcribing_input');
        }
    }, []);

    const handleTranscriptionContextSelect = (mode: TranscriptionMode) => {
        setTranscriptionMode(mode);
        setAppState('transcribing_input');
    };

    const handleFeatureSubmit = useCallback(async (description: string) => {
        setAppState('loading_bdd_scenarios');
        setFeatureDescription(description);
        setError(null);
        try {
            const scenarios = await generateBddScenarios(description);
            setBddScenarios(scenarios.map((title, i) => ({ id: Date.now() + i, title, gherkin: null, completed: false })));
            setAppState('bdd_scenarios');
        } catch (err) {
             setError(err instanceof Error ? err.message : 'Falha ao gerar cenários BDD.');
             setAppState('bdd_input');
        }
    }, []);

    const handleAnalyzeDocument = useCallback(async (document: string) => {
        setAppState('loading_bdd_breakdown');
        setDocumentToConvert(document);
        setError(null);
        try {
            const suggestions = await analyzeAndBreakdownDocument(document);
            setFeatureSuggestions(suggestions);
            setAppState('bdd_breakdown_review');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao analisar o documento.');
            setAppState('bdd_converting_doc_input');
        }
    }, []);

    const handleConvertSelectedFeature = useCallback(async (featureTitle: string) => {
        setAppState('loading_bdd_conversion');
        setError(null);
        try {
            const featureFile = await convertDocumentToBdd(documentToConvert, featureTitle);
            setConvertedFeatureFile(featureFile);
            setAppState('bdd_converting_doc_review');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao converter a feature selecionada.');
            setAppState('bdd_feature_selection');
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
        }));

        setBddScenarios(initialBddScenarios);
        setAppState('bdd_scenarios');
    }, [convertedFeatureFile]);

    const handleDetailScenario = useCallback((index: number) => {
        setCurrentScenarioIndex(index);
        const scenario = bddScenarios[index];
        setOriginalStory({ title: scenario.title, description: `Este é um cenário para a funcionalidade: "${featureDescription}"` });
        setPlanningMode('bdd');
        setAppState('configuring');
    }, [bddScenarios, featureDescription]);

    const handleReviewConfirm = useCallback(() => {
        if (!originalStory) return;
        setAppState('configuring');
    }, [originalStory]);

    const handleStartPlanning = useCallback(async (selectedPersonas: Persona[]) => {
        const contextStory = planningMode === 'bdd' && currentScenarioIndex !== null 
            ? { title: bddScenarios[currentScenarioIndex].title, description: featureDescription }
            : originalStory;

        if (!contextStory || selectedPersonas.length === 0) return;
        
        setAppState('loading');
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
            setAppState('planning');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
            setAppState('error');
        }
    }, [originalStory, planningMode, currentScenarioIndex, bddScenarios, featureDescription]);

    const handleCancelConfiguration = useCallback(() => {
        if (planningMode === 'bdd') {
            setAppState('bdd_scenarios');
        } else if (splitStories.length > 0) {
            setAppState('story_selection');
        } else {
            setAppState('home');
        }
        setOriginalStory(null);
    }, [splitStories, planningMode]);

    const submitAnswer = useCallback(async (answer: string) => {
        const contextStory = planningMode === 'bdd' && currentScenarioIndex !== null
            ? { title: bddScenarios[currentScenarioIndex].title, description: featureDescription }
            : originalStory;

        if (!contextStory || activePersonas.length === 0) return;

        setIsAnswering(true);
        
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
                ? await generateBddFollowUpQuestion(featureDescription, contextStory.title, updatedConversation, nextPersona)
                : await generateFollowUpQuestion(contextStory, updatedConversation, nextPersona);
                
            const nextTurn: ConversationTurn = { id: Date.now(), persona: nextPersona, question: nextQuestionText };
            setConversation(prev => [...prev, nextTurn]);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao obter a próxima pergunta.');
        } finally {
            setIsAnswering(false);
        }
    }, [conversation, originalStory, activePersonas, planningMode, currentScenarioIndex, bddScenarios, featureDescription]);

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
        if (planningMode !== 'bdd' || currentScenarioIndex === null || conversation.length === 0) return;
        setIsGeneratingGherkin(true);
        setGeneratedGherkin(null);
        setError(null);
        try {
            const scenario = bddScenarios[currentScenarioIndex];
            const lastTurn = conversation[conversation.length - 1];
            const convForGherkin = lastTurn.answer ? conversation : conversation.slice(0, -1);
            const gherkin = await generateGherkinFromConversation(featureDescription, scenario.title, convForGherkin);
            setGeneratedGherkin(gherkin);
        } catch (err) {
             setError(err instanceof Error ? err.message : 'Falha ao gerar o Gherkin.');
        } finally {
            setIsGeneratingGherkin(false);
        }
    }, [planningMode, currentScenarioIndex, conversation, featureDescription, bddScenarios]);

    const handleCompleteScenario = useCallback(() => {
        if (currentScenarioIndex === null || !generatedGherkin) return;
        
        const updatedScenarios = [...bddScenarios];
        updatedScenarios[currentScenarioIndex] = {
            ...updatedScenarios[currentScenarioIndex],
            gherkin: generatedGherkin,
            completed: true
        };
        setBddScenarios(updatedScenarios);

        // Reset planning state for next scenario
        setConversation([]);
        setCurrentScenarioIndex(null);
        setGeneratedGherkin(null);
        
        setAppState('bdd_scenarios');
    }, [currentScenarioIndex, generatedGherkin, bddScenarios]);
    
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
        if (!originalStory) return;
        const storyToPrototype = suggestedStory ?? originalStory.description;
        const modelToUse = localPrototypeModel || prototypeModel;

        if (prototypeCache && prototypeCache.description === storyToPrototype && prototypeCache.model === modelToUse) {
            setSuggestedPrototype(prototypeCache.prototype);
            return;
        }

        setIsGeneratingPrototype(true);
        setSuggestedPrototype(null);
        setError(null);
        try {
            const prototypeCode = await generatePrototype(storyToPrototype, modelToUse);
            setSuggestedPrototype(prototypeCode);
            setPrototypeCache({ description: storyToPrototype, model: modelToUse, prototype: prototypeCode });
        } catch (err) {
             setError(err instanceof Error ? err.message : 'Falha ao gerar o protótipo.');
        } finally {
            setIsGeneratingPrototype(false);
        }
    }, [originalStory, suggestedStory, prototypeModel, localPrototypeModel, prototypeCache]);

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
            setError(err instanceof Error ? err.message : 'Falha ao gerar os steps.');
        } finally {
            setIsGeneratingSteps(false);
        }
    }, [selectedTechnology, stepDefCache]);

    const handleAcceptSplit = useCallback(() => {
        if (complexityAnalysis?.suggestedStories) {
            setSplitStories(complexityAnalysis.suggestedStories);
            setAppState('story_selection');
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
        setAppState('configuring');
    }, []);

    const resetApp = () => {
        setAppState('home');
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
        setGeneratedGherkin(null);
        setPoChecklistContent(null);
        setStepDefContent(null);
        setDocumentToConvert('');
        setFeatureSuggestions([]);
        setConvertedFeatureFile('');
        setActivePersonas([]);
        setConversation([]);
        setCurrentAnswer('');
        setIsAnswering(false);
        setIsSuggesting(false);
        setIsRefining(false);
        setIsGeneratingScenarios(false);
        setIsGeneratingPrototype(false);
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
        // Reset Caches
        setComplexityCache(null);
        setTestScenariosCache(null);
        setPrototypeCache(null);
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
           setAppState('story_selection');
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

    const currentTurn = conversation[conversation.length - 1];

    const renderContent = () => {
        switch (appState) {
            case 'home':
                return <HomeScreen 
                            onChoice={setAppState} 
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
                        onBack={() => setAppState('transcribing_context')} 
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
                        const newScenario: BddScenario = { id: Date.now(), title: "Novo Cenário", gherkin: null, completed: false };
                        setBddScenarios([...bddScenarios, newScenario]);
                        handleEdit(bddScenarios.length);
                    };

                    return (
                        <div className="flex flex-col items-center justify-center min-h-screen p-4 -mt-20">
                            <div className="w-full max-w-3xl bg-gray-800 rounded-lg shadow-xl p-6">
                                <h2 className="text-xl font-semibold mb-2 text-gray-200">Cenários para a Feature</h2>
                                <p className="text-gray-400 mb-4 text-sm">Revise, edite, adicione ou remova cenários. Depois, clique em "Detalhar Cenário" para iniciar a sessão de planejamento para cada um.</p>
                                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                                    {bddScenarios.map((scenario, index) => (
                                        <div key={scenario.id} className={`flex items-center gap-3 p-3 rounded-md ${scenario.completed ? 'bg-green-900/30' : 'bg-gray-700/50'}`}>
                                            {scenario.completed ? <CheckCircleIcon className="w-6 h-6 text-green-400 flex-shrink-0"/> : <div className="w-6 h-6 flex-shrink-0" />}
                                            {editingIndex === index ? (
                                                <input
                                                    type="text"
                                                    value={editingText}
                                                    onChange={(e) => setEditingText(e.target.value)}
                                                    onBlur={() => handleSaveEdit(index)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(index)}
                                                    autoFocus
                                                    className="flex-grow p-1 bg-gray-900 border border-purple-500 rounded-md text-gray-200"
                                                />
                                            ) : (
                                                <p className={`flex-grow ${scenario.completed ? 'line-through text-gray-400' : 'text-gray-200'}`}>{scenario.title}</p>
                                            )}
                                            <div className="flex items-center gap-2">
                                                {!scenario.completed && (
                                                    <>
                                                        <button onClick={() => handleEdit(index)} title="Editar"><PencilIcon className="w-5 h-5 text-gray-400 hover:text-yellow-300" /></button>
                                                        <button onClick={() => handleDeleteBddScenario(scenario.id)} title="Remover"><TrashIcon className="w-5 h-5 text-gray-400 hover:text-red-400" /></button>
                                                        <button onClick={() => handleDetailScenario(index)} className="text-sm bg-purple-600 hover:bg-purple-700 text-white font-bold py-1 px-3 rounded">Detalhar</button>
                                                    </>
                                                )}
                                                {scenario.completed && <span className="text-sm text-green-400 font-bold">Concluído</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between mt-6">
                                     <button onClick={handleAdd} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">Adicionar Cenário</button>
                                     <button onClick={() => setAppState('bdd_review')} disabled={!bddScenarios.some(s => s.completed)} className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white font-bold py-2 px-4 rounded">Revisar Arquivo .feature</button>
                                </div>
                            </div>
                        </div>
                    )
                };
                return <BddScenarioList />;
            case 'bdd_review':
                const BddFeatureReviewScreen = () => {
                    const featureFileContent = `Funcionalidade: ${featureDescription}\n\n${bddScenarios
                        .filter(s => s.completed && s.gherkin)
                        .map(s => s.gherkin)
                        .join('\n\n')}`;
                    
                    const [copied, setCopied] = useState(false);
                    const handleCopy = () => {
                        navigator.clipboard.writeText(featureFileContent);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                    };

                    return (
                        <div className="flex flex-col items-center justify-center min-h-screen p-4 -mt-20">
                            <div className="w-full max-w-4xl bg-gray-800 rounded-lg shadow-xl p-6">
                                <h2 className="text-xl font-semibold mb-2 text-gray-200">Arquivo .feature Consolidado</h2>
                                <p className="text-gray-400 mb-4 text-sm">Este é o arquivo .feature gerado. Agora você pode gerar artefatos de suporte para o PO e para os Desenvolvedores.</p>
                                <div className="relative">
                                    <button onClick={handleCopy} title="Copiar" className="absolute top-2 right-2 text-gray-400 hover:text-white transition">
                                        {copied ? <ClipboardCheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                                    </button>
                                    <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono bg-gray-900/50 p-4 rounded-md max-h-[50vh] overflow-y-auto">{featureFileContent}</pre>
                                </div>
                                <div className="mt-6 border-t border-gray-700 pt-6">
                                    <h3 className="text-lg font-semibold text-cyan-300 mb-4">Gerar Artefatos de Suporte</h3>
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <button onClick={() => handleGeneratePoChecklist(featureFileContent)} disabled={isGeneratingChecklist} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 text-white font-bold py-2 px-4 rounded transition">
                                            <ClipboardListIcon className="w-5 h-5" />
                                            {isGeneratingChecklist ? 'Gerando...' : 'Gerar Checklist de Pré-Homologação'}
                                        </button>
                                        <button onClick={() => setIsTechSelectionModalOpen(true)} disabled={isGeneratingSteps} className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900 text-white font-bold py-2 px-4 rounded transition">
                                            <CodeIcon className="w-5 h-5" />
                                            {isGeneratingSteps ? 'Gerando...' : 'Gerar Esqueletos de Steps'}
                                        </button>
                                    </div>
                                    {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
                                </div>
                                <div className="flex justify-end mt-6">
                                    <button onClick={() => setAppState('bdd_scenarios')} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">Voltar para a Lista de Cenários</button>
                                </div>
                            </div>
                        </div>
                    );
                };
                return <BddFeatureReviewScreen />;
            case 'bdd_converting_doc_input':
                return (
                    <div className="flex flex-col items-center justify-center min-h-screen p-4 -mt-20">
                        <div className="w-full max-w-3xl bg-gray-800 rounded-lg shadow-xl p-6">
                            <h2 className="text-xl font-semibold mb-2 text-gray-200">Converter Documento para BDD</h2>
                            <p className="text-gray-400 mb-4 text-sm">Cole o conteúdo de um documento de requisitos tradicional. A IA atuará como um Arquiteto de Produto para analisá-lo e sugerir uma quebra em features menores.</p>
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
                 const BddBreakdownReviewScreen = () => {
                    const [suggestions, setSuggestions] = useState(featureSuggestions);
                    
                    const handleUpdateTitle = (index: number, newTitle: string) => {
                        const updated = [...suggestions];
                        updated[index].title = newTitle;
                        setSuggestions(updated);
                    };

                    return (
                        <div className="flex flex-col items-center justify-center min-h-screen p-4 -mt-20">
                            <div className="w-full max-w-3xl bg-gray-800 rounded-lg shadow-xl p-6">
                                <h2 className="text-xl font-semibold mb-2 text-gray-200">Revisão da Quebra de Features</h2>
                                <p className="text-gray-400 mb-6 text-sm">A IA analisou o documento e sugere dividi-lo nas seguintes features. Você pode editar os títulos antes de continuar.</p>
                                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                                    {suggestions.map((feature, index) => (
                                        <div key={index} className="bg-gray-700/50 p-4 rounded-md">
                                            <input
                                                type="text"
                                                value={feature.title}
                                                onChange={(e) => handleUpdateTitle(index, e.target.value)}
                                                className="w-full p-1 mb-2 bg-gray-900 border border-purple-500 rounded-md text-purple-300 font-semibold"
                                            />
                                            <p className="text-gray-400 text-sm">{feature.summary}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-end mt-6">
                                    <button onClick={() => { setFeatureSuggestions(suggestions); setAppState('bdd_feature_selection'); }} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded">Aprovar Quebra e Selecionar</button>
                                </div>
                            </div>
                        </div>
                    );
                };
                return <BddBreakdownReviewScreen />;
            case 'bdd_feature_selection':
                return (
                     <div className="flex flex-col items-center justify-center min-h-screen p-4 -mt-20">
                        <div className="w-full max-w-3xl bg-gray-800 rounded-lg shadow-xl p-6">
                            <h2 className="text-xl font-semibold mb-2 text-gray-200">Selecione uma Feature para Converter</h2>
                            <p className="text-gray-400 mb-6 text-sm">Escolha qual das features aprovadas você deseja converter para o formato .feature agora.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {featureSuggestions.map((feature, index) => (
                                    <button 
                                        key={index} 
                                        onClick={() => handleConvertSelectedFeature(feature.title)}
                                        className="bg-gray-700 hover:bg-gray-600 text-left p-4 rounded-md transition-transform transform hover:scale-105"
                                    >
                                        <h3 className="font-bold text-purple-300">{feature.title}</h3>
                                        <p className="text-sm text-gray-400 mt-2 line-clamp-3">{feature.summary}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            case 'bdd_converting_doc_review':
                 const BddConvertedReviewScreen = () => {
                    const [copied, setCopied] = useState(false);
                    const handleCopy = () => {
                        navigator.clipboard.writeText(convertedFeatureFile);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                    };

                    return (
                        <div className="flex flex-col items-center justify-center min-h-screen p-4 -mt-20">
                            <div className="w-full max-w-4xl bg-gray-800 rounded-lg shadow-xl p-6">
                                <h2 className="text-xl font-semibold mb-2 text-gray-200">Revisão do .feature Convertido</h2>
                                <p className="text-gray-400 mb-4 text-sm">A IA gerou o arquivo .feature abaixo. Você pode copiá-lo ou prosseguir para refiná-lo no fluxo guiado.</p>
                                <div className="relative">
                                    <button onClick={handleCopy} title="Copiar" className="absolute top-2 right-2 text-gray-400 hover:text-white transition">
                                        {copied ? <ClipboardCheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                                    </button>
                                    <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono bg-gray-900/50 p-4 rounded-md max-h-[60vh] overflow-y-auto">{convertedFeatureFile}</pre>
                                </div>
                                <div className="flex justify-end gap-4 mt-6">
                                     <button onClick={() => setAppState('bdd_feature_selection')} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">Voltar</button>
                                    <button onClick={handleRefineConvertedFeature} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded">Refinar Feature</button>
                                </div>
                            </div>
                        </div>
                    );
                };
                return <BddConvertedReviewScreen />;
            case 'loading_generation':
                return <div className="h-screen -mt-20"><Loader text="A IA está gerando sua história..." /></div>;
            case 'loading_transcription':
                const loadingTexts = {
                    requirements: "A IA está analisando a transcrição e gerando histórias...",
                    planning: "O Agile Coach da IA está analisando a transcrição e a história...",
                    homologation: "O Analista de QA Sênior da IA está analisando o feedback...",
                };
                return <div className="h-screen -mt-20"><Loader text={loadingTexts[transcriptionMode || 'requirements']} /></div>;
             case 'loading_bdd_scenarios':
                return <div className="h-screen -mt-20"><Loader text="A IA está fazendo um brainstorm de cenários..." /></div>;
             case 'loading_bdd_breakdown':
                return <div className="h-screen -mt-20"><Loader text="O Arquiteto de Produto da IA está analisando seu documento..." /></div>;
             case 'loading_bdd_conversion':
                return <div className="h-screen -mt-20"><Loader text="O Analista de Negócios Sênior da IA está convertendo a feature focada..." /></div>;
            case 'reviewing':
                return originalStory && <ReviewGeneratedStory story={originalStory} onConfirm={handleReviewConfirm} onEdit={setOriginalStory} />;
            case 'configuring':
                return <PersonaConfiguration onStart={handleStartPlanning} onCancel={handleCancelConfiguration} />;
            case 'loading':
                return <div className="h-screen -mt-20"><Loader text="As personas de IA estão analisando sua história..." /></div>;
             case 'story_selection':
                return <StorySelectionScreen stories={splitStories} onSelectStory={handleSelectSplitStory} />;
            case 'planning':
                return originalStory && (
                    <main className="p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-screen-2xl mx-auto">
                        <div className="lg:col-span-7 flex flex-col">
                            <div className="flex-grow bg-gray-800/50 rounded-lg p-4 lg:p-6 border border-gray-700 mb-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold text-cyan-300">Sessão de Planejamento</h3>
                                    <div className="flex items-center gap-2">
                                        {planningMode === 'story' ? (
                                            <>
                                                <button
                                                    onClick={handleAnalyzeComplexity}
                                                    disabled={isAnalyzingComplexity}
                                                    className="flex items-center gap-2 text-sm text-gray-300 hover:text-purple-300 transition-colors py-1 px-3 rounded-md hover:bg-gray-700/50 disabled:cursor-not-allowed"
                                                    title="Analisar complexidade da história"
                                                >
                                                    <ScaleIcon className="w-5 h-5" />
                                                    <span>Analisar Complexidade</span>
                                                </button>
                                                <button
                                                    onClick={() => setIsOriginalStoryModalOpen(true)}
                                                    className="flex items-center gap-2 text-sm text-gray-300 hover:text-purple-300 transition-colors py-1 px-3 rounded-md hover:bg-gray-700/50"
                                                    title="Visualizar a história original"
                                                >
                                                    <BookOpenIcon className="w-5 h-5" />
                                                    <span>Ver História</span>
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => setIsFeatureDescriptionModalOpen(true)}
                                                    className="flex items-center gap-2 text-sm text-gray-300 hover:text-purple-300 transition-colors py-1 px-3 rounded-md hover:bg-gray-700/50"
                                                    title="Visualizar a feature completa"
                                                >
                                                    <DocumentTextIcon className="w-5 h-5" />
                                                    <span>Ver Feature</span>
                                                </button>
                                                 <button
                                                    onClick={() => setIsOriginalStoryModalOpen(true)}
                                                    className="flex items-center gap-2 text-sm text-gray-300 hover:text-purple-300 transition-colors py-1 px-3 rounded-md hover:bg-gray-700/50"
                                                    title="Visualizar o cenário atual"
                                                >
                                                    <BookOpenIcon className="w-5 h-5" />
                                                    <span>Ver Cenário</span>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {isAnalyzingComplexity && <Loader text="Analisando complexidade..." />}
                                <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-2">
                                    {conversation.map(turn => (
                                        <React.Fragment key={turn.id}>
                                            <div className="flex gap-3 group">
                                                <PersonaAvatar persona={turn.persona} />
                                                <div className="flex-1 bg-gray-700/60 rounded-lg p-3 relative">
                                                    <button onClick={() => handleCopy(turn.question, turn.id)} title="Copiar Pergunta" className="absolute top-2 right-2 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {copiedTurnId === turn.id ? <ClipboardCheckIcon className="w-4 h-4 text-green-400" /> : <ClipboardIcon className="w-4 h-4" />}
                                                    </button>
                                                    <p className="font-semibold text-sm text-gray-300">{turn.persona}</p>
                                                    <p className="text-gray-200 pr-6">{turn.question}</p>
                                                </div>
                                            </div>
                                            {turn.answer && (
                                                <div className="flex gap-3 justify-end">
                                                    <div className="flex-1 max-w-[85%] bg-purple-900/40 rounded-lg p-3 text-right">
                                                        <p className="font-semibold text-sm text-gray-300">Sua Resposta</p>
                                                        <p className="text-gray-200 whitespace-pre-wrap">{turn.answer}</p>
                                                    </div>
                                                    <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 border-purple-400 bg-gray-800">
                                                    <UserIcon className="w-5 h-5 text-gray-300" />
                                                    </div>
                                                </div>
                                            )}
                                        </React.Fragment>
                                    ))}
                                    <div ref={conversationEndRef} />
                                </div>
                            </div>
                            {currentTurn && !currentTurn.answer && !isAnswering && (
                                <div className="bg-gray-800/50 rounded-lg p-4 lg:p-6 border-2 border-purple-500 shadow-lg relative group">
                                    <button onClick={() => handleCopy(currentTurn.question, currentTurn.id)} title="Copiar Pergunta" className="absolute top-4 right-4 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                         {copiedTurnId === currentTurn.id ? <ClipboardCheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                                    </button>
                                    <h3 className="text-lg font-semibold text-purple-300 mb-3">Pergunta de {currentTurn.persona}:</h3>
                                    <p className="mb-4 text-gray-200 pr-8">{currentTurn.question}</p>
                                    <textarea
                                        value={currentAnswer}
                                        onChange={(e) => setCurrentAnswer(e.target.value)}
                                        placeholder="Digite sua resposta aqui..."
                                        rows={4}
                                        className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition text-gray-300"
                                    />
                                    <div className="flex justify-end gap-3 mt-4">
                                        <button onClick={handleSkip} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition">Pular</button>
                                        <button onClick={handleAnswerSubmit} disabled={!currentAnswer.trim()} className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 text-white font-bold py-2 px-4 rounded transition">Enviar Resposta</button>
                                    </div>
                                </div>
                            )}
                            {isAnswering && <Loader text="A IA está gerando a próxima pergunta..." />}
                        </div>
                        <div className="lg:col-span-5 h-fit lg:sticky top-24 space-y-6">
                            {planningMode === 'story' ? (
                                <>
                                    <div className="bg-gray-800/50 rounded-lg p-4 lg:p-6 border border-gray-700">
                                        <h3 className="text-lg font-semibold text-yellow-300 mb-4">Refinamento da História</h3>
                                        <button
                                            onClick={handleGetSuggestion}
                                            disabled={isSuggesting}
                                            className="w-full mb-4 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-900 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition-transform transform hover:scale-105"
                                        >
                                            {suggestedStory ? 'Gerar Nova Sugestão' : 'Pedir Sugestão de Nova Versão ao PO'}
                                        </button>
                                        {isSuggesting && <Loader text="O PO Sênior está reescrevendo a história..." />}
                                        {suggestedStory && !isSuggesting && (
                                            <div className="space-y-4">
                                                <div>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <h4 className="font-semibold text-md">Versão Sugerida:</h4>
                                                        <button onClick={() => handleCopy(suggestedStory)} title="Copiar" className="text-gray-400 hover:text-white transition">
                                                            {copied ? <ClipboardCheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                                                        </button>
                                                    </div>
                                                    <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans bg-gray-900/50 p-3 rounded-md max-h-60 overflow-y-auto">{suggestedStory}</pre>
                                                </div>
                                                <div className="border-t border-gray-700 pt-4">
                                                    <h4 className="font-semibold text-md mb-2">Sugerir Modificações</h4>
                                                    <textarea
                                                        value={refinementPrompt}
                                                        onChange={(e) => setRefinementPrompt(e.target.value)}
                                                        placeholder="Ex: Simplifique o critério de aceitação 2 e adicione um critério sobre tratamento de erros."
                                                        rows={3}
                                                        className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition text-gray-300"
                                                    />
                                                    <button
                                                        onClick={handleRefineSuggestion}
                                                        disabled={isRefining || !refinementPrompt.trim()}
                                                        className="w-full mt-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 text-white font-bold py-2 px-4 rounded-md transition"
                                                    >
                                                        {isRefining ? 'Refinando...' : 'Refinar Sugestão'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {isRefining && <Loader text="Refinando a sugestão..." />}
                                    </div>
                                    <div className="bg-gray-800/50 rounded-lg p-4 lg:p-6 border border-gray-700">
                                        <h3 className="text-lg font-semibold text-green-300 mb-4 flex items-center gap-2"><ClipboardListIcon className="w-6 h-6"/>Cenários de Teste</h3>
                                        <button onClick={handleGenerateScenarios} disabled={isGeneratingScenarios} className="w-full mb-4 bg-green-600 hover:bg-green-700 disabled:bg-green-900 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition-transform transform hover:scale-105">Sugerir Cenários de Teste</button>
                                        {isGeneratingScenarios && <Loader text="O QA Sênior está elaborando os testes..." />}
                                        {testScenarios && !isGeneratingScenarios && (
                                            <div>
                                                <div className="flex justify-between items-center mb-2"><h4 className="font-semibold text-md">Cenários Sugeridos:</h4><button onClick={() => handleCopy(testScenarios)} title="Copiar Cenários" className="text-gray-400 hover:text-white transition">{copied ? <ClipboardCheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}</button></div>
                                                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans bg-gray-900/50 p-3 rounded-md max-h-60 overflow-y-auto">{testScenarios}</pre>
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-gray-800/50 rounded-lg p-4 lg:p-6 border border-gray-700">
                                        <h3 className="text-lg font-semibold text-blue-300 mb-4 flex items-center gap-2"><ViewBoardsIcon className="w-6 h-6"/>Prototipagem Visual</h3>
                                        <button onClick={handleGeneratePrototype} disabled={isGeneratingPrototype} className="w-full mb-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition-transform transform hover:scale-105">Sugerir Protótipo Visual</button>
                                        <details className="mt-4">
                                            <summary className="cursor-pointer text-sm text-gray-400 hover:text-white">
                                                Usar modelo de protótipo (opcional)
                                            </summary>
                                            <textarea
                                                value={localPrototypeModel}
                                                onChange={(e) => setLocalPrototypeModel(e.target.value)}
                                                placeholder="Cole um trecho de código HTML/Tailwind aqui para guiar a IA..."
                                                rows={5}
                                                className="w-full mt-2 p-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 transition text-gray-300 font-mono text-xs"
                                            />
                                        </details>
                                        {isGeneratingPrototype && <div className="mt-4"><Loader text="A IA está desenhando o protótipo..." /></div>}
                                        {suggestedPrototype && !isGeneratingPrototype && (
                                            <div className="mt-4">
                                                <div className="flex justify-between items-center mb-2"><h4 className="font-semibold text-md">Código do Protótipo:</h4><button onClick={() => handleCopy(suggestedPrototype)} title="Copiar Código" className="text-gray-400 hover:text-white transition">{copied ? <ClipboardCheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}</button></div>
                                                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono bg-gray-900/50 p-3 rounded-md max-h-60 overflow-y-auto">{suggestedPrototype}</pre>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : ( // BDD Mode Panel
                                <div className="bg-gray-800/50 rounded-lg p-4 lg:p-6 border border-gray-700">
                                    <h3 className="text-lg font-semibold text-yellow-300 mb-1">Construtor de Cenário BDD</h3>
                                    <p className="text-sm text-gray-400 mb-4">Cenário: <span className="font-semibold">{originalStory.title}</span></p>
                                    <button onClick={handleGenerateGherkin} disabled={isGeneratingGherkin || !!generatedGherkin} className="w-full mb-4 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-900 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition-transform transform hover:scale-105">Gerar Cenário em Gherkin</button>
                                    {isGeneratingGherkin && <Loader text="A IA está escrevendo o Gherkin..." />}
                                    {generatedGherkin && !isGeneratingGherkin && (
                                        <div>
                                            <div className="flex justify-between items-center mb-2"><h4 className="font-semibold text-md">Gherkin Gerado:</h4><button onClick={() => handleCopy(generatedGherkin)} title="Copiar Gherkin" className="text-gray-400 hover:text-white transition">{copied ? <ClipboardCheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}</button></div>
                                            <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono bg-gray-900/50 p-3 rounded-md max-h-80 overflow-y-auto">{generatedGherkin}</pre>
                                            <button onClick={handleCompleteScenario} className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition">Concluir e Voltar para a Lista</button>
                                        </div>
                                    )}
                                </div>
                            )}
                            {error && !isSuggesting && !isRefining && !isGeneratingScenarios && !isGeneratingPrototype && !isGeneratingGherkin && <p className="text-red-400 mt-2 text-sm text-center p-2 bg-red-900/20 rounded-md">{error}</p>}
                        </div>
                    </main>
                );
            default:
                return null;
        }
    }


    return (
        <div className="bg-gray-900 text-gray-200 min-h-screen font-sans">
            <Header 
                onRestart={headerAction} 
                showRestart={appState !== 'home'} 
                text={headerText}
            />
            {renderContent()}
            {isOriginalStoryModalOpen && originalStory && (
                <OriginalStoryModal 
                    story={originalStory} 
                    onClose={() => setIsOriginalStoryModalOpen(false)}
                    titleOverride={planningMode === 'bdd' ? 'Cenário Atual' : undefined}
                />
            )}
            {isFeatureDescriptionModalOpen && (
                 <FeatureDescriptionModal 
                    description={featureDescription}
                    onClose={() => setIsFeatureDescriptionModalOpen(false)}
                />
            )}
             {isFeaturesModalOpen && <FeaturesModal onClose={() => setIsFeaturesModalOpen(false)} />}
             {complexityAnalysis && (
                <ComplexityAnalysisModal 
                    result={complexityAnalysis} 
                    onClose={() => setComplexityAnalysis(null)}
                    onAcceptSplit={handleAcceptSplit}
                />
             )}
             {isModelStoryModalOpen && (
                <ModelStoryModal
                    initialModel={modelStory}
                    onClose={() => setIsModelStoryModalOpen(false)}
                    onSave={(model) => setModelStory(model)}
                />
             )}
            {isPrototypeModelModalOpen && (
                <PrototypeModelModal
                    initialModel={prototypeModel}
                    onClose={() => setIsPrototypeModelModalOpen(false)}
                    onSave={(model) => setPrototypeModel(model)}
                />
            )}
            {isTechSelectionModalOpen && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setIsTechSelectionModalOpen(false)}>
                    <div className="bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-6 border border-gray-700 animate-fade-in-up" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-purple-300 mb-4">Selecionar Tecnologia</h3>
                        <select
                            value={selectedTechnology}
                            onChange={(e) => setSelectedTechnology(e.target.value)}
                            className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 transition text-gray-300"
                        >
                            <option>JavaScript - Cypress</option>
                            <option>Python - Behave</option>
                            <option>Java - Cucumber</option>
                            <option>PHP</option>
                            <option>C#</option>
                        </select>
                        <div className="flex justify-end gap-3 mt-4">
                            <button onClick={() => setIsTechSelectionModalOpen(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition">Cancelar</button>
                            <button onClick={() => handleGenerateStepDefs(`Funcionalidade: ${featureDescription}\n\n${bddScenarios.filter(s => s.completed && s.gherkin).map(s => s.gherkin).join('\n\n')}`)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition">Gerar</button>
                        </div>
                    </div>
                </div>
            )}
            {isPoChecklistModalOpen && poChecklistContent && (
                 <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setIsPoChecklistModalOpen(false)}>
                    <div className="bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full p-6 border border-gray-700 animate-fade-in-up" onClick={e => e.stopPropagation()}>
                         <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold text-purple-300">Checklist de Pré-Homologação</h3>
                            <button onClick={() => handleCopy(poChecklistContent)} title="Copiar Checklist" className="text-gray-400 hover:text-white transition">
                                {copied ? <ClipboardCheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                            </button>
                        </div>
                        <div className="max-h-[70vh] overflow-y-auto pr-2">
                           <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans bg-gray-900/50 p-3 rounded-md">{poChecklistContent}</pre>
                        </div>
                         <div className="flex justify-end mt-6">
                            <button onClick={() => setIsPoChecklistModalOpen(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">Fechar</button>
                        </div>
                    </div>
                 </div>
            )}
            {isStepDefModalOpen && stepDefContent && (
                 <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setIsStepDefModalOpen(false)}>
                    <div className="bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full p-6 border border-gray-700 animate-fade-in-up" onClick={e => e.stopPropagation()}>
                         <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold text-purple-300">Esqueletos de Steps ({selectedTechnology})</h3>
                            <button onClick={() => handleCopy(stepDefContent)} title="Copiar Código" className="text-gray-400 hover:text-white transition">
                                {copied ? <ClipboardCheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                            </button>
                        </div>
                        <div className="max-h-[70vh] overflow-y-auto pr-2">
                           <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono bg-gray-900/50 p-3 rounded-md">{stepDefContent}</pre>
                        </div>
                         <div className="flex justify-end mt-6">
                            <button onClick={() => setIsStepDefModalOpen(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">Fechar</button>
                        </div>
                    </div>
                 </div>
            )}
            {confirmationAction && <ConfirmationModal action={confirmationAction} onClose={() => setConfirmationAction(null)} />}
        </div>
    );
};

export default App;
