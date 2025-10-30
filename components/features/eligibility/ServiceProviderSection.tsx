import React, { useCallback } from 'react';
import { Stethoscope } from 'lucide-react';
import { useEstimateState, useEstimateDispatch } from '../../../context/EstimateContext';
import Card from '../../common/Card';
import InputField from '../../common/InputField';
import NpiInput from './NpiInput';
import SelectField from '../../common/SelectField';
import { MetaData } from '../../../types';

const ServiceProviderSection: React.FC = () => {
    const { metaData } = useEstimateState();
    const dispatch = useEstimateDispatch();

    const handleMetaDataChange = useCallback((section: keyof MetaData, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        dispatch({ type: 'UPDATE_METADATA', payload: { section, name: e.target.name, value: e.target.value } });
    }, [dispatch]);

    return (
        <Card title="Service & Provider" icon={<Stethoscope className="text-blue-600" />} contentClassName="grid-cols-1 md:grid-cols-2">
             <InputField label="Date of Service" name="date" type="date" value={metaData.service.date} onChange={e => handleMetaDataChange('service', e)} />
             <SelectField
                 label="Place of Service"
                 name="placeOfService"
                 value={metaData.service.placeOfService}
                 onChange={e => handleMetaDataChange('service', e)}
                 tooltip="The setting where the service will be performed. This is critical for authorization rules."
             >
                 <option value="11">11 - Office</option>
                 <option value="21">21 - Inpatient Hospital</option>
                 <option value="22">22 - Outpatient Hospital</option>
                 <option value="23">23 - Emergency Room</option>
             </SelectField>
             <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <NpiInput
                        value={metaData.provider.npi}
                        onChange={e => handleMetaDataChange('provider', e)}
                        tooltip="Enter the 10-digit National Provider Identifier. Basic validation and lookup will occur."
                    />
                </div>
                <div className="space-y-4">
                    <InputField label="Provider Name" name="name" value={metaData.provider.name} onChange={e => handleMetaDataChange('provider', e)}
                        placeholder="e.g., Dr. Jane Doe" tooltip="Provider name (will be auto-filled from NPI if found)." />
                    <InputField label="Practice Name" name="name" value={metaData.practice.name} onChange={e => handleMetaDataChange('practice', e)} 
                        placeholder="e.g., Central City Clinic" />
                </div>
             </div>
             <InputField label="Practice Tax ID" name="taxId" value={metaData.practice.taxId} onChange={e => handleMetaDataChange('practice', e)} 
                placeholder="9-digit TIN" maxLength={9} />
             <InputField label="Provider Phone" name="phone" type="tel" value={metaData.provider.phone} onChange={e => handleMetaDataChange('provider', e)} 
                placeholder="(555) 123-4567" />
         </Card>
    );
};

export default ServiceProviderSection;