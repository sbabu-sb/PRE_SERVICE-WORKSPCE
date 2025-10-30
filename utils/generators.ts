
import { Procedure, MetaData, Payer } from "../types";
import { roundCurrency, formatDate } from "./formatters";

export const generateRandomBenefits = (procedures: Procedure[]) => {
    const indDed = 500 * (Math.floor(Math.random() * 14) + 1); // $500 to $7500
    const famDed = roundCurrency(indDed * (Math.random() * 1 + 1.5)); // 1.5x to 2.5x of individual
    const indOop = indDed + (500 * (Math.floor(Math.random() * 10) + 2)); // $1000 to $6000 more than ded
    const famOop = roundCurrency(indOop * (Math.random() * 1 + 1.5));
    const coinsurance = [10, 15, 20, 25, 30][Math.floor(Math.random() * 5)];
    const indDedMet = roundCurrency(Math.random() * indDed * 0.5); // Met up to 50%
    const famDedMet = roundCurrency(Math.random() * famDed * 0.5);
    const indOopMet = roundCurrency(indDedMet + (Math.random() * (indOop - indDedMet) * 0.5));
    const famOopMet = roundCurrency(famDedMet + (Math.random() * (famOop - famDedMet) * 0.5));
    
    const procBenefits = procedures.map(p => {
        const billed = Number(p.billedAmount) || 500; // Default if not set
        const allowed = roundCurrency(billed * (Math.random() * 0.4 + 0.5)); // 50% to 90% of billed
        const copay = [0, 25, 50, 75][Math.floor(Math.random() * 4)];
        return {
            procedureId: p.id,
            allowedAmount: allowed.toString(),
            copay: copay.toString(),
            coinsurancePercentage: ''
        };
    });

    return {
        benefits: {
            inNetworkIndividualDeductible: indDed.toString(), inNetworkFamilyDeductible: famDed.toString(),
            inNetworkIndividualOopMax: indOop.toString(), inNetworkFamilyOopMax: famOop.toString(),
            inNetworkCoinsurancePercentage: coinsurance.toString(),
            outOfNetworkIndividualDeductible: roundCurrency(indDed * 1.5).toString(), outOfNetworkFamilyDeductible: roundCurrency(famDed * 1.5).toString(),
            outOfNetworkIndividualOopMax: roundCurrency(indOop * 1.5).toString(), outOfNetworkFamilyOopMax: roundCurrency(famOop * 1.5).toString(),
            outOfNetworkCoinsurancePercentage: Math.min(100, coinsurance + 20).toString(),
        },
        patientAccumulators: {
            inNetworkDeductibleMet: indDedMet.toString(), inNetworkOopMet: indOopMet.toString(),
            outOfNetworkDeductibleMet: roundCurrency(indDedMet * 0.5).toString(), outOfNetworkOopMet: roundCurrency(indOopMet * 0.5).toString(),
        },
        familyAccumulators: {
            inNetworkDeductibleMet: famDedMet.toString(), inNetworkOopMet: famOopMet.toString(),
            outOfNetworkDeductibleMet: roundCurrency(famDedMet * 0.5).toString(), outOfNetworkOopMet: roundCurrency(famOopMet * 0.5).toString(),
        },
        procedureBenefits: procBenefits
    };
};

export const generateDummy270 = (metaData: MetaData, payer: Payer) => {
    const { provider, patient, service, practice } = metaData;
    const today = new Date().toISOString();
    const dos = service.date ? new Date(service.date).toISOString().slice(0, 10).replace(/-/g, '') : '20230101';
    const payerName = payer.insurance.name?.replace(/ /g, '').slice(0, 15) || 'PAYERID';

    return `
ISA*00* *00* *ZZ*SUBMITTERID    *ZZ*${payerName}       *${today.slice(2, 8)}*${today.slice(11, 15)}*^*00501*000000001*0*T*:~
GS*HS*APP_SENDER*${payerName}*${today.slice(0, 10).replace(/-/g, '')}*${today.slice(11, 15)}*1*X*005010X222A1~
ST*270*0001*005010X222A1~
BHT*0022*13*${practice.name?.slice(0,10) || 'PRACTICE'}_${Date.now()}*${today.slice(0, 10).replace(/-/g, '')}*${today.slice(11, 15)}~
HL*1**20*1~
NM1*PR*2*${payer.insurance.name}*****PI*${payer.insurance.memberId.slice(0,5) || 'PAYERID'}~
HL*2*1*21*1~
NM1*1P*2*${practice.name || 'PRACTICE'}*****XX*${provider.npi || '1234567890'}~
HL*3*2*22*0~
NM1*IL*1*${patient.name?.split(' ')?.[1] || 'PATIENT'}*${patient.name?.split(' ')?.[0] || 'PATIENT'}****MI*${payer.insurance.memberId || 'UNKNOWN_MEMBER_ID'}~
DMG*D8*${patient.dob?.replace(/-/g, '') || '20000101'}~
DTP*291*D8*${dos}~
EQ*30**FAM~
SE*11*0001~
GE*1*1~
IEA*1*000000001~
`.trim();
};

