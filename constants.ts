// --- App Configuration ---
export const appConfig = {
    brandName: "XYZ Inc.",
    appTitle: "Good Faith Patient Estimate Calculator",
    appSubtitle: `An “A-grade” tool to forecast patient financial responsibility and mitigate denial risks before service.`
};

// --- Constants: Insurance Payers ---
export const INSURANCE_PAYERS = [ 
    'Aetna', 'Aflac', 'Allianz', 'Allstate', 'Amerigroup', 'Anthem', 'Assurant', 
    'Asuris Northwest Health', 'AvMed', 'Blue Cross Blue Shield', 'BridgeSpan', 
    'Cambia Health Solutions', 'Capital BlueCross', 'CareFirst', 'CareSource', 
    'Centene Corporation', 'Cerulean', 'Cigna', 'Coventry Health Care', 
    'Dean Health Plan', 'Delta Dental', 'EmblemHealth', 'Fallon Health', 'Florida Blue', 
    'Geisinger', 'Group Health Cooperative', 'Harvard Pilgrim Health Care', 
    'Health Alliance Plan (HAP)', 'Health Care Service Corporation (HCSC)', 
    'Health Net', 'Health New England', 'HealthPartners', 'Highmark', 
    'Horizon Blue Cross Blue Shield of New Jersey', 'Humana', 'Independence Blue Cross', 
    'Kaiser Permanente', 'Liberty Mutual', 'LifeWise Health Plan of Oregon', 
    'LifeWise Health Plan of Washington', 'Magellan Health', 'Medical Mutual of Ohio', 
    'MetLife', 'Molina Healthcare', 'MVP Health Care', 'Oscar Health', 'Premera Blue Cross', 
    'Principal Financial Group', 'Priority Health', 'Providence Health Plan', 'Regence', 
    'Security Health Plan', 'SelectHealth', 'Tufts Health Plan', 'UnitedHealthcare', 
    'UPMC Health Plan', 'Wellcare', 'Wellmark Blue Cross Blue Shield' 
];

export enum CobMethod {
  Traditional = 'traditional',
  MaintenanceOfBenefits = 'maintenance_of_benefits',
  CarveOut = 'carve_out',
  NonDuplication = 'non_duplication',
  MedicareSecondary = 'medicare_secondary',
  MedicaidPayerLastResort = 'medicaid_payer_last_resort',
  LiabilityNoFault = 'liability_no_fault'
}

export enum PayerType {
  Commercial = 'commercial',
  Medicare = 'medicare',
  Medicaid = 'medicaid',
  Auto = 'auto',
  WorkersComp = 'workers_comp'
}