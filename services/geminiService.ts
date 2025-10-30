import { GoogleGenAI, Type } from "@google/genai";
import { EstimateData, AiEstimate, Procedure, Payer, MetaData, VerificationResult, PaymentLikelihood, NpiData, BundlingAuditData, NecessityDetails, SearchResults, RiskFactor } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function generateJson<T,>(
    prompt: string, 
    systemInstruction: string, 
    responseSchema: object,
    modelName: string = 'gemini-2.5-flash',
    enableThinking: boolean = false,
    maxRetries: number = 3,
    initialDelay: number = 1000
): Promise<{ success: boolean; data?: T; error?: string }> {
    let attempt = 0;
    let delay = initialDelay;

    while (attempt < maxRetries) {
        try {
            const config: any = { // Use 'any' to dynamically add properties
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            };

            if (enableThinking && modelName.includes('pro')) {
                config.thinkingConfig = { thinkingBudget: 32768 };
            }

            const response = await ai.models.generateContent({
                model: modelName,
                contents: prompt,
                config: config
            });

            const jsonText = response.text;
            if (!jsonText) {
                // This isn't a retryable error, so fail fast.
                return { success: false, error: "Received an empty response from the AI." };
            }
            const data = JSON.parse(jsonText) as T;
            return { success: true, data }; // Success, exit loop

        } catch (error: any) {
            const fullErrorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Error fetching from Gemini API (Attempt ${attempt + 1}/${maxRetries}):`, fullErrorMessage);

            // Check if it's a rate limit error (429)
            const isRateLimitError = fullErrorMessage.includes('429') || fullErrorMessage.includes('RESOURCE_EXHAUSTED');

            if (isRateLimitError && attempt < maxRetries - 1) {
                console.log(`Rate limit exceeded. Retrying in ${delay / 1000}s...`);
                await sleep(delay + Math.random() * 500); // Add jitter to prevent thundering herd
                delay *= 2; // Exponential backoff
                attempt++;
            } else {
                // For non-rate-limit errors or if max retries are reached
                let finalError = "An unknown error occurred while contacting the AI service.";
                try {
                    // Try to parse the error for a cleaner message for the user
                    const parsed = JSON.parse(fullErrorMessage);
                    finalError = parsed?.error?.message || fullErrorMessage;
                } catch (e) {
                    finalError = fullErrorMessage;
                }
                return { success: false, error: finalError };
            }
        }
    }
    
    return { success: false, error: `API call failed after ${maxRetries} attempts.` };
}

export const predictAuthorizationRequirements = async (
    procedures: Procedure[], 
    currentPayer: Payer, 
    servicePlace: string, 
    previousPayers: Payer[]
) => {
    const systemPrompt = `You are a world-class utilization management AI specialist for a US healthcare provider. Your task is to analyze a set of procedures and a specific payer's context within a Coordination of Benefits (COB) sequence to predict if that specific payer requires a separate prior authorization. Your response MUST be a valid JSON object matching the provided schema. Base your decision on the CPT code's nature, the current payer's type, the Place of Service, and the identity of any preceding payers.`;

    let userQuery = `Procedures: ${JSON.stringify(procedures.map(p => ({ cpt: p.cptCode, dx: p.dxCode })))}, Place of Service: ${servicePlace}.`;

    if (previousPayers.length === 0) {
        userQuery += ` You are the Primary Payer: ${currentPayer.insurance.name} (Type: ${currentPayer.payerType}). Do you require prior authorization?`;
    } else {
        const previousPayerDescriptions = previousPayers.map((p, i) => `${i === 0 ? 'Primary' : 'Secondary'} Payer is ${p.insurance.name}`).join('; ');
        userQuery += ` The preceding payer(s) are: ${previousPayerDescriptions}. You are the ${currentPayer.rank} Payer: ${currentPayer.insurance.name} (Type: ${currentPayer.payerType}). Given the prior coverage, do you require a separate authorization?`;
    }
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            authRequired: { type: Type.BOOLEAN, description: "Is prior authorization required for any of these procedures FROM THIS SPECIFIC PAYER?" },
            confidence: { type: Type.STRING, description: "Your confidence in this prediction: 'High', 'Medium', or 'Low'." },
            reasoning: { type: Type.STRING, description: "A concise, single-sentence explanation for your decision, acknowledging COB context if relevant." },
        }
    };
    return generateJson<{authRequired: boolean; confidence: 'High' | 'Medium' | 'Low'; reasoning: string}>(userQuery, systemPrompt, schema, 'gemini-2.5-flash');
};


export const fetchCptDetailsFromApi = async (cptCode: string) => {
    const systemPrompt = `You are an expert medical coder API. For a given CPT code, provide its official short description, whether it commonly requires prior authorization, and if it is deprecated. Your response MUST be a valid JSON object matching the provided schema. If the CPT code is invalid or not found, respond with an error message in the 'error' field.`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            description: { type: Type.STRING, description: "Official short description of the CPT code." },
            authRequired: { type: Type.BOOLEAN, description: "Whether prior authorization is commonly required." },
            notes: { type: Type.STRING, description: "Brief note if authorization is context-dependent." },
            isDeprecated: { type: Type.BOOLEAN, description: "Whether the CPT code is deprecated." },
            deprecationNote: { type: Type.STRING, description: "If isDeprecated is true, explain why. If false, this can be an empty string." },
            error: { type: Type.STRING, description: "An error message if the CPT code is invalid or not found." }
        },
    };
    const result = await generateJson<{error?: string}>(`CPT Code: ${cptCode}`, systemPrompt, schema);
    if (result.success && result.data?.error) {
        return { success: false, error: `CPT code ${cptCode} not found or invalid.` };
    }
    return result;
};

export const fetchMedicalNecessityFromApi = async (cptCode: string, dxCode: string, payerName: string) => {
    const systemPrompt = `You are an expert medical billing and coding auditor AI. Assess denial risk for a procedure. Based on CPT, DX, and Payer, provide: 1. A denial risk score (Low, Medium, High). 2. The single most common reason for denial. 3. Specific documentation needed to mitigate risk. 4. A modifier suggestion if common. Your response MUST be a valid JSON object matching the provided schema.`;
    const userQuery = `Payer: ${payerName || 'General Policy'}, CPT Code: ${cptCode}, Diagnosis Code: ${dxCode}`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            denialRisk: { type: Type.STRING, description: "Values: 'Low', 'Medium', 'High'" },
            reason: { type: Type.STRING, description: "The single most common reason for denial." },
            mitigation: { type: Type.STRING, description: "Specific documentation needed to mitigate risk." },
            confidence: { type: Type.STRING, description: "Values: 'High', 'Medium', 'Low'" },
            modifierSuggestion: { type: Type.STRING, description: "A modifier suggestion (e.g., -25) or empty string." },
        },
    };
    return generateJson<NecessityDetails>(userQuery, systemPrompt, schema);
};

export const fetchIcdSuggestionsFromApi = async (cptCode: string, dxCode: string) => {
    const systemPrompt = `You are an AI medical coding assistant. User entered a CPT and ICD-10. Analyze ICD-10 for specificity. 1. If general/unspecified, provide 2-3 more specific, billable child codes relevant to the CPT. 2. Provide a brief note on specificity's importance. 3. If specific, return empty suggestions and a 'Code is specific.' note. Response MUST be a valid JSON object matching the provided schema.`;
    const userQuery = `CPT Code: ${cptCode}, Diagnosis Code: ${dxCode}`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            suggestions: {
                type: Type.ARRAY,
                description: "A list of more specific, billable ICD-10 child codes.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        code: { type: Type.STRING, description: "The ICD-10 code." },
                        description: { type: Type.STRING, description: "The description of the ICD-10 code." }
                    }
                }
            },
            note: { type: Type.STRING, description: "A brief note on specificity's importance." }
        }
    };
    return generateJson(userQuery, systemPrompt, schema);
};

export const fetchPayerPolicyFromApi = async (cptCode: string, dxCode: string, payerName: string) => {
    const systemPrompt = `You are an advanced RAG for healthcare, containing all US payer clinical policies. For a CPT, DX, and Payer, find the exact clinical policy rule. 1. Extract the single most relevant rule/coverage criteria. 2. State its impact (e.g., "Requires Prior Auth"). If no specific policy is found, state that. Response MUST be a valid JSON object matching the provided schema.`;
    const userQuery = `Payer: ${payerName}, CPT Code: ${cptCode}, Diagnosis Code: ${dxCode}`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            policyRule: { type: Type.STRING, description: "The single most relevant rule/coverage criteria from the policy." },
            impact: { type: Type.STRING, description: "The impact of the policy, e.g., 'Requires Prior Auth', 'Not Covered', 'Covered if Criteria Met', 'Standard Coverage'." },
            source: { type: Type.STRING, description: "The source of the policy, e.g., 'Cigna Clinical Policy 0522'." }
        }
    };
    return generateJson(userQuery, systemPrompt, schema);
};

export const fetchPayerIntelligenceFromApi = async (payerName: string, cptCode: string) => {
    const systemPrompt = `You are a health insurance navigation expert. For the given Payer and CPT, provide any known payer-specific "gotchas" or requirements (e.g., portals, forms, non-clinical rejection reasons, timelines). If none known, respond "Standard auth process applies." Response MUST be a valid JSON object matching the provided schema.`;
    const userQuery = `Payer: ${payerName}, CPT Code: ${cptCode}`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            intel: { type: Type.STRING, description: "A brief, one-sentence tip about payer-specific requirements." }
        }
    };
    return generateJson(userQuery, systemPrompt, schema);
};

export const fetchBundlingAuditFromApi = async (cptCodes: string[]) => {
    const systemPrompt = `You are an expert medical coding auditor with deep knowledge of NCCI edits. Analyze CPT codes: ${JSON.stringify(cptCodes)}. 1. Identify bundled pairs. 2. Explain the relationship. 3. Suggest when a modifier might be appropriate. 4. Provide an overall summary. Response MUST be a valid JSON object matching the provided schema.`;
    const userQuery = `Audit CPT codes: ${cptCodes.join(', ')}`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            auditResults: {
                type: Type.ARRAY,
                description: "List of identified bundled code pairs and their details.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        codePair: { type: Type.ARRAY, items: { type: Type.STRING }, description: "The pair of CPT codes with a bundling relationship." },
                        relationship: { type: Type.STRING, description: "Explanation of the bundling relationship." },
                        suggestion: { type: Type.STRING, description: "Suggestion on when a modifier might be appropriate." }
                    }
                }
            },
            hasIssues: { type: Type.BOOLEAN, description: "True if any bundling issues were found." },
            summary: { type: Type.STRING, description: "An overall summary of the audit findings." }
        }
    };
    return generateJson<BundlingAuditData>(userQuery, systemPrompt, schema);
};

export const fetchNpiDetailsFromApi = async (npi: string) => {
    const systemPrompt = `You are a simulated lookup for the US NPPES NPI Registry. For a given NPI, provide provider details. Response MUST be a valid JSON object matching the provided schema.`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            npi: { type: Type.STRING, description: "The NPI number that was looked up." },
            isValid: { type: Type.BOOLEAN, description: "Whether the NPI is valid according to the registry." },
            isActive: { type: Type.BOOLEAN, description: "Whether the NPI is currently active." },
            providerName: { type: Type.STRING, description: "The full name of the provider." },
            primaryTaxonomy: { type: Type.STRING, description: "The primary specialty of the provider." },
            address: { type: Type.STRING, description: "The city and state of the provider's address." },
            error: { type: Type.STRING, description: "An error message if the NPI is invalid, otherwise can be an empty string." }
        }
    };
    return generateJson<{ isValid: boolean, isActive: boolean, error: string | null }>(`NPI: ${npi}`, systemPrompt, schema);
};

export const fetchClaimPaymentLikelihood = async (procedures: Procedure[], targetPayer: Payer, npiDetails: NpiData, verificationDetails: VerificationResult, previousPayers: Payer[]) => {
    const systemPrompt = `You are a senior AI claims adjudicator specializing in multi-payer Coordination of Benefits (COB). Your task is to analyze a claim for a SPECIFIC payer within a COB sequence and predict its payment likelihood.

- **Analyze ONLY the provided TARGET PAYER.**
- **Consider the context of PREVIOUS PAYERS.** If previous payers exist, the claim has already been partially adjudicated. Your analysis must reflect the target payer's role (e.g., Secondary).
- For 'keyFactors', identify critical, payer-specific risks. For example, a Secondary payer may not require auth if the Primary approved it.
- Each risk factor must have: 'id', 'text', 'impact' ('High', 'Medium', 'Low'), 'category' ('Eligibility', 'Authorization', 'Coding', 'Provider Data', 'Other'), and a 'scoreImpact' (-5 to -40).
- The 'recommendation' must be a single, clear, actionable paragraph for the TARGET PAYER.
- Your response MUST be a valid JSON object matching the provided schema.`;
    
    const procedureSummary = procedures.map(p => ({
        cpt: p.cptCode,
        dx: p.dxCode,
        authRequiredByCode: p.authDetails?.data?.authRequired ?? 'Unknown',
        medicalNecessityRisk: p.necessityDetails?.data?.denialRisk ?? 'Not Checked',
        payerPolicyImpact: p.policyDetails?.data?.impact ?? 'Not Checked'
    }));

    const targetPayerVerification = verificationDetails.payerVerifications[targetPayer.id];
    
    const inputSummary = {
        targetPayer: {
            rank: targetPayer.rank,
            name: targetPayer.insurance.name,
            type: targetPayer.payerType,
            networkStatus: targetPayer.networkStatus,
            eligibilityStatusForDOS: verificationDetails.overallEligibilityStatus,
            predictedAuthStatus: targetPayerVerification?.authStatus || 'Not Checked',
        },
        previousPayers: previousPayers.map(p => ({ rank: p.rank, name: p.insurance.name, type: p.payerType })),
        providerNpiValidation: { isValid: npiDetails.isValid, isActive: npiDetails.isActive },
        procedures: procedureSummary
    };

    const userQuery = `Analyze the payment likelihood for the TARGET PAYER based on this context:\n${JSON.stringify(inputSummary, null, 2)}`;
    
    const riskFactorSchema = {
        type: Type.OBJECT,
        properties: {
            id: { type: Type.STRING },
            text: { type: Type.STRING },
            impact: { type: Type.STRING, description: "Values: 'High', 'Medium', 'Low'" },
            category: { type: Type.STRING, description: "Values: 'Eligibility', 'Authorization', 'Coding', 'Provider Data', 'Other'" },
            scoreImpact: { type: Type.INTEGER, description: "Negative integer representing payment score impact." }
        }
    };

    const schema = {
        type: Type.OBJECT,
        properties: {
            likelihood: { type: Type.STRING, description: "Values: 'High', 'Medium', 'Low', 'Very Low'" },
            confidence: { type: Type.STRING, description: "Values: 'High', 'Medium', 'Low'" },
            keyFactors: { type: Type.ARRAY, items: riskFactorSchema, description: "A list of structured risk factors SPECIFIC to the target payer." },
            recommendation: { type: Type.STRING, description: "An actionable suggestion paragraph for the user to mitigate risk for THIS payer." }
        }
    };

    return generateJson<PaymentLikelihood>(userQuery, systemPrompt, schema, 'gemini-2.5-flash');
};

export const fetchPatientExplanationFromApi = async (estimateData: EstimateData, aiEstimate: {data: AiEstimate | null}) => {
    const systemPrompt = `You are a friendly, empathetic financial counselor. Your audience is a patient who is not a medical billing expert. Explain their "Estimated Patient Responsibility" in simple, clear, non-jargon language. Focus on: 1. The final total amount owed. 2. A simple explanation of *why* (deductible, coinsurance, copay). 3. Mention it's an estimate. 4. If an AI estimate is available and confident, briefly mention it increases confidence. Response MUST be a valid JSON object matching the provided schema.`;
    const inputData = {
        total: estimateData.totalPatientResponsibility,
        procedures: estimateData.procedures.map(p => ({ cpt: p.cptCode, billed: p.billedAmount })),
        breakdown: estimateData.adjudicationChain.map(adj => ({
            payer: adj.insurance.name,
            patientShare: adj.totalPatientShareThisPayer,
            payerPaid: adj.totalPayerPaymentThisPayer
        })),
        aiTotal: aiEstimate?.data?.finalPatientResponsibility
    };
    const userQuery = `Explain this estimate: ${JSON.stringify(inputData)}`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            explanation: { type: Type.STRING, description: "A simple, multi-paragraph text explanation for the patient." }
        }
    };
    return generateJson<{explanation: string}>(userQuery, systemPrompt, schema);
};

export const fetchLmnDraftFromApi = async (procedure: Procedure, metaData: MetaData, payerName: string) => {
    const systemPrompt = `You are an expert medical billing specialist. Draft a formal, professional Letter of Medical Necessity from provider to payer, advocating for a high-risk service. Structure: Provider & Practice Info, Patient & Payer Info, DOS, Service Requested (CPT/DX), **Clinical Justification** (use denial reason/mitigation to build a strong argument), Closing. Response MUST be a valid JSON object matching the provided schema.`;
    const { patient, provider, practice, service } = metaData;
    const { cptCode, dxCode, authDetails, necessityDetails } = procedure;
    const inputData = {
        patientName: patient.name, patientDob: patient.dob,
        providerName: provider.name, providerNpi: provider.npi,
        practiceName: practice.name, practicePhone: provider.phone,
        payerName: payerName, serviceDate: service.date,
        cpt: `${cptCode} (${authDetails?.data?.description || 'N/A'})`, dx: dxCode,
        denialRiskReason: necessityDetails?.data?.reason,
        mitigationArgument: necessityDetails?.data?.mitigation
    };
    const userQuery = `Draft LMN based on this data: ${JSON.stringify(inputData)}`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            draft: { type: Type.STRING, description: "The full, formatted letter text, using \\n for new lines." }
        }
    };
    return generateJson<{draft: string}>(userQuery, systemPrompt, schema, 'gemini-2.5-flash', false);
};

export const fetchAppealLetterDraftFromApi = async (procedure: Procedure, metaData: MetaData, payer: Payer, denialReason: string) => {
    const systemPrompt = `You are a utilization review expert specializing in appealing insurance denials. A request for prior authorization was denied. Your task is to draft a compelling, professional appeal letter. The letter must directly counter the stated denial reason using the provided clinical justification. Structure it formally and cite the key clinical arguments. Response MUST be a valid JSON object with a single 'draft' field containing the formatted letter text.`;
    const { patient, provider, practice, service } = metaData;
    const { cptCode, dxCode, necessityDetails } = procedure;
    const inputData = {
        denialReason,
        patientName: patient.name,
        patientDob: patient.dob,
        payerName: payer.insurance.name,
        memberId: payer.insurance.memberId,
        serviceDate: service.date,
        cpt: cptCode,
        dx: dxCode,
        clinicalJustification: necessityDetails?.data?.mitigation,
        providerName: provider.name,
        practiceName: practice.name,
    };
    const userQuery = `Draft an appeal letter based on this data: ${JSON.stringify(inputData)}`;
    const schema = { type: Type.OBJECT, properties: { draft: { type: Type.STRING } } };
    return generateJson<{draft: string}>(userQuery, systemPrompt, schema, 'gemini-2.5-flash', false);
};

export const fetchCodingSuggestionsForDenialFromApi = async (procedure: Procedure, payer: Payer, denialReason: string) => {
    const systemPrompt = `You are an expert medical coding auditor. An authorization for the given CPT/DX was denied for a specific reason. Your task is to suggest alternative, clinically appropriate CPT or ICD-10 codes that might satisfy the payer's policy and resolve the denial. For each suggestion, provide the code, its description, and a clear rationale for why it's a better choice. Format your response as a single string with clear markdown headings. Response MUST be a valid JSON object with a single 'suggestions' field.`;
    const { cptCode, dxCode, policyDetails } = procedure;
    const inputData = {
        deniedCpt: cptCode,
        deniedDx: dxCode,
        payerName: payer.insurance.name,
        denialReason,
        knownPolicy: policyDetails?.data?.policyRule
    };
    const userQuery = `Provide coding suggestions for this denial: ${JSON.stringify(inputData)}`;
    const schema = { type: Type.OBJECT, properties: { suggestions: { type: Type.STRING } } };
    return generateJson<{suggestions: string}>(userQuery, systemPrompt, schema, 'gemini-2.5-flash', false);
};

export const fetchPeerToPeerScriptFromApi = async (procedure: Procedure, metaData: MetaData, denialReason: string) => {
    const systemPrompt = `You are a clinical documentation expert coaching a physician for a peer-to-peer review call. An auth was denied. Generate a concise, bullet-pointed script for the physician to use. The script should include: 1. A brief patient summary. 2. A strong clinical justification that directly addresses the denial reason. 3. Key talking points to emphasize. 4. A professional closing. Format the response as a single, well-structured string with markdown headings. Response MUST be a valid JSON object with a single 'script' field.`;
    const { patient } = metaData;
    const { cptCode, dxCode, necessityDetails } = procedure;
    const inputData = {
        patientName: patient.name,
        patientAge: new Date(new Date().getTime() - new Date(patient.dob).getTime()).getFullYear() - 1970, // Calculate age
        patientGender: patient.gender,
        deniedService: `CPT ${cptCode} (${dxCode})`,
        denialReason,
        clinicalArgument: necessityDetails?.data?.mitigation,
    };
    const userQuery = `Generate a peer-to-peer script for this denial: ${JSON.stringify(inputData)}`;
    const schema = { type: Type.OBJECT, properties: { script: { type: Type.STRING } } };
    return generateJson<{script: string}>(userQuery, systemPrompt, schema, 'gemini-2.5-flash', false);
};


export const fetchAiGeneratedEstimate = async (payers: Payer[], procedures: Procedure[], metaData: MetaData) => {
    const systemPrompt = `You are an expert US healthcare claims adjudication engine. Your goal is to calculate a precise patient financial responsibility estimate based on the provided JSON data, and you must return a valid JSON object matching the provided output schema.

**Calculation Process:**

1.  **Iterate Through Payers:** Process each payer in the provided order (Primary, then Secondary, etc.). The starting claim balance for a subsequent payer is the remaining patient responsibility from the previous one.
2.  **Iterate Through Procedures:** For each payer, you MUST adjudicate **every procedure** listed in the input.
    *   Initialize running totals for this payer's total payment and total patient share to zero.
    *   Maintain a temporary, updated copy of the patient's accumulators (deductible met, OOP met) as you process each line.
    *   For **each procedure**, calculate the patient's cost-sharing based on the payer's benefits and the *current state* of the accumulators.
    *   Add the calculated amounts to the payer's running totals.
    *   Update the temporary accumulators before processing the next procedure.
3.  **Summarize in Notes:** For each payer's \`notes\` field, provide a concise, narrative summary explaining how the total patient share for that payer was calculated. **This summary must account for all procedures adjudicated for that payer.** For example: "Primary: Patient responsibility includes a $50.00 copay for procedure 27447, the remaining individual deductible of $208.44, and 15% coinsurance on the remaining allowed amounts."

**Core Adjudication Principles:**

1.  **Sequential Processing:** Adjudicate payers strictly in their given order (Primary, then Secondary, etc.). The claim balance for a subsequent payer is the remaining balance from the previous one.

2.  **Allowed Amount is Central:** ALL calculations for a given procedure MUST be based on that payer's specific \`allowedAmount\`. The \`billedAmount\` is only the starting point for the primary payer.

3.  **Strict Waterfall Logic:** For each procedure, apply patient cost-sharing against the \`allowedAmount\` in this exact order:
    a.  **Copay**
    b.  **Deductible**
    c.  **Coinsurance**

4.  **Accumulators & Caps:** Strictly respect all plan accumulators. The patient's share for a procedure cannot exceed the remaining Deductible or Out-of-Pocket (OOP) maximums. Correctly apply logic for Individual, Embedded Family, and Aggregate Family plans.

5.  **Network Status is CRITICAL:**
    *   **In-Network:** The difference between the \`billedAmount\` and the \`allowedAmount\` is a provider **write-off**. It is NOT the patient's responsibility.
    *   **Out-of-Network:** Balance billing may apply. The patient may be responsible for charges above the allowed amount, passed on after all payers have adjudicated.

6.  **Coordination of Benefits (COB):** For secondary and tertiary payers, their payment is generally the **lesser of** (a) what they would have paid if they were primary, or (b) the remaining claim balance. Apply standard COB methodologies (e.g., Traditional, Non-Duplication) as appropriate for the payer type.

Analyze the input data carefully, apply these principles, and generate an accurate, auditable estimate.`;

    const inputData = { metaData, payers, procedures };
    const userQuery = `Calculate the full COB estimate for this data:\n${JSON.stringify(inputData, null, 2)}`;
    const payerResultSchema = {
        type: Type.OBJECT,
        properties: {
            payerName: { type: Type.STRING },
            estimatedPayment: { type: Type.NUMBER },
            patientShare: { type: Type.NUMBER },
            notes: { type: Type.STRING }
        }
    };
    const schema = {
        type: Type.OBJECT,
        properties: {
            primaryPayer: payerResultSchema,
            secondaryPayer: { ...payerResultSchema, description: "Include this object only if a secondary payer exists." },
            tertiaryPayer: { ...payerResultSchema, description: "Include this object only if a tertiary payer exists." },
            finalPatientResponsibility: { type: Type.NUMBER },
            overallConfidence: { type: Type.STRING, description: "Values: 'High', 'Medium', 'Low'" },
            keyAssumptions: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
    };
    return generateJson<AiEstimate>(userQuery, systemPrompt, schema, 'gemini-2.5-pro', true);
};

export const fetchChatbotResponse = async (userMessage: string, appState: any) => {
    const systemPrompt = `You are "Gemini," an AI assistant in the "Good Faith Patient Estimate Calculator." Answer user questions about their *current* "case" based *only* on the provided JSON CONTEXT. Be concise, friendly, and helpful. Do not perform new calculations. If context is empty, say you need the user to run a calculation first. If the question is unrelated, politely decline. Response MUST be a valid JSON object matching the provided schema.`;
    const context = {
        currentPage: appState.page,
        patientAndProviderInfo: appState.metaData,
        insurancePayers: appState.payers,
        procedures: appState.procedures.map(({authDetails, necessityDetails, ...p}: Procedure) => p), // Simplify for prompt
        verificationAndLikelihood: {
            eligibility: appState.verificationResult,
            paymentLikelihood: appState.paymentLikelihood,
            npiValidation: appState.npiValidationResult,
            codingAudit: appState.bundlingAudit
        },
        financialPlanningInputs: appState.propensityData,
        algorithmicEstimate: appState.estimateData,
        aiGeneratedEstimate: appState.aiEstimate
    };
    const userQuery = `CONTEXT:\n${JSON.stringify(context, null, 2)}\n\nQUESTION:\n${userMessage}`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            response: { type: Type.STRING, description: "The chatbot's text answer." }
        }
    };
    return generateJson<{response: string}>(userQuery, systemPrompt, schema);
};

export const fetchGlobalSearchResults = async (query: string) => {
    const systemPrompt = `You are an intelligent search engine and QA assistant for a medical billing application. Your task is two-fold:
1.  Find relevant CPT codes, ICD-10 diagnosis codes, and US insurance payer names based on a user's query. The query can be a code, a name, or a natural language description. Provide a concise 'relevance' explanation for each result. Prioritize the most common and relevant results, returning up to 3 for each category. If no relevant results are found for a category, return an empty array for it.
2.  If the query appears to be a direct question (e.g., 'Is auth required for...?', 'What is CPT...?'), provide a direct, concise answer in the 'quickAnswer' field. Base this answer on general US healthcare billing principles and publicly available data.

Your response MUST be a valid JSON object matching the provided schema.`;
    const userQuery = `Search query: "${query}"`;
    
    const searchResultItemSchema = {
        type: Type.OBJECT,
        properties: {
            type: { type: Type.STRING, description: "The type of the result: 'CPT', 'ICD-10', or 'Payer'." },
            code: { type: Type.STRING, description: "The code (e.g., '99214') or name (e.g., 'Aetna')." },
            description: { type: Type.STRING, description: "The official description or details." },
            relevance: { type: Type.STRING, description: "A concise explanation of why this result is relevant to the query." }
        }
    };

    const schema = {
        type: Type.OBJECT,
        properties: {
            quickAnswer: {
                type: Type.OBJECT,
                description: "A direct answer if the user query is a question. This should be null if it's not a question.",
                properties: {
                    answer: { type: Type.STRING, description: "A concise, direct answer to the user's question." },
                    confidence: { type: Type.STRING, description: "Confidence in the answer: 'High', 'Medium', 'Low'." },
                    source: { type: Type.STRING, description: "The basis for the answer, e.g., 'General Payer Policy'." }
                }
            },
            procedures: { type: Type.ARRAY, items: searchResultItemSchema },
            diagnoses: { type: Type.ARRAY, items: searchResultItemSchema },
            payers: { type: Type.ARRAY, items: searchResultItemSchema }
        }
    };

    return generateJson<SearchResults>(userQuery, systemPrompt, schema);
};