export const generateDummy271 = (metaData: MetaData, payer: Payer, isActive: boolean) => {
    const { provider, patient, service, practice } = metaData;
    const today = new Date().toISOString();
    const dos = service.date ? new Date(service.date).toISOString().slice(0, 10).replace(/-/g, '') : '20230101';
    const payerName = payer.insurance.name?.replace(/ /g, '').slice(0, 15) || 'PAYERID';
    
    const activeSegments = `
EB*1*IND*30**PPO*ACTIVE COVERAGE~
EB*G*IND*30**DENTAL, MEDICAL*PLAN ACTIVE~
MSG*COVERAGE IS ACTIVE FOR DATE OF SERVICE~
AMT*R*650~
AMT*A*2100~
`.trim();
    
    const inactiveSegments = `
EB*C*IND*30**PPO*INACTIVE COVERAGE~
MSG*MEMBER NOT FOUND OR INACTIVE ON DATE OF SERVICE~
`.trim();

    return `
ISA*00* *00* *ZZ*${payerName}       *ZZ*SUBMITTERID    *${today.slice(2, 8)}*${today.slice(11, 15)}*^*00501*000000002*0*T*:~
GS*HB*${payerName}*APP_SENDER*${today.slice(0, 10).replace(/-/g, '')}*${today.slice(11, 15)}*2*X*005010X222A1~
ST*271*0002*005010X222A1~
BHT*0022*11*${practice.name?.slice(0,10) || 'PRACTICE'}_${Date.now()}*${today.slice(0, 10).replace(/-/g, '')}*${today.slice(11, 15)}~
HL*1**20*1~
NM1*PR*2*${payer.insurance.name}*****PI*${payer.insurance.memberId.slice(0,5) || 'PAYERID'}~
HL*2*1*21*1~
NM1*1P*2*${practice.name || 'PRACTICE'}*****XX*${provider.npi || '1234567890'}~
HL*3*2*22*0~
NM1*IL*1*${patient.name?.split(' ')?.[1] || 'PATIENT'}*${patient.name?.split(' ')?.[0] || 'PATIENT'}****MI*${payer.insurance.memberId || 'UNKNOWN_MEMBER_ID'}~
${isActive ? activeSegments : inactiveSegments}
SE*${isActive ? 13 : 9}*0002~
GE*1*2~
IEA*1*000000002~
`.trim();
};

export const generateDummy278 = (metaData: MetaData, payers: Payer[], procedures: Procedure[]) => {
    const { provider, patient, service, practice } = metaData;
    const payer = payers[0]?.insurance;
    const today = new Date().toISOString();
    const dos = service.date ? new Date(service.date).toISOString().slice(0, 10).replace(/-/g, '') : '20230101';

    const procedureLines = procedures
        .filter(p => p.cptCode)
        .map(p => `SV1*HC:${p.cptCode}*${p.billedAmount || '0'}*UN*1~DTP*472*D8*${dos}~REF*6R*${p.id.slice(0, 8)}~HI*BK:${p.dxCode || 'ZZ'}`)
        .join('~\n');

    return `
ISA*00* *00* *ZZ*SUBMITTERID    *ZZ*${payer.name?.replace(/ /g, '').slice(0, 15) || 'PAYERID'}       *${today.slice(2, 8)}*${today.slice(11, 15)}*^*00501*000000001*0*T*:~
GS*HS*APP_SENDER*${payer.name?.replace(/ /g, '').slice(0, 15) || 'PAYERID'}*${today.slice(0, 10).replace(/-/g, '')}*${today.slice(11, 15)}*1*X*005010X217~
ST*278*0001*005010X217~
BHT*0022*13*XYZ_REQ_${Date.now()}*${today.slice(0, 10).replace(/-/g, '')}*${today.slice(11, 15)}*RT~
HL*1**20*1~
NM1*X3*2*${practice.name || 'SUBMITTING PRACTICE'}*****46*${provider.npi || '1234567890'}~
HL*2*1*21*1~
NM1*1P*2*${provider.name || 'RENDERING PROVIDER'}*****XX*${provider.npi || '1234567890'}~
HL*3*2*22*0~
NM1*IL*1*${patient.name?.split(' ')?.[1] || 'PATIENT'}*${patient.name?.split(' ')?.[0] || 'PATIENT'}****MI*${payer.memberId || 'UNKNOWN_MEMBER_ID'}~
DMG*D8*${patient.dob?.replace(/-/g, '') || '20000101'}*${patient.gender?.slice(0, 1) || 'U'}~
DTP*472*D8*${dos}~
${procedureLines}
SE*${10 + (procedures.filter(p=>p.cptCode).length * 4)}*0001~
GE*1*1~
IEA*1*000000001~
`.trim();
}
