import React, { useState } from 'react';
import { TrashIcon, PlusIcon } from './icons';

type DataTableModalProps = {
  title: string;
  columns: string[];
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (tableString: string) => void;
};

const DataTableModal: React.FC<DataTableModalProps> = ({ title, columns, isOpen, onClose, onConfirm }) => {
  const [data, setData] = useState<string[][]>([Array(columns.length).fill('')]);

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const newData = [...data];
    newData[rowIndex][colIndex] = value;
    setData(newData);
  };

  const addRow = () => {
    setData([...data, Array(columns.length).fill('')]);
  };

  const deleteRow = (rowIndex: number) => {
    if (data.length > 1) {
      setData(data.filter((_, index) => index !== rowIndex));
    }
  };

  const formatTableToString = () => {
    if (data.every(row => row.every(cell => cell.trim() === ''))) {
        return '';
    }
    const header = `| ${columns.join(' | ')} |`;
    const rows = data.map(row => `| ${row.map(c => c.trim()).join(' | ')} |`).join('\n');
    return `\n${header}\n${rows}`;
  };

  const handleConfirm = () => {
    const tableString = formatTableToString();
    onConfirm(tableString);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full p-6 border border-gray-700 relative animate-fade-in-up" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-semibold text-purple-300 mb-4 pr-10">{title}</h3>
        <p className="text-gray-400 mb-4 text-sm">Preencha os dados na tabela abaixo. Eles serão formatados e inseridos na sua resposta.</p>
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm text-left text-gray-400">
            <thead className="text-xs text-gray-300 uppercase bg-gray-700/50 sticky top-0">
              <tr>
                {columns.map((col, index) => (
                  <th key={index} scope="col" className="px-4 py-3">{col}</th>
                ))}
                <th scope="col" className="px-4 py-3 w-12 text-center">Ação</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-gray-700 hover:bg-gray-700/50">
                  {row.map((cell, colIndex) => (
                    <td key={colIndex} className="px-2 py-1">
                      <input
                        type="text"
                        value={cell}
                        onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-shadow"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1 text-center">
                    <button onClick={() => deleteRow(rowIndex)} disabled={data.length <= 1} className="text-gray-400 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed p-1" title="Remover linha">
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700">
          <button onClick={addRow} className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded transition">
            <PlusIcon className="w-5 h-5" />
            Adicionar Linha
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition">Cancelar</button>
            <button onClick={handleConfirm} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition">Confirmar Tabela</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataTableModal;
