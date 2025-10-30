import { MetaData, Payer, Procedure, VerificationResult, PayerVerificationDetails } from "../types";
import { formatDate } from "../utils/formatters";
import { generateDummy270, generateDummy271 } from "../utils/generators";
import { predictAuthorizationRequirements } from "./geminiService";

export const runEligibilityAndAuthLogic = async (data: { metaData: MetaData, payers: Payer[], procedures: Procedure[] }): Promise<VerificationResult> => {
    const { metaData, payers, procedures } = data;
    const { patient, service } = metaData;

    // Overall Eligibility is determined primarily by the Primary payer
    const primaryPayer = payers[0];
    let overallEligibilityStatus: 'Active' | 'Inactive' | 'Error' = 'Active';
    let eligibilityNotes = `Coverage confirmed for ${patient.name} (${patient.relationship}) with ${primaryPayer.insurance.name} for DOS ${formatDate(service.date)}.`;

    if (primaryPayer.insurance.memberId?.toLowerCase().includes('inactive')) {
        overallEligibilityStatus = 'Inactive';
        eligibilityNotes = `Primary coverage for member ID ${primaryPayer.insurance.memberId} appears to be inactive. Please verify with the payer.`;
    }

    const payerVerifications: Record<string, PayerVerificationDetails> = {};
    let authRequiredForAnyPayer = false;

    // Use a sequential for...of loop to process payers in order, building context.
    // This is a deliberate change from parallel processing to enable COB-aware AI checks.
    for (const [index, payer] of payers.entries()) {
        const isPayerActive = !payer.insurance.memberId?.toLowerCase().includes('inactive');
        const edi270 = generateDummy270(metaData, payer);
        const edi271 = generateDummy271(metaData, payer, isPayerActive);

        let authStatus: 'Required' | 'Not Required' | 'Not Checked' = 'Not Checked';
        let authPredictionReasoning = 'AI check not performed.';
        let authPredictionConfidence: 'High' | 'Medium' | 'Low' | null = null;
        
        // Get all payers that came before the current one in the list.
        const previousPayers = payers.slice(0, index);

        // Call the AI service with the full context (current payer + all previous payers).
        const authPredictionResult = await predictAuthorizationRequirements(procedures, payer, service.placeOfService, previousPayers);

        if (authPredictionResult.success && authPredictionResult.data) {
            const { authRequired, confidence, reasoning } = authPredictionResult.data;
            authStatus = authRequired ? 'Required' : 'Not Required';
            authPredictionReasoning = reasoning;
            authPredictionConfidence = confidence;
            if (authRequired) {
                authRequiredForAnyPayer = true;
            }
        } else {
            // Handle cases where the AI call fails
            authStatus = 'Not Checked';
            authPredictionReasoning = `AI Error: ${authPredictionResult.error || 'Unknown error'}`;
        }
        
        payerVerifications[payer.id] = {
            payerId: payer.id,
            authStatus,
            authPredictionReasoning,
            authPredictionConfidence,
            edi270Submitted: edi270,
            edi271Response: edi271,
        };
    }
    
    return {
        overallEligibilityStatus,
        eligibilityNotes,
        payerVerifications,
        authRequiredForAnyPayer,
    };
};