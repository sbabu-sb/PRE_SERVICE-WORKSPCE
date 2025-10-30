import React, { useCallback } from 'react';
import { User, Stethoscope } from 'lucide-react';
import { useEstimateState, useEstimateDispatch } from '../../../context/EstimateContext';
import Card from '../../common/Card';
import InputField from '../../common/InputField';
import SelectField from '../../common/SelectField';

const PatientServicePracticeSection: React.FC = () => {
    const { metaData } = useEstimateState();
    const dispatch = useEstimateDispatch();
    
    const handleMetaDataChange = useCallback((section: keyof typeof metaData, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        dispatch({ type: 'UPDATE_METADATA', payload: { section, name: e.target.name, value: e.target.value } });
    }, [dispatch]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Patient & Service" icon={<User className="text-blue-600" />} contentClassName="grid-cols-1 md:grid-cols-2">
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
                 <div className="md:col-span-2">
                     <InputField label="Date of Service" name="date" type="date" value={metaData.service.date} onChange={e => handleMetaDataChange('service', e)} />
                 </div>
             </Card>
            <Card title="Practice Details" icon={<Stethoscope className="text-blue-600" />}>
                 <InputField label="Practice Name" name="name" value={metaData.practice.name} onChange={e => handleMetaDataChange('practice', e)} />
                 <InputField label="Practice Tax ID" name="taxId" value={metaData.practice.taxId} onChange={e => handleMetaDataChange('practice', e)} />
                 <InputField label="Provider Name" name="name" value={metaData.provider.name} onChange={e => handleMetaDataChange('provider', e)} />
                 <InputField label="Provider NPI" name="npi" value={metaData.provider.npi} onChange={e => handleMetaDataChange('provider', e)} />
                 <InputField label="Provider Phone" name="phone" type="tel" value={metaData.provider.phone} onChange={e => handleMetaDataChange('provider', e)} />
             </Card>
        </div>
    );
};

export default PatientServicePracticeSection;
