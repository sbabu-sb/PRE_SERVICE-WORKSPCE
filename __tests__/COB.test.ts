import { describe, it, expect } from '@jest/globals';
import { calculateCombinedEstimate } from '../engine/adjudicationEngine';
import { Payer, Procedure, MetaData, PropensityData, Benefits, Accumulators } from '../types';
import { PayerType, CobMethod } from '../constants';

// Mock data setup
const mockMetaData: MetaData = {
    patient: { name: 'John Doe', dob: '1980-01-01', relationship: 'Self', gender: 'Male' },
    practice: { name: 'Test Clinic', taxId: '123456789' },
    provider: { name: 'Dr. Smith', npi: '1234567890', phone: '555-555-5555' },
    service: { date: new Date().toISOString().split('T')[0], placeOfService: '11' },
};

const mockPropensityData: PropensityData = {
    paymentHistory: '',
    financialConfidence: '',
    outstandingBalance: '',
    employmentStatus: '',
    householdIncome: '',
    householdSize: '1',
    isHSACompatible: false,
};

const createProcedure = (id: string, billedAmount: number): Procedure => ({
    id,
    cptCode: '99214',
    billedAmount: String(billedAmount),
    modifiers: '',
    dxCode: 'R05',
    category: 'Office Visit',
    units: 1,
    isPreventive: false,
    dateOfService: mockMetaData.service.date,
    acuity: 'standard',
    authDetails: { loading: false, data: null, error: null },
    necessityDetails: { loading: false, data: null, error: null },
    payerIntel: { loading: false, data: null, error: null },
    policyDetails: { loading: false, data: null, error: null },
    icdSuggestions: { loading: false, data: null, error: null },
});

const createPayer = (
    id: string,
    rank: 'Primary' | 'Secondary',
    config: {
        networkStatus: 'in-network' | 'out-of-network',
        payerType?: PayerType,
        cobMethod?: CobMethod,
        subrogationActive?: boolean,
        benefits: Partial<Benefits>,
        accumulators?: Partial<Accumulators>,
        procBenefits: { procId: string; allowed: number; copay?: number, coinsurancePercentage?: number }[]
    }
): Payer => {
    const defaultBenefits: Benefits = {
        planType: 'Individual',
        copayLogic: 'standard_waterfall',
        deductibleAllocation: 'highest_allowed_first',
        multiProcedureLogic: '100_50_50',
        inNetworkIndividualDeductible: '0',
        inNetworkIndividualOopMax: '5000',
        inNetworkFamilyDeductible: '0',
        inNetworkFamilyOopMax: '10000',
        inNetworkCoinsurancePercentage: '20',
        outOfNetworkIndividualDeductible: '0',
        outOfNetworkIndividualOopMax: '10000',
        outOfNetworkFamilyDeductible: '0',
        outOfNetworkFamilyOopMax: '20000',
        outOfNetworkCoinsurancePercentage: '40',
        therapyVisitLimits: { physical: '', occupational: '', speech: '' },
        dmeRentalCap: { applies: false, purchasePrice: '' },
    };

    const defaultAccumulators: Accumulators = {
        inNetworkDeductibleMet: '0',
        inNetworkOopMet: '0',
        outOfNetworkDeductibleMet: '0',
        outOfNetworkOopMet: '0',
        therapyVisitsUsed: { physical: 0, occupational: 0, speech: 0 },
        dmeRentalPaid: 0,
    };

    return {
        id,
        rank,
        insurance: { name: `${rank} Payer`, memberId: '123' },
        networkStatus: config.networkStatus,
        payerType: config.payerType || PayerType.Commercial,
        cobMethod: config.cobMethod || CobMethod.Traditional,
        subrogationActive: config.subrogationActive || false,
        benefits: { ...defaultBenefits, ...config.benefits },
        patientAccumulators: { ...defaultAccumulators, ...config.accumulators },
        familyAccumulators: null,
        procedureBenefits: config.procBenefits.map(pb => ({
            procedureId: pb.procId,
            allowedAmount: String(pb.allowed),
            copay: String(pb.copay || 0),
            coinsurancePercentage: String(pb.coinsurancePercentage),
        })),
    };
};


