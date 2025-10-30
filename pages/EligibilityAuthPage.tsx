import React, { useCallback } from 'react';
import { ShieldCheck, XCircle, ArrowRight, AlertTriangle, Percent, Loader, Wand2, ListChecks, FileText } from 'lucide-react';
import { useEstimateState, useEstimateDispatch } from '../context/EstimateContext';
import { runEligibilityAndAuthLogic } from '../services/eligibilityService';
import { fetchClaimPaymentLikelihood } from '../services/geminiService';
import PatientInsuranceSection from '../components/features/eligibility/PatientInsuranceSection';
import ServiceProviderSection from '../components/features/eligibility/ServiceProviderSection';
import ProceduresVerificationSection from '../components/features/eligibility/ProceduresVerificationSection';
import { generateRandomBenefits } from '../utils/generators';
import { PaymentLikelihood, VerificationResult, Procedure, Payer, MetaData, Benefits, Accumulators } from '../types';
import { PayerType, CobMethod } from '../constants';

const VerificationResults: React.FC = () => {
    const { verificationResult, paymentLikelihood, payers, procedures, bundlingAudit } = useEstimateState();
    const dispatch = useEstimateDispatch();
    
    const showModal = useCallback((title: string, message: string) => {
        dispatch({ type: 'SHOW_MODAL', payload: { title, message } });
    }, [dispatch]);
    
    const primaryPayer = payers[0];
    const primaryLikelihood = primaryPayer ? paymentLikelihood[primaryPayer.id] : null;
    const likelihoodLoading = !primaryLikelihood && !!verificationResult;
    
    const proceedToRiskAnalysis = useCallback(() => {
        if (bundlingAudit.data?.hasIssues) {
            showModal('Coding Issues Found', 'The automated audit found NCCI bundling conflicts with the CPT codes. Please review and correct the procedures, or add appropriate modifiers on the next page.');
        }

        const updatedPayers = payers.map(payer => {
            const benefitsArePopulated = payer.benefits.inNetworkIndividualDeductible !== '';
            if (benefitsArePopulated) return payer;
            
            const randomData = generateRandomBenefits(procedures);
            return { ...payer,
                benefits: { ...payer.benefits, ...randomData.benefits },
                patientAccumulators: { ...payer.patientAccumulators, ...randomData.patientAccumulators },
                familyAccumulators: payer.familyAccumulators ? { ...payer.familyAccumulators, ...randomData.familyAccumulators } : null,
                procedureBenefits: randomData.procedureBenefits
            };
        });
        
        dispatch({ type: 'SET_VERIFICATION_SUCCESS_DATA', payload: updatedPayers });
        dispatch({ type: 'SET_PAGE', payload: 'risk-analysis' });

    }, [payers, procedures, bundlingAudit, dispatch, showModal]);

    if (!verificationResult) return null;
    
    const likelihoodData = primaryLikelihood;
    const likelihoodStyles = {
        "High": { border: 'border-green-500', text: 'text-green-700', bg: 'bg-green-50', progress: 'bg-green-500' }, "Medium": { border: 'border-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50', progress: 'bg-yellow-500' }, "Low": { border: 'border-orange-500', text: 'text-orange-700', bg: 'bg-orange-50', progress: 'bg-orange-500' }, "Very Low": { border: 'border-red-500', text: 'text-red-700', bg: 'bg-red-50', progress: 'bg-red-500' },
    };
    const likelihoodMap: Record<string, number> = { "High": 90, "Medium": 60, "Low": 30, "Very Low": 10 };
    const currentLikelihoodStyle = likelihoodData?.likelihood ? likelihoodStyles[likelihoodData.likelihood] : null;
    const currentLikelihoodValue = likelihoodData?.likelihood ? likelihoodMap[likelihoodData.likelihood] : 0;
    
    const overallStatusStyle = verificationResult.overallEligibilityStatus === 'Active' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-red-50 border-red-500 text-red-700';

    return (
        <div className="mt-8 animate-fade-in space-y-6">
            <h3 className="text-2xl font-bold text-gray-800 text-center">Verification Complete</h3>
            
            <div className={`p-4 rounded-xl text-center border-l-4 ${overallStatusStyle}`}>
                <h4 className="font-bold text-lg">Overall Status: {verificationResult.overallEligibilityStatus}</h4>
                <p className="text-sm">{verificationResult.eligibilityNotes}</p>
            </div>

            {likelihoodLoading ? ( <div className="p-6 rounded-xl bg-white text-center border"><Loader className="h-6 w-6 animate-spin mx-auto text-blue-500" /><p className="text-gray-600 mt-2 text-sm">Predicting Payment Likelihood for Primary Payer...</p></div>
            ) : likelihoodData?.error ? (
                <div className="p-4 rounded-xl border-l-4 border-red-500 bg-red-50"><h4 className="font-bold flex items-center text-red-700"><AlertTriangle className="mr-2"/> Prediction Error</h4><p className="text-sm text-red-600 mt-1">{likelihoodData.error}</p></div>
            ) : likelihoodData && currentLikelihoodStyle ? (
                <div className={`p-6 rounded-xl border-l-4 ${currentLikelihoodStyle.border} ${currentLikelihoodStyle.bg}`}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                        <div className="md:col-span-1"><h4 className="font-bold flex items-center text-gray-800"><Percent className={`${currentLikelihoodStyle.text} mr-2`}/>Payment Likelihood (Primary)</h4><p className={`text-2xl font-extrabold mt-2 ${currentLikelihoodStyle.text}`}>{likelihoodData.likelihood}</p><div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden mt-2"><div className={`h-full rounded-full ${currentLikelihoodStyle.progress}`} style={{ width: `${currentLikelihoodValue}%` }} /></div><p className="text-xs text-gray-500 mt-1">AI Confidence: {likelihoodData.confidence}</p></div>
                        <div className="md:col-span-2 space-y-3"><div><p className="font-semibold flex items-center text-sm text-gray-800"><ListChecks className="h-4 w-4 mr-2"/>Key Risk Factors:</p><ul className="list-disc list-inside pl-5 mt-1 text-sm text-gray-700 space-y-0.5">{likelihoodData.keyFactors?.map((factor) => <li key={factor.id}>{factor.text}</li>) || <li>N/A</li>}</ul></div><div><p className="font-semibold flex items-center text-sm text-gray-800"><FileText className="h-4 w-4 mr-2"/>AI Recommendation:</p><p className="mt-1 text-sm text-gray-700">{likelihoodData.recommendation || 'N/A'}</p></div></div>
                    </div>
                </div>
            ) : null}

            <div className="flex justify-center pt-6 border-t">
                <button 
                    onClick={proceedToRiskAnalysis} 
                    disabled={verificationResult.overallEligibilityStatus !== 'Active'} 
                    className="flex items-center space-x-2 bg-slate-600 text-white font-semibold py-2 px-5 rounded-lg shadow hover:bg-slate-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed" 
                    title={verificationResult.overallEligibilityStatus !== 'Active' ? 'Patient is not eligible.' : 'Analyze denial risks and manage authorizations'}>
                        <span>Analyze Risks &amp; Proceed</span>
                        <ArrowRight className="h-5 w-5"/>
                </button>
            </div>
        </div>
    );
};

