
import { useState, useEffect } from 'react';
import { useEstimateDispatch } from '../context/EstimateContext';
import { fetchNpiDetailsFromApi } from '../services/geminiService';
import { isValidNpiLuhn } from '../utils/validators';
import { NpiData } from '../types';

export const useNpiVerification = (npiValue: string) => {
    const dispatch = useEstimateDispatch();
    const [npiDetails, setNpiDetails] = useState<{ loading: boolean; data: NpiData | null; error: string | null; luhnValid: boolean | null }>({ loading: false, data: null, error: null, luhnValid: null });

    useEffect(() => {
        const npi = npiValue?.trim() || '';
        if (npi.length === 10) {
            const luhnValid = isValidNpiLuhn(npi);
            const initialValidationState = { luhnValid, loading: luhnValid, data: null, error: luhnValid ? null : 'Invalid NPI checksum.' };
            setNpiDetails(prev => ({ ...prev, ...initialValidationState }));
            dispatch({ type: 'SET_NPI_VALIDATION', payload: initialValidationState });

            if (luhnValid) {
                let mounted = true;
                const handler = setTimeout(async () => {
                    const result = await fetchNpiDetailsFromApi(npi);
                    
                    const newNpiDetails = (result.success && result.data)
                        ? { loading: false, data: result.data as NpiData, error: result.data.error, luhnValid }
                        : { loading: false, data: null, error: result.error ?? 'API request failed', luhnValid };

                    if (mounted) {
                        setNpiDetails(prev => ({ ...prev, ...newNpiDetails }));
                        dispatch({ type: 'SET_NPI_VALIDATION', payload: newNpiDetails });
                        if (newNpiDetails.data && newNpiDetails.data.providerName) {
                            dispatch({ type: 'UPDATE_METADATA', payload: { section: 'provider', name: 'name', value: newNpiDetails.data.providerName } });
                        }
                    }
                }, 800);
                return () => { mounted = false; clearTimeout(handler); };
            }
        } else if (npi.length > 0) {
            const errorMsg = 'NPI must be 10 digits.';
            const errorState = { loading: false, data: null, error: errorMsg, luhnValid: false };
            setNpiDetails(errorState);
            dispatch({ type: 'SET_NPI_VALIDATION', payload: errorState });
        } else {
            const clearState = { loading: false, data: null, error: null, luhnValid: null };
            setNpiDetails(clearState);
            dispatch({ type: 'SET_NPI_VALIDATION', payload: clearState });
        }
    }, [npiValue, dispatch]);
    
    return npiDetails;
};
