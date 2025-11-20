
import React, { useState } from 'react';
import { SessionData } from '../types';
import { ClockIcon, PlusIcon, TrashIcon, MenuIcon, XIcon } from './icons';

type HistorySidebarProps = {
  sessions: SessionData[];
  currentSessionId: string | null;
  onSelectSession: (session: SessionData) => void;
  onDeleteSession: (id: string) => void;
  onNewSession: () => void;
  className?: string;
};

const HistorySidebar: React.FC<HistorySidebarProps> = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onNewSession,
  className
}) => {
  const [isOpen, setIsOpen] = useState(true);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
        {/* Mobile Toggle */}
        <button 
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden fixed bottom-4 left-4 z-50 bg-purple-600 text-white p-3 rounded-full shadow-lg"
        >
             {isOpen ? <XIcon className="w-6 h-6" /> : <ClockIcon className="w-6 h-6" />}
        </button>

        <div 
            className={`
                bg-gray-900 border-r border-gray-800 h-screen flex flex-col transition-all duration-300 z-40
                ${isOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full lg:w-0 lg:translate-x-0 lg:hidden'}
                fixed lg:relative top-0 left-0
                ${className || ''}
            `}
        >
            <div className="p-4 border-b border-gray-800 flex items-center justify-between min-w-[256px]">
                <h2 className="text-lg font-semibold text-purple-300 flex items-center gap-2">
                    <ClockIcon className="w-5 h-5" />
                    Histórico
                </h2>
                 <button onClick={() => setIsOpen(false)} className="lg:hidden text-gray-400"><XIcon className="w-5 h-5"/></button>
            </div>

            <div className="flex-grow overflow-y-auto min-w-[256px]">
                {sessions.length === 0 ? (
                    <div className="p-6 text-center text-gray-500 text-sm">
                        Nenhuma sessão anterior encontrada.
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-800">
                        {sessions.map((session) => (
                            <li key={session.id}>
                                <button
                                    onClick={() => {
                                        onSelectSession(session);
                                        if (window.innerWidth < 1024) setIsOpen(false);
                                    }}
                                    className={`w-full text-left p-4 transition-colors hover:bg-gray-800 group relative ${currentSessionId === session.id ? 'bg-gray-800 border-l-2 border-purple-500' : ''}`}
                                >
                                    <div className="pr-6">
                                        <p className="font-medium text-gray-300 truncate text-sm mb-1" title={session.title}>
                                            {session.title || 'Sessão Sem Título'}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {formatDate(session.lastModified)}
                                        </p>
                                    </div>
                                    <div 
                                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteSession(session.id);
                                        }}
                                    >
                                         <div className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-red-400">
                                            <TrashIcon className="w-4 h-4" />
                                         </div>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="p-4 border-t border-gray-800 min-w-[256px]">
                <button
                    onClick={() => {
                        onNewSession();
                        if (window.innerWidth < 1024) setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition"
                >
                    <PlusIcon className="w-5 h-5" />
                    Nova Sessão
                </button>
            </div>
        </div>
    </>
  );
};

export default HistorySidebar;
