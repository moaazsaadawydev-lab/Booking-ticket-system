import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?:
    | 'crimson'
    | 'gold'
    | 'vip'
    | 'imax'
    | 'cyan'
    | 'indigo'
    | 'blue'
    | 'emerald'
    | 'rose'
    | 'purple'
    | 'slate';
  size?: 'sm' | 'md' | 'xs';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'crimson',
  size = 'md',
  dot = true,
}) => {
  const variantStyles: Record<string, string> = {
    crimson:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/70 dark:text-red-400 dark:border-red-900/60 shadow-sm',
    gold:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-900/60 shadow-sm',
    vip:
      'bg-gradient-to-r from-amber-500/10 to-yellow-500/10 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800/80 font-bold',
    imax:
      'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/70 dark:text-cyan-300 dark:border-cyan-800/60 font-bold tracking-wider',
    cyan:
      'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-400 dark:border-cyan-900/60',
    blue:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-900/60',
    indigo:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-400 dark:border-indigo-900/60',
    emerald:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900/60',
    rose:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-900/60',
    purple:
      'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-400 dark:border-purple-900/60',
    slate:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700/80',
  };

  const sizeStyles = {
    xs: 'px-1.5 py-0.2 text-[9px] font-mono',
    sm: 'px-2 py-0.5 text-[10px] font-medium',
    md: 'px-2.5 py-1 text-xs font-medium',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border tracking-wide font-sans ${variantStyles[variant] || variantStyles.crimson} ${sizeStyles[size]}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80 animate-pulse"></span>}
      {children}
    </span>
  );
};

export default Badge;

