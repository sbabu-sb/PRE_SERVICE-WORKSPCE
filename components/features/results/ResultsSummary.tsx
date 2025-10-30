import React from 'react';
import { Loader, MessageCircle } from 'lucide-react';
import { AdjudicationForPayer } from '../../../types';

interface ResultsSummaryProps {
    totalPatientResponsibility: number;
    adjudicationChain: AdjudicationForPayer[];
    onGenerateExplanation: () => void;
    explanationLoading: boolean;
}

const ResultsSummary: React.FC<ResultsSummaryProps> = ({ totalPatientResponsibility, adjudicationChain, onGenerateExplanation, explanationLoading }) => {
    const lastPayer = adjudicationChain[adjudicationChain.length - 1];
    let contextMessage = null;
    if (lastPayer?.networkStatus === 'in-network') {
        contextMessage = <p className="text-xs text-gray-500">(Based on in-network allowed amounts and cost-sharing. Provider contractual adjustments applied.)</p>;
    } else if (lastPayer?.networkStatus === 'out-of-network') {
        contextMessage = <p className="text-xs text-orange-600 font-medium">(Based on out-of-network benefits. May include balance billing above allowed amounts.)</p>;
    }

    return (
        <div className="bg-white p-8 rounded-xl shadow-2xl border border-gray-200/80 text-center max-w-lg mx-auto">
            <p className="text-lg text-gray-600">Final Estimated Patient Responsibility</p>
            <p className="text-6xl font-extrabold text-blue-600 tracking-tight my-2">${totalPatientResponsibility.toFixed(2)}</p>
            
            <div className="mt-4">
                <button
                    onClick={onGenerateExplanation}
                    disabled={explanationLoading}
                    className="flex items-center justify-center space-x-2 w-full sm:w-auto mx-auto bg-purple-600 text-white font-semibold py-2 px-5 rounded-lg shadow hover:bg-purple-700 transition transform hover:scale-105 disabled:bg-gray-400"
                >
                    {explanationLoading ? <Loader className="h-5 w-5 animate-spin"/> : <MessageCircle className="h-5 w-5" />}
                    <span>✨ Explain This to Me</span>
                </button>
            </div>
            {contextMessage && <div className="mt-3">{contextMessage}</div>}
        </div>
    );
};

export default ResultsSummary;
