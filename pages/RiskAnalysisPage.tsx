import React, { useMemo, useState, useCallback, useEffect } from "react";
import { useEstimateState, useEstimateDispatch } from '../context/EstimateContext';
import { Payer, Procedure, RiskFactor, MetaData, AuthSubmissionState, PaymentLikelihood } from '../types';
import { ArrowLeft, ArrowRight, Loader, FileText, ShieldCheck, Stethoscope, RefreshCw, Wand2, CheckSquare, X, Code, PenSquare, PhoneForwarded, FilePlus, AlertTriangle, ChevronDown, ChevronUp, Upload, Send, FileBadge } from 'lucide-react';
import { formatDate } from '../utils/formatters';
import Card from '../components/common/Card';
import { generateDummy270, generateDummy271, generateDummy278 } from "../utils/generators";
import { fetchAppealLetterDraftFromApi, fetchCodingSuggestionsForDenialFromApi, fetchPeerToPeerScriptFromApi, fetchClaimPaymentLikelihood } from "../services/geminiService";

// ====================================================================================
// ARCHITECTURAL NOTE: Page 2 — "MULTI-PAYER RISK INTELLIGENCE HUB" IMPLEMENTATION
// This component realizes the Principal Architect's redesign for multi-payer analysis.
// It is structured with payer-specific tabs, on-demand AI risk fetching, and context-
// aware sub-components to create a true RCM cockpit.
// ====================================================================================

const getRiskPresentation = (score: number) => {
    if (score < 50) return { text: 'text-red-600', stroke: 'stroke-red-500', bg: 'bg-red-50', border: 'border-red-500' };
    if (score < 80) return { text: 'text-yellow-600', stroke: 'stroke-yellow-500', bg: 'bg-yellow-50', border: 'border-yellow-500' };
    return { text: 'text-green-600', stroke: 'stroke-green-500', bg: 'bg-green-50', border: 'border-green-500' };
};

const getImpactColor = (impact: 'High' | 'Medium' | 'Low') => {
    if (impact === 'High') return 'text-red-600';
    if (impact === 'Medium') return 'text-yellow-600';
    return 'text-green-600';
};

