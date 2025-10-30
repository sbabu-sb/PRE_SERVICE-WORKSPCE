import { CobMethod, PayerType } from './constants';

export interface ApiState<T> {
  loading: boolean;
  data: T | null;
  error: string | null;
  key?: string | null;
  cpt?: string;
}

export interface CptDetails {
  description: string;
  authRequired: boolean;
  notes: string;
  isDeprecated: boolean;
  deprecationNote: string | null;
  error?: string;
}

export interface NecessityDetails {
  denialRisk: 'Low' | 'Medium' | 'High';
  reason: string;
  mitigation: string;
  confidence: 'High' | 'Medium' | 'Low';
  modifierSuggestion: string | null;
}

export interface IcdSuggestion {
  code: string;
  description: string;
}

export interface IcdSuggestionsData {
  suggestions: IcdSuggestion[];
  note: string;
}

export interface PayerPolicy {
  policyRule: string;
  impact: 'Requires Prior Auth' | 'Not Covered' | 'Covered if Criteria Met' | 'Standard Coverage';
  source: string;
}

export interface PayerIntel {
  intel: string;
}

export interface BundlingAuditResult {
  codePair: [string, string];
  relationship: string;
  suggestion: string;
}

export interface BundlingAuditData {
  auditResults: BundlingAuditResult[];
  hasIssues: boolean;
  summary: string;
}

export interface NpiData {
  npi: string;
  isValid: boolean;
  isActive: boolean;
  providerName: string;
  primaryTaxonomy: string;
  address: string;
  error: string | null;
}

export interface Procedure {
  id: string;
  cptCode: string;
  billedAmount: string;
  modifiers: string;
  dxCode: string;
  category: string;
  units: number;
  isPreventive: boolean;
  dateOfService: string;
  acuity: 'standard' | 'elective' | 'urgent' | 'none';
  authDetails: ApiState<CptDetails>;
  necessityDetails: ApiState<NecessityDetails>;
  payerIntel: ApiState<PayerIntel>;
  policyDetails: ApiState<PayerPolicy>;
  icdSuggestions: ApiState<IcdSuggestionsData>;
}

export interface ProcedureBenefit {
  procedureId: string;
  allowedAmount: string;
  copay: string;
  coinsurancePercentage: string | null;
}

export interface Benefits {
  planType: 'EmbeddedFamily' | 'AggregateFamily' | 'Individual';
  copayLogic: 'standard_waterfall' | 'highest_copay_only_per_day' | 'copay_by_category_per_day' | 'copay_only_if_present';
  deductibleAllocation: 'highest_allowed_first' | 'line_item_order';
  multiProcedureLogic: '100_50_25' | '100_50_50';
  inNetworkIndividualDeductible: string;
  inNetworkIndividualOopMax: string;
  inNetworkFamilyDeductible: string;
  inNetworkFamilyOopMax: string;
  inNetworkCoinsurancePercentage: string;
  outOfNetworkIndividualDeductible: string;
  outOfNetworkIndividualOopMax: string;
  outOfNetworkFamilyDeductible: string;
  outOfNetworkFamilyOopMax: string;
  outOfNetworkCoinsurancePercentage: string;
  therapyVisitLimits: {
    physical: string;
    occupational: string;
    speech: string;
  };
  dmeRentalCap: {
    applies: boolean;
    purchasePrice: string;
  };
}

export interface Accumulators {
  inNetworkDeductibleMet: string;
  inNetworkOopMet: string;
  outOfNetworkDeductibleMet: string;
  outOfNetworkOopMet: string;
  therapyVisitsUsed: {
    physical: number;
    occupational: number;
    speech: number;
  };
  dmeRentalPaid: number;
}

export interface Payer {
  id: string;
  rank: 'Primary' | 'Secondary' | 'Tertiary';
  insurance: { name: string; memberId: string };
  networkStatus: 'in-network' | 'out-of-network';
  payerType: PayerType;
  subrogationActive: boolean;
  cobMethod: CobMethod;
  benefits: Benefits;
  patientAccumulators: Accumulators;
  familyAccumulators: Accumulators | null;
  procedureBenefits: ProcedureBenefit[];
}

export interface MetaData {
  patient: { name: string; dob: string; relationship: 'Self' | 'Spouse' | 'Child' | 'Other Dependent'; gender: string; };
  practice: { name: string; taxId: string };
  provider: { name: string; npi: string; phone: string };
  service: { date: string; placeOfService: string };
}

export interface PropensityData {
  paymentHistory: 'on_time' | 'payment_plan' | 'sometimes_late' | 'difficulty' | '';
  financialConfidence: 'excellent' | 'good' | 'fair' | 'needs_improvement' | '';
  outstandingBalance: string;
  employmentStatus: 'employed' | 'unemployed' | 'student' | 'retired' | 'other' | '';
  householdIncome: '<25k' | '25k-50k' | '50k-100k' | '100k-200k' | '>200k' | '';
  householdSize: string;
  isHSACompatible: boolean;
}

export interface PayerVerificationDetails {
  payerId: string;
  authStatus: 'Required' | 'Not Required' | 'Not Checked';
  authPredictionReasoning: string;
  authPredictionConfidence: 'High' | 'Medium' | 'Low' | null;
  edi270Submitted: string | null;
  edi271Response: string | null;
  reVerifying?: boolean;
}

