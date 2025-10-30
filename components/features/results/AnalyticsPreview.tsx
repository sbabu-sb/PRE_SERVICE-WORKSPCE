import React from 'react';
import { BarChart2 } from 'lucide-react';
import { EstimateData } from '../../../types';
import InfoTooltip from '../../common/InfoTooltip';

interface AnalyticsPreviewProps {
    data: EstimateData;
}

const AnalyticsPreview: React.FC<AnalyticsPreviewProps> = ({ data }) => {
    if (!data.propensity) return null;
    const { tier, score } = data.propensity;

    const scoreInfo = `<div class='text-left'><p class='font-bold mb-1'>How Readiness Scores are Calculated:</p><p>The score is a weighted average of self-reported financial data, bill size, and plan type to predict payment likelihood.</p><p class='font-bold mt-2 mb-1'>Tiers:</p><ul class='list-disc list-inside text-xs space-y-1'><li><b>High:</b> &gt;75</li><li><b>Medium:</b> 40-75</li><li><b>Low:</b> &lt;40</li></ul></div>`;
    
    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200/80">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                <BarChart2 className="text-blue-600"/>
                <span>Provider Analytics Preview</span>
                <InfoTooltip text={scoreInfo} />
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 p-3 rounded-lg">
                    <h4 className="font-bold text-gray-700 mb-2">Readiness by Procedure</h4>
                    <ul className="space-y-1">
                        {data.procedures.map(p => ( 
                            <li key={p.id} className="flex justify-between items-center w-full">
                                <span>CPT: {p.cptCode || 'N/A'} ({p.acuity})</span>
                                <span className={`font-bold ${tier === 'High' ? 'text-green-600' : tier === 'Medium' ? 'text-yellow-600' : 'text-red-600'}`}>{score}/100</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                    <h4 className="font-bold text-gray-700 mb-2">Readiness by Payer</h4>
                    <ul className="space-y-1">
                        <li className="flex justify-between items-center w-full">
                            <span>{data.payers[0]?.insurance.name || 'N/A'}</span>
                            <span className={`font-bold ${tier === 'High' ? 'text-green-600' : tier === 'Medium' ? 'text-yellow-600' : 'text-red-600'}`}>{score}/100</span>
                        </li>
                    </ul>
                </div>
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">This simulates how this estimate contributes to a broader analytics dashboard.</p>
        </div> 
    );
};

export default AnalyticsPreview;
