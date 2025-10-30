import React, { useCallback, useEffect, useState } from 'react';
import { User, PlusCircle, XCircle } from 'lucide-react';
import { useEstimateState, useEstimateDispatch } from '../../../context/EstimateContext';
import Card from '../../common/Card';
import InputField from '../../common/InputField';
import SelectField from '../../common/SelectField';
import InsuranceCombobox from '../../common/InsuranceCombobox';

const PatientInsuranceSection: React.FC = () => {
    const { metaData, payers } = useEstimateState();
    const dispatch = useEstimateDispatch();
    const [activePayerInputId, setActivePayerInputId] = useState(payers[0]?.id || null);

    const handleMetaDataChange = useCallback((section: 'patient', e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        dispatch({ type: 'UPDATE_METADATA', payload: { section, name: e.target.name, value: e.target.value } });
    }, [dispatch]);
    
    const handlePayerDetailChange = useCallback((id: string, field: string, value: string) => {
        dispatch({ type: 'UPDATE_PAYER_DETAIL', payload: { id, field, value } });
    }, [dispatch]);

    const addPayer = useCallback(() => { dispatch({ type: 'ADD_PAYER' }); }, [dispatch]);

    useEffect(() => {
        if (payers.length > 0) {
            const lastPayerId = payers[payers.length - 1].id;
            if (activePayerInputId !== lastPayerId && !payers.find(p => p.id === activePayerInputId)) {
                setActivePayerInputId(lastPayerId);
            }
        } else {
            setActivePayerInputId(null);
        }
    }, [payers, activePayerInputId]);

    const removePayer = useCallback((id: string) => {
        dispatch({ type: 'REMOVE_PAYER', payload: { id } });
        if (activePayerInputId === id && payers.length > 1) {
            setActivePayerInputId(payers[0].id);
        }
    }, [dispatch, activePayerInputId, payers]);

    return (
        <Card title="Patient & Insurance" icon={<User className="text-blue-600" />} contentClassName="grid-cols-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField label="Patient Name" name="name" value={metaData.patient.name} onChange={e => handleMetaDataChange('patient', e)} />
                <InputField label="Date of Birth" name="dob" type="date" value={metaData.patient.dob} onChange={e => handleMetaDataChange('patient', e)} />
                <SelectField label="Patient Gender" name="gender" value={metaData.patient.gender} onChange={e => handleMetaDataChange('patient', e)}>
                    <option value="">Select Gender...</option><option value="Male">Male</option><option value="Female">Female</option>
                    <option value="Other">Other</option><option value="Prefer not to say">Prefer not to say</option>
                </SelectField>
                <SelectField label="Relationship to Subscriber" name="relationship" value={metaData.patient.relationship} onChange={e => handleMetaDataChange('patient', e)}>
                    <option value="Self">Self (Subscriber)</option><option value="Spouse">Spouse</option>
                    <option value="Child">Child</option><option value="Other Dependent">Other Dependent</option>
                </SelectField>
            </div>
            <div className="pt-4 border-t">
                <h4 className="text-sm font-medium text-gray-600 mb-2">Insurance Plans</h4>
                <div className="flex space-x-1 border-b border-gray-200">
                    {payers.map((payer, index) => (
                        <button type="button" key={payer.id} onClick={() => setActivePayerInputId(payer.id)}
                            className={`flex items-center space-x-1.5 py-2 px-4 font-medium text-sm rounded-t-lg ${activePayerInputId === payer.id ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                            <span>{payer.rank}</span>
                            {index > 0 && (
                                <span onClick={(e) => { e.stopPropagation(); removePayer(payer.id); }} className="text-red-400 hover:text-red-600 ml-1 rounded-full hover:bg-red-100">
                                    <XCircle className="h-4 w-4"/>
                                </span>
                            )}
                        </button>
                    ))}
                    {payers.length < 3 && (
                        <button type="button" onClick={addPayer} className="py-2 px-3 font-medium text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1">
                            <PlusCircle className="h-4 w-4" />
                            <span>Add {payers.length === 1 ? 'Secondary' : 'Tertiary'}</span> 
                        </button>
                    )}
                </div>
                <div className="pt-4">
                    {payers.map(payer => (
                        <div key={payer.id} className={activePayerInputId === payer.id ? 'block animate-fade-in' : 'hidden'}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 items-end">
                                <InsuranceCombobox label={`${payer.rank} Insurance Plan`} value={payer.insurance.name}
                                    onChange={(val) => handlePayerDetailChange(payer.id, 'name', val)} />
                                <InputField label={`${payer.rank} Member ID`} name="memberId" value={payer.insurance.memberId}
                                    onChange={(e) => handlePayerDetailChange(payer.id, 'memberId', e.target.value)}
                                    tooltip="Enter the Member ID specific to this insurance plan." />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    );
};

export default PatientInsuranceSection;
