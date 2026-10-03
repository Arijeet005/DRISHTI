import React from 'react';
import { RiskCategory } from '../types/project';

interface RiskBadgeProps {
  category: RiskCategory;
  score?: number;
  size?: 'sm' | 'md' | 'lg';
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ category, score, size = 'md' }) => {
  let colorStyles = '';
  if (category === 'High') {
    // High-risk semantic exception: muted brick red #A8442E
    colorStyles = 'bg-[#A8442E] text-[#F5EFE3]';
  } else if (category === 'Medium') {
    // Medium: gold background, olive text
    colorStyles = 'bg-[#B8892D] text-[#4F5B2A]';
  } else {
    // Low: olive background, cream text
    colorStyles = 'bg-[#4F5B2A] text-[#F5EFE3]';
  }

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5 border-2 shadow-[2px_2px_0px_0px_#4F5B2A]',
    md: 'text-sm px-3 py-1 border-2 shadow-[3px_3px_0px_0px_#4F5B2A]',
    lg: 'text-base px-4 py-1.5 border-4 shadow-[4px_4px_0px_0px_#4F5B2A]',
  }[size];

  return (
    <span
      id={`risk-badge-${category.toLowerCase()}`}
      className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider rounded-none border-[#4F5B2A] ${colorStyles} ${sizeStyles}`}
    >
      <span className="inline-block w-2 h-2 rounded-full border border-[#4F5B2A] bg-current opacity-80" />
      <span>{category} RISK</span>
      {typeof score === 'number' && (
        <span className="font-black border-l border-[#4F5B2A]/40 pl-1.5 ml-0.5">
          {score}
        </span>
      )}
    </span>
  );
};
