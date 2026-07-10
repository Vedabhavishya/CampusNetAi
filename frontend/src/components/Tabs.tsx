import React from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = '',
}) => {
  return (
    <div className={`border-b border-slate-200/50 dark:border-slate-800/50 ${className}`}>
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;
          
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`
                group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 cursor-pointer
                ${isActive
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200'
                }
              `}
            >
              {Icon && (
                <Icon
                  className={`
                    -ml-0.5 mr-2 h-4 w-4 transition-colors
                    ${isActive
                      ? 'text-brand-500 dark:text-brand-400'
                      : 'text-slate-400 group-hover:text-slate-500 dark:text-slate-500 dark:group-hover:text-slate-400'
                    }
                  `}
                />
              )}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
