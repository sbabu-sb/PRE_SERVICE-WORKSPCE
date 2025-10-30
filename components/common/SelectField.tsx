import React from 'react';
import InfoTooltip from './InfoTooltip';

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label: string;
    tooltip?: string;
}

const SelectField: React.FC<SelectFieldProps> = ({ label, name, value, onChange, children, tooltip, ...rest }) => (
    <div className="flex flex-col space-y-1">
        <label className="text-sm font-medium text-gray-600 flex items-center space-x-2">
            <span>{label}</span>
            {tooltip && <InfoTooltip text={tooltip} />}
        </label>
        <div className="relative">
            <select
                name={name} value={value} onChange={onChange}
                className="bg-white text-gray-900 p-2 pr-8 w-full border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition appearance-none"
                {...rest}
            >
                {children}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
            </div>
        </div>
    </div>
);

export default SelectField;