
import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { XIcon, PlusIcon } from './icons'; // Reusing icons, might add MinusIcon later or just reuse

// Simple Minus Icon for Zoom Out
const MinusIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
    </svg>
);

// Expand Icon for Fullscreen
const ExpandIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
    </svg>
);

interface DiagramViewerProps {
    code: string;
    className?: string;
}

const DiagramViewer: React.FC<DiagramViewerProps> = ({ code, className }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [svgContent, setSvgContent] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        mermaid.initialize({ 
            startOnLoad: false, 
            theme: 'dark',
            securityLevel: 'loose',
        });

        const renderDiagram = async () => {
            if (!code) return;
            try {
                setError(null);
                const id = `mermaid-${Date.now()}`;
                const { svg } = await mermaid.render(id, code);
                setSvgContent(svg);
            } catch (err) {
                console.error("Mermaid render error:", err);
                setError("Erro ao renderizar o diagrama. A sintaxe pode estar incorreta.");
            }
        };

        renderDiagram();
    }, [code]);

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 3));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.5));
    const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

    const ViewerContent = () => (
        <div className="relative w-full h-full flex flex-col bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
            {/* Toolbar */}
            <div className="absolute top-4 right-4 z-10 flex gap-2 bg-gray-800/80 backdrop-blur-sm p-2 rounded-lg shadow-lg border border-gray-700">
                <button onClick={handleZoomOut} className="p-1 hover:bg-gray-700 rounded text-gray-300" title="Zoom Out">
                    <MinusIcon className="w-5 h-5" />
                </button>
                <span className="text-xs text-gray-400 flex items-center w-12 justify-center">{Math.round(zoom * 100)}%</span>
                <button onClick={handleZoomIn} className="p-1 hover:bg-gray-700 rounded text-gray-300" title="Zoom In">
                    <PlusIcon className="w-5 h-5" />
                </button>
                <div className="w-px bg-gray-600 mx-1"></div>
                <button onClick={toggleFullscreen} className="p-1 hover:bg-gray-700 rounded text-gray-300" title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}>
                    {isFullscreen ? <XIcon className="w-5 h-5" /> : <ExpandIcon className="w-5 h-5" />}
                </button>
            </div>

            {/* Diagram Area */}
            <div 
                className="flex-grow overflow-auto flex items-center justify-center p-8 cursor-grab active:cursor-grabbing bg-gray-900"
                ref={containerRef}
                onMouseDown={(e) => {
                    const ele = containerRef.current;
                    if (!ele) return;
                    ele.style.cursor = 'grabbing';
                    ele.style.userSelect = 'none';

                    const startX = e.pageX - ele.offsetLeft;
                    const startY = e.pageY - ele.offsetTop;
                    const scrollLeft = ele.scrollLeft;
                    const scrollTop = ele.scrollTop;

                    const mouseMoveHandler = (e: MouseEvent) => {
                        const x = e.pageX - ele.offsetLeft;
                        const y = e.pageY - ele.offsetTop;
                        const walkX = (x - startX) * 1.5; 
                        const walkY = (y - startY) * 1.5;
                        ele.scrollLeft = scrollLeft - walkX;
                        ele.scrollTop = scrollTop - walkY;
                    };

                    const mouseUpHandler = () => {
                        ele.style.cursor = 'grab';
                        ele.style.userSelect = 'auto';
                        document.removeEventListener('mousemove', mouseMoveHandler);
                        document.removeEventListener('mouseup', mouseUpHandler);
                    };

                    document.addEventListener('mousemove', mouseMoveHandler);
                    document.addEventListener('mouseup', mouseUpHandler);
                }}
            >
                {error ? (
                    <div className="text-red-400 text-center p-4">
                        <p>{error}</p>
                        <pre className="mt-4 text-xs text-left bg-gray-800 p-2 rounded overflow-auto max-w-md">{code}</pre>
                    </div>
                ) : (
                    <div 
                        dangerouslySetInnerHTML={{ __html: svgContent }} 
                        style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 0.2s ease' }}
                    />
                )}
            </div>
        </div>
    );

    if (isFullscreen) {
        return (
            <div className="fixed inset-0 z-50 bg-gray-900 flex items-center justify-center p-4">
                <ViewerContent />
            </div>
        );
    }

    return (
        <div className={`h-full w-full ${className}`}>
            <ViewerContent />
        </div>
    );
};

export default DiagramViewer;
