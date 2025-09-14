import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Persona, ParsedStory, RedmineIssue, ConversationTurn, ComplexityAnalysisResult, SplitStory } from './types';
import { generateInitialQuestions, suggestNewStoryVersion, generateFollowUpQuestion, generateNewStory, refineSuggestedStory, generateTestScenarios, analyzeStoryComplexity, generateStoriesFromTranscript } from './services/geminiService';
import { personaDetails, UserIcon, BookOpenIcon, XIcon, MenuIcon, SparklesIcon, HomeIcon, ClipboardIcon, ClipboardCheckIcon, ClipboardListIcon, InformationCircleIcon, ScaleIcon, MicrophoneIcon } from './components/icons';

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
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
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
                    <li><span className="font-semibold">Analisar Transcrição de Reunião:</span> Cole a transcrição de uma reunião para que a IA gere propostas de histórias de usuário.</li>
                </ul>
            </div>
            <div>
                <h4 className="font-bold text-cyan-300">Geração de História</h4>
                <ul className="list-disc list-inside space-y-1 mt-1">
                    <li><span className="font-semibold">Modelo Opcional:</span> Forneça uma história como modelo para manter a consistência de formatação.</li>
                    <li><span className="font-semibold">Revisão Humana:</span> Edite a história gerada pela IA antes de iniciar o refinamento.</li>
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
                <h4 className="font-bold text-cyan-300">Geração de Cenários de Teste</h4>
                <ul className="list-disc list-inside space-y-1 mt-1">
                    <li><span className="font-semibold">Validação Integrada:</span> Gere cenários de teste (caminho feliz, casos de borda, negativos) para a versão atual da história a qualquer momento.</li>
                </ul>
            </div>
            <div>
                <h4 className="font-bold text-cyan-300">Utilidades</h4>
                <ul className="list-disc list-inside space-y-1 mt-1">
                    <li><span className="font-semibold">Acesso Rápido:</span> Visualize a história original em um modal a qualquer momento.</li>
                    <li><span className="font-semibold">Copiar para a Área de Transferência:</span> Copie facilmente a história original, perguntas, sugestões e cenários de teste.</li>
                     <li><span className="font-semibold">Navegação Inteligente:</span> Reinicie o processo ou volte para a seleção de histórias quebradas com um botão que se adapta ao contexto.</li>
                </ul>
            </div>
        </div>
      </div>
    </div>
);


