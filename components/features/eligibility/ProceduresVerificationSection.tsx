import React, { useCallback, useEffect, useMemo } from 'react';
import { PlusCircle, Loader, ShieldOff, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useEstimateDispatch, useEstimateState } from '../../../context/EstimateContext';
import { fetchBundlingAuditFromApi } from '../../../services/geminiService';
import ProcedureAuthInput from './ProcedureAuthInput';
import { MetaData, Procedure } from '../../../types';

interface ProceduresVerificationSectionProps {
    procedures: Procedure[];
    primaryPayerName: string;
    bundlingAudit: ReturnType<typeof useEstimateState>['bundlingAudit'];
    metaData: MetaData;
}

const BundlingAuditDisplay: React.FC<{ bundlingAudit: ProceduresVerificationSectionProps['bundlingAudit'], procedureCount: number }> = ({ bundlingAudit, procedureCount }) => {
    if (procedureCount < 2) return null;
    if (bundlingAudit.loading) {
        return ( <div className="mt-4 p-4 border rounded-lg bg-gray-50 flex items-center justify-center"><Loader className="h-5 w-5 animate-spin text-blue-500" /><span className="ml-2 text-sm text-gray-500">Running NCCI Bundling Audit...</span></div> );
    }
    if (bundlingAudit.error) {
         return ( <div className="mt-4 p-4 border rounded-lg bg-red-50 border-red-200"><h4 className="font-bold text-red-700 flex items-center"><AlertTriangle className="h-5 w-5 mr-2" />Coding Audit Error</h4><p className="text-sm text-red-600">{bundlingAudit.error}</p></div> );
    }
    if (!bundlingAudit.data) return null;

    const { hasIssues, summary, auditResults } = bundlingAudit.data;
    return (
        <div className={`mt-4 p-4 border rounded-lg ${hasIssues ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
            <h4 className={`font-bold flex items-center ${hasIssues ? 'text-yellow-700' : 'text-green-700'}`}>
                {hasIssues ? <ShieldOff className="h-5 w-5 mr-2" /> : <ShieldCheck className="h-5 w-5 mr-2" />}
                Automated Coding Audit: {summary}
            </h4>
            {hasIssues && (
                <div className="mt-2 space-y-2">
                    {auditResults.map((result, index) => (
                        <div key={index} className="text-sm border-t border-yellow-200 pt-2">
                            <p><span className="font-semibold">Conflict:</span> {result.codePair.join(' & ')}</p>
                            <p className="text-xs text-gray-700"><strong className="font-semibold">Relationship:</strong> {result.relationship}</p>
                            <p className="text-xs text-gray-700"><strong className="font-semibold">Suggestion:</strong> {result.suggestion}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const ProceduresVerificationSection: React.FC<ProceduresVerificationSectionProps> = ({ procedures, primaryPayerName, bundlingAudit, metaData }) => {
    const dispatch = useEstimateDispatch();
    const addProcedure = useCallback(() => { dispatch({ type: 'ADD_PROCEDURE' }); }, [dispatch]);
    
    const cptCodesList = useMemo(() => procedures.map(p => p.cptCode.trim()).filter(cpt => cpt && cpt.length >= 5), [procedures]);
    const cptCodesKey = useMemo(() => JSON.stringify(cptCodesList.sort()), [cptCodesList]);

    useEffect(() => {
        if (cptCodesList.length < 2) {
            if (bundlingAudit.data || bundlingAudit.error) {
                 dispatch({ type: 'SET_BUNDLING_AUDIT_RESULT', payload: { loading: false, data: null, error: null } });
            }
            return;
        }
        
        if (bundlingAudit.key === cptCodesKey) return;

        dispatch({ type: 'SET_BUNDLING_AUDIT_RESULT', payload: { loading: true, data: null, error: null, key: cptCodesKey } });
        let mounted = true;
        const handler = setTimeout(async () => {
            const result = await fetchBundlingAuditFromApi(cptCodesList);
            if (mounted) {
                const newAuditResult = result.success
                    ? { loading: false, data: result.data ?? null, error: null, key: cptCodesKey }
                    : { loading: false, data: null, error: result.error ?? 'Unknown audit error', key: cptCodesKey };
                dispatch({ type: 'SET_BUNDLING_AUDIT_RESULT', payload: newAuditResult });
            }
        }, 1000);
        return () => { mounted = false; clearTimeout(handler); };
    }, [cptCodesKey, dispatch]);

    return (
         <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200/80">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-3 mb-4">Procedures to Verify</h3>
            <div className="space-y-3">
                {procedures.map((p) => (
                    <ProcedureAuthInput key={p.id} procedure={p} primaryPayerName={primaryPayerName} metaData={metaData} />
                ))}
            </div>
            <button type="button" onClick={addProcedure} className="mt-4 flex items-center space-x-2 text-blue-600 font-medium hover:text-blue-800 transition">
                <PlusCircle className="h-5 w-5"/><span>Add Procedure</span>
            </button>
            <BundlingAuditDisplay bundlingAudit={bundlingAudit} procedureCount={cptCodesList.length} />
        </div>
    );
};

export default ProceduresVerificationSection;