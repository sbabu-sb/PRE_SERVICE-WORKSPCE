
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { INSURANCE_PAYERS } from '../../constants';
import InputField from './InputField';

interface InsuranceComboboxProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
}

const InsuranceCombobox: React.FC<InsuranceComboboxProps> = ({ value, onChange, label = "Insurance Plan" }) => {
    const [searchTerm, setSearchTerm] = useState(value);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setSearchTerm(value); }, [value]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const filteredPayers = useMemo(() => 
        !searchTerm ? INSURANCE_PAYERS : INSURANCE_PAYERS.filter(p => p.toLowerCase().includes(searchTerm.toLowerCase())), 
        [searchTerm]
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        onChange(e.target.value);
        setIsOpen(true);
    };
    
    const handleSelectPayer = (payer: string) => {
        onChange(payer);
        setSearchTerm(payer);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <InputField
                label={label} value={searchTerm}
                onChange={handleInputChange}
                onFocus={() => setIsOpen(true)} placeholder="Search or type payer name"
            />
            {isOpen && (
                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
                    {filteredPayers.length > 0 ? filteredPayers.map(payer => (
                        <li key={payer} className="p-2 hover:bg-blue-100 cursor-pointer text-sm" onMouseDown={() => handleSelectPayer(payer)}>
                            {payer}
                        </li>
                    )) : <li className="p-2 text-sm text-gray-500">No matching payers found.</li>}
                </ul>
            )}
        </div>
    );
};

export default InsuranceCombobox;