const HomeScreen = ({ onChoice, onShowFeatures }: { onChoice: (choice: 'refining' | 'generating' | 'transcribing') => void; onShowFeatures: () => void; }) => (
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
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
                    onClick={() => onChoice('transcribing')}
                    className="flex flex-col items-center justify-center bg-gray-700 hover:bg-gray-600 text-white font-bold py-6 px-6 rounded-md transition-transform transform hover:scale-105"
                >
                    <MicrophoneIcon className="w-8 h-8 mx-auto mb-2 text-green-300" />
                    Analisar Transcrição
                     <p className="text-sm font-normal text-gray-400 mt-1">Transforme uma reunião em propostas de histórias.</p>
                </button>
            </div>
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

const GenerateStoryInput = ({ onGenerate }: { onGenerate: (requirements: string, modelStory: string) => void; }) => {
    const [requirements, setRequirements] = useState('');
    const [modelStory, setModelStory] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (!requirements.trim()) {
            setError('Por favor, descreva os requisitos da história.');
            return;
        }
        setError('');
        onGenerate(requirements, modelStory);
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

                <label className="block mt-4 mb-2 text-sm font-medium text-gray-300" htmlFor="modelStory">História Modelo (Opcional)</label>
                 <textarea
                    id="modelStory"
                    className="w-full h-32 p-3 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition text-gray-300 resize-y"
                    value={modelStory}
                    onChange={(e) => setModelStory(e.target.value)}
                    placeholder="Cole uma história existente aqui para que a IA copie o formato e a estrutura."
                />

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

const TranscriptionInput = ({ onTranscriptSubmit }: { onTranscriptSubmit: (transcript: string) => void; }) => {
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (!transcript.trim()) {
            setError('Por favor, cole a transcrição da reunião.');
            return;
        }
        setError('');
        onTranscriptSubmit(transcript);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 -mt-20">
            <div className="w-full max-w-3xl bg-gray-800 rounded-lg shadow-xl p-6">
                <h2 className="text-xl font-semibold mb-2 text-gray-200">Analisar Transcrição de Reunião</h2>
                <p className="text-gray-400 mb-4 text-sm">Cole o texto bruto da transcrição e a IA irá identificar temas e sugerir histórias de usuário.</p>
                
                <textarea
                    className="w-full h-80 p-3 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition text-gray-300 resize-y"
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Cole a transcrição completa aqui..."
                />
                {error && <p className="text-red-400 mt-2 text-sm">{error}</p>}
                
                <button
                    onClick={handleSubmit}
                    className="mt-6 w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md transition-transform transform hover:scale-105"
                >
                    Analisar e Gerar Histórias
                </button>
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

const OriginalStoryModal = ({ story, onClose }: { story: ParsedStory; onClose: () => void; }) => {
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
                <h3 className="text-lg font-semibold text-purple-300">História Original</h3>
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


const App: React.FC = () => {
    type AppState = 'home' | 'refining' | 'generating' | 'transcribing' | 'loading_generation' | 'loading_transcription' | 'reviewing' | 'configuring' | 'loading' | 'planning' | 'error' | 'analyzing_complexity' | 'story_selection';
    const [appState, setAppState] = useState<AppState>('home');

    const [originalStory, setOriginalStory] = useState<ParsedStory | null>(null);
    const [activePersonas, setActivePersonas] = useState<Persona[]>([]);
    const [conversation, setConversation] = useState<ConversationTurn[]>([]);
    const [currentAnswer, setCurrentAnswer] = useState('');
    const [isAnswering, setIsAnswering] = useState(false);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [suggestedStory, setSuggestedStory] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isOriginalStoryModalOpen, setIsOriginalStoryModalOpen] = useState(false);
    const [refinementPrompt, setRefinementPrompt] = useState('');
    const [isRefining, setIsRefining] = useState(false);
    const [copied, setCopied] = useState(false);
    const [copiedTurnId, setCopiedTurnId] = useState<number | null>(null);
    const [testScenarios, setTestScenarios] = useState<string | null>(null);
    const [isGeneratingScenarios, setIsGeneratingScenarios] = useState(false);
    const [isFeaturesModalOpen, setIsFeaturesModalOpen] = useState(false);
    const [isAnalyzingComplexity, setIsAnalyzingComplexity] = useState(false);
    const [complexityAnalysis, setComplexityAnalysis] = useState<ComplexityAnalysisResult | null>(null);
    const [splitStories, setSplitStories] = useState<SplitStory[]>([]);
    
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
        setOriginalStory(story);
        setAppState('configuring');
    }, []);

    const handleGenerateStory = useCallback(async (requirements: string, modelStory: string) => {
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
    }, []);

     const handleTranscriptSubmit = useCallback(async (transcript: string) => {
        setAppState('loading_transcription');
        setError(null);
        try {
            const generatedStories = await generateStoriesFromTranscript(transcript);
            if (generatedStories.length === 0) {
                setError('A IA não conseguiu gerar histórias a partir da transcrição fornecida. Tente com um texto mais detalhado.');
                setAppState('transcribing');
                return;
            }
            setSplitStories(generatedStories);
            setAppState('story_selection');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao analisar a transcrição.');
            setAppState('error');
        }
    }, []);

    const handleReviewConfirm = useCallback(() => {
        if (!originalStory) return;
        setAppState('configuring');
    }, [originalStory]);

    const handleStartPlanning = useCallback(async (selectedPersonas: Persona[]) => {
        if (!originalStory || selectedPersonas.length === 0) return;
        setAppState('loading');
        setActivePersonas(selectedPersonas);
        setError(null);
        try {
            const initialQs = await generateInitialQuestions(originalStory, selectedPersonas);
            
            const firstQuestion: ConversationTurn = {
                id: Date.now(),
                persona: selectedPersonas[0],
                question: initialQs[personaToKey(selectedPersonas[0])],
            };
            setConversation([firstQuestion]);
            setAppState('planning');
        } catch (err)
 {
            setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
            setAppState('error');
        }
    }, [originalStory]);

    const handleCancelConfiguration = useCallback(() => {
        if (splitStories.length > 0) {
            setAppState('story_selection');
            setOriginalStory(null);
        } else {
            setOriginalStory(null);
            setAppState('home');
        }
    }, [splitStories]);

    const submitAnswer = useCallback(async (answer: string) => {
        if (!originalStory || activePersonas.length === 0) return;
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

            const nextQuestionText = await generateFollowUpQuestion(originalStory, updatedConversation, nextPersona);
            const nextTurn: ConversationTurn = { id: Date.now(), persona: nextPersona, question: nextQuestionText };
            setConversation(prev => [...prev, nextTurn]);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao obter a próxima pergunta.');
        } finally {
            setIsAnswering(false);
        }
    }, [conversation, originalStory, activePersonas]);

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
        setSuggestedStory(null);
        setTestScenarios(null);
        setError(null);
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
        try {
            const refined = await refineSuggestedStory(suggestedStory, refinementPrompt);
            setSuggestedStory(refined);
            setTestScenarios(null);
            setRefinementPrompt('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao refinar a sugestão.');
        } finally {
            setIsRefining(false);
        }
    }, [suggestedStory, refinementPrompt]);
    
    const handleGenerateScenarios = useCallback(async () => {
        if (!originalStory) return;
        setIsGeneratingScenarios(true);
        setTestScenarios(null);
        setError(null);
        try {
            const storyToTest = suggestedStory ?? originalStory.description;
            const scenarios = await generateTestScenarios(storyToTest);
            setTestScenarios(scenarios);
        } catch (err) {
             setError(err instanceof Error ? err.message : 'Falha ao gerar cenários de teste.');
        } finally {
            setIsGeneratingScenarios(false);
        }
    }, [originalStory, suggestedStory]);

    const handleAnalyzeComplexity = useCallback(async () => {
        if (!originalStory) return;
        setIsAnalyzingComplexity(true);
        setComplexityAnalysis(null);
        setError(null);
        try {
            const storyToAnalyze = suggestedStory ? { title: originalStory.title, description: suggestedStory } : originalStory;
            const result = await analyzeStoryComplexity(storyToAnalyze);
            setComplexityAnalysis(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao analisar a complexidade.');
        } finally {
            setIsAnalyzingComplexity(false);
        }
    }, [originalStory, suggestedStory]);

    const handleAcceptSplit = useCallback(() => {
        if (complexityAnalysis?.suggestedStories) {
            setSplitStories(complexityAnalysis.suggestedStories);
            setAppState('story_selection');
        }
        setComplexityAnalysis(null);
    }, [complexityAnalysis]);

    const handleSelectSplitStory = useCallback((story: SplitStory) => {
        setConversation([]);
        setActivePersonas([]);
        setSuggestedStory(null);
        setError(null);
        setCurrentAnswer('');
        setIsAnswering(false);
        setIsSuggesting(false);
        setIsRefining(false);
        setRefinementPrompt('');
        setTestScenarios(null);
        setIsGeneratingScenarios(false);
        setCopiedTurnId(null);
        setComplexityAnalysis(null);
        setIsAnalyzingComplexity(false);
        
        setOriginalStory(story);
        setAppState('configuring');
    }, []);


    const resetApp = () => {
        setSplitStories([]);
        setAppState('home');
        setOriginalStory(null);
        setConversation([]);
        setActivePersonas([]);
        setSuggestedStory(null);
        setError(null);
        setCurrentAnswer('');
        setIsAnswering(false);
        setIsSuggesting(false);
        setIsRefining(false);
        setRefinementPrompt('');
        setTestScenarios(null);
        setIsGeneratingScenarios(false);
        setCopiedTurnId(null);
        setIsFeaturesModalOpen(false);
        setComplexityAnalysis(null);
        setIsAnalyzingComplexity(false);
    };

    const handleRestart = () => {
        if (window.confirm("Tem certeza que deseja recomeçar? Todo o progresso será perdido.")) {
            resetApp();
        }
    };

    const isRefiningSplitStory = (appState === 'planning' || appState === 'configuring') && splitStories.length > 0;

    const handleBackToSelection = () => {
         if (window.confirm("Tem certeza que deseja voltar para a seleção? O progresso nesta história será perdido.")) {
            setConversation([]);
            setSuggestedStory(null);
            setError(null);
            setCurrentAnswer('');
            setTestScenarios(null);
            setOriginalStory(null); 
            
            setAppState('story_selection');
        }
    }

    const headerAction = isRefiningSplitStory ? handleBackToSelection : handleRestart;
    const headerText = isRefiningSplitStory ? 'Voltar para Seleção' : 'Recomeçar';
    
    if (appState === 'error') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
                <h2 className="text-2xl text-red-400 mb-4">Ocorreu um Erro</h2>
                <p className="text-gray-400 mb-6">{error}</p>
                <button onClick={() => resetApp()} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded">
                    Começar de Novo
                </button>
            </div>
        );
    }

    const currentTurn = conversation[conversation.length - 1];

    const renderContent = () => {
        switch (appState) {
            case 'home':
                return <HomeScreen onChoice={setAppState as (choice: 'refining' | 'generating' | 'transcribing') => void} onShowFeatures={() => setIsFeaturesModalOpen(true)} />;
            case 'refining':
                return <StoryInput onStorySubmit={handleStorySubmit} />;
            case 'generating':
                return <GenerateStoryInput onGenerate={handleGenerateStory} />;
            case 'transcribing':
                return <TranscriptionInput onTranscriptSubmit={handleTranscriptSubmit} />;
            case 'loading_generation':
                return <div className="h-screen -mt-20"><Loader text="A IA está gerando sua história..." /></div>;
            case 'loading_transcription':
                return <div className="h-screen -mt-20"><Loader text="A IA está analisando a transcrição e gerando histórias..." /></div>;
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
                                            <span>Ver História Original</span>
                                        </button>
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
                                <h3 className="text-lg font-semibold text-green-300 mb-4 flex items-center gap-2">
                                    <ClipboardListIcon className="w-6 h-6"/>
                                    Cenários de Teste
                                </h3>
                                <button
                                    onClick={handleGenerateScenarios}
                                    disabled={isGeneratingScenarios}
                                    className="w-full mb-4 bg-green-600 hover:bg-green-700 disabled:bg-green-900 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition-transform transform hover:scale-105"
                                >
                                    Sugerir Cenários de Teste
                                </button>
                                {isGeneratingScenarios && <Loader text="O QA Sênior está elaborando os testes..." />}
                                {testScenarios && !isGeneratingScenarios && (
                                    <div>
                                         <div className="flex justify-between items-center mb-2">
                                             <h4 className="font-semibold text-md">Cenários Sugeridos:</h4>
                                             <button onClick={() => handleCopy(testScenarios)} title="Copiar Cenários" className="text-gray-400 hover:text-white transition">
                                                 {copied ? <ClipboardCheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                                             </button>
                                         </div>
                                         <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans bg-gray-900/50 p-3 rounded-md max-h-60 overflow-y-auto">{testScenarios}</pre>
                                    </div>
                                )}
                            </div>
                            {error && !isSuggesting && !isRefining && !isGeneratingScenarios && <p className="text-red-400 mt-2 text-sm text-center p-2 bg-red-900/20 rounded-md">{error}</p>}
                        </div>
                    </main>
                );
            default:
                return null;
        }
    }


    return (
        <div className="bg-gray-900 text-gray-200 min-h-screen font-sans">
            <Header onRestart={headerAction} showRestart={appState !== 'home'} text={headerText} />
            {renderContent()}
            {isOriginalStoryModalOpen && originalStory && (
                <OriginalStoryModal 
                    story={originalStory} 
                    onClose={() => setIsOriginalStoryModalOpen(false)} 
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
        </div>
    );
};

export default App;