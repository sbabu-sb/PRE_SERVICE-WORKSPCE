

import React, { useState } from 'react';
import { Clock, Send, Loader, FileCheck, FileX, FileText, PenSquare, Code, PhoneForwarded } from 'lucide-react';
import { useEstimateState, useEstimateDispatch } from '../../../context/EstimateContext';
import { generateDummy278 } from '../../../utils/generators';
import { formatDate } from '../../../utils/formatters';
import { PayerVerificationDetails, AuthSubmissionState, Procedure } from '../../../types';
import { fetchAppealLetterDraftFromApi, fetchCodingSuggestionsForDenialFromApi, fetchPeerToPeerScriptFromApi } from '../../../services/geminiService';

interface AuthSubmissionSectionProps {
    payerVerificationDetails: PayerVerificationDetails | undefined;
}

const CLAIM_AUTH_ID = 'claim-level-auth';

interface AiActionCenterProps {
    authSubmission: AuthSubmissionState;
}


const AiActionCenter: React.FC<AiActionCenterProps> = ({ authSubmission }) => {
    const { metaData, payers, procedures } = useEstimateState();
    const dispatch = useEstimateDispatch();
    const [loadingAction, setLoadingAction] = useState<'appeal' | 'coding' | 'script' | null>(null);

    const rejectedProcedure = procedures.find(p => authSubmission.statusNotes?.includes(p.cptCode));
    const primaryPayer = payers[0];

    const handleAction = async (action: 'appeal' | 'coding' | 'script') => {
        if (!rejectedProcedure || !primaryPayer || !authSubmission.statusNotes) {
            dispatch({ type: 'SHOW_MODAL', payload: { title: "Error", message: "Could not identify the specific procedure or payer for this action." } });
            return;
        }
        setLoadingAction(action);
        let result;
        let title = '';
        switch (action) {
            case 'appeal':
                title = "✨ AI-Drafted Appeal Letter";
                result = await fetchAppealLetterDraftFromApi(rejectedProcedure, metaData, primaryPayer, authSubmission.statusNotes);
                break;
            case 'coding':
                title = "💡 AI Coding Suggestions";
                result = await fetchCodingSuggestionsForDenialFromApi(rejectedProcedure, primaryPayer, authSubmission.statusNotes);
                break;
            case 'script':
                title = "📞 AI Peer-to-Peer Script";
                result = await fetchPeerToPeerScriptFromApi(rejectedProcedure, metaData, authSubmission.statusNotes);
                break;
        }
        
        setLoadingAction(null);
        if (result && result.success && result.data) {
            const message = (result.data as any).draft || (result.data as any).suggestions || (result.data as any).script || "No content generated.";
            dispatch({ type: 'SHOW_MODAL', payload: { title, message } });
        } else {
            dispatch({ type: 'SHOW_MODAL', payload: { title: "Error", message: result?.error || `Could not generate ${action}.` } });
        }
    };
    
    return (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h5 className="font-bold text-gray-800">AI-Powered Next Steps</h5>
            <p className="text-sm text-gray-600 mb-4">The AI has analyzed the denial and suggests the following actions:</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                
                <button disabled={!!loadingAction} onClick={() => handleAction('appeal')} className="group p-3 text-left bg-white rounded-lg border hover:border-blue-500 hover:shadow-md transition disabled:opacity-50">
                    <div className="flex items-center">
                        {loadingAction === 'appeal' ? <Loader className="h-5 w-5 text-blue-500 animate-spin"/> : <PenSquare className="h-5 w-5 text-blue-600"/>}
                        <h6 className="ml-2 font-semibold text-gray-800">Draft Appeal Letter</h6>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Generate a formal appeal letter that directly counters the payer's reason for denial.</p>
                </button>

                <button disabled={!!loadingAction} onClick={() => handleAction('coding')} className="group p-3 text-left bg-white rounded-lg border hover:border-blue-500 hover:shadow-md transition disabled:opacity-50">
                    <div className="flex items-center">
                         {loadingAction === 'coding' ? <Loader className="h-5 w-5 text-blue-500 animate-spin"/> : <Code className="h-5 w-5 text-blue-600"/>}
                        <h6 className="ml-2 font-semibold text-gray-800">Suggest Alt. Codes</h6>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Get suggestions for alternative CPT/DX codes that may meet the payer's policy.</p>
                </button>
                
                <button disabled={!!loadingAction} onClick={() => handleAction('script')} className="group p-3 text-left bg-white rounded-lg border hover:border-blue-500 hover:shadow-md transition disabled:opacity-50">
                    <div className="flex items-center">
                         {loadingAction === 'script' ? <Loader className="h-5 w-5 text-blue-500 animate-spin"/> : <PhoneForwarded className="h-5 w-5 text-blue-600"/>}
                        <h6 className="ml-2 font-semibold text-gray-800">Generate P2P Script</h6>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Create a concise script with key talking points for a peer-to-peer review call.</p>
                </button>
            </div>
        </div>
    );
};


