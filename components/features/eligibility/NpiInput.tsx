import React from 'react';
import { Loader, XCircle, CheckCircle, Clock } from 'lucide-react';
import { useNpiVerification } from '../../../hooks/useNpiVerification';
import InputField from '../../common/InputField';

interface NpiInputProps {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    label?: string;
    tooltip?: string;
}

const NpiInput: React.FC<NpiInputProps> = ({ value, onChange, label = "Provider NPI", tooltip }) => {
    const npiDetails = useNpiVerification(value);
    return (
        <div className="relative">
            <InputField
                label={label} name="npi" value={value} onChange={onChange}
                placeholder="10-digit NPI" tooltip={tooltip} maxLength={10}
            />
            {npiDetails.loading && <div className="absolute top-8 right-2"><Loader className="h-4 w-4 animate-spin text-blue-500"/></div>}
             <div className="mt-1 min-h-[4rem] text-xs px-1">
                {value?.length === 10 && (
                     <p className={`flex items-center ${npiDetails.luhnValid === true ? 'text-green-600' : npiDetails.luhnValid === false ? 'text-red-500' : 'text-gray-500'}`}>
                        {npiDetails.luhnValid === true ? <CheckCircle className="h-3 w-3 mr-1"/> : npiDetails.luhnValid === false ? <XCircle className="h-3 w-3 mr-1"/> : <Clock className="h-3 w-3 mr-1"/>}
                         NPI Format {npiDetails.luhnValid === true ? 'OK' : npiDetails.luhnValid === false ? 'Invalid' : 'Checking...'} (Luhn Check)
                     </p>
                 )}
                 {npiDetails.error && npiDetails.luhnValid && <p className="text-red-500 flex items-center"><XCircle className="h-3 w-3 mr-1"/> {npiDetails.error}</p>}
                {npiDetails.data && npiDetails.luhnValid && !npiDetails.error && (
                    <div className="text-gray-600 space-y-0.5 mt-1">
                        <p><strong>Name:</strong> {npiDetails.data.providerName || 'N/A'}</p>
                        <p><strong>Spec:</strong> {npiDetails.data.primaryTaxonomy || 'N/A'}</p>
                        <p><strong>Loc:</strong> {npiDetails.data.address || 'N/A'}</p>
                        {npiDetails.data.isActive === false && <p className="text-yellow-600 font-bold">Warning: NPI may be inactive.</p>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NpiInput;
