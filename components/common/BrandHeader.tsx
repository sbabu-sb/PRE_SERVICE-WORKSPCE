
import React from 'react';

export const BrandHeader: React.FC<{ brandName: string }> = ({ brandName }) => (
    <div className="flex items-center justify-center space-x-2 text-gray-500">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
        <span className="font-semibold text-lg">{brandName}</span>
    </div>
);
