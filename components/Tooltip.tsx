import React from 'react';

interface TooltipProps {
  children: React.ReactElement;
  tip: string;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ children, tip, className }) => {
  return (
    <div className={`relative group ${className || ''}`}>
      {children}
      <span
        className="absolute bottom-full mb-2 w-max max-w-xs p-2 text-center text-sm text-white bg-slate-900 border border-gemini-cyan/50 rounded-md shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300 z-10 pointer-events-none left-1/2 -translate-x-1/2"
        role="tooltip"
      >
        {tip}
      </span>
    </div>
  );
};

export default Tooltip;
