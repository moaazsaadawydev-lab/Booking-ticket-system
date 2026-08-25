import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'gold' | 'indigo' | 'blue' | 'emerald' | 'rose' | 'slate';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'blue',
  size = 'md',
}) => {
  const variantStyles = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-900/60',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-400 dark:border-indigo-900/60',
    gold: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-900/60',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900/60',
    rose: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-900/60',
    slate: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700/80',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[10px] font-medium',
    md: 'px-2.5 py-1 text-xs font-medium',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border tracking-wide font-sans ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80"></span>
      {children}
    </span>
  );
};

export default Badge;
