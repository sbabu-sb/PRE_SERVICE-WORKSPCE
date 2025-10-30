import React from 'react';
import { Info } from 'lucide-react';

const InfoTooltip: React.FC<{ text: string }> = ({ text }) => (
    <div className="group relative flex items-center">
        <Info className="h-4 w-4 text-gray-400 cursor-pointer" />
        <div
            className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 p-3 bg-white text-gray-700 text-xs rounded-lg border border-gray-200 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none"
            dangerouslySetInnerHTML={{ __html: text }}
        ></div>
    </div>
);

export default InfoTooltip;