
import React, { useCallback, useState } from 'react';
import { ArrowLeft, FileDown, Loader, MessageCircle } from 'lucide-react';
import { useEstimateState, useEstimateDispatch } from '../context/EstimateContext';
import { fetchPatientExplanationFromApi } from '../services/geminiService';
import { usePdfGenerator } from '../hooks/usePdfGenerator';
import { AiEstimate, EstimateData } from '../types';
import ResultsSummary from '../components/features/results/ResultsSummary';
import AiEstimateDisplay from '../components/features/results/AiEstimateDisplay';
import PropensityDisplay from '../components/features/results/PropensityDisplay';
import EstimateContextComponent from '../components/features/results/EstimateContextComponent';
import DetailedAdjudicationBreakdown from '../components/features/results/DetailedAdjudicationBreakdown';
import AnalyticsPreview from '../components/features/results/AnalyticsPreview';

interface EstimateResultsPageProps {
    data: EstimateData;
    aiEstimate: { loading: boolean; data: AiEstimate | null; error: string | null; };
}

const EstimateResultsPage: React.FC<EstimateResultsPageProps> = ({ data, aiEstimate }) => {
    const dispatch = useEstimateDispatch();
    const { generatePDF } = usePdfGenerator();
    const [explanationLoading, setExplanationLoading] = useState(false);

    const showActionModal = (title: string, message: string) => {
        dispatch({ type: 'SHOW_MODAL', payload: { title, message } });
    };

    const setPage = useCallback((page: 'eligibility' | 'form' | 'results') => {
        dispatch({ type: 'SET_PAGE', payload: page });
    }, [dispatch]);
    
    const handleGenerateExplanation = useCallback(async () => {
        setExplanationLoading(true);
        const result = await fetchPatientExplanationFromApi(data, aiEstimate);
        setExplanationLoading(false);
        if (result.success && result.data) {
            dispatch({ type: 'SHOW_MODAL', payload: { title: "✨ Your Estimate Explained", message: result.data.explanation } });
        } else {
            dispatch({ type: 'SHOW_MODAL', payload: { title: "Error", message: result.error || "Could not generate explanation." } });
        }
    }, [data, aiEstimate, dispatch]);
    
    return (
        <div className="space-y-8">
            <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-800">Calculation Complete</h2>
                <p className="text-gray-500 mt-1">Review the coordinated benefits estimate below.</p>
            </div>
            
            <ResultsSummary 
                totalPatientResponsibility={data.totalPatientResponsibility} 
                adjudicationChain={data.adjudicationChain} 
                onGenerateExplanation={handleGenerateExplanation}
                explanationLoading={explanationLoading}
            />
            <AiEstimateDisplay aiEstimate={aiEstimate} />
            <PropensityDisplay propensity={data.propensity} showActionModal={showActionModal} />
            <EstimateContextComponent metaData={data.metaData} payers={data.payers} />
            <DetailedAdjudicationBreakdown adjudicationChain={data.adjudicationChain} />
            {data.propensity && <AnalyticsPreview data={data} />}

            <div className="flex flex-col sm:flex-row justify-between items-center pt-6 mt-6 border-t gap-4">
                 <button onClick={() => setPage('form')} className="flex items-center space-x-2 bg-gray-200 text-gray-800 font-semibold py-2 px-5 rounded-lg hover:bg-gray-300 transition w-full sm:w-auto">
                     <ArrowLeft className="h-5 w-5" /><span>Back to Form</span>
                 </button>
                 <button onClick={generatePDF} className="flex items-center justify-center space-x-2 bg-green-600 text-white font-semibold py-2 px-5 rounded-lg shadow hover:bg-green-700 transition transform hover:scale-105 w-full sm:w-auto">
                     <FileDown className="h-5 w-5" />
                     <span>Download PDF</span>
                 </button>
            </div>
        </div>
    );
};

export default EstimateResultsPage;