import React from 'react';
import { MetaData, Payer } from '../../../types';
import { formatDate } from '../../../utils/formatters';

interface EstimateContextProps {
    metaData: MetaData;
    payers: Payer[];
}

const EstimateContextComponent: React.FC<EstimateContextProps> = ({ metaData, payers }) => (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200/80">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Estimate Context</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
             <div><strong>Patient:</strong> {metaData.patient.name} <span className="text-gray-600"> (DOB: {formatDate(metaData.patient.dob)})</span></div>
             <div><strong>Provider:</strong> {metaData.provider.name} (NPI: {metaData.provider.npi})</div>
             <div><strong>Gender:</strong> {metaData.patient.gender || 'N/A'}</div>
             <div><strong>Relationship:</strong> {metaData.patient.relationship}</div>
             <div><strong>Service Date:</strong> {formatDate(metaData.service.date)}</div>
             <div><strong>Practice:</strong> {metaData.practice.name} (TIN: {metaData.practice.taxId || 'N/A'})</div>
            {payers.map(p => (
                <div key={p.id} className="sm:col-span-2 grid grid-cols-subgrid">
                   <div className="col-span-1"><strong>{p.rank} Insurance:</strong> {p.insurance.name} (ID: {p.insurance.memberId})</div>
                   <div className="col-span-1">
                       <span className={`font-medium text-xs px-2 py-0.5 rounded-full ml-2 ${p.networkStatus === 'in-network' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                        {p.networkStatus === 'in-network' ? 'In Network' : 'Out of Network'}
                       </span>
                       <span className="text-xs text-gray-500 ml-2">({p.cobMethod.replace('_', ' ')})</span>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

export default EstimateContextComponent;
