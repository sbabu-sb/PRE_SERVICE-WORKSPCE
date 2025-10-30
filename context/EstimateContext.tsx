

import React, { createContext, useReducer, useContext, Dispatch, ReactNode } from 'react';
import { Payer, Procedure, MetaData, PropensityData, EstimateData, VerificationResult, PaymentLikelihood, NpiData, BundlingAuditData, AiEstimate, AuthSubmissionState, Benefits, Accumulators, SearchResults, SearchResultItem, PayerVerificationDetails } from '../types';
import { PayerType, CobMethod } from '../constants';

interface AppState {
    page: 'eligibility' | 'risk-analysis' | 'form' | 'results';
    estimateData: EstimateData | null;
    modal: { isOpen: boolean; title: string; message: string; };
    procedures: Procedure[];
    payers: Payer[];
    metaData: MetaData;
    propensityData: PropensityData;
    eligibilityLoading: boolean;
    verificationResult: VerificationResult | null;
    paymentLikelihood: Record<string, PaymentLikelihood>; // payerId -> likelihood
    npiValidationResult: { loading: boolean; data: NpiData | null; error: string | null; luhnValid: boolean | null; };
    aiEstimate: { loading: boolean; data: AiEstimate | null; error: string | null; };
    bundlingAudit: { loading: boolean; data: BundlingAuditData | null; error: string | null; key?: string; };
    authSubmissions: Record<string, Record<string, AuthSubmissionState>>; // payerId -> procedureId -> state
    search: {
        isOpen: boolean;
        isLoading: boolean;
        query: string;
        results: SearchResults | null;
        error: string | null;
    };
}

type Action =
    | { type: 'SET_PAGE'; payload: 'eligibility' | 'risk-analysis' | 'form' | 'results' }
    | { type: 'SHOW_MODAL'; payload: { title: string; message: string } }
    | { type: 'HIDE_MODAL' }
    | { type: 'UPDATE_METADATA'; payload: { section: keyof MetaData; name: string; value: any } }
    | { type: 'ADD_PROCEDURE' }
    | { type: 'REMOVE_PROCEDURE'; payload: { id: string } }
    | { type: 'UPDATE_PROCEDURE'; payload: { id: string; field: string; value: any } }
    | { type: 'UPDATE_PROCEDURE_VALIDATION'; payload: { id: string; field: keyof Procedure; data: any } }
    | { type: 'ADD_PAYER' }
    | { type: 'REMOVE_PAYER'; payload: { id: string } }
    | { type: 'UPDATE_PAYER_DETAIL'; payload: { id: string; field: string; value: string } }
    | { type: 'UPDATE_PAYER_TOP_LEVEL'; payload: { id: string; field: keyof Payer; value: any } }
    | { type: 'UPDATE_PAYER_ACCUM'; payload: { id: string; section: 'patientAccumulators' | 'familyAccumulators'; field: string; value: any } }
    | { type: 'UPDATE_PAYER_BENEFIT'; payload: { id: string; name: string; value: any } }
    | { type: 'UPDATE_PAYER_PROC_BENEFIT'; payload: { payerId: string; procedureId: string; name: string; value: string } }
    | { type: 'UPDATE_PROPENSITY'; payload: { name: string; value: any } }
    | { type: 'SET_NPI_VALIDATION'; payload: Partial<AppState['npiValidationResult']> }
    | { type: 'START_VERIFICATION' }
    | { type: 'SET_ELIGIBILITY_RESULT'; payload: VerificationResult }
    | { type: 'SET_LIKELIHOOD_FOR_PAYER'; payload: { payerId: string, likelihood: PaymentLikelihood } }
    | { type: 'SET_VERIFICATION_SUCCESS_DATA'; payload: Payer[] }
    | { type: 'REVERIFY_ELIGIBILITY_START'; payload: { payerId: string } }
    | { type: 'REVERIFY_ELIGIBILITY_RESULT'; payload: { payerId: string, result: Partial<PayerVerificationDetails> } }
    | { type: 'SET_ESTIMATE_RESULT'; payload: EstimateData }
    | { type: 'START_AI_ESTIMATE' }
    | { type: 'SET_AI_ESTIMATE_RESULT'; payload: { data: AiEstimate | null; error: string | null } }
    | { type: 'SET_BUNDLING_AUDIT_RESULT'; payload: Partial<AppState['bundlingAudit']> }
    | { type: 'START_AUTH_SUBMISSION_FOR_PAYER'; payload: { payerId: string; procedureId: string } }
    | { type: 'SET_AUTH_SUBMISSION_RESULT_FOR_PAYER'; payload: { payerId: string; procedureId: string, result: Partial<AuthSubmissionState> } }
    | { type: 'START_AUTH_STATUS_CHECK_FOR_PAYER'; payload: { payerId: string; procedureId: string } }
    | { type: 'SET_AUTH_STATUS_RESULT_FOR_PAYER'; payload: { payerId: string; procedureId: string, result: Partial<AuthSubmissionState> } }
    | { type: 'PREFILL_FORM'; payload: { metaData: MetaData; payers: Payer[]; procedures: Procedure[] } }
    | { type: 'RESET_FORM' }
    | { type: 'TOGGLE_SEARCH'; payload?: boolean }
    | { type: 'SET_SEARCH_STATE'; payload: Partial<AppState['search']> }
    | { type: 'APPLY_SEARCH_RESULT'; payload: SearchResultItem };

