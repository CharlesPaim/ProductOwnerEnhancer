import React from 'react';

type BreadcrumbsProps = {
  history: string[];
  onNavigate: (index: number) => void;
  translate: (state: string) => string;
};

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ history, onNavigate, translate }) => {
  if (history.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-400">
      <ol className="flex items-center space-x-2 flex-wrap">
        {history.map((state, index) => (
          <li key={index} className="flex items-center">
            {index < history.length - 1 ? (
              <button
                onClick={() => onNavigate(index)}
                className="hover:text-purple-300 hover:underline"
              >
                {translate(state)}
              </button>
            ) : (
              <span className="font-semibold text-gray-200" aria-current="page">
                {translate(state)}
              </span>
            )}
            {index < history.length - 1 && (
              <svg className="w-4 h-4 text-gray-500 mx-2" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
