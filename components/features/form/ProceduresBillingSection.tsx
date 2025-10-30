import React, { useCallback } from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';
import { useEstimateState, useEstimateDispatch } from '../../../context/EstimateContext';
import InputField from '../../common/InputField';
import SelectField from '../../common/SelectField';

const ProceduresBillingSection: React.FC = () => {
    const { procedures } = useEstimateState();
    const dispatch = useEstimateDispatch();

    const handleProcedureChange = useCallback((id: string, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const finalValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        dispatch({ type: 'UPDATE_PROCEDURE', payload: { id, field: name, value: finalValue } });
    }, [dispatch]);

    const addProcedure = useCallback(() => { dispatch({ type: 'ADD_PROCEDURE' }); }, [dispatch]);
    const removeProcedure = useCallback((id: string) => { dispatch({ type: 'REMOVE_PROCEDURE', payload: { id } }); }, [dispatch]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200/80">
             <h3 className="text-lg font-semibold text-gray-800 border-b pb-3 mb-4">Procedures</h3>
             <div className="space-y-4">
                 {procedures.map((p, index) => (
                    <div key={p.id} className="grid grid-cols-1 md:grid-cols-9 gap-x-4 gap-y-2 bg-gray-50 p-3 rounded-lg items-end">
                       <InputField label={`CPT #${index+1}`} name="cptCode" value={p.cptCode} onChange={e => handleProcedureChange(p.id, e)} placeholder="e.g., 99214" />
                       <InputField label="Category" name="category" value={p.category} onChange={e => handleProcedureChange(p.id, e)} placeholder="e.g., Surgery" tooltip="Helps apply category-specific rules like copay buckets or therapy limits."/>
                       <InputField label="DOS" name="dateOfService" type="date" value={p.dateOfService} onChange={e => handleProcedureChange(p.id, e)} tooltip="Defaults to the main Date of Service."/>
                       <SelectField
                           label="Acuity"
                           name="acuity"
                           value={p.acuity}
                           onChange={e => handleProcedureChange(p.id, e)}
                           tooltip="Standard: Routine care. Elective: Planned, non-urgent procedure. Urgent: Medically necessary, but not an immediate emergency."
                       >
                           <option value="standard">Standard</option>
                           <option value="elective">Elective</option>
                           <option value="urgent">Urgent</option>
                           <option value="none">N/A</option>
                       </SelectField>
                       <InputField label="DX Codes" name="dxCode" value={p.dxCode} onChange={e => handleProcedureChange(p.id, e)} placeholder="e.g., M17.11" tooltip="Primary diagnosis code."/>
                       <InputField label="Modifiers" name="modifiers" value={p.modifiers} onChange={e => handleProcedureChange(p.id, e)} placeholder="e.g., 50, LT" tooltip="Comma-separated. Pricing mods like 50/62 will adjust allowed amount."/>
                       <InputField type="number" label="Billed ($)" name="billedAmount" value={p.billedAmount} onChange={e => handleProcedureChange(p.id, e)} placeholder="e.g., 400" min="0" />
                       <InputField type="number" label="Units" name="units" value={p.units} onChange={e => handleProcedureChange(p.id, e)} placeholder="e.g., 1" min="1" step="1" />
                       <div className="flex flex-col items-center space-y-2 mt-1">
                           <label className="text-sm font-medium text-gray-600">Actions</label>
                           <div className="flex items-center h-10 space-x-3">
                               <button type="button" onClick={() => removeProcedure(p.id)} className="text-red-500 hover:text-red-700 transition"><Trash2 className="h-5 w-5"/></button>
                               <div className="group relative flex items-center">
                                   <input
                                       type="checkbox"
                                       name="isPreventive"
                                       checked={p.isPreventive}
                                       onChange={e => handleProcedureChange(p.id, e)}
                                       className={`cursor-pointer appearance-none h-5 w-5 rounded border border-gray-300 bg-white checked:bg-green-600 checked:border-transparent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 checked:bg-no-repeat checked:bg-center checked:bg-cover checked:bg-[url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e")]`}
                                   />
                                   <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max p-3 bg-white text-gray-700 text-xs rounded-lg border border-gray-200 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">Mark as Preventive (100% In-Network Coverage)</div>
                               </div>
                           </div>
                       </div>
                    </div>
                 ))}
             </div>
             <button type="button" onClick={addProcedure} className="mt-4 flex items-center space-x-2 text-blue-600 font-medium hover:text-blue-800 transition">
                 <PlusCircle className="h-5 w-5" /><span>Add Procedure</span>
             </button>
        </div>
    );
};

export default ProceduresBillingSection;