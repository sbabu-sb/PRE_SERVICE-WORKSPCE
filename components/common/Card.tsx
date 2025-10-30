
import React, { ReactNode } from 'react';

interface CardProps {
    title: string;
    icon: ReactNode;
    children: ReactNode;
    disabled?: boolean;
    contentClassName?: string;
}

const Card: React.FC<CardProps> = ({ title, icon, children, disabled = false, contentClassName = "grid-cols-1 md:grid-cols-2" }) => (
    <div className={`bg-white p-6 rounded-xl shadow-lg border border-gray-200/80 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <h3 className="text-lg font-semibold text-gray-800 border-b pb-3 mb-4 flex items-center space-x-2">
            {icon} <span>{title}</span>
        </h3>
        <div className={`grid gap-4 ${contentClassName}`}>
            {children}
        </div>
        {disabled && <div className="text-xs text-center text-gray-500 mt-2">These benefits are not applicable for the selected plan type.</div>}
    </div>
);

export default Card;
