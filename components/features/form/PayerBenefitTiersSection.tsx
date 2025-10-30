import React, { useCallback, useEffect, useState } from 'react';
import { Briefcase, ChevronDown, ChevronUp, PlusCircle, Trash2, User, Users, Cog } from 'lucide-react';
import { useEstimateState, useEstimateDispatch } from '../../../context/EstimateContext';
import Card from '../../common/Card';
import InputField from '../../common/InputField';
import SelectField from '../../common/SelectField';
import InfoTooltip from '../../common/InfoTooltip';
import InsuranceCombobox from '../../common/InsuranceCombobox';
import { CobMethod, PayerType } from '../../../constants';
import { Payer } from '../../../types';

const PayerBenefitTiersSection: React.FC = () => {
    const { payers, procedures } = useEstimateState();
    const dispatch = useEstimateDispatch();
    const [expandedPayers, setExpandedPayers] = useState<{ [key: string]: boolean }>({ [payers[0]?.id]: true });

    useEffect(() => {
        const payerIds = payers.map(p => p.id);
        if (payerIds.length === 0) {
            setExpandedPayers({});
            return;
        }

        const newExpanded = { ...expandedPayers };
        let hasChanged = false;

        // Prune deleted payers
        Object.keys(newExpanded).forEach(id => {
            if (!payerIds.includes(id)) {
                delete newExpanded[id];
                hasChanged = true;
            }
        });

        // Add and expand new payers
        const lastPayerId = payerIds[payerIds.length - 1];
        if (lastPayerId && newExpanded[lastPayerId] === undefined) {
             newExpanded[lastPayerId] = true;
             hasChanged = true;
        }
        
        if (hasChanged) {
             setExpandedPayers(newExpanded);
        }
    }, [payers]);

    const togglePayerExpansion = (id: string) => { setExpandedPayers(prev => ({ ...prev, [id]: !prev[id] })); };
    const handlePayerChange = (id: string, section: 'patientAccumulators' | 'familyAccumulators', field: string, value: string) => dispatch({ type: 'UPDATE_PAYER_ACCUM', payload: { id, section, field, value } });
    const handlePayerTopLevelChange = (id: string, field: keyof Payer, value: any) => dispatch({ type: 'UPDATE_PAYER_TOP_LEVEL', payload: { id, field, value } });
    const handlePayerProcedureBenefitChange = (payerId: string, procedureId: string, e: React.ChangeEvent<HTMLInputElement>) => dispatch({ type: 'UPDATE_PAYER_PROC_BENEFIT', payload: { payerId, procedureId, name: e.target.name, value: e.target.value } });
    const handlePayerBenefitChange = (id: string, e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const { name, value, type } = e.target;
        const finalValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        dispatch({ type: 'UPDATE_PAYER_BENEFIT', payload: { id, name, value: finalValue } });
    }
    const handlePayerInsuranceChange = (id: string, value: string) => dispatch({ type: 'UPDATE_PAYER_DETAIL', payload: { id, field: 'name', value } });
    const removePayer = (id: string) => dispatch({ type: 'REMOVE_PAYER', payload: { id } });
    const addPayer = () => dispatch({ type: 'ADD_PAYER' });
    
    return (
        <div className="space-y-6">
            {payers.map((payer, index) => {
                const isFamilyPlan = payer.benefits.planType !== 'Individual';
                const isOON = payer.networkStatus === 'out-of-network'; 
                const isExpanded = !!expandedPayers[payer.id];
                const isTplPayer = payer.payerType === 'auto' || payer.payerType === 'workers_comp';

                return (
                <div key={payer.id} className="bg-white rounded-xl shadow-lg border border-gray-200/80 overflow-hidden transition-all duration-300">
                    <button type="button" onClick={() => togglePayerExpansion(payer.id)} className="w-full p-6 text-left flex justify-between items-center hover:bg-gray-50/50">
                        <div className="flex items-center space-x-3">
                             <Briefcase className="h-6 w-6 text-blue-600" />
                             <div>
                                <h3 className="text-lg font-semibold text-gray-800">{payer.rank} Insurance Plan</h3>
                                <p className="text-sm text-gray-500">{payer.insurance.name || "No Plan Selected"}</p> 
                             </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            {index > 0 && <span onClick={(e) => { e.stopPropagation(); removePayer(payer.id); }} className="text-red-400 hover:text-red-600 rounded-full p-1 hover:bg-red-100" title={`Remove ${payer.rank} Payer`}><Trash2 className="h-5 w-5"/></span> }
                            {isExpanded ? <ChevronUp className="h-6 w-6 text-gray-500" /> : <ChevronDown className="h-6 w-6 text-gray-500" />}
                        </div>
                    </button>
                    {isExpanded && (
                        <div className="p-6 border-t border-gray-200/80 animate-fade-in space-y-6">
                            {/* Top Level Payer Config */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-b pb-6">
                                <InsuranceCombobox value={payer.insurance.name} onChange={(val) => handlePayerInsuranceChange(payer.id, val)} label={`${payer.rank} Insurance Plan`} />
                                <div>
                                    <label className="text-sm font-medium text-gray-600">Network Status</label>
                                    <div className="mt-2 flex rounded-lg shadow-sm border border-gray-300">
                                        <button type="button" onClick={() => handlePayerTopLevelChange(payer.id, 'networkStatus', 'in-network')} className={`flex-1 py-2 px-4 text-sm font-medium rounded-l-md transition ${!isOON ? 'bg-blue-600 text-white shadow-inner' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>In-Network</button>
                                        <button type="button" onClick={() => handlePayerTopLevelChange(payer.id, 'networkStatus', 'out-of-network')} className={`flex-1 py-2 px-4 text-sm font-medium rounded-r-md transition ${isOON ? 'bg-red-600 text-white shadow-inner' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Out-of-Network</button>
                                    </div>
                                </div>
                                <SelectField label="Payer Type" name="payerType" value={payer.payerType} onChange={e => handlePayerTopLevelChange(payer.id, 'payerType', e.target.value)} tooltip="Select the payer type for correct COB/pricing rules.">{Object.values(PayerType).map(pt => <option key={pt} value={pt}>{pt.charAt(0).toUpperCase() + pt.slice(1).replace('_', ' ')}</option>)}</SelectField>
                                {isTplPayer && <div className="flex items-center justify-center pt-6"><label className="flex items-center space-x-2 text-sm font-medium text-gray-600 cursor-pointer"><input type="checkbox" name="subrogationActive" checked={payer.subrogationActive} onChange={e => handlePayerTopLevelChange(payer.id, 'subrogationActive', e.target.checked)} className={`cursor-pointer appearance-none h-4 w-4 rounded border border-gray-300 bg-white checked:bg-blue-600 checked:border-transparent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 checked:bg-no-repeat checked:bg-center checked:bg-cover checked:bg-[url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e")]`} /><span>Subrogation Active</span><InfoTooltip text="If checked, this payer is confirmed primary and will block downstream health plans from paying." /></label></div>}
                                <SelectField label="Plan Type" name="planType" value={payer.benefits.planType} onChange={(e) => handlePayerBenefitChange(payer.id, e)}><option value="EmbeddedFamily">Embedded Family</option><option value="AggregateFamily">Aggregate Family</option><option value="Individual">Individual</option></SelectField>
                                <SelectField label="COB Method" name="cobMethod" value={payer.cobMethod} onChange={e => handlePayerTopLevelChange(payer.id, 'cobMethod', e.target.value)} disabled={payer.payerType === PayerType.Commercial && index === 0} tooltip="Select the Coordination of Benefits method for secondary+ payers.">{Object.values(CobMethod).map(cm => <option key={cm} value={cm}>{cm.charAt(0).toUpperCase() + cm.slice(1).replace(/_/g, ' ')}</option>)}</SelectField>
                            </div>
                            {/* Advanced Adjudication Rules */}
                            <details className="border rounded-lg p-3"><summary className="cursor-pointer font-semibold text-gray-700 flex items-center space-x-2"><Cog className="h-5 w-5 text-gray-500"/><span>Advanced Adjudication Rules</span></summary>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t">
                                    <SelectField label="Copay Logic" name="copayLogic" value={payer.benefits.copayLogic} onChange={e => handlePayerBenefitChange(payer.id, e)} tooltip="Determines how copays are applied for multiple procedures on the same day."><option value="standard_waterfall">Standard Waterfall (Copay per line)</option><option value="highest_copay_only_per_day">Highest Copay Only (Per Day)</option><option value="copay_by_category_per_day">Highest Copay per Category (Per Day)</option><option value="copay_only_if_present">Copay Only (Bypasses Ded/Coins)</option></SelectField>
                                    <SelectField label="Deductible Allocation" name="deductibleAllocation" value={payer.benefits.deductibleAllocation} onChange={e => handlePayerBenefitChange(payer.id, e)} tooltip="Order in which deductible is applied to procedures."><option value="highest_allowed_first">Highest Allowed First</option><option value="line_item_order">Line Item Order</option></SelectField>
                                    <SelectField label="Multi-Procedure Logic" name="multiProcedureLogic" value={payer.benefits.multiProcedureLogic} onChange={e => handlePayerBenefitChange(payer.id, e)} tooltip="Reduction rule for multiple surgeries in one session."><option value="100_50_25">100% - 50% - 25%</option><option value="100_50_50">100% - 50% - 50%</option></SelectField>
                                </div>
                            </details>
                            {/* Plan Level Benefits */}
                            <div className="mb-6"><h4 className="text-md font-semibold text-gray-700 mb-3">Plan Level Benefits</h4>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className={`p-4 border rounded-lg ${!isOON ? 'border-blue-500 bg-blue-50/50' : 'border-gray-300'}`}><h4 className="font-bold text-gray-700 mb-3 text-center">In-Network</h4>
                                        {payer.benefits.planType !== 'AggregateFamily' && <Card title="Individual" icon={<User className="h-5 w-5"/>}><InputField type="number" label="Deductible ($)" name="inNetworkIndividualDeductible" value={payer.benefits.inNetworkIndividualDeductible} onChange={e => handlePayerBenefitChange(payer.id, e)} /><InputField type="number" label="OOP Max ($)" name="inNetworkIndividualOopMax" value={payer.benefits.inNetworkIndividualOopMax} onChange={e => handlePayerBenefitChange(payer.id, e)} /><InputField type="number" label="Deductible Met ($)" value={payer.patientAccumulators.inNetworkDeductibleMet} onChange={e => handlePayerChange(payer.id, 'patientAccumulators', 'inNetworkDeductibleMet', e.target.value)} /><InputField type="number" label="OOP Met ($)" value={payer.patientAccumulators.inNetworkOopMet} onChange={e => handlePayerChange(payer.id, 'patientAccumulators', 'inNetworkOopMet', e.target.value)} /></Card>}
                                        {isFamilyPlan && <Card title="Family" icon={<Users className="h-5 w-5"/>} disabled={!payer.familyAccumulators}><InputField type="number" label="Deductible ($)" name="inNetworkFamilyDeductible" value={payer.benefits.inNetworkFamilyDeductible} onChange={e => handlePayerBenefitChange(payer.id, e)} /><InputField type="number" label="OOP Max ($)" name="inNetworkFamilyOopMax" value={payer.benefits.inNetworkFamilyOopMax} onChange={e => handlePayerBenefitChange(payer.id, e)} /><InputField type="number" label="Deductible Met ($)" value={payer.familyAccumulators?.inNetworkDeductibleMet} onChange={e => handlePayerChange(payer.id, 'familyAccumulators', 'inNetworkDeductibleMet', e.target.value)} /><InputField type="number" label="OOP Met ($)" value={payer.familyAccumulators?.inNetworkOopMet} onChange={e => handlePayerChange(payer.id, 'familyAccumulators', 'inNetworkOopMet', e.target.value)} /></Card>}
                                        <div className="mt-4"><InputField type="number" label="Default Coinsurance (%)" name="inNetworkCoinsurancePercentage" value={payer.benefits.inNetworkCoinsurancePercentage} onChange={e => handlePayerBenefitChange(payer.id, e)} /></div>
                                    </div>
                                    <div className={`p-4 border rounded-lg ${isOON ? 'border-red-500 bg-red-50/50' : 'border-gray-300'}`}><h4 className="font-bold text-gray-700 mb-3 text-center">Out-of-Network</h4>
                                        {payer.benefits.planType !== 'AggregateFamily' && <Card title="Individual" icon={<User className="h-5 w-5"/>}><InputField type="number" label="Deductible ($)" name="outOfNetworkIndividualDeductible" value={payer.benefits.outOfNetworkIndividualDeductible} onChange={e => handlePayerBenefitChange(payer.id, e)} /><InputField type="number" label="OOP Max ($)" name="outOfNetworkIndividualOopMax" value={payer.benefits.outOfNetworkIndividualOopMax} onChange={e => handlePayerBenefitChange(payer.id, e)} /><InputField type="number" label="Deductible Met ($)" value={payer.patientAccumulators.outOfNetworkDeductibleMet} onChange={e => handlePayerChange(payer.id, 'patientAccumulators', 'outOfNetworkDeductibleMet', e.target.value)} /><InputField type="number" label="OOP Met ($)" value={payer.patientAccumulators.outOfNetworkOopMet} onChange={e => handlePayerChange(payer.id, 'patientAccumulators', 'outOfNetworkOopMet', e.target.value)} /></Card>}
                                        {isFamilyPlan && <Card title="Family" icon={<Users className="h-5 w-5"/>} disabled={!payer.familyAccumulators}><InputField type="number" label="Deductible ($)" name="outOfNetworkFamilyDeductible" value={payer.benefits.outOfNetworkFamilyDeductible} onChange={e => handlePayerBenefitChange(payer.id, e)} /><InputField type="number" label="OOP Max ($)" name="outOfNetworkFamilyOopMax" value={payer.benefits.outOfNetworkFamilyOopMax} onChange={e => handlePayerBenefitChange(payer.id, e)} /><InputField type="number" label="Deductible Met ($)" value={payer.familyAccumulators?.outOfNetworkDeductibleMet} onChange={e => handlePayerChange(payer.id, 'familyAccumulators', 'outOfNetworkDeductibleMet', e.target.value)} /><InputField type="number" label="OOP Met ($)" value={payer.familyAccumulators?.outOfNetworkOopMet} onChange={e => handlePayerChange(payer.id, 'familyAccumulators', 'outOfNetworkOopMet', e.target.value)} /></Card>}
                                        <div className="mt-4"><InputField type="number" label="Default Coinsurance (%)" name="outOfNetworkCoinsurancePercentage" value={payer.benefits.outOfNetworkCoinsurancePercentage} onChange={e => handlePayerBenefitChange(payer.id, e)} /></div>
                                    </div>
                                </div>
                            </div>
                             {/* Service Limits */}
                            <div className="border-t pt-6"><h4 className="text-md font-semibold text-gray-700 mb-3">Service Limits &amp; Caps</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Card title="Therapy Visit Limits" icon={<></>} contentClassName="grid-cols-3"><InputField label="PT" name="therapyVisitLimits.physical" value={payer.benefits.therapyVisitLimits.physical} onChange={e => handlePayerBenefitChange(payer.id, e)} placeholder="e.g., 30"/><InputField label="OT" name="therapyVisitLimits.occupational" value={payer.benefits.therapyVisitLimits.occupational} onChange={e => handlePayerBenefitChange(payer.id, e)} placeholder="e.g., 30"/><InputField label="ST" name="therapyVisitLimits.speech" value={payer.benefits.therapyVisitLimits.speech} onChange={e => handlePayerBenefitChange(payer.id, e)} placeholder="e.g., 30"/></Card>
                                    <div className="bg-white p-4 rounded-xl shadow-md border"><h3 className="text-sm font-semibold text-gray-800 flex items-center mb-3">DME Rental Cap</h3><div className="flex items-center space-x-4"><label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="dmeRentalCap.applies" checked={payer.benefits.dmeRentalCap.applies} onChange={e => handlePayerBenefitChange(payer.id, e)} className={`cursor-pointer appearance-none h-4 w-4 rounded border border-gray-300 bg-white checked:bg-blue-600 checked:border-transparent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 checked:bg-no-repeat checked:bg-center checked:bg-cover checked:bg-[url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e")]`} /><span>Applies</span></label><InputField type="number" label="Purchase Price ($)" name="dmeRentalCap.purchasePrice" value={payer.benefits.dmeRentalCap.purchasePrice} onChange={e => handlePayerBenefitChange(payer.id, e)} disabled={!payer.benefits.dmeRentalCap.applies}/></div></div>
                                </div>
                            </div>
                            {/* Procedure-Specific Benefits */}
                            <div className="border-t pt-6"><h4 className="text-md font-semibold text-gray-700 mb-3">Procedure-Specific Benefits</h4><div className="space-y-2">{procedures.map(proc => { const benefit = payer.procedureBenefits.find(pb => pb.procedureId === proc.id); return (<div key={proc.id} className="grid grid-cols-4 gap-x-3 gap-y-2 bg-gray-50 p-2 rounded-md items-end"><div className="font-medium text-sm text-gray-800 self-center">CPT: {proc.cptCode || "N/A"}</div><InputField type="number" label="Allowed ($)" name="allowedAmount" value={benefit?.allowedAmount ?? ''} onChange={e => handlePayerProcedureBenefitChange(payer.id, proc.id, e)} warning={!!benefit?.allowedAmount && !!proc.billedAmount && Number(benefit.allowedAmount) > Number(proc.billedAmount)} /><InputField type="number" label="Copay ($)" name="copay" value={benefit?.copay ?? ''} onChange={e => handlePayerProcedureBenefitChange(payer.id, proc.id, e)} disabled={proc.isPreventive} /><InputField type="number" label="Coins. (%)" name="coinsurancePercentage" value={benefit?.coinsurancePercentage ?? ''} onChange={e => handlePayerProcedureBenefitChange(payer.id, proc.id, e)} placeholder="Plan Default" disabled={proc.isPreventive} /></div>)})}</div></div>
                        </div>
                    )}
                </div>
                )})}
            {payers.length < 3 && <button type="button" onClick={addPayer} className="flex items-center space-x-2 text-blue-600 font-medium hover:text-blue-800 transition"><PlusCircle className="h-5 w-5"/><span>{payers.length === 1 ? 'Add Secondary' : 'Add Tertiary'}</span></button>}
        </div>
    );
};

export default PayerBenefitTiersSection;