

import React, { useCallback, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Info } from 'lucide-react';
import { useEstimateState, useEstimateDispatch } from '../context/EstimateContext';
import { calculateCombinedEstimate } from '../engine/adjudicationEngine';
import { fetchAiGeneratedEstimate } from '../services/geminiService';
import PatientServicePracticeSection from '../components/features/form/PatientServicePracticeSection';
import ProceduresBillingSection from '../components/features/form/ProceduresBillingSection';
import FinancialPlanningSection from '../components/features/form/FinancialPlanningSection';
import PayerBenefitTiersSection from '../components/features/form/PayerBenefitTiersSection';

const EstimateFormPage: React.FC = () => {
    const state = useEstimateState();
    const dispatch = useEstimateDispatch();
    const { payers, procedures, metaData, propensityData } = state;

    const showModal = useCallback((title: string, message: string) => {
        dispatch({ type: 'SHOW_MODAL', payload: { title, message } });
    }, [dispatch]);

    useEffect(() => {
        if (metaData.service.date) {
            procedures.forEach(p => {
                if (!p.dateOfService) {
                    dispatch({ type: 'UPDATE_PROCEDURE', payload: { id: p.id, field: 'dateOfService', value: metaData.service.date } });
                }
            });
        }
    }, [metaData.service.date, procedures, dispatch]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const errors = [];
        if (!metaData.patient.name) errors.push("Patient Name is required.");
        const activeProcedures = procedures.filter(p => p.cptCode || p.billedAmount);
        if (activeProcedures.length === 0) { errors.push("At least one procedure must be added."); }
        
        activeProcedures.forEach((proc, index) => {
            if (!proc.cptCode) { errors.push(`Procedure #${index + 1} is missing a CPT Code.`); }
            if (!proc.billedAmount) { errors.push(`Procedure ${proc.cptCode} is missing a Billed Amount.`); }
        });

        payers.forEach(payer => {
            if (!payer.insurance.name) { errors.push(`${payer.rank} Payer: An insurance plan must be selected.`); }
            activeProcedures.forEach(proc => { 
                const benefit = payer.procedureBenefits.find(pb => pb.procedureId === proc.id);
                if (!benefit || benefit.allowedAmount === '' || benefit.allowedAmount === null) { 
                    errors.push(`CPT ${proc.cptCode || `(Procedure #${procedures.findIndex(p=>p.id===proc.id)+1})`}: Missing Allowed Amount for the ${payer.rank} Payer.`); 
                } 
            });
        });

        if (errors.length > 0) {
            showModal('Missing or Invalid Information', `Please correct the following issues:\n- ${[...new Set(errors)].join('\n- ')}`);
            return;
        }

        const result = calculateCombinedEstimate(payers, activeProcedures, metaData, propensityData);
        dispatch({ type: 'SET_ESTIMATE_RESULT', payload: result });
        dispatch({ type: 'START_AI_ESTIMATE' });
        
        fetchAiGeneratedEstimate(payers, activeProcedures, metaData)
            .then(aiResult => {
                if (aiResult.success) {
                    dispatch({ type: 'SET_AI_ESTIMATE_RESULT', payload: { data: aiResult.data ?? null, error: null } });
                } else {
                    dispatch({ type: 'SET_AI_ESTIMATE_RESULT', payload: { data: null, error: aiResult.error ?? 'Unknown AI Error' } });
                }
            })
            .catch(err => {
                 dispatch({ type: 'SET_AI_ESTIMATE_RESULT', payload: { data: null, error: err.message || 'An unknown error occurred.' } });
            });
    }, [payers, procedures, metaData, propensityData, dispatch, showModal]);

    const handleBack = useCallback(() => {
        dispatch({ type: 'SET_PAGE', payload: 'risk-analysis' });
    }, [dispatch]);

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-800 p-4 rounded-lg mb-6">
                <div className="flex">
                    <div className="py-1"><Info className="h-5 w-5 mr-3"/></div>
                    <div>
                        <p className="font-bold">Ready to Calculate</p>
                        <p className="text-sm">Eligibility verified. Please complete or confirm the benefit details below and add billed amounts to generate the estimate.</p>
                    </div>
                </div>
            </div>
            <PatientServicePracticeSection />
            <ProceduresBillingSection />
            <FinancialPlanningSection />
            <PayerBenefitTiersSection />
            <div className="flex justify-between pt-4">
                <button type="button" onClick={handleBack} className="flex items-center space-x-2 bg-gray-200 text-gray-800 font-bold py-3 px-6 rounded-lg hover:bg-gray-300 transition">
                    <ArrowLeft className="h-5 w-5" /><span>Back to Risk Analysis</span>
                </button>
                <button type="submit" className="flex items-center space-x-2 bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-blue-700 transition transform hover:scale-105">
                    <span>Calculate Estimate</span><ArrowRight className="h-5 w-5" />
                </button>
            </div>
        </form>
    );
};

export default EstimateFormPage;
