
import React, { useState } from 'react';
import { ParsedStory, BddScenario } from '../types';
import { generateMarkdownExport, generateJiraExport, generateHtmlReport } from '../utils/exportUtils';
import { XIcon, DownloadIcon, ClipboardIcon, ClipboardCheckIcon } from './icons';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: {
        story: ParsedStory | null;
        featureDescription: string;
        bddScenarios: { id: number; title: string; gherkin: string | null; completed: boolean; type: 'scenario' | 'outline' }[];
        poChecklist: string | null;
        technicalNotes: string | null;
        prototypeCode: string | null;
        diagramCode: string | null;
    };
}

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, data }) => {
    const [copied, setCopied] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleCopy = (text: string, format: string) => {
        navigator.clipboard.writeText(text);
        setCopied(format);
        setTimeout(() => setCopied(null), 2000);
    };

    const handleDownload = (text: string, filename: string, mimeType: string) => {
        const blob = new Blob([text], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const formats = [
        {
            id: 'jira',
            name: 'Jira (Wiki Markup)',
            description: 'Formatação compatível com a descrição de issues do Jira.',
            action: () => handleCopy(generateJiraExport(data), 'jira'),
            icon: copied === 'jira' ? ClipboardCheckIcon : ClipboardIcon,
            btnText: copied === 'jira' ? 'Copiado!' : 'Copiar para Área de Transferência'
        },
        {
            id: 'markdown',
            name: 'Markdown (.md)',
            description: 'Compatível com GitHub, GitLab, Azure DevOps e Notion.',
            action: () => handleDownload(generateMarkdownExport(data), 'especificacao.md', 'text/markdown'),
            icon: DownloadIcon,
            btnText: 'Baixar Arquivo .md'
        },
        {
            id: 'html',
            name: 'Relatório HTML',
            description: 'Relatório visual completo com diagramas e protótipos embutidos.',
            action: () => handleDownload(generateHtmlReport(data), 'relatorio.html', 'text/html'),
            icon: DownloadIcon,
            btnText: 'Baixar Relatório .html'
        }
    ];

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div 
                className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6 border border-gray-700 relative animate-fade-in-up"
                onClick={e => e.stopPropagation()}
            >
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-gray-700 z-10"
                >
                    <XIcon className="w-6 h-6" />
                </button>
                
                <h2 className="text-xl font-semibold text-purple-300 mb-2">Exportar Artefatos</h2>
                <p className="text-gray-400 mb-6 text-sm">Escolha o formato ideal para levar o resultado do seu refinamento para outras ferramentas.</p>

                <div className="grid gap-4">
                    {formats.map((format) => (
                        <div key={format.id} className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 hover:border-purple-500/50 transition-colors flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="text-center sm:text-left">
                                <h3 className="font-bold text-gray-200">{format.name}</h3>
                                <p className="text-sm text-gray-500">{format.description}</p>
                            </div>
                            <button
                                onClick={format.action}
                                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors min-w-[160px] justify-center"
                            >
                                <format.icon className={`w-4 h-4 ${copied === format.id ? 'text-green-400' : ''}`} />
                                {format.btnText}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ExportModal;
