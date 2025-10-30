import { useEffect, useRef } from 'react';
import { useEstimateDispatch } from '../context/EstimateContext';
import { fetchCptDetailsFromApi, fetchMedicalNecessityFromApi, fetchPayerIntelligenceFromApi, fetchPayerPolicyFromApi, fetchIcdSuggestionsFromApi } from '../services/geminiService';
import { Procedure, ApiState } from '../types';

const initialApiState: ApiState<any> = { loading: false, data: null, error: null };

export const useProcedureValidation = (procedure: Procedure, primaryPayerName: string) => {
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

    // Create a ref to hold the latest state of all validation slices.
    // This avoids stale closures in the useEffects and prevents infinite loops
    // by removing the state slices themselves from the dependency arrays.
    const validationStateRef = useRef({ authDetails, necessityDetails, payerIntel, policyDetails, icdSuggestions });
    useEffect(() => {
        validationStateRef.current = { authDetails, necessityDetails, payerIntel, policyDetails, icdSuggestions };
    });

    // Effect 1: CPT Auth Details
    useEffect(() => {
        const { authDetails: currentAuthDetails } = validationStateRef.current;
        const trimmedCpt = cptCode.trim();
        const key = trimmedCpt;

        if (trimmedCpt.length < 5) {
            if (currentAuthDetails.loading || currentAuthDetails.data || currentAuthDetails.error) {
                dispatch({ type: 'UPDATE_PROCEDURE_VALIDATION', payload: { id, field: 'authDetails', data: initialApiState } });
            }
            return;
        }

        if ((currentAuthDetails.loading || currentAuthDetails.data) && currentAuthDetails.key === key) return;

        let mounted = true;
        const handler = setTimeout(async () => {
            const result = await fetchCptDetailsFromApi(trimmedCpt);
            if (mounted) {
                const newDetails = result.success
                    ? { loading: false, data: result.data, error: null, key }
                    : { loading: false, data: null, error: result.error, key };
                dispatch({ type: 'UPDATE_PROCEDURE_VALIDATION', payload: { id, field: 'authDetails', data: newDetails } });
            }
        }, 800);
        
        dispatch({ type: 'UPDATE_PROCEDURE_VALIDATION', payload: { id, field: 'authDetails', data: { ...currentAuthDetails, loading: true, key } } });

        return () => { mounted = false; clearTimeout(handler); };
    }, [id, cptCode, dispatch]);

    // Effect 2: Payer Intel
    useEffect(() => {
        const { payerIntel: currentPayerIntel } = validationStateRef.current;
        const trimmedCpt = cptCode.trim();
        const trimmedPayer = primaryPayerName.trim();
        const key = `${trimmedCpt}-${trimmedPayer}`;

        if (!(trimmedCpt.length >= 5 && !!trimmedPayer)) {
            if (currentPayerIntel.loading || currentPayerIntel.data || currentPayerIntel.error) {
                dispatch({ type: 'UPDATE_PROCEDURE_VALIDATION', payload: { id, field: 'payerIntel', data: initialApiState } });
            }
            return;
        }

        if ((currentPayerIntel.loading || currentPayerIntel.data) && currentPayerIntel.key === key) return;

        let mounted = true;
        const handler = setTimeout(async () => {
            const result = await fetchPayerIntelligenceFromApi(trimmedPayer, trimmedCpt);
            if (mounted) {
                const newDetails = result.success
                    ? { loading: false, data: result.data, error: null, key }
                    : { loading: false, data: null, error: result.error, key };
                dispatch({ type: 'UPDATE_PROCEDURE_VALIDATION', payload: { id, field: 'payerIntel', data: newDetails } });
            }
        }, 900);
        
        dispatch({ type: 'UPDATE_PROCEDURE_VALIDATION', payload: { id, field: 'payerIntel', data: { ...currentPayerIntel, loading: true, key } } });

        return () => { mounted = false; clearTimeout(handler); };
    }, [id, cptCode, primaryPayerName, dispatch]);

    // Effect 3: Medical Necessity
    useEffect(() => {
        const { necessityDetails: currentNecessityDetails } = validationStateRef.current;
        const trimmedCpt = cptCode.trim();
        const trimmedDx = dxCode.trim();
        const trimmedPayer = primaryPayerName.trim();
        const key = `${trimmedCpt}-${trimmedDx}-${trimmedPayer || 'general'}`;
        
        if (!(trimmedCpt.length >= 5 && !!trimmedDx)) {
            if (currentNecessityDetails.loading || currentNecessityDetails.data || currentNecessityDetails.error) {
                dispatch({ type: 'UPDATE_PROCEDURE_VALIDATION', payload: { id, field: 'necessityDetails', data: initialApiState } });
            }
            return;
        }

        if ((currentNecessityDetails.loading || currentNecessityDetails.data) && currentNecessityDetails.key === key) return;

        let mounted = true;
        const handler = setTimeout(async () => {
            const result = await fetchMedicalNecessityFromApi(trimmedCpt, trimmedDx, trimmedPayer);
            if (mounted) {
                const newDetails = result.success
                    ? { loading: false, data: result.data, error: null, key }
                    : { loading: false, data: null, error: result.error, key };
                dispatch({ type: 'UPDATE_PROCEDURE_VALIDATION', payload: { id, field: 'necessityDetails', data: newDetails } });
            }
        }, 800);
        
        dispatch({ type: 'UPDATE_PROCEDURE_VALIDATION', payload: { id, field: 'necessityDetails', data: { ...currentNecessityDetails, loading: true, key } } });

        return () => { mounted = false; clearTimeout(handler); };
    }, [id, cptCode, dxCode, primaryPayerName, dispatch]);

    // Effect 4: Payer Policy
    useEffect(() => {
        const { policyDetails: currentPolicyDetails } = validationStateRef.current;
        const trimmedCpt = cptCode.trim();
        const trimmedDx = dxCode.trim();
        const trimmedPayer = primaryPayerName.trim();
        const key = `${trimmedCpt}-${trimmedDx}-${trimmedPayer}`;

        if (!(trimmedCpt.length >= 5 && !!trimmedDx && !!trimmedPayer)) {
            if (currentPolicyDetails.loading || currentPolicyDetails.data || currentPolicyDetails.error) {
                dispatch({ type: 'UPDATE_PROCEDURE_VALIDATION', payload: { id, field: 'policyDetails', data: initialApiState } });
            }
            return;
        }
        
        if ((currentPolicyDetails.loading || currentPolicyDetails.data) && currentPolicyDetails.key === key) return;
        
        let mounted = true;
        const handler = setTimeout(async () => {
            const result = await fetchPayerPolicyFromApi(trimmedCpt, trimmedDx, trimmedPayer);
            if (mounted) {
                const newDetails = result.success
                    ? { loading: false, data: result.data, error: null, key }
                    : { loading: false, data: null, error: result.error, key };
                dispatch({ type: 'UPDATE_PROCEDURE_VALIDATION', payload: { id, field: 'policyDetails', data: newDetails } });
            }
        }, 1000);
        
        dispatch({ type: 'UPDATE_PROCEDURE_VALIDATION', payload: { id, field: 'policyDetails', data: { ...currentPolicyDetails, loading: true, key } } });

        return () => { mounted = false; clearTimeout(handler); };
    }, [id, cptCode, dxCode, primaryPayerName, dispatch]);

    // Effect 5: ICD Suggestions
    useEffect(() => {
        const { icdSuggestions: currentIcdSuggestions } = validationStateRef.current;
        const trimmedCpt = cptCode.trim();
        const trimmedDx = dxCode.trim();
        const key = `${trimmedCpt}-${trimmedDx}`;
        
        if (!(trimmedCpt.length >= 5 && !!trimmedDx)) {
            if (currentIcdSuggestions.loading || currentIcdSuggestions.data || currentIcdSuggestions.error) {
                dispatch({ type: 'UPDATE_PROCEDURE_VALIDATION', payload: { id, field: 'icdSuggestions', data: initialApiState } });
            }
            return;
        }

        if ((currentIcdSuggestions.loading || currentIcdSuggestions.data) && currentIcdSuggestions.key === key) return;
        
        let mounted = true;
        const handler = setTimeout(async () => {
            const result = await fetchIcdSuggestionsFromApi(trimmedCpt, trimmedDx);
            if (mounted) {
                const newDetails = result.success
                    ? { loading: false, data: result.data, error: null, key }
                    : { loading: false, data: null, error: result.error, key };
                dispatch({ type: 'UPDATE_PROCEDURE_VALIDATION', payload: { id, field: 'icdSuggestions', data: newDetails } });
            }
        }, 1100);
        
        dispatch({ type: 'UPDATE_PROCEDURE_VALIDATION', payload: { id, field: 'icdSuggestions', data: { ...currentIcdSuggestions, loading: true, key } } });

        return () => { mounted = false; clearTimeout(handler); };
    }, [id, cptCode, dxCode, dispatch]);
};