
import React, { useId, useRef } from 'react';
import { AlertTriangle, CalendarDays } from 'lucide-react';
import InfoTooltip from './InfoTooltip';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    tooltip?: string;
    warning?: boolean;
}

const InputField: React.FC<InputFieldProps> = ({ label, type = "text", value, onChange, name, placeholder, tooltip, disabled=false, warning=false, ...rest }) => {
    
    const generatedId = useId();
    // Use the passed-in id, or the name, or the generated one as a fallback for the input's id.
    const id = rest.id || name || generatedId;
    const inputRef = useRef<HTMLInputElement>(null);

    const inputClasses = `bg-white text-gray-900 p-2 w-full border rounded-md shadow-sm focus:ring-2 focus:border-blue-500 transition disabled:bg-gray-100 ${warning ? 'border-yellow-500 focus:ring-yellow-400' : 'border-gray-300 focus:ring-blue-500'}`;
    
    const handleIconClick = () => {
        const inputEl = inputRef.current;
        if (!inputEl) {
            return;
        }

        // Modern browsers support showPicker() for programmatically opening the picker
        if (typeof inputEl.showPicker === 'function') {
            try {
                inputEl.showPicker();
            } catch (error) {
                console.error("Failed to execute showPicker():", error);
                // Fallback to focus if showPicker fails unexpectedly
                inputEl.focus();
            }
        } else {
            // Fallback for browsers that don't support it (e.g., Firefox)
            inputEl.focus();
        }
    };

    return (
        <div className="flex flex-col space-y-1">
            <label htmlFor={id} className="text-sm font-medium text-gray-600 flex items-center space-x-2">
                <span>{label}</span>
                {tooltip && <InfoTooltip text={tooltip} />}
            </label>
            <div className="relative">
                <input
                    ref={inputRef}
                    id={id}
                    type={type} name={name} value={value ?? ''} onChange={onChange} placeholder={placeholder} disabled={disabled}
                    className={`${inputClasses} ${type === 'date' ? 'pr-10' : ''}`}
                    step={type === 'number' ? '0.01' : undefined}
                    {...rest}
                />

                {type === 'date' && (
                    <button
                        type="button"
                        onClick={handleIconClick}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
                        aria-label="Open date picker"
                        disabled={disabled}
                    >
                        <CalendarDays className="h-5 w-5 text-gray-400" />
                    </button>
                )}

                {warning &&
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <div className="group cursor-default">
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                            <div className="absolute right-full mr-2 w-max p-3 bg-yellow-50 text-yellow-800 text-xs rounded-lg border border-yellow-200 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">Allowed amount is greater than billed amount.</div>
                        </div>
                    </div>
                }
            </div>
        </div>
    );
};

export default InputField;