const createNewProcedure = (): Procedure => ({
    id: crypto.randomUUID(), cptCode: '', billedAmount: '', modifiers: '', dxCode: '', category: 'Medical/Surgical', units: 1,
    isPreventive: false, dateOfService: '', acuity: 'standard',
    authDetails: { loading: false, data: null, error: null },
    necessityDetails: { loading: false, data: null, error: null },
    payerIntel: { loading: false, data: null, error: null },
    policyDetails: { loading: false, data: null, error: null },
    icdSuggestions: { loading: false, data: null, error: null }
});

const defaultBenefits: Benefits = {
    planType: 'EmbeddedFamily', copayLogic: 'standard_waterfall', deductibleAllocation: 'highest_allowed_first', multiProcedureLogic: '100_50_25',
    inNetworkIndividualDeductible: '', inNetworkIndividualOopMax: '', inNetworkFamilyDeductible: '', inNetworkFamilyOopMax: '', inNetworkCoinsurancePercentage: '',
    outOfNetworkIndividualDeductible: '', outOfNetworkIndividualOopMax: '', outOfNetworkFamilyDeductible: '', outOfNetworkFamilyOopMax: '', outOfNetworkCoinsurancePercentage: '',
    therapyVisitLimits: { physical: '', occupational: '', speech: '' },
    dmeRentalCap: { applies: false, purchasePrice: '' },
};

const defaultAccumulators: Accumulators = {
    inNetworkDeductibleMet: '', inNetworkOopMet: '', outOfNetworkDeductibleMet: '',
    outOfNetworkOopMet: '',
    therapyVisitsUsed: { physical: 0, occupational: 0, speech: 0 },
    dmeRentalPaid: 0
};

const createNewPayer = (rank: 'Primary' | 'Secondary' | 'Tertiary', procedures: Procedure[]): Payer => ({
    id: crypto.randomUUID(), rank,
    insurance: { name: '', memberId: '' }, networkStatus: 'in-network',
    payerType: PayerType.Commercial,
    subrogationActive: false,
    cobMethod: CobMethod.Traditional,
    benefits: defaultBenefits,
    patientAccumulators: defaultAccumulators,
    familyAccumulators: defaultAccumulators,
    procedureBenefits: procedures.map(p => ({ procedureId: p.id, allowedAmount: '', copay: '', coinsurancePercentage: '' }))
});

const blankMetaData: MetaData = {
    patient: { name: '', dob: '', relationship: 'Self', gender: '' },
    practice: { name: '', taxId: '' },
    provider: { name: '', npi: '', phone: '' },
    service: { date: new Date().toISOString().split('T')[0], placeOfService: '11' }
};