describe('Coordination of Benefits (COB) Engine', () => {
    const procedure1 = createProcedure('proc1', 1000);
    const procedures = [procedure1];

    it('1. Traditional COB: Secondary pays remaining balance up to its allowed amount', () => {
        const primaryPayer = createPayer('payer1', 'Primary', {
            networkStatus: 'in-network',
            benefits: {}, // Pays 80% default
            procBenefits: [{ procId: 'proc1', allowed: 1000, coinsurancePercentage: 40 }], // Pays 60%
        });

        const secondaryPayer = createPayer('payer2', 'Secondary', {
            networkStatus: 'in-network',
            cobMethod: CobMethod.Traditional,
            benefits: {},
            procBenefits: [{ procId: 'proc1', allowed: 1000, coinsurancePercentage: 20 }], // Would pay 80%
        });

        const result = calculateCombinedEstimate([primaryPayer, secondaryPayer], procedures, mockMetaData, mockPropensityData);
        
        // Primary adjudication: Allowed $1000, 40% coins -> Patient owes $400, Payer pays $600. Remaining balance for COB is $400.
        expect(result.adjudicationChain[0].totalPayerPaymentThisPayer).toBe(600);
        expect(result.adjudicationChain[0].totalPatientShareThisPayer).toBe(400);

        // Secondary adjudication (Traditional):
        // As-if primary, it would pay $800.
        // Remaining balance is $400.
        // It pays min(800, 400) = $400.
        expect(result.adjudicationChain[1].totalPayerPaymentThisPayer).toBe(400);

        // Final patient responsibility should be $0.
        expect(result.totalPatientResponsibility).toBe(0);
    });

    it('2. Non-Duplication COB: Secondary pays nothing if primary paid equal or more than its liability', () => {
        const primaryPayer = createPayer('payer1', 'Primary', {
            networkStatus: 'in-network',
            benefits: {},
            procBenefits: [{ procId: 'proc1', allowed: 1000, coinsurancePercentage: 20 }], // Pays 80%
        });

        const secondaryPayer = createPayer('payer2', 'Secondary', {
            networkStatus: 'in-network',
            cobMethod: CobMethod.NonDuplication,
            benefits: {},
            procBenefits: [{ procId: 'proc1', allowed: 1000, coinsurancePercentage: 20 }], // Would also pay 80%
        });
        
        const result = calculateCombinedEstimate([primaryPayer, secondaryPayer], procedures, mockMetaData, mockPropensityData);

        // Primary adjudication: Allowed $1000, 20% coins -> Patient owes $200, Payer pays $800.
        expect(result.adjudicationChain[0].totalPayerPaymentThisPayer).toBe(800);
        
        // Secondary adjudication (Non-Duplication):
        // As-if primary, it would pay $800.
        // Primary paid $800.
        // It pays max(0, 800 - 800) = $0.
        expect(result.adjudicationChain[1].totalPayerPaymentThisPayer).toBe(0);

        // Final patient responsibility is the $200 left by the primary.
        expect(result.totalPatientResponsibility).toBe(200);
    });

    it('3. Carve-Out COB: Secondary pays up to the patient share from its own calculation', () => {
        const primaryPayer = createPayer('payer1', 'Primary', {
            networkStatus: 'in-network',
            benefits: { inNetworkIndividualDeductible: '1000' }, // Patient owes full $1000 deductible
            procBenefits: [{ procId: 'proc1', allowed: 1000 }],
        });

        const secondaryPayer = createPayer('payer2', 'Secondary', {
            networkStatus: 'in-network',
            cobMethod: CobMethod.CarveOut,
            benefits: {},
            procBenefits: [{ procId: 'proc1', allowed: 1000, copay: 50, coinsurancePercentage: 20 }], // As-if primary, patient would owe $50 copay + $190 coinsurance (20% of 950) = $240
        });

        const result = calculateCombinedEstimate([primaryPayer, secondaryPayer], procedures, mockMetaData, mockPropensityData);
        
        // Primary adjudication: Patient owes $1000 deductible, Payer pays $0. Remaining balance $1000.
        expect(result.adjudicationChain[0].totalPayerPaymentThisPayer).toBe(0);
        expect(result.adjudicationChain[0].totalPatientShareThisPayer).toBe(1000);

        // Secondary adjudication (Carve-Out):
        // As-if primary, patient share is $50 copay + 20% of ($1000-$50) = $50 + $190 = $240.
        // Secondary pays min(patient share, remaining balance) = min(240, 1000) = $240.
        expect(result.adjudicationChain[1].totalPayerPaymentThisPayer).toBe(240);

        // Final patient responsibility: 1000 (from primary) - 240 (paid by secondary) = $760.
        expect(result.totalPatientResponsibility).toBe(760);
    });

    it('4. OON Primary: Balance bill is not COB-eligible for the secondary payer', () => {
        const oonProcedure = createProcedure('proc1', 2000); // Higher billed amount
        
        const primaryPayer = createPayer('payer1', 'Primary', {
            networkStatus: 'out-of-network',
            benefits: {},
            procBenefits: [{ procId: 'proc1', allowed: 1000, coinsurancePercentage: 40 }], // Allowed is $1000, pays 60%
        });

        const secondaryPayer = createPayer('payer2', 'Secondary', {
            networkStatus: 'in-network',
            cobMethod: CobMethod.Traditional,
            benefits: {},
            procBenefits: [{ procId: 'proc1', allowed: 1000, coinsurancePercentage: 20 }], // Pays 80%
        });
        
        const result = calculateCombinedEstimate([primaryPayer, secondaryPayer], [oonProcedure], mockMetaData, mockPropensityData);

        // Primary OON adjudication: Billed $2000, Allowed $1000.
        // Patient owes 40% of allowed = $400.
        // Primary pays 60% of allowed = $600.
        // Patient also owes balance bill = $2000 - $1000 = $1000.
        // Total non-COB liability = $1000.
        // Remaining balance for COB = $400.
        expect(result.nonCobPatientLiability['proc1']).toBe(1000);
        expect(result.adjudicationChain[0].totalPayerPaymentThisPayer).toBe(600);
        expect(result.adjudicationChain[0].totalRemainingBalanceAfterPayer).toBe(400);

        // Secondary adjudication: Should only see the $400 balance.
        // As-if primary, it would pay $800. It pays min(800, 400) = $400.
        expect(result.adjudicationChain[1].totalPayerPaymentThisPayer).toBe(400);
        
        // Final Patient Responsibility = $1000 (balance bill) + $0 (remaining after secondary) = $1000.
        expect(result.totalPatientResponsibility).toBe(1000);
    });

    it('5. TPL/Subrogation Block: Downstream commercial payer pays nothing', () => {
        const primaryPayer = createPayer('payer1', 'Primary', {
            networkStatus: 'in-network',
            payerType: PayerType.Auto,
            subrogationActive: true, // Key flag
            benefits: {},
            procBenefits: [{ procId: 'proc1', allowed: 1000, coinsurancePercentage: 20 }], // Pays 80%
        });

        const secondaryPayer = createPayer('payer2', 'Secondary', {
            networkStatus: 'in-network',
            payerType: PayerType.Commercial, // Will be blocked
            cobMethod: CobMethod.Traditional,
            benefits: {},
            procBenefits: [{ procId: 'proc1', allowed: 1000 }],
        });

        const result = calculateCombinedEstimate([primaryPayer, secondaryPayer], procedures, mockMetaData, mockPropensityData);

        // Primary (Auto) pays 80% -> $800. Patient owes $200.
        expect(result.adjudicationChain[0].totalPayerPaymentThisPayer).toBe(800);
        expect(result.adjudicationChain[0].totalRemainingBalanceAfterPayer).toBe(200);

        // Secondary (Commercial) should be blocked and pay $0.
        // The adjudication engine should set its claimAmount to 0.
        expect(result.adjudicationChain[1].totalPayerPaymentThisPayer).toBe(0);

        // Final patient responsibility is the $200 left by the primary.
        expect(result.totalPatientResponsibility).toBe(200);
    });

});