export interface VerificationResult {
  overallEligibilityStatus: 'Active' | 'Inactive' | 'Error';
  eligibilityNotes: string;
  payerVerifications: Record<string, PayerVerificationDetails>; // Keyed by Payer ID
  authRequiredForAnyPayer: boolean;
}

export interface RiskFactor {
    id: string;
    text: string;
    impact: 'High' | 'Medium' | 'Low';
    category: 'Eligibility' | 'Authorization' | 'Coding' | 'Provider Data' | 'Other';
    scoreImpact: number; 
}

export interface PaymentLikelihood {
    likelihood: "High" | "Medium" | "Low" | "Very Low";
    confidence: "High" | "Medium" | "Low";
    keyFactors: RiskFactor[];
    recommendation: string;
    error?: string;
}

export interface BreakdownStep {
  description: string;
  patientOwes: number;
  notes: string;
}

export interface AdjudicatedProcedure {
  id: string;
  cptCode: string;
  originalBilledAmount: number;
  patientCostShare: number;
  payerPayment: number;
  balanceAfterPayer: number;
  finalAllowedAmount: number;
  calculationBreakdown: BreakdownStep[];
  processingOrder: number | null;
}

export interface AdjudicationForPayer extends Payer {
    procedureEstimates: AdjudicatedProcedure[];
    totalPayerPaymentThisPayer: number;
    totalPatientShareThisPayer: number;
    totalRemainingBalanceAfterPayer: number;
}

export interface PropensityResult {
    score: number;
    tier: 'High' | 'Medium' | 'Low';
    recommendation: string;
    dynamicActions: { text: string; type: 'primary' | 'secondary' }[];
    factors: Record<string, number>;
}

export interface EstimateData {
  metaData: MetaData;
  payers: Payer[];
  procedures: Procedure[];
  totalPatientResponsibility: number;
  adjudicationChain: AdjudicationForPayer[];
  propensity: PropensityResult | null;
  nonCobPatientLiability: Record<string, number>;
}

export interface AiEstimatePayerResult {
    payerName: string;
    estimatedPayment: number;
    patientShare: number;
    notes: string;
}

export interface AiEstimate {
    primaryPayer: AiEstimatePayerResult;
    secondaryPayer: AiEstimatePayerResult | null;
    tertiaryPayer: AiEstimatePayerResult | null;
    finalPatientResponsibility: number;
    overallConfidence: 'High' | 'Medium' | 'Low';
    keyAssumptions: string[];
}

export interface AuthSubmissionState {
  loading: boolean;
  status: 'Pending' | 'Approved' | 'Rejected (More Info)' | null;
  generated278: string | null;
  authNumber: string | null;
  statusNotes: string | null;
}

export interface SearchResultItem {
  type: 'CPT' | 'ICD-10' | 'Payer';
  code: string;
  description: string;
  relevance: string;
}

export interface QuickAnswer {
  answer: string;
  confidence: 'High' | 'Medium' | 'Low';
  source: string;
}

export interface SearchResults {
  procedures: SearchResultItem[];
  diagnoses: SearchResultItem[];
  payers: SearchResultItem[];
  quickAnswer?: QuickAnswer | null;
}

// --- Enterprise Case Lifecycle & Disposition Engine (v3) ---

export enum CaseStatus {
  NEW = "New",
  ACTIVE = "Active",
  PENDING_EXTERNAL = "Pending External",
  WAITING_INTERNAL = "Waiting Internal",
  COMPLETED = "Completed",
  ARCHIVED = "Archived",
  REOPENED = "Reopened"
}

export interface CaseDisposition {
  outcome: string;
  summary: string;
  note?: string;
  finalizable?: boolean;
  attachments?: {
    authNumber?: string;
    payerRef?: string;
  }
}

export interface CaseEvent {
  at: string;                   // ISO
  by: string;                   // user id / system
  type: 'STATUS_CHANGE' | 'NOTE' | 'OVERRIDE' | 'REOPEN' | 'CREATION';
  from_status?: CaseStatus;
  to_status?: CaseStatus;
  payload?: any;
}

interface TopFactor {
  feature: string;
  value?: string;
  impact?: string;
}

interface NextBestAction {
  code: string;
  display_text: string;
}

interface PriorityDetails {
  score: number;
  topFactors: TopFactor[];
  nextBestAction: NextBestAction;
}

export interface WorklistPatient {
    id: string;
    metaData: MetaData;
    payers: Payer[];
    procedures: Procedure[];
    financialClearance: 'Cleared' | 'Needs Review' | 'Blocked';
    estimateStatus: 'Not Started' | 'In Progress' | 'Ready for Review' | 'Sent to Patient';
    estimatedResponsibility: number | null;
    lastUpdated: string;
    lastWorkedBy: { name: string; avatarUrl: string };
    assignedTo: { name: string; avatarUrl: string };
    priorityDetails?: PriorityDetails;
    isExplorationItem?: boolean;
    status: CaseStatus;
    disposition?: CaseDisposition;
    events: CaseEvent[];
}

export type SortKey = 'patient' | 'timeToService' | 'dos' | 'primaryPayer' | 'preServiceClearance' | 'estimateStatus' | 'lastWorkedBy' | 'assignedTo' | 'priority' | 'status';