const blankPropensityData: PropensityData = {
    paymentHistory: '',
    financialConfidence: '',
    outstandingBalance: '',
    employmentStatus: '',
    householdIncome: '',
    householdSize: '1',
    isHSACompatible: false,
};
const initialProcedures = [createNewProcedure()];
const initialAuthSubmissionState: AuthSubmissionState = { loading: false, status: null, generated278: null, authNumber: null, statusNotes: null };

const initialState: AppState = {
    page: 'eligibility', estimateData: null,
    modal: { isOpen: false, title: '', message: '' },
    procedures: initialProcedures,
    payers: [createNewPayer('Primary', initialProcedures)],
    metaData: blankMetaData, propensityData: blankPropensityData,
    eligibilityLoading: false, verificationResult: null, paymentLikelihood: {},
    npiValidationResult: { loading: false, data: null, error: null, luhnValid: null },
    aiEstimate: { loading: false, data: null, error: null },
    bundlingAudit: { loading: false, data: null, error: null },
    authSubmissions: {},
    search: { isOpen: false, isLoading: false, query: '', results: null, error: null },
};

function estimateReducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case 'SET_PAGE': return { ...state, page: action.payload };
        case 'SHOW_MODAL': return { ...state, modal: { isOpen: true, title: action.payload.title, message: action.payload.message } };
        case 'HIDE_MODAL': return { ...state, modal: { ...state.modal, isOpen: false } };
        case 'UPDATE_METADATA': {
            const { section, name, value } = action.payload;
            return { ...state, metaData: { ...state.metaData, [section]: { ...state.metaData[section], [name]: value } } };
        }
        case 'ADD_PROCEDURE': {
            const newProc = createNewProcedure();
            newProc.dateOfService = state.metaData.service.date;
            const newProcedures = [...state.procedures, newProc];

            const newPayers = state.payers.map(payer => {
                const existingBenefits = new Map(payer.procedureBenefits.map(pb => [pb.procedureId, pb]));
                const syncedBenefits = newProcedures.map(proc => {
                    return existingBenefits.get(proc.id) || {
                        procedureId: proc.id,
                        allowedAmount: '',
                        copay: '',
                        coinsurancePercentage: ''
                    };
                });
                return { ...payer, procedureBenefits: syncedBenefits };
            });

            return { ...state, procedures: newProcedures, payers: newPayers };
        }
        case 'REMOVE_PROCEDURE': {
            const { id } = action.payload;
            const newProcedures = state.procedures.filter(p => p.id !== id);
            const newPayers = state.payers.map(p => ({ ...p, procedureBenefits: p.procedureBenefits.filter(pb => pb.procedureId !== id) }));
            const newAuthSubmissions = { ...state.authSubmissions };
            // Need to iterate over payers to remove the procedureId
            Object.keys(newAuthSubmissions).forEach(payerId => {
                delete newAuthSubmissions[payerId][id];
            });
            return { ...state, procedures: newProcedures, payers: newPayers, authSubmissions: newAuthSubmissions };
        }
        case 'UPDATE_PROCEDURE': {
            const { id, field, value } = action.payload;
            return { ...state, procedures: state.procedures.map(p => p.id === id ? { ...p, [field]: value } : p) };
        }
        case 'UPDATE_PROCEDURE_VALIDATION': {
            const { id, field, data } = action.payload;
            return { ...state, procedures: state.procedures.map(p => p.id === id ? { ...p, [field]: data } : p) };
        }
        case 'ADD_PAYER': {
            if (state.payers.length >= 3) return state;
            const rank = state.payers.length === 1 ? 'Secondary' : 'Tertiary';
            const newPayer = createNewPayer(rank, state.procedures);
            return { ...state, payers: [...state.payers, newPayer] };
        }
        case 'REMOVE_PAYER': {
            const { id } = action.payload;
            const newPayers = state.payers.filter(p => p.id !== id).map((p, index) => ({
                ...p, rank: (index === 0 ? 'Primary' : (index === 1 ? 'Secondary' : 'Tertiary')) as 'Primary' | 'Secondary' | 'Tertiary'
            }));
             const newAuthSubmissions = { ...state.authSubmissions };
             delete newAuthSubmissions[id];
             const newPaymentLikelihood = { ...state.paymentLikelihood };
             delete newPaymentLikelihood[id];
            return { ...state, payers: newPayers, authSubmissions: newAuthSubmissions, paymentLikelihood: newPaymentLikelihood };
        }
        case 'UPDATE_PAYER_DETAIL': {
            const { id, field, value } = action.payload;
            return { ...state, payers: state.payers.map(p => p.id === id ? { ...p, insurance: { ...p.insurance, [field]: value } } : p) };
        }
        case 'UPDATE_PAYER_TOP_LEVEL': {
            const { id, field, value } = action.payload;
            let finalValue = value;
            if (field === 'subrogationActive') {
                finalValue = typeof value === 'boolean' ? value : (value as HTMLInputElement).checked;
            }
            return { ...state, payers: state.payers.map(p => p.id === id ? { ...p, [field]: finalValue } : p) };
        }
        case 'UPDATE_PAYER_ACCUM': {
            const { id, section, field, value } = action.payload;
            return { ...state, payers: state.payers.map(p => p.id === id ? { ...p, [section]: { ...p[section]!, [field]: value } } : p) };
        }
        case 'UPDATE_PAYER_BENEFIT': {
            const { id, name, value } = action.payload;
             return { ...state, payers: state.payers.map(p => {
                if (p.id !== id) return p;

                let newBenefits = { ...p.benefits };

                if (name.startsWith('therapyVisitLimits.')) {
                    const key = name.split('.')[1] as keyof Benefits['therapyVisitLimits'];
                    newBenefits.therapyVisitLimits = { ...newBenefits.therapyVisitLimits, [key]: value };
                } else if (name.startsWith('dmeRentalCap.')) {
                    const key = name.split('.')[1] as keyof Benefits['dmeRentalCap'];
                    const finalValue = typeof value === 'boolean' ? value : (value as any).checked ?? value;
                    newBenefits.dmeRentalCap = { ...newBenefits.dmeRentalCap, [key]: finalValue };
                } else {
                    (newBenefits as any)[name] = value;
                }

                let newPatientAcc = p.patientAccumulators;
                let newFamilyAcc = p.familyAccumulators;
                if (name === 'planType') {
                    if (value === 'Individual') {
                        newBenefits.inNetworkFamilyDeductible = ''; newBenefits.inNetworkFamilyOopMax = '';
                        newBenefits.outOfNetworkFamilyDeductible = ''; newBenefits.outOfNetworkFamilyOopMax = '';
                        newFamilyAcc = { ...defaultAccumulators };
                    }
                    if (value === 'AggregateFamily') {
                        newBenefits.inNetworkIndividualDeductible = ''; newBenefits.inNetworkIndividualOopMax = '';
                        newBenefits.outOfNetworkIndividualDeductible = ''; newBenefits.outOfNetworkIndividualOopMax = '';
                        newPatientAcc = { ...defaultAccumulators };
                    }
                }
                return { ...p, benefits: newBenefits, patientAccumulators: newPatientAcc, familyAccumulators: newFamilyAcc };
            })};
        }
        case 'UPDATE_PAYER_PROC_BENEFIT': {
            const { payerId, procedureId, name, value } = action.payload;
            return { ...state, payers: state.payers.map(p => p.id === payerId ? { ...p, procedureBenefits: p.procedureBenefits.map(pb => pb.procedureId === procedureId ? { ...pb, [name]: value } : pb) } : p) };
        }
        case 'UPDATE_PROPENSITY': {
            const { name, value } = action.payload;
            return { ...state, propensityData: { ...state.propensityData, [name]: value } };
        }
        case 'SET_NPI_VALIDATION': return { ...state, npiValidationResult: { ...state.npiValidationResult, ...action.payload } };
        case 'START_VERIFICATION': return { ...state, eligibilityLoading: true, verificationResult: null, paymentLikelihood: {}, authSubmissions: {} };
        case 'SET_ELIGIBILITY_RESULT': return { ...state, eligibilityLoading: false, verificationResult: action.payload };
        case 'SET_LIKELIHOOD_FOR_PAYER': return { ...state, paymentLikelihood: { ...state.paymentLikelihood, [action.payload.payerId]: action.payload.likelihood } };
        case 'SET_VERIFICATION_SUCCESS_DATA': return { ...state, payers: action.payload };
        case 'REVERIFY_ELIGIBILITY_START': {
            const { payerId } = action.payload;
            if (!state.verificationResult) return state;
            const newPayerVerifications = { ...state.verificationResult.payerVerifications };
            if (newPayerVerifications[payerId]) {
                newPayerVerifications[payerId] = { ...newPayerVerifications[payerId], reVerifying: true };
            }
            return { ...state, verificationResult: { ...state.verificationResult, payerVerifications: newPayerVerifications } };
        }
        case 'REVERIFY_ELIGIBILITY_RESULT': {
            const { payerId, result } = action.payload;
            if (!state.verificationResult) return state;
            const newPayerVerifications = { ...state.verificationResult.payerVerifications };
            if (newPayerVerifications[payerId]) {
                newPayerVerifications[payerId] = { ...newPayerVerifications[payerId], ...result, reVerifying: false };
            }
            const overallStatus = result.edi271Response?.includes('ACTIVE') ? 'Active' : 'Inactive';
            const eligibilityNotes = `Re-verified: ${overallStatus} for ${state.payers.find(p=>p.id===payerId)?.insurance.name}.`;
            return { ...state, verificationResult: { ...state.verificationResult, payerVerifications: newPayerVerifications, overallEligibilityStatus: overallStatus, eligibilityNotes } };
        }
        case 'SET_ESTIMATE_RESULT': return { ...state, estimateData: action.payload, page: 'results' };
        case 'START_AI_ESTIMATE': return { ...state, aiEstimate: { loading: true, data: null, error: null } };
        case 'SET_AI_ESTIMATE_RESULT': return { ...state, aiEstimate: { loading: false, data: action.payload.data, error: action.payload.error } };
        case 'SET_BUNDLING_AUDIT_RESULT': return { ...state, bundlingAudit: {...state.bundlingAudit, ...action.payload} };
        case 'START_AUTH_SUBMISSION_FOR_PAYER': {
            const { payerId, procedureId } = action.payload;
            const payerSubmissions = state.authSubmissions[payerId] || {};
            const submission = payerSubmissions[procedureId] || initialAuthSubmissionState;
            // Fix: Explicitly type the new submission state to guide TypeScript's inference.
            const newSubmission: AuthSubmissionState = { ...submission, loading: true, status: 'Pending' };
            const newPayerSubmissions = { ...payerSubmissions, [procedureId]: newSubmission };
            return { ...state, authSubmissions: { ...state.authSubmissions, [payerId]: newPayerSubmissions } };
        }
        case 'SET_AUTH_SUBMISSION_RESULT_FOR_PAYER': {
            const { payerId, procedureId, result } = action.payload;
            const payerSubmissions = state.authSubmissions[payerId] || {};
            const submission = payerSubmissions[procedureId] || initialAuthSubmissionState;
            const updatedSubmission: AuthSubmissionState = { ...submission, ...result, loading: false };
            const newPayerSubmissions = { ...payerSubmissions, [procedureId]: updatedSubmission };
            return { ...state, authSubmissions: { ...state.authSubmissions, [payerId]: newPayerSubmissions } };
        }
        case 'START_AUTH_STATUS_CHECK_FOR_PAYER': {
            const { payerId, procedureId } = action.payload;
            const payerSubmissions = state.authSubmissions[payerId] || {};
            const submission = payerSubmissions[procedureId] || initialAuthSubmissionState;
            const newPayerSubmissions = { ...payerSubmissions, [procedureId]: { ...submission, loading: true } };
            return { ...state, authSubmissions: { ...state.authSubmissions, [payerId]: newPayerSubmissions } };
        }
        case 'SET_AUTH_STATUS_RESULT_FOR_PAYER': {
            const { payerId, procedureId, result } = action.payload;
            const payerSubmissions = state.authSubmissions[payerId] || {};
            const submission = payerSubmissions[procedureId] || initialAuthSubmissionState;
            const updatedSubmission: AuthSubmissionState = { ...submission, ...result, loading: false };
            const newPayerSubmissions = { ...payerSubmissions, [procedureId]: updatedSubmission };
            return { ...state, authSubmissions: { ...state.authSubmissions, [payerId]: newPayerSubmissions } };
        }
        case 'PREFILL_FORM':
            return {
                ...state,
                metaData: action.payload.metaData,
                payers: action.payload.payers,
                procedures: action.payload.procedures,
                verificationResult: null,
                paymentLikelihood: {},
                npiValidationResult: { loading: false, data: null, error: null, luhnValid: null },
                aiEstimate: { loading: false, data: null, error: null },
                bundlingAudit: { loading: false, data: null, error: null },
                authSubmissions: {},
            };
        case 'RESET_FORM': {
            const newProcs = [createNewProcedure()];
            return { ...initialState, procedures: newProcs, payers: [createNewPayer('Primary', newProcs)], propensityData: blankPropensityData, aiEstimate: { loading: false, data: null, error: null }, bundlingAudit: { loading: false, data: null, error: null }, authSubmissions: {} };
        }
        case 'TOGGLE_SEARCH':
            return { ...state, search: { ...state.search, isOpen: action.payload ?? !state.search.isOpen } };
        case 'SET_SEARCH_STATE':
            return { ...state, search: { ...state.search, ...action.payload } };
        case 'APPLY_SEARCH_RESULT': {
            const item = action.payload;
            let newProcedures = [...state.procedures];
            let newPayers = [...state.payers];
            let page = state.page;

            if (page !== 'eligibility' && page !== 'form') {
                page = 'eligibility';
            }

            switch (item.type) {
                case 'CPT': {
                    const emptyProc = newProcedures.find(p => !p.cptCode);
                    if (emptyProc) {
                        newProcedures = newProcedures.map(p => p.id === emptyProc.id ? { ...p, cptCode: item.code } : p);
                    } else {
                        const newProc = createNewProcedure();
                        newProc.cptCode = item.code;
                        newProcedures.push(newProc);
                    }
                    break;
                }
                case 'ICD-10': {
                    const firstProcWithoutDx = newProcedures.find(p => p.cptCode && !p.dxCode);
                    if (firstProcWithoutDx) {
                        newProcedures = newProcedures.map(p => p.id === firstProcWithoutDx.id ? { ...p, dxCode: item.code } : p);
                    } else if (newProcedures.length > 0) {
                        newProcedures[0] = { ...newProcedures[0], dxCode: item.code };
                    }
                    break;
                }
                case 'Payer': {
                    if (newPayers.length > 0) {
                        newPayers[0] = { ...newPayers[0], insurance: { ...newPayers[0].insurance, name: item.code } };
                    }
                    break;
                }
            }
             return { ...state, procedures: newProcedures, payers: newPayers, page, search: { ...state.search, isOpen: false } };
        }
        default: return state;
    }
}

const EstimateStateContext = createContext<AppState | undefined>(undefined);
const EstimateDispatchContext = createContext<Dispatch<Action> | undefined>(undefined);

export const EstimateProvider: React.FC<{children: ReactNode}> = ({ children }) => {
    const [state, dispatch] = useReducer(estimateReducer, initialState);
    return (
        <EstimateStateContext.Provider value={state}>
            <EstimateDispatchContext.Provider value={dispatch}>
                {children}
            </EstimateDispatchContext.Provider>
        </EstimateStateContext.Provider>
    );
};

export const useEstimateState = (): AppState => {
    const context = useContext(EstimateStateContext);
    if (context === undefined) {
        throw new Error('useEstimateState must be used within a EstimateProvider');
    }
    return context;
};

export const useEstimateDispatch = (): Dispatch<Action> => {
    const context = useContext(EstimateDispatchContext);
    if (context === undefined) {
        throw new Error('useEstimateDispatch must be used within a EstimateProvider');
    }
    return context;
};