const RiskGauge: React.FC<{ score: number }> = ({ score }) => {
    const size = 160; const strokeWidth = 16; const center = size / 2; const radius = center - strokeWidth / 2;
    const circumference = 2 * Math.PI * radius;
    const { text: textColor, stroke: strokeColor } = getRiskPresentation(score);
    const offset = circumference - (score / 100) * circumference;

    return (
        <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle cx={center} cy={center} r={radius} strokeWidth={strokeWidth} className="stroke-gray-200" fill="none" />
                <circle cx={center} cy={center} r={radius} strokeWidth={strokeWidth} className={strokeColor} fill="none" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90 ${center} ${center})`} style={{ transition: 'stroke-dashoffset 0.8s ease-out' }} />
            </svg>
            <div className="absolute flex flex-col items-center text-center">
                <span className={`font-extrabold text-5xl ${textColor}`}>{Math.round(score)}</span>
                <span className="font-semibold text-gray-600 text-xs -mt-1">Clearance Score</span>
            </div>
        </div>
    );
};

const WhatIfSandbox: React.FC<{
    risks: RiskFactor[];
    mitigatedRisks: Set<string>;
    onToggleRisk: (riskId: string) => void;
}> = ({ risks, mitigatedRisks, onToggleRisk }) => {
    const groupedRisks = useMemo(() => {
        if (!Array.isArray(risks)) {
            return {};
        }
        const sortedRisks = [...risks].sort((a, b) => a.scoreImpact - b.scoreImpact);
        // FIX: Explicitly typed the `acc` parameter in the reduce function to ensure TypeScript correctly
        // infers the return type. This resolves the error where `riskList.map` could not be called
        // because `riskList` was of type `unknown`.
        return sortedRisks.reduce((acc: Record<string, RiskFactor[]>, risk) => {
            const category = risk.category || 'Other';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(risk);
            return acc;
        }, {});
    }, [risks]);


    if (!Array.isArray(risks) || risks.length === 0) {
        return <p className="text-sm text-center text-green-700 bg-green-50 p-4 rounded-lg">No actionable risks detected for this payer.</p>;
    }

    return (
        <div className="space-y-4 max-h-48 overflow-y-auto pr-2">
            {Object.entries(groupedRisks).map(([category, riskList]) => (
                <div key={category}>
                    <h4 className="text-sm font-bold text-gray-600 mb-2">{category}</h4>
                    {riskList.map(risk => {
                        const isMitigated = mitigatedRisks.has(risk.id);
                        const impactColor = getImpactColor(risk.impact);
                        return (
                            <label key={risk.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
                                <input type="checkbox" className={`flex-shrink-0 appearance-none h-4 w-4 rounded border border-gray-300 bg-white checked:bg-blue-600 checked:border-transparent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 checked:bg-no-repeat checked:bg-center checked:bg-cover checked:bg-[url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e")]`} checked={isMitigated} onChange={() => onToggleRisk(risk.id)} />
                                <p className={`text-sm font-medium text-gray-800 ${isMitigated ? 'line-through text-gray-500' : ''}`}>
                                    <AlertTriangle className={`h-4 w-4 inline-block mr-2 ${impactColor} ${isMitigated ? 'opacity-40' : ''}`} />
                                    {risk.text}
                                </p>
                            </label>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

const ProcedureCoverageDetails: React.FC<{ activePayer: Payer }> = ({ activePayer }) => {
    const { procedures, authSubmissions, metaData, payers } = useEstimateState();
    const dispatch = useEstimateDispatch();
    const payerAuths = authSubmissions[activePayer.id] || {};

    const handleAuthAction = (procId: string, action: 'submit' | 'check') => {
        const payload = { payerId: activePayer.id, procedureId: procId };
        if (action === 'submit') {
            dispatch({ type: 'START_AUTH_SUBMISSION_FOR_PAYER', payload });
            setTimeout(() => {
                const dummy278 = generateDummy278(metaData, [activePayer], procedures.filter(p => p.id === procId));
                dispatch({ type: 'SET_AUTH_SUBMISSION_RESULT_FOR_PAYER', payload: { ...payload, result: { status: 'Pending', generated278: dummy278, statusNotes: `Submitted to ${activePayer.insurance.name} at ${new Date().toLocaleTimeString()}` } } });
            }, 1500);
        } else {
            dispatch({ type: 'START_AUTH_STATUS_CHECK_FOR_PAYER', payload });
            setTimeout(() => {
                const isApproved = Math.random() > 0.3;
                const result: Partial<AuthSubmissionState> = isApproved
                    ? { status: 'Approved', authNumber: `AUTH-${Math.random().toString(36).substring(2, 9).toUpperCase()}`, statusNotes: `Approved on ${formatDate(new Date().toISOString())}` }
                    : { status: 'Rejected (More Info)', statusNotes: `Denied by ${activePayer.insurance.name}: Medical necessity not met.` };
                dispatch({ type: 'SET_AUTH_SUBMISSION_RESULT_FOR_PAYER', payload: { ...payload, result } });
            }, 2000);
        }
    };
    
    const requiredAuths = procedures.filter(p => p.authDetails.data?.authRequired && !['Pending', 'Approved'].includes(payerAuths[p.id]?.status || ''));
    const pendingAuths = procedures.filter(p => payerAuths[p.id]?.status === 'Pending');
    
    const handleBulkAuth = () => requiredAuths.forEach(p => handleAuthAction(p.id, 'submit'));
    const handleBulkCheck = () => pendingAuths.forEach(p => handleAuthAction(p.id, 'check'));

    return (
        <Card title="Procedure & Coverage Details" icon={<Stethoscope className="text-blue-600" />} contentClassName="grid-cols-1">
            <div className="flex items-center space-x-2 mb-4 border-b pb-3">
                <button onClick={handleBulkAuth} disabled={requiredAuths.length === 0} className="flex items-center space-x-1.5 text-sm bg-blue-600 text-white font-semibold py-1.5 px-3 rounded-md hover:bg-blue-700 transition disabled:bg-gray-400"><Send className="h-4 w-4" /><span>Submit All Auths ({requiredAuths.length})</span></button>
                <button onClick={handleBulkCheck} disabled={pendingAuths.length === 0} className="flex items-center space-x-1.5 text-sm bg-gray-500 text-white font-semibold py-1.5 px-3 rounded-md hover:bg-gray-600 transition disabled:bg-gray-400"><RefreshCw className="h-4 w-4" /><span>Check All Statuses ({pendingAuths.length})</span></button>
            </div>
            <div className="hidden md:grid grid-cols-12 gap-x-4 px-3 py-2 text-xs font-bold text-gray-500 uppercase">
                <div className="col-span-2">CPT Code</div><div className="col-span-1">DX Code</div><div className="col-span-4">Description</div><div className="col-span-2 text-center">Auth Status</div><div className="col-span-3 text-right">Actions</div>
            </div>
            <div className="space-y-2">
                {procedures.map(proc => {
                    const auth = payerAuths[proc.id];
                    const status = auth?.status;
                    const authIsRequired = proc.authDetails.data?.authRequired;

                    const statusBadge = <span className={`text-xs font-bold px-2 py-1 rounded-full ${status === 'Approved' ? 'bg-green-100 text-green-800' : status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : status === 'Rejected (More Info)' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>{status || (authIsRequired ? 'Auth Required' : 'No Auth Needed')}</span>;
                    return (
                        <div key={proc.id} className="grid grid-cols-1 md:grid-cols-12 gap-x-4 items-center border-t first:border-t-0 pt-3 first:pt-0 md:border-t md:first:border-t md:border-gray-200 md:p-3 md:hover:bg-gray-50 rounded-lg">
                            <div className="md:col-span-2"><p className="font-bold text-gray-800">{proc.cptCode}</p></div>
                            <div className="md:col-span-1"><p className="text-sm text-gray-600">{proc.dxCode}</p></div>
                            <div className="md:col-span-4"><p className="text-xs text-gray-500">{proc.authDetails.data?.description}</p></div>
                            <div className="md:col-span-2 text-center my-2 md:my-0">{statusBadge}</div>
                            <div className="md:col-span-3 flex items-center justify-end space-x-3">{auth?.loading ? <Loader className="h-5 w-5 animate-spin text-blue-500" /> : <>
                                <button onClick={() => handleAuthAction(proc.id, 'submit')} disabled={!authIsRequired || status === 'Pending' || status === 'Approved'} className="flex items-center text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400"><Send className="h-3 w-3 mr-1" />Submit</button>
                                <button onClick={() => handleAuthAction(proc.id, 'check')} disabled={status !== 'Pending'} className="flex items-center text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400"><RefreshCw className="h-3 w-3 mr-1" />Check</button>
                                <button onClick={() => dispatch({ type: 'SHOW_MODAL', payload: { title: `Auth Details for ${proc.cptCode}`, message: `<pre>${auth?.generated278 || auth?.statusNotes || "No details."}</pre>` } })} disabled={!auth?.status} className="flex items-center text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400"><FileBadge className="h-3 w-3 mr-1" />Details</button>
                            </>}</div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};

const PayerDataPanels: React.FC<{ activePayer: Payer }> = ({ activePayer }) => {
    const { authSubmissions, verificationResult, metaData, procedures } = useEstimateState();
    const dispatch = useEstimateDispatch();
    const payerVerification = verificationResult?.payerVerifications[activePayer.id];
    const [ediVisible, setEdiVisible] = useState(false);

    const handleReverify = () => {
        dispatch({ type: 'REVERIFY_ELIGIBILITY_START', payload: { payerId: activePayer.id } });
        setTimeout(() => {
            const isStillActive = Math.random() > 0.1;
            dispatch({ type: 'REVERIFY_ELIGIBILITY_RESULT', payload: { payerId: activePayer.id, result: { edi271Response: generateDummy271(metaData, activePayer, isStillActive) } } });
        }, 1500);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Eligibility Snapshot" icon={<ShieldCheck className="text-blue-600" />} contentClassName="grid-cols-1">
                <div className="flex justify-between items-start"><p className="font-semibold text-gray-700">{activePayer.insurance.name}</p><button onClick={handleReverify} disabled={payerVerification?.reVerifying} className="flex items-center text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400">{payerVerification?.reVerifying ? <Loader className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />} Re-Verify</button></div>
                <p className="text-sm text-gray-600">{verificationResult?.overallEligibilityStatus === 'Active' ? 'Eligibility appears active.' : 'Eligibility issue detected.'}</p>
                <button onClick={() => setEdiVisible(!ediVisible)} className="text-sm text-blue-600 hover:underline flex items-center">{ediVisible ? <ChevronUp className="h-4 w-4 mr-1"/> : <ChevronDown className="h-4 w-4 mr-1"/>} {ediVisible ? 'Hide' : 'Show'} 270/271 Response</button>
                {ediVisible && <pre className="mt-2 p-2 bg-gray-900 text-white text-xs rounded-md overflow-x-auto text-[10px] leading-tight"><strong>270 Request:</strong><br/>{payerVerification?.edi270Submitted}<br/><br/><strong>271 Response:</strong><br/>{payerVerification?.edi271Response}</pre>}
            </Card>
            <Card title="Authorization Summary" icon={<FileText className="text-blue-600" />} contentClassName="grid-cols-1">
                 <p className="font-semibold text-gray-700">Consolidated Status per Procedure</p>
                 <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">{procedures.map(proc => <li key={proc.id}><strong>{proc.cptCode}:</strong> {(authSubmissions[activePayer.id]?.[proc.id]?.status) || (proc.authDetails.data?.authRequired ? 'Required' : 'Not Required')}</li>)}</ul>
                 <p className="text-xs text-gray-500 mt-2">{payerVerification?.authPredictionReasoning}</p>
            </Card>
        </div>
    );
};

const NextBestActions: React.FC<{ activePayer: Payer }> = ({ activePayer }) => {
    const { metaData, procedures, authSubmissions } = useEstimateState();
    const dispatch = useEstimateDispatch();
    const [loadingAction, setLoadingAction] = useState<'appeal' | 'coding' | 'script' | null>(null);

    const payerAuths = authSubmissions[activePayer.id] || {};
    const deniedProcedures = useMemo(() => procedures.filter(p => payerAuths[p.id]?.status === 'Rejected (More Info)'), [procedures, payerAuths]);
    
    if (deniedProcedures.length === 0) {
        return <Card title="Next Best Actions" icon={<CheckSquare className="text-green-600" />}><p className="text-green-700 text-center font-semibold">All authorizations for this payer are approved or not required.</p></Card>;
    }
    const deniedProc = deniedProcedures[0];
    const denialReason = payerAuths[deniedProc.id]?.statusNotes || 'No reason provided';
    
    const handleAction = async (action: 'appeal' | 'coding' | 'script') => { setLoadingAction(action);
        let result, title;
        switch (action) {
            case 'appeal': title = `✨ AI-Drafted Appeal to ${activePayer.insurance.name}`; result = await fetchAppealLetterDraftFromApi(deniedProc, metaData, activePayer, denialReason); break;
            case 'coding': title = "💡 AI Coding Suggestions"; result = await fetchCodingSuggestionsForDenialFromApi(deniedProc, activePayer, denialReason); break;
            case 'script': title = `📞 AI Peer-to-Peer Script for ${activePayer.insurance.name}`; result = await fetchPeerToPeerScriptFromApi(deniedProc, metaData, denialReason); break;
        }
        setLoadingAction(null);
        if (result?.success && result.data) {
            const message = (result.data as any).draft || (result.data as any).suggestions || (result.data as any).script || "No content generated.";
            dispatch({ type: 'SHOW_MODAL', payload: { title, message } });
        } else {
            dispatch({ type: 'SHOW_MODAL', payload: { title: "Error", message: result?.error || `Could not generate ${action}.` } });
        }
    };

    return (
        <Card title="Next Best Actions (Denial Response)" icon={<AlertTriangle className="text-red-600" />}>
            <p className="text-sm text-red-700 -mt-2 mb-3">Denial detected from {activePayer.insurance.name} for CPT {deniedProc.cptCode}: "{denialReason}"</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <button disabled={!!loadingAction} onClick={() => handleAction('appeal')} className="flex items-center space-x-2 p-2 bg-red-50 text-red-800 font-semibold rounded-lg hover:bg-red-100 transition disabled:opacity-50">{loadingAction === 'appeal' ? <Loader className="h-5 w-5 animate-spin"/> : <PenSquare className="h-5 w-5"/>}<span>Generate Appeal Letter</span></button>
                <button className="flex items-center space-x-2 p-2 bg-gray-100 text-gray-800 font-semibold rounded-lg hover:bg-gray-200 transition disabled:opacity-50"><Upload className="h-5 w-5"/><span>Add Attachments</span></button>
                <button disabled={!!loadingAction} onClick={() => handleAction('script')} className="flex items-center space-x-2 p-2 bg-red-50 text-red-800 font-semibold rounded-lg hover:bg-red-100 transition disabled:opacity-50">{loadingAction === 'script' ? <Loader className="h-5 w-5 animate-spin"/> : <PhoneForwarded className="h-5 w-5"/>}<span>Generate Talking Points</span></button>
                <button disabled={!!loadingAction} onClick={() => handleAction('coding')} className="flex items-center space-x-2 p-2 bg-red-50 text-red-800 font-semibold rounded-lg hover:bg-red-100 transition disabled:opacity-50">{loadingAction === 'coding' ? <Loader className="h-5 w-5 animate-spin"/> : <Code className="h-5 w-5"/>}<span>Resubmit with Mods</span></button>
            </div>
        </Card>
    );
};

const RiskAnalysisPage: React.FC = () => {
    const state = useEstimateState();
    const dispatch = useEstimateDispatch();
    const { metaData, payers, procedures, paymentLikelihood, npiValidationResult, verificationResult } = state;
    
    const [activePayerId, setActivePayerId] = useState<string>(payers[0]?.id || '');
    const [mitigatedRisks, setMitigatedRisks] = useState<Record<string, Set<string>>>({});
    const [fetchingPayerRisk, setFetchingPayerRisk] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (!activePayerId && payers.length > 0) setActivePayerId(payers[0].id);
    }, [payers, activePayerId]);

    const activePayer = useMemo(() => payers.find(p => p.id === activePayerId), [activePayerId, payers]);
    
    useEffect(() => {
        if (!activePayerId || !activePayer || !npiValidationResult.data || !verificationResult) return;
        const alreadyFetched = !!paymentLikelihood[activePayerId];
        if (alreadyFetched || fetchingPayerRisk[activePayerId]) return;

        const fetchRiskForPayer = async () => {
            setFetchingPayerRisk(prev => ({ ...prev, [activePayerId]: true }));
            const payerIndex = payers.findIndex(p => p.id === activePayerId);
            const previousPayers = payers.slice(0, payerIndex);
            
            const result = await fetchClaimPaymentLikelihood(procedures, activePayer, npiValidationResult.data, verificationResult, previousPayers);
            
            if (result.success && result.data) {
                dispatch({ type: 'SET_LIKELIHOOD_FOR_PAYER', payload: { payerId: activePayerId, likelihood: result.data } });
            } else {
                const errorLikelihood = { error: result.error || 'Failed to fetch risk analysis.', keyFactors: [] } as PaymentLikelihood;
                dispatch({ type: 'SET_LIKELIHOOD_FOR_PAYER', payload: { payerId: activePayerId, likelihood: errorLikelihood } });
            }
            setFetchingPayerRisk(prev => ({ ...prev, [activePayerId]: false }));
        };
        fetchRiskForPayer();
    }, [activePayerId, payers, paymentLikelihood, dispatch, procedures, metaData.service.placeOfService, npiValidationResult.data, verificationResult, activePayer, fetchingPayerRisk]);

    const handleToggleRisk = (riskId: string) => {
        setMitigatedRisks(prev => {
            const currentPayerRisks = new Set(prev[activePayerId] || []);
            if (currentPayerRisks.has(riskId)) currentPayerRisks.delete(riskId); else currentPayerRisks.add(riskId);
            return { ...prev, [activePayerId]: currentPayerRisks };
        });
    };
    
    const activeLikelihood = useMemo(() => paymentLikelihood[activePayerId] || null, [activePayerId, paymentLikelihood]);
    const baseScore = useMemo(() => 100 + (activeLikelihood?.keyFactors || []).reduce((sum, r) => sum + r.scoreImpact, 0), [activeLikelihood]);
    const scoreWithMitigation = useMemo(() => {
        if (!activeLikelihood?.keyFactors) return baseScore;
        const mitigatedImpactSum = activeLikelihood.keyFactors
            .filter(r => mitigatedRisks[activePayerId]?.has(r.id))
            .reduce((sum, r) => sum + r.scoreImpact, 0);
        return baseScore - mitigatedImpactSum;
    }, [baseScore, activeLikelihood, mitigatedRisks, activePayerId]);

    const handleBack = useCallback(() => dispatch({ type: 'SET_PAGE', payload: 'eligibility' }), [dispatch]);
    const handleNext = useCallback(() => dispatch({ type: 'SET_PAGE', payload: 'form' }), [dispatch]);

    const renderContent = () => {
        if (!activePayer) {
            return <Card title="Error" icon={<AlertTriangle className="text-red-500" />}><p>No active payer selected.</p></Card>;
        }
        
        const isLoading = fetchingPayerRisk[activePayerId];
        const likelihood = activeLikelihood;

        if (isLoading) {
            return <div className="text-center p-8"><Loader className="h-8 w-8 animate-spin mx-auto text-blue-500" /><p className="mt-2">Loading Risk Analysis for {activePayer.insurance.name}...</p></div>;
        }

        if (likelihood?.error) {
            return <Card title="Error" icon={<AlertTriangle className="text-red-500"/>}><p className="text-red-600">{likelihood.error}</p></Card>;
        }

        if (likelihood) {
            return (
                 <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200/80">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                            <div className="lg:col-span-1 flex items-center justify-center"><RiskGauge score={scoreWithMitigation} /></div>
                            <div className="lg:col-span-2 space-y-4">
                                <Card title="WHAT IF SANDBOX" icon={<Wand2 className="text-purple-600" />}>
                                    <p className="text-xs text-gray-500 -mt-3 mb-1">Click a risk to simulate its mitigation and see the impact on the Clearance Score for {activePayer.insurance.name}.</p>
                                    <WhatIfSandbox risks={likelihood.keyFactors || []} mitigatedRisks={mitigatedRisks[activePayerId] || new Set()} onToggleRisk={handleToggleRisk} />
                                </Card>
                            </div>
                        </div>
                    </div>
                    <ProcedureCoverageDetails activePayer={activePayer} />
                    <PayerDataPanels activePayer={activePayer} />
                    <NextBestActions activePayer={activePayer} />
                </div>
            );
        }
        
        // This state occurs briefly before the useEffect triggers the fetch.
        return <div className="text-center p-8"><Loader className="h-8 w-8 animate-spin mx-auto text-blue-500" /><p className="mt-2">Preparing analysis for {activePayer.insurance.name}...</p></div>;
    };


    return (
        <div className="space-y-6 animate-fade-in">
            <div><h2 className="text-3xl font-bold text-gray-800">Multi-Payer Risk Intelligence Hub</h2><p className="text-sm text-gray-500">{metaData.patient.name} • DOS {formatDate(metaData.service.date)}</p></div>
            
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                    {payers.map(payer => (
                        <button key={payer.id} onClick={() => setActivePayerId(payer.id)} className={`${payer.id === activePayerId ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>
                            {payer.rank} ({payer.insurance.name})
                        </button>
                    ))}
                </nav>
            </div>
            
            <div className="mt-4 min-h-[300px]">
                {renderContent()}
            </div>

            <div className="flex justify-between items-center pt-6 mt-4 border-t border-gray-200">
                <button onClick={handleBack} className="flex items-center bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition"><ArrowLeft className="h-4 w-4 mr-1"/> Back to Eligibility</button>
                <button onClick={handleNext} className="flex items-center bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition">Proceed to Estimate <ArrowRight className="h-4 w-4 ml-1"/></button>
            </div>
        </div>
    );
};

export default RiskAnalysisPage;