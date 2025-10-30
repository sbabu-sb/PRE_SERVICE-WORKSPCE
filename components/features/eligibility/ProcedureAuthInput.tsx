import React, { useCallback, useState } from 'react';
import { Trash2, Loader, AlertTriangle, Info, FileText, FileCheck, FileX } from 'lucide-react';
import { useEstimateDispatch } from '../../../context/EstimateContext';
import { useProcedureValidation } from '../../../hooks/useProcedureValidation';
import InputField from '../../common/InputField';
import { Procedure, MetaData, ApiState } from '../../../types';
import { fetchLmnDraftFromApi } from '../../../services/geminiService';

interface ProcedureAuthInputProps {
    procedure: Procedure;
    primaryPayerName: string;
    metaData: MetaData;
}

const initialApiState: ApiState<any> = { loading: false, data: null, error: null };

const ProcedureAuthInput: React.FC<ProcedureAuthInputProps> = ({ procedure, primaryPayerName, metaData }) => {
    const dispatch = useEstimateDispatch();
    const { 
        id, 
        cptCode = '', 
        dxCode = '', 
        authDetails = initialApiState, 
        necessityDetails = initialApiState, 
        payerIntel = initialApiState, 
        policyDetails = initialApiState, 
        icdSuggestions = initialApiState 
    } = procedure || {};
    
    useProcedureValidation(procedure, primaryPayerName);
    const [lmnLoading, setLmnLoading] = useState(false);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        dispatch({ type: 'UPDATE_PROCEDURE', payload: { id, field: e.target.name, value: e.target.value } });
    }, [dispatch, id]);
    
    const handleRemove = useCallback(() => {
        dispatch({ type: 'REMOVE_PROCEDURE', payload: { id } });
    }, [dispatch, id]);
    
    const handleDraftLmn = useCallback(async () => {
        setLmnLoading(true);
        const result = await fetchLmnDraftFromApi(procedure, metaData, primaryPayerName);
        setLmnLoading(false);
        if (result.success && result.data) {
            const formattedMessage = result.data.draft;
            dispatch({ type: 'SHOW_MODAL', payload: { title: "✨ LMN Draft", message: formattedMessage } });
        } else {
            dispatch({ type: 'SHOW_MODAL', payload: { title: "Error", message: result.error || "Could not draft letter." } });
        }
    }, [procedure, metaData, primaryPayerName, dispatch]);
    
    const getRiskStyles = (risk: string | undefined) => {
        switch (risk) {
            case 'High': return { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
            case 'Medium': return { text: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' };
            case 'Low': return { text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' };
            default: return { text: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200' };
        }
    };
    
    const riskData = necessityDetails?.data;
    const riskStyles = getRiskStyles(riskData?.denialRisk);
    const isLoading = authDetails?.loading || necessityDetails?.loading || payerIntel?.loading || policyDetails?.loading || icdSuggestions?.loading;

    return (
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-x-4 items-start">
                <div className="md:col-span-2 relative">
                    <InputField label="CPT Code" name="cptCode" value={cptCode} onChange={handleChange} placeholder="e.g., 71250" />
                    {isLoading && <div className="absolute top-8 right-2"><Loader className="h-4 w-4 animate-spin text-blue-500"/></div>}
                </div>
                <div className="md:col-span-3">
                    <InputField label="DX Code (Primary)" name="dxCode" value={dxCode} onChange={handleChange} placeholder="e.g., R05" />
                </div>
                 <div className="md:col-span-1 flex items-end justify-center h-full pb-2">
                    <button type="button" onClick={handleRemove} className="text-red-500 hover:text-red-700 transition"><Trash2 className="h-5 w-5"/></button>
                </div>
                <div className="md:col-span-6 mt-1 space-y-2">
                    {authDetails?.data && (
                        <>
                            <p className="text-sm font-semibold text-gray-700" title={authDetails.data.description}>Desc: {authDetails.data.description}</p>
                            {authDetails.data.isDeprecated && (
                                <p className="text-xs font-bold text-red-600 bg-red-100 border border-red-300 p-1.5 rounded-md mt-1.5">
                                    <AlertTriangle className="h-3 w-3 inline mr-1"/>
                                    DEPRECATED: {authDetails.data.deprecationNote}
                                </p>
                            )}
                        </>
                    )}
                    {authDetails?.error && <p className="text-sm text-red-500">{authDetails.error}</p>}
                    
                    {(authDetails?.data || payerIntel?.data) && (
                         <div className="text-sm">
                            <span className="font-semibold">Auth: </span>
                            {authDetails?.data && (
                                <span className={authDetails.data.authRequired ? 'text-yellow-600 font-bold' : 'text-green-600'}>
                                    {authDetails.data.authRequired ? `Likely Required` : 'Not Typically Required'}
                                </span>
                            )}
                             {payerIntel?.data && (
                                <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 p-1.5 rounded-md mt-1">
                                    <strong className="font-semibold">💡 Payer Intel ({primaryPayerName}):</strong> {payerIntel.data.intel}
                                </p>
                             )}
                             {payerIntel?.error && <p className="text-xs text-red-500">Payer Intel: {payerIntel.error}</p>}
                        </div>
                    )}
                    
                    {icdSuggestions?.data && icdSuggestions.data.suggestions?.length > 0 && (
                        <div className="text-xs text-cyan-700 bg-cyan-50 border border-cyan-200 p-1.5 rounded-md mt-1.5">
                            <p className="font-semibold flex items-center">
                                <Info className="h-3 w-3 mr-1.5 flex-shrink-0"/>
                                AI Coding Suggestion: {icdSuggestions.data.note}
                            </p>
                            <ul className="mt-1 pl-4 list-disc list-inside">
                                {icdSuggestions.data.suggestions.map(sug => (
                                    <li key={sug.code}><strong>{sug.code}:</strong> {sug.description}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    
                    {policyDetails?.data && (
                        <div className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 p-1.5 rounded-md mt-1.5">
                            <p className="font-semibold flex items-center">
                                <FileText className="h-3 w-3 mr-1.5 flex-shrink-0"/>
                                Clinical Policy (RAG): {policyDetails.data.impact}
                                <span className="font-normal text-gray-500 ml-2">({policyDetails.data.source})</span>
                            </p>
                            <p className="mt-1 pl-4 text-gray-700">{policyDetails.data.policyRule}</p>
                        </div>
                    )}

                    {necessityDetails?.data && (
                        <div className={`text-sm p-2 rounded-md ${riskStyles.bg} ${riskStyles.border} border mt-1.5`}>
                             <p>
                                <span className="font-semibold">Risk: </span>
                                <span className={`${riskStyles.text} font-bold`}>{riskData.denialRisk} Denial Risk</span>
                                <span className="text-xs text-gray-500 ml-2">(AI Confidence: {riskData.confidence})</span>
                            </p>
                             {riskData.denialRisk !== 'Low' && (
                                <>
                                <p className="text-xs text-gray-700 mt-1"><strong className="font-semibold">Common Reason:</strong> {riskData.reason}</p>
                                <p className="text-xs text-gray-700 mt-1"><strong className="font-semibold">Recommended Action:</strong> {riskData.mitigation}</p>
                                
                                <div className="mt-2 pt-2 border-t border-gray-300">
                                    <button
                                        type="button"
                                        onClick={handleDraftLmn}
                                        disabled={lmnLoading}
                                        className="flex items-center space-x-2 text-sm bg-purple-600 text-white font-semibold py-1.5 px-3 rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400"
                                    >
                                        {lmnLoading ? <Loader className="h-4 w-4 animate-spin"/> : <FileText className="h-4 w-4" />}
                                        <span>✨ Draft Letter of Necessity</span>
                                    </button>
                                </div>
                                </>
                             )}
                             {riskData.modifierSuggestion && (
                                <p className="text-xs text-gray-700 mt-1 pt-1 border-t border-gray-300"><strong className="font-semibold">Modifier Note:</strong> {riskData.modifierSuggestion}</p>
                             )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProcedureAuthInput;