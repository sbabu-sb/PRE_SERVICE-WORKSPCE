// @ts-nocheck
// FIX: PayerType and CobMethod are enums (values) and should be imported from constants.ts, not types.ts.
import { WorklistPatient, CaseStatus, CaseEvent, Procedure, Benefits, Accumulators, Payer, MetaData, PriorityDetails, TopFactor } from '../types';
import { INSURANCE_PAYERS, PayerType, CobMethod } from '../constants';

const firstNames = ['Eleanor', 'David', 'Maria', 'Thomas', 'Sophia', 'James', 'Isabella', 'William', 'Olivia', 'John', 'Emma', 'Liam', 'Ava', 'Noah', 'Mia', 'Lucas'];
const lastNames = ['Vance', 'Chen', 'Garcia', 'Anderson', 'Smith', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Lee', 'Walker', 'Hall'];
// FIX: Added the required 'phone' property to match the MetaData.provider type.
const fixedProvider = { name: 'Dr. Kara Ewing', npi: '1528208204', phone: '(555) 123-4567' };
const providers = [
    fixedProvider,
    { name: 'Dr. Montague', npi: '1987654321', phone: '(555) 111-2222' },
    { name: 'Dr. Emily Carter', npi: '1234567893', phone: '(555) 555-5555' },
    { name: 'Dr. Smith', npi: '1234567890', phone: '(555) 555-5555' },
    { name: 'Dr. Allen', npi: '1122334455', phone: '(555) 666-7777' }
];
const practices = [
    { name: 'Ortho Associates', taxId: '987654321' },
    { name: 'General Medical Clinic', taxId: '123456789' },
    { name: 'Downtown Health', taxId: '112233445' }
];
const teamMembers = [
    { name: 'Maria Garcia', avatarUrl: 'https://i.pravatar.cc/150?u=mariagarcia' },
    { name: 'David Chen', avatarUrl: 'https://i.pravatar.cc/150?u=davidchen' },
    { name: 'J. Smith', avatarUrl: 'https://i.pravatar.cc/150?u=jsmith' },
    { name: 'Unassigned', avatarUrl: '' },
];
// FIX: Explicitly typed the array as Partial<Procedure>[] to ensure type compatibility for properties like 'acuity'.
const proceduresList: Partial<Procedure>[] = [
    { cptCode: '27447', billedAmount: '32000', dxCode: 'M17.11', category: 'Surgery', acuity: 'elective' },
    { cptCode: '99214', billedAmount: '250', dxCode: 'J02.9', category: 'Office Visit', acuity: 'standard' },
    { cptCode: '87880', billedAmount: '85', dxCode: 'J02.9', category: 'Lab', acuity: 'standard' },
    { cptCode: '71250', billedAmount: '850', dxCode: 'S62.60XA', category: 'Imaging', acuity: 'urgent' },
    { cptCode: 'G0202', billedAmount: '450', dxCode: 'Z12.31', category: 'Screening', isPreventive: true },
    { cptCode: '99285', billedAmount: '1200', dxCode: 'R07.9', category: 'Emergency', acuity: 'urgent' },
    { cptCode: '93010', billedAmount: '150', dxCode: 'I20.9', category: 'Cardiology', acuity: 'standard' }
];

const getRandomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const getRandomDate = (start: Date, end: Date): string => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString().split('T')[0];

const createDefaultProcedure = (overrides: Partial<Procedure>): Procedure => ({
    id: crypto.randomUUID(),
    cptCode: '',
    billedAmount: '0',
    modifiers: '',
    dxCode: '',
    category: 'Medical/Surgical',
    units: 1,
    isPreventive: false,
    dateOfService: '',
    acuity: 'standard',
    authDetails: { loading: false, data: null, error: null },
    necessityDetails: { loading: false, data: null, error: null },
    payerIntel: { loading: false, data: null, error: null },
    policyDetails: { loading: false, data: null, error: null },
    icdSuggestions: { loading: false, data: null, error: null },
    ...overrides
});

const defaultBenefits: Benefits = {
    planType: 'EmbeddedFamily', copayLogic: 'standard_waterfall', deductibleAllocation: 'highest_allowed_first', multiProcedureLogic: '100_50_25',
    inNetworkIndividualDeductible: '5000', inNetworkIndividualOopMax: '8000', inNetworkFamilyDeductible: '10000', inNetworkFamilyOopMax: '16000', inNetworkCoinsurancePercentage: '20',
    outOfNetworkIndividualDeductible: '10000', outOfNetworkIndividualOopMax: '20000', outOfNetworkFamilyDeductible: '20000', outOfNetworkFamilyOopMax: '40000', outOfNetworkCoinsurancePercentage: '40',
    therapyVisitLimits: { physical: '30', occupational: '30', speech: '30' },
    dmeRentalCap: { applies: false, purchasePrice: '' },
};

const defaultAccumulators: Accumulators = {
    inNetworkDeductibleMet: '1250', inNetworkOopMet: '2500', outOfNetworkDeductibleMet: '0',
    outOfNetworkOopMet: '0',
    therapyVisitsUsed: { physical: 5, occupational: 2, speech: 0 },
    dmeRentalPaid: 0
};

const createPayer = (rank: 'Primary' | 'Secondary' | 'Tertiary', procedures: Procedure[], overrides: Partial<Payer>): Payer => ({
    id: crypto.randomUUID(),
    rank,
    insurance: { name: getRandomItem(INSURANCE_PAYERS), memberId: `W${Math.floor(Math.random() * 1e9)}` },
    networkStatus: 'in-network',
    payerType: PayerType.Commercial,
    subrogationActive: false,
    cobMethod: CobMethod.Traditional,
    benefits: defaultBenefits,
    patientAccumulators: defaultAccumulators,
    familyAccumulators: defaultAccumulators,
    procedureBenefits: procedures.map(p => ({ procedureId: p.id, allowedAmount: String(Number(p.billedAmount) * 0.6), copay: '50', coinsurancePercentage: '' })),
    ...overrides,
});

const generatePriorityDetails = (patient: { procedures: Procedure[], metaData: MetaData, payers: Payer[] }): PriorityDetails => {
    let baseScore = 50;
    const factors: TopFactor[] = [];

    // Potential Factors
    const primaryProcedure = patient.procedures[0];
    if (primaryProcedure) {
        const billed = Number(primaryProcedure.billedAmount);
        if (billed > 10000) {
            factors.push({ feature: 'Procedure Cost', value: `$${billed.toLocaleString()}`, impact: 25.5 });
        } else if (billed > 1000) {
            factors.push({ feature: 'Procedure Cost', value: `$${billed.toLocaleString()}`, impact: 10.2 });
        }
    }

    if (patient.procedures.length > 1) {
        factors.push({ feature: 'Multiple Procedures', value: patient.procedures.length, impact: 8.0 });
    }
    
    const serviceDate = new Date(patient.metaData.service.date);
    const today = new Date();
    const daysUntilService = (serviceDate.getTime() - today.getTime()) / (1000 * 3600 * 24);

    if (daysUntilService < 3) {
         factors.push({ feature: 'Time to Service', value: `${Math.round(daysUntilService)} days`, impact: 22.1 });
    } else if (daysUntilService < 7) {
        factors.push({ feature: 'Time to Service', value: `${Math.round(daysUntilService)} days`, impact: 15.3 });
    }

    if (patient.payers[0]?.networkStatus === 'out-of-network') {
        factors.push({ feature: 'Network Status', value: 'Out-of-Network', impact: 12.5 });
    }

    // A random negative factor for variety
    if (Math.random() < 0.2) {
        factors.push({ feature: 'Payer Timely Filing Risk', value: 'High', impact: -7.8 });
    }

    const finalScore = baseScore + factors.reduce((sum, f) => sum + f.impact, 0);

    return {
        score: parseFloat(finalScore.toFixed(2)),
        topFactors: factors.sort((a,b) => Math.abs(b.impact) - Math.abs(a.impact)), // sort by absolute impact
        nextBestAction: { code: 'RUN_ELIGIBILITY', display_text: 'Run full eligibility check' },
        modelConfidence: parseFloat((0.85 + Math.random() * 0.14).toFixed(2)), // 0.85 - 0.99
        percentileRank: Math.floor(80 + Math.random() * 20), // 80 - 99
    };
};

export const createNewWorklistPatient = (): WorklistPatient => {
    const randomProcedureInfo = getRandomItem(proceduresList);
    const procedures = [createDefaultProcedure(randomProcedureInfo)];
    const provider = fixedProvider; // Always use the fixed provider
    const practice = getRandomItem(practices);
    const serviceDate = new Date();
    serviceDate.setDate(serviceDate.getDate() + Math.floor(Math.random() * 60) - 15); // -15 to +45 days from now

    const meta: MetaData = {
        patient: { name: `${getRandomItem(firstNames)} ${getRandomItem(lastNames)}`, dob: getRandomDate(new Date(1950, 0, 1), new Date(2005, 0, 1)), relationship: 'Self', gender: Math.random() > 0.5 ? 'Male' : 'Female' },
        practice,
        provider,
        service: { date: serviceDate.toISOString().split('T')[0], placeOfService: '11' }
    };

    const payers = [createPayer('Primary', procedures, {})];
    const createdDate = new Date();
    createdDate.setDate(createdDate.getDate() - Math.floor(Math.random() * 5));
    const events: CaseEvent[] = [{ at: createdDate.toISOString(), by: 'System', type: 'CREATION' }];
    const assignedTo = getRandomItem(teamMembers);
    const statusOptions = [CaseStatus.NEW, CaseStatus.ACTIVE, CaseStatus.PENDING_EXTERNAL, CaseStatus.WAITING_INTERNAL, CaseStatus.ACTIVE, CaseStatus.NEW]; // Skew towards open
    const status = getRandomItem(statusOptions);
    
    const worklistPatientBase = {
        metaData: meta,
        payers,
        procedures,
    };
    
    const priorityDetails = generatePriorityDetails(worklistPatientBase);

    return {
        id: `CASE-${String(Math.floor(Math.random() * 9000) + 1000)}`,
        metaData: meta,
        payers,
        procedures,
        financialClearance: getRandomItem(['Cleared', 'Needs Review', 'Blocked']),
        estimateStatus: getRandomItem(['Not Started', 'In Progress', 'Ready for Review']),
        estimatedResponsibility: status === CaseStatus.COMPLETED ? 0 : Math.random() > 0.5 ? parseFloat((Math.random() * 2000).toFixed(2)) : null,
        lastUpdated: new Date().toISOString(),
        lastWorkedBy: getRandomItem(teamMembers.filter(t => t.name !== 'Unassigned')),
        assignedTo: assignedTo,
        priorityDetails: priorityDetails,
        isExplorationItem: Math.random() > 0.8,
        status,
        events,
    };
};

// Generate a list of 50 unique patients for the initial worklist
export const worklistData: WorklistPatient[] = Array.from({ length: 50 }, createNewWorklistPatient);