const EligibilityAuthPage: React.FC = () => {
    const state = useEstimateState();
    const dispatch = useEstimateDispatch();
    const { payers, procedures, metaData, npiValidationResult, eligibilityLoading, bundlingAudit, verificationResult } = state;
    const isLoading = eligibilityLoading;

    const showModal = useCallback((title: string, message: string) => {
        dispatch({ type: 'SHOW_MODAL', payload: { title, message } });
    }, [dispatch]);

    const handleReset = useCallback(() => { dispatch({ type: 'RESET_FORM' }); }, [dispatch]);

    const handlePrefill = useCallback(() => {
        const today = new Date().toISOString().split('T')[0];
        const prefillProcedures: Procedure[] = [
            { id: crypto.randomUUID(), cptCode: '27447', billedAmount: '32000', modifiers: 'RT', dxCode: 'M17.11', category: 'Surgery', units: 1, isPreventive: false, dateOfService: today, acuity: 'elective', authDetails: { loading: false, data: null, error: null }, necessityDetails: { loading: false, data: null, error: null }, payerIntel: { loading: false, data: null, error: null }, policyDetails: { loading: false, data: null, error: null }, icdSuggestions: { loading: false, data: null, error: null } },
            { id: crypto.randomUUID(), cptCode: '71250', billedAmount: '850', modifiers: '', dxCode: 'S62.60XA', category: 'Imaging', units: 1, isPreventive: false, dateOfService: today, acuity: 'urgent', authDetails: { loading: false, data: null, error: null }, necessityDetails: { loading: false, data: null, error: null }, payerIntel: { loading: false, data: null, error: null }, policyDetails: { loading: false, data: null, error: null }, icdSuggestions: { loading: false, data: null, error: null } }
        ];
        const defaultBenefits: Benefits = { planType: 'EmbeddedFamily', copayLogic: 'standard_waterfall', deductibleAllocation: 'highest_allowed_first', multiProcedureLogic: '100_50_25', inNetworkIndividualDeductible: '', inNetworkIndividualOopMax: '', inNetworkFamilyDeductible: '', inNetworkFamilyOopMax: '', inNetworkCoinsurancePercentage: '', outOfNetworkIndividualDeductible: '', outOfNetworkIndividualOopMax: '', outOfNetworkFamilyDeductible: '', outOfNetworkFamilyOopMax: '', outOfNetworkCoinsurancePercentage: '', therapyVisitLimits: { physical: '', occupational: '', speech: '' }, dmeRentalCap: { applies: false, purchasePrice: '' } };
        const defaultAcc: Accumulators = { inNetworkDeductibleMet: '', inNetworkOopMet: '', outOfNetworkDeductibleMet: '', outOfNetworkOopMet: '', therapyVisitsUsed: { physical: 0, occupational: 0, speech: 0 }, dmeRentalPaid: 0 };
        const prefillPayers: Payer[] = [
            { id: crypto.randomUUID(), rank: 'Primary', insurance: { name: 'Aetna', memberId: 'W123456789' }, networkStatus: 'in-network', payerType: PayerType.Commercial, subrogationActive: false, cobMethod: CobMethod.Traditional, benefits: defaultBenefits, patientAccumulators: defaultAcc, familyAccumulators: defaultAcc, procedureBenefits: prefillProcedures.map(p => ({ procedureId: p.id, allowedAmount: '', copay: '', coinsurancePercentage: '' })) },
            { id: crypto.randomUUID(), rank: 'Secondary', insurance: { name: 'Medicaid', memberId: 'W987654321' }, networkStatus: 'in-network', payerType: PayerType.Medicaid, subrogationActive: false, cobMethod: CobMethod.MedicaidPayerLastResort, benefits: defaultBenefits, patientAccumulators: defaultAcc, familyAccumulators: defaultAcc, procedureBenefits: prefillProcedures.map(p => ({ procedureId: p.id, allowedAmount: '', copay: '', coinsurancePercentage: '' })) },
        ];
        const prefillMetaData: MetaData = { patient: { name: 'John A. Appleseed', dob: '1985-05-15', relationship: 'Self', gender: 'Male' }, practice: { name: 'General Medical Clinic', taxId: '123456789' }, provider: { name: 'Dr. Emily Carter', npi: '1234567893', phone: '(555) 555-5555' }, service: { date: '2025-10-27', placeOfService: '22' } };
        dispatch({ type: 'PREFILL_FORM', payload: { metaData: prefillMetaData, payers: prefillPayers, procedures: prefillProcedures } });
    }, [dispatch]);

    const handleVerification = useCallback(async (e: React.MouseEvent) => {
        e.preventDefault();
        
        if (!npiValidationResult.data || !npiValidationResult.data.isValid) {
            showModal('Invalid Provider NPI', 'Please provide a valid and verified NPI before proceeding with eligibility checks.');
            return; 
        }

        dispatch({ type: 'START_VERIFICATION' });
        try {
            const eligResult = await runEligibilityAndAuthLogic({ metaData, payers, procedures });
            dispatch({ type: 'SET_ELIGIBILITY_RESULT', payload: eligResult });
            const primaryPayer = payers.find(p => p.rank === 'Primary');
            if (eligResult.overallEligibilityStatus === 'Active' && npiValidationResult.data && primaryPayer) {
                const likelihoodResult = await fetchClaimPaymentLikelihood(procedures, primaryPayer, npiValidationResult.data, eligResult, []);
                if (likelihoodResult.success && likelihoodResult.data) {
                    dispatch({ type: 'SET_LIKELIHOOD_FOR_PAYER', payload: { payerId: primaryPayer.id, likelihood: likelihoodResult.data } });
                } else {
                    dispatch({ type: 'SET_LIKELIHOOD_FOR_PAYER', payload: { payerId: primaryPayer.id, likelihood: { error: likelihoodResult.error || "Failed to predict payment likelihood." } as PaymentLikelihood } });
                }
            } else if (!npiValidationResult.data || !primaryPayer) {
                dispatch({ type: 'SET_LIKELIHOOD_FOR_PAYER', payload: { payerId: primaryPayer?.id || 'unknown', likelihood: { error: "NPI details or primary payer not available." } as PaymentLikelihood } });
            } else {
                dispatch({ type: 'SET_LIKELIHOOD_FOR_PAYER', payload: { payerId: primaryPayer.id, likelihood: { error: "Eligibility check failed." } as PaymentLikelihood } });
            }
        } catch (error: any) {
            console.error("An unexpected error occurred during verification:", error);
            const errorMessage = error?.message || "An unexpected error occurred.";
            dispatch({ type: 'SET_ELIGIBILITY_RESULT', payload: { overallEligibilityStatus: 'Error', eligibilityNotes: `Error: ${errorMessage}`, payerVerifications: {}, authRequiredForAnyPayer: false } as VerificationResult });
            const primaryPayerId = payers[0]?.id || 'unknown';
            dispatch({ type: 'SET_LIKELIHOOD_FOR_PAYER', payload: { payerId: primaryPayerId, likelihood: { error: errorMessage } as PaymentLikelihood } });
        }
    }, [metaData, payers, procedures, npiValidationResult, bundlingAudit, dispatch, showModal]);
    
    return (
        <div className="space-y-6">
            <div className="flex justify-end mb-4 space-x-2">
                <button type="button" onClick={handlePrefill} className="flex items-center space-x-2 text-sm bg-yellow-400 text-yellow-900 font-semibold py-2 px-4 rounded-lg hover:bg-yellow-500 transition">
                    <Wand2 className="h-4 w-4" /><span>Prefill Test Data</span>
                </button>
                <button type="button" onClick={handleReset} className="flex items-center space-x-2 text-sm bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition">
                    <XCircle className="h-4 w-4" /><span>Clear Form</span>
                </button>
            </div>
            
            <fieldset disabled={isLoading} className={`space-y-6 transition-opacity ${isLoading ? 'opacity-60' : 'opacity-100'}`}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <PatientInsuranceSection />
                    <ServiceProviderSection />
                </div>
                <ProceduresVerificationSection procedures={procedures} primaryPayerName={payers[0]?.insurance.name || ''} bundlingAudit={bundlingAudit} metaData={metaData} />
                <div className="flex justify-center pt-4">
                    <button type="button" onClick={handleVerification} disabled={isLoading || npiValidationResult.loading || bundlingAudit.loading} className="flex items-center space-x-2 bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-blue-700 transition transform hover:scale-105 disabled:bg-gray-400">
                        {isLoading ? <Loader className="h-5 w-5 animate-spin"/> : <ShieldCheck className="h-5 w-5" />}
                        <span>{isLoading ? 'Verifying...' : 'Verify Eligibility & Predict Likelihood'}</span>
                    </button>
                </div>
            </fieldset>

            {/* Results Section (conditionally rendered below form) */}
            <div className="mt-8">
                {isLoading && (
                    <div className="p-6 rounded-xl bg-white text-center border animate-pulse">
                         <div className="flex items-center justify-center">
                            <Loader className="h-8 w-8 animate-spin text-blue-500" />
                            <p className="text-gray-600 ml-3 text-lg font-semibold">Verifying Eligibility & Predicting Auth Needs...</p>
                         </div>
                    </div>
                )}
                {!isLoading && verificationResult && <VerificationResults />}
            </div>
        </div>
    );
};

export default EligibilityAuthPage;