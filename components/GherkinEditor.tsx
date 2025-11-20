
import React, { useState, useRef, useEffect } from 'react';
import { TableIcon, ClipboardIcon, ClipboardCheckIcon } from './icons';

interface GherkinEditorProps {
    value: string;
    onChange?: (value: string) => void;
    readOnly?: boolean;
    className?: string;
    onRequestTable?: (cursorIndex: number) => void;
    title?: string;
}

const GherkinEditor: React.FC<GherkinEditorProps> = ({ 
    value, 
    onChange, 
    readOnly = false, 
    className = "", 
    onRequestTable,
    title
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const preRef = useRef<HTMLPreElement>(null);
    const [copied, setCopied] = useState(false);

    // Sincronizar Scroll
    const handleScroll = () => {
        if (textareaRef.current && preRef.current) {
            preRef.current.scrollTop = textareaRef.current.scrollTop;
            preRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleTableClick = () => {
        if (onRequestTable && textareaRef.current) {
            onRequestTable(textareaRef.current.selectionStart);
            textareaRef.current.focus();
        }
    };

    const highlightSyntax = (text: string) => {
        if (!text) return '';

        // Escapar HTML básico para evitar injeção ao renderizar
        let escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // 1. Comentários (Cinza) - Processar primeiro para evitar conflitos
        // Regex captura do # até o fim da linha
        escaped = escaped.replace(/(#.*$)/gm, '<span class="text-gray-500 italic">$1</span>');

        // 2. Strings (Verde)
        // Captura texto entre aspas duplas
        escaped = escaped.replace(/(&quot;.*?&quot;)/g, '<span class="text-green-400">$1</span>');

        // 3. Placeholders (Laranja)
        // Captura texto entre < e > (já escapados como &lt; e &gt;)
        escaped = escaped.replace(/(&lt;.*?&gt;)/g, '<span class="text-orange-400 font-bold">$1</span>');

        // 4. Keywords (Roxo/Rosa)
        // Lista de palavras-chave Gherkin (PT-BR e EN)
        const keywords = [
            'Funcionalidade', 'Feature',
            'Cenário', 'Scenario',
            'Esquema do Cenário', 'Scenario Outline',
            'Contexto', 'Background',
            'Dado', 'Given',
            'Quando', 'When',
            'Então', 'Then',
            'E', 'And',
            'Mas', 'But',
            'Exemplos', 'Examples'
        ];
        
        // Regex complexa para pegar keywords no início da linha ou após espaço, seguidas de : ou espaço
        const keywordRegex = new RegExp(`^(\\s*)(${keywords.join('|')}):?`, 'gm');
        escaped = escaped.replace(keywordRegex, '$1<span class="text-purple-400 font-bold">$2</span>:'); // Recoloca os dois pontos se existirem na captura original, ajustando caso a caso pode ser complexo, simplificando:
        
        // Refinamento para keywords que podem não ter dois pontos (Steps) vs Declarações
        // Estratégia alternativa: Substituir palavras exatas
        keywords.forEach(kw => {
            // Lookbehind simulado ou word boundaries
            // Apenas colorimos se for início de linha (com indentação opcional)
            const regex = new RegExp(`^(\\s*)(${kw})`, 'gm');
            escaped = escaped.replace(regex, '$1<span class="text-purple-400 font-bold">$2</span>');
        });

        // 5. Tabelas (Azul Claro para os pipes)
        escaped = escaped.replace(/(\|)/g, '<span class="text-cyan-600 font-bold">$1</span>');

        return escaped;
    };

    return (
        <div className={`flex flex-col border border-gray-700 rounded-md bg-gray-900 overflow-hidden ${className}`}>
            {/* Toolbar */}
            <div className="flex justify-between items-center px-3 py-2 bg-gray-800 border-b border-gray-700">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {title || 'Gherkin Editor'}
                </span>
                <div className="flex items-center gap-2">
                    {!readOnly && onRequestTable && (
                        <button 
                            onClick={handleTableClick}
                            className="flex items-center gap-1 text-xs text-gray-300 hover:text-cyan-300 transition-colors py-1 px-2 rounded hover:bg-gray-700"
                            title="Inserir Tabela de Exemplos"
                        >
                            <TableIcon className="w-4 h-4" />
                            <span>Tabela</span>
                        </button>
                    )}
                    <button 
                        onClick={handleCopy}
                        className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
                        title="Copiar código"
                    >
                        {copied ? <ClipboardCheckIcon className="w-4 h-4 text-green-400" /> : <ClipboardIcon className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Editor Area */}
            <div className="relative flex-grow min-h-[300px] font-mono text-sm">
                {/* Syntax Highlighting Layer (Background) */}
                <pre
                    ref={preRef}
                    className="absolute inset-0 p-4 margin-0 whitespace-pre-wrap break-words pointer-events-none overflow-auto"
                    style={{ fontFamily: 'monospace' }}
                    dangerouslySetInnerHTML={{ __html: highlightSyntax(value) + '<br>' }} // br extra para scroll sync no final
                />

                {/* Input Layer (Foreground) */}
                {!readOnly ? (
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => onChange && onChange(e.target.value)}
                        onScroll={handleScroll}
                        spellCheck={false}
                        className="absolute inset-0 w-full h-full p-4 bg-transparent text-transparent caret-white resize-none border-none focus:ring-0 focus:outline-none whitespace-pre-wrap break-words overflow-auto"
                        style={{ fontFamily: 'monospace' }}
                    />
                ) : (
                    // Se for readOnly, usamos apenas uma div transparente por cima para permitir seleção de texto nativa do navegador
                    // mas sem editar. O pre já mostra as cores.
                    // Melhor abordagem para readOnly: Esconder o textarea e deixar o PRE lidar com a seleção?
                    // O PRE com pointer-events-none não permite seleção.
                    // Vamos mudar a estratégia para readOnly: Tirar pointer-events-none do PRE ou usar textarea readOnly.
                    <textarea
                        ref={textareaRef}
                        value={value}
                        readOnly
                        onScroll={handleScroll}
                        className="absolute inset-0 w-full h-full p-4 bg-transparent text-transparent resize-none border-none focus:ring-0 focus:outline-none whitespace-pre-wrap break-words overflow-auto selection:bg-purple-500/30 selection:text-transparent"
                        style={{ fontFamily: 'monospace', color: 'transparent' }} // Texto transparente para ver o fundo
                    />
                )}
            </div>
        </div>
    );
};

export default GherkinEditor;