const AuthSubmissionSection: React.FC<AuthSubmissionSectionProps> = ({ payerVerificationDetails }) => {
    const { metaData, payers, procedures, authSubmissions } = useEstimateState();
    const dispatch = useEstimateDispatch();
    const [show278, setShow278] = useState(false);
    
    // Fix: Correctly access authSubmissions state with payerId and CLAIM_AUTH_ID.
    const payerId = payerVerificationDetails?.payerId;
    const authSubmission: AuthSubmissionState = (payerId && authSubmissions[payerId]?.[CLAIM_AUTH_ID]) || { loading: false, status: null, generated278: null, authNumber: null, statusNotes: null };

    if (!payerId) {
        return <div className="p-4"><p className="text-sm text-red-500">Error: Payer context is missing for authorization submission.</p></div>;
    }

    if (payerVerificationDetails?.authStatus !== 'Required' && authSubmission.status === null) {
        return <p className="text-sm text-gray-500 p-4">Authorization is not indicated as required for this payer.</p>;
    }

    const handleSubmitAuth = () => {
        // Fix: Use correct action type and payload structure.
        dispatch({ type: 'START_AUTH_SUBMISSION_FOR_PAYER', payload: { payerId, procedureId: CLAIM_AUTH_ID } });
        const dummy278 = generateDummy278(metaData, payers, procedures);
        
        setTimeout(() => {
            dispatch({ 
                // Fix: Use correct action type and payload structure.
                type: 'SET_AUTH_SUBMISSION_RESULT_FOR_PAYER', 
                payload: {
                    payerId,
                    procedureId: CLAIM_AUTH_ID,
                    result: {
                        status: 'Pending', 
                        generated278: dummy278, 
                        statusNotes: 'Submitted successfully to payer portal. Awaiting payer review.' 
                    }
                } 
            });
        }, 1500);
    };
    
    const handleCheckStatus = () => {
        // Fix: Use correct action type and payload structure.
        dispatch({ type: 'START_AUTH_STATUS_CHECK_FOR_PAYER', payload: { payerId, procedureId: CLAIM_AUTH_ID } });
        
        setTimeout(() => {
            const isApproved = Math.random() > 0.3; // 70% approval chance
            if (isApproved) {
                dispatch({ 
                    // Fix: Use correct action type and payload structure.
                    type: 'SET_AUTH_STATUS_RESULT_FOR_PAYER', 
                    payload: {
                        payerId,
                        procedureId: CLAIM_AUTH_ID,
                        result: {
                            status: 'Approved', 
                            authNumber: `AUTH-${Math.floor(Math.random() * 90000 + 10000)}`, 
                            statusNotes: `Authorization approved. Valid until ${formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0,10))}.`
                        }
                    } 
                });
            } else {
                 const rejectedProc = procedures.find(p => p.authDetails.data?.authRequired) || procedures[0];
                 dispatch({ 
                    // Fix: Use correct action type and payload structure.
                    type: 'SET_AUTH_STATUS_RESULT_FOR_PAYER', 
                    payload: {
                        payerId,
                        procedureId: CLAIM_AUTH_ID,
                        result: {
                            status: 'Rejected (More Info)', 
                            statusNotes: `Rejected: Requires additional clinical documentation for CPT ${rejectedProc.cptCode}.` 
                        }
                    } 
                });
            }
        }, 2000);
    };

    const statusStyles = {
        'Pending': { icon: <Clock className="text-yellow-600 mr-2"/>, text: 'text-yellow-800', border: 'border-yellow-500', bg: 'bg-yellow-50' },
        'Approved': { icon: <FileCheck className="text-green-600 mr-2"/>, text: 'text-green-800', border: 'border-green-500', bg: 'bg-green-50' },
        'Rejected (More Info)': { icon: <FileX className="text-red-600 mr-2"/>, text: 'text-red-800', border: 'border-red-500', bg: 'bg-red-50' },
        'Not Submitted': { icon: <FileText className="text-blue-600 mr-2"/>, text: 'text-blue-800', border: 'border-blue-500', bg: 'bg-blue-50' }
    };
    
    const currentStatusStyle = authSubmission.status ? statusStyles[authSubmission.status] : statusStyles['Not Submitted'];

    return (
        <div className={`p-4 rounded-lg border-l-4 ${currentStatusStyle.border} ${currentStatusStyle.bg}`}>
            <h4 className={`font-bold flex items-center ${currentStatusStyle.text}`}>
                {currentStatusStyle.icon}
                Authorization (EDI 278) Status: {authSubmission.status || 'Not Submitted'}
            </h4>
            
            {authSubmission.statusNotes && (
                <p className="text-sm text-gray-600 mt-1">
                    {authSubmission.statusNotes}
                    {authSubmission.authNumber && <span className="font-bold ml-1">Auth #: {authSubmission.authNumber}</span>}
                </p>
            )}

            <div className="flex items-center space-x-3 mt-4">
                {!authSubmission.status && (
                    <button 
                        type="button" 
                        onClick={handleSubmitAuth} 
                        disabled={authSubmission.loading}
                        className="flex items-center space-x-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
                    >
                        {authSubmission.loading ? <Loader className="h-5 w-5 animate-spin"/> : <Send className="h-5 w-5" />}
                        <span>{authSubmission.loading ? 'Submitting...' : 'Submit Auth Request'}</span>
                    </button>
                )}

                {authSubmission.status === 'Pending' && (
                     <button 
                        type="button" 
                        onClick={handleCheckStatus} 
                        disabled={authSubmission.loading}
                        className="flex items-center space-x-2 bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-600 transition disabled:bg-gray-400"
                    >
                        {authSubmission.loading ? <Loader className="h-5 w-5 animate-spin"/> : <Clock className="h-5 w-5" />}
                        <span>{authSubmission.loading ? 'Checking...' : 'Check Status'}</span>
                    </button>
                )}
                
                {authSubmission.generated278 && (
                     <button 
                        type="button" 
                        onClick={() => setShow278(s => !s)} 
                        className="text-sm text-blue-600 hover:underline font-medium"
                    >
                        {show278 ? 'Hide' : 'Show'} Generated 278
                    </button>
                )}
            </div>
            
            {/* Fix: Pass correctly typed authSubmission to AiActionCenter */}
            {authSubmission.status === 'Rejected (More Info)' && <AiActionCenter authSubmission={authSubmission} />}
            
            {show278 && authSubmission.generated278 && (
                <pre className="mt-4 p-3 bg-gray-900 text-white text-xs rounded-md overflow-x-auto">
                    <code>{authSubmission.generated278}</code>
                </pre>
            )}
        </div>
    );
};

export default AuthSubmissionSection;