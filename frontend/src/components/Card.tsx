import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  headerActions?: React.ReactNode;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  description,
  headerActions,
  noPadding = false,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`glass-panel rounded-xl shadow-md overflow-hidden ${className}`}
      {...props}
    >
      {(title || description || headerActions) && (
        <div className="px-6 py-4 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
          <div>
            {title && (
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 font-display">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {description}
              </p>
            )}
          </div>
          {headerActions && <div className="flex items-center space-x-2">{headerActions}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-6'}>{children}</div>
    </div>
  );
};
