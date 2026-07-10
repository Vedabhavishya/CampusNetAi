import React from 'react';

interface TimelineItem {
  id: string;
  time: string;
  title: string;
  description?: string;
  type?: 'info' | 'warning' | 'success' | 'critical';
  user?: string;
}

interface UniversalTimelineProps {
  items: TimelineItem[];
  emptyMessage?: string;
}

export const UniversalTimeline: React.FC<UniversalTimelineProps> = ({ 
  items, 
  emptyMessage = 'No logs registered in this window.' 
}) => {
  const getColors = (type?: 'info' | 'warning' | 'success' | 'critical') => {
    switch (type) {
      case 'success': return 'bg-emerald-500 ring-emerald-500/20';
      case 'warning': return 'bg-amber-500 ring-amber-500/20';
      case 'critical': return 'bg-rose-500 ring-rose-500/20';
      case 'info':
      default: return 'bg-brand-500 ring-brand-500/20';
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-xs text-slate-400 font-medium">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="flow-root text-left">
      <ul className="-mb-8">
        {items.map((item, idx) => (
          <li key={item.id}>
            <div className="relative pb-8">
              {idx !== items.length - 1 && (
                <span 
                  className="absolute top-4 left-4 -ml-px h-full w-[1px] bg-slate-200 dark:bg-slate-800" 
                  aria-hidden="true" 
                />
              )}
              <div className="relative flex space-x-3">
                <div>
                  <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-slate-950 ${getColors(item.type)}`}>
                    <span className="h-2 w-2 rounded-full bg-white" />
                  </span>
                </div>
                <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                  <div className="text-xs">
                    <p className="font-bold text-slate-800 dark:text-slate-100">{item.title}</p>
                    {item.description && (
                      <p className="mt-1 text-slate-500 leading-relaxed font-sans">{item.description}</p>
                    )}
                    {item.user && (
                      <span className="mt-1 inline-block text-[10px] font-semibold text-brand-500 font-mono">
                        By Operator: {item.user}
                      </span>
                    )}
                  </div>
                  <div className="text-right text-[10px] whitespace-nowrap text-slate-400 font-mono select-none shrink-0">
                    <time dateTime={item.time}>
                      {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </time>
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
