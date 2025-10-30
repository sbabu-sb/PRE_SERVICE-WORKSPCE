
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { AdjudicationForPayer } from '../../../types';
import InfoTooltip from '../../common/InfoTooltip';

interface DetailedAdjudicationBreakdownProps {
    adjudicationChain: AdjudicationForPayer[];
}

const DetailedAdjudicationBreakdown: React.FC<DetailedAdjudicationBreakdownProps> = ({ adjudicationChain }) => {
    const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});
    const toggleSection = (id: string) => setExpandedSections(prev => ({...prev, [id]: !prev[id]}));
    
    const copayLogicDescriptions: Record<string, string> = { 
        standard_waterfall: "Each service's copay was applied, followed by deductible and coinsurance.", 
        highest_copay_only: "The single highest copay was applied for all services.", 
    };

    const summaryTooltip = `<div class='text-left'><p class='font-bold mb-1'>Term Definitions:</p><ul class='list-disc list-inside text-xs space-y-1'><li><b>Payment:</b> Estimated amount this insurance plan will pay.</li><li><b>Patient Share:</b> The patient's cost-sharing (copay, deductible, etc.) for this plan.</li><li><b>Balance After:</b> Amount remaining for the next payer or final patient bill.</li></ul></div>`;

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200/80">
             <h3 className="text-xl font-semibold text-gray-800 mb-4">Detailed Adjudication Breakdown</h3>
            <div className="space-y-4">
                {adjudicationChain.map((adj, adjIdx) => {
                    const isPayerExpanded = !!expandedSections[`payer-${adjIdx}`];
                    const networkStatus = adj.networkStatus === 'in-network' ? 'INN' : 'OON';
                    return (
                        <div key={adjIdx} className="border border-gray-200 rounded-lg overflow-hidden">
                            <button onClick={() => toggleSection(`payer-${adjIdx}`)} className="w-full bg-gray-50 hover:bg-gray-100 p-4 text-left flex justify-between items-center transition">
                                <div className="flex-grow">
                                    <div className="flex items-center space-x-2">
                                        <h4 className="font-bold text-gray-800 text-lg">{adj.rank} Payer: {adj.insurance.name}</h4>
                                        <InfoTooltip text={summaryTooltip} />
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Payment: <span className="font-semibold text-green-700">${adj.totalPayerPaymentThisPayer.toFixed(2)}</span> |
                                        Patient Share: <span className="font-semibold text-orange-600">${adj.totalPatientShareThisPayer.toFixed(2)}</span> |
                                        Balance After: <span className="font-semibold text-red-700">${adj.totalRemainingBalanceAfterPayer.toFixed(2)}</span>
                                    </p>
                                </div>
                                {isPayerExpanded ? <ChevronUp className="h-5 w-5 text-gray-500 flex-shrink-0 ml-2" /> : <ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0 ml-2" />}
                            </button>
                            {isPayerExpanded && (
                                <div className="p-4 border-t border-gray-200 space-y-3 animate-fade-in">
                                    <div className="text-sm text-gray-700 bg-blue-50 p-3 rounded-md border border-blue-200 flex items-start">
                                        <Info className="h-4 w-4 inline-block mr-2 text-blue-700 mt-0.5 flex-shrink-0" />
                                        <div><strong>Logic Applied:</strong> {copayLogicDescriptions[adj.benefits.copayLogic]}
                                            <span className="ml-2 text-xs text-gray-500">({adj.cobMethod.replace(/_/g, ' ')})</span>
                                        </div>
                                    </div>
                                    {adj.procedureEstimates.map((p, pIdx) => {
                                        const isProcExpanded = !!expandedSections[`proc-${adjIdx}-${pIdx}`];
                                        return (
                                            <div key={pIdx} className="border bg-white rounded-md overflow-hidden">
                                                <button onClick={() => toggleSection(`proc-${adjIdx}-${pIdx}`)} className="w-full p-3 text-left flex justify-between items-center hover:bg-gray-50 transition">
                                                    <div>
                                                        <p className="font-semibold text-gray-700">
                                                            {p.processingOrder && <span className="text-xs font-normal text-gray-500 mr-2">(Order: {p.processingOrder})</span>}
                                                            CPT: {p.cptCode}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            Allowed: ${(p.finalAllowedAmount).toFixed(2)} |
                                                            Patient Share: <span className="font-bold">${(p.patientCostShare).toFixed(2)}</span>
                                                        </p>
                                                    </div>
                                                    {isProcExpanded ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
                                                </button>
                                                {isProcExpanded && (
                                                    <div className="p-3 border-t bg-gray-50/50 animate-fade-in">
                                                        <table className="w-full text-sm">
                                                            <thead className="bg-gray-100"><tr className="text-left">
                                                                <th className="p-2 font-semibold text-gray-600">Component</th>
                                                                <th className="p-2 font-semibold text-gray-600 text-right">Patient Pays</th>
                                                                <th className="p-2 font-semibold text-gray-600">Notes</th>
                                                            </tr></thead>
                                                            <tbody>
                                                                {p.calculationBreakdown.map((step, stepIdx) => {
                                                                    const isAccumulatorUpdate = step.description.includes('Accumulator Update');

                                                                    if (isAccumulatorUpdate) {
                                                                        const noteParts = step.notes.match(/Old: \$(.*), Applied: \$(.*), New: \$(.*)/);
                                                                        const [, oldVal, appliedVal, newVal] = noteParts || [null, 'N/A', 'N/A', 'N/A'];
                                                                        return (
                                                                            <tr key={stepIdx} className="border-t border-gray-200 bg-gray-100">
                                                                                <td className="p-2 text-gray-800 font-medium text-xs">{step.description}</td>
                                                                                <td colSpan={2} className="p-2 text-xs text-gray-600">
                                                                                    <div className="flex flex-wrap justify-end md:justify-around items-center gap-x-3">
                                                                                        <span><span className="font-semibold">Old:</span> ${oldVal}</span>
                                                                                        <span className="font-semibold text-green-700">Applied: +${appliedVal}</span>
                                                                                        <span><span className="font-semibold">New:</span> ${newVal}</span>
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    }
                                                                    
                                                                    const isCostComponent = ['Copay', 'Deductible', 'Coinsurance'].some(c => step.description.includes(c));

                                                                    return (
                                                                        <tr key={stepIdx} className="border-t border-gray-200">
                                                                            <td className="p-2 text-gray-800">
                                                                                {step.description}
                                                                                {isCostComponent && <span className="text-gray-400 text-xs ml-1">({networkStatus})</span>}
                                                                            </td>
                                                                            <td className="p-2 font-mono text-right text-gray-900">${step.patientOwes.toFixed(2)}</td>
                                                                            <td className="p-2 text-gray-500 text-xs">{step.notes}</td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

export default DetailedAdjudicationBreakdown;
