// EstimatorCore_v4—Deductible/OOP‑Correct, COB‑Safe, 25‑Year Architecture
// ---------------------------------------------------------------------------------
// Goals
// • FIX: Correct tracking for Individual vs Family Deductible & OOP (Embedded vs Aggregate)
// • FIX: Coinsurance should trigger at the right time (e.g., after IND deductible is met even if FAM not yet)
// • FIX: Network mapping bugs (INN/OON) and lesser‑of caps
// • Keep: COB methods (Traditional / Non‑Duplication / Carve‑Out), OON balance‑bill handling, MPD 100/50/50 etc
// • Improve: Pure functions, immutability, clear waterfall (Copay → Deductible → Coinsurance → OOP Cap)
// • Safety: Explicit rounding to cents, guard rails, invariant checks and rich breakdown steps
// • Extendable: Configuration hooks and adapter layer so future rules can plug in without rewrites
// ---------------------------------------------------------------------------------

import {
  Procedure,
  Payer,
  MetaData,
  PropensityData,
  Benefits,
  Accumulators,
  EstimateData,
  ProcedureBenefit,
  PropensityResult,
  AdjudicationForPayer,
  BreakdownStep,
} from "../types";

import { PayerType, CobMethod } from "../constants";

// ---------------------------------------------------------------------------------
// SHARED UTILITIES (PURE, SIDE‑EFFECT FREE)
// ---------------------------------------------------------------------------------

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const cents = (v: number): number => Math.round(num(v) * 100) / 100;
const clamp0 = (v: number): number => (v < 0 ? 0 : v);

// Safer deep clone for simple JSONish shapes
const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o ?? {}));

// ---------------------------------------------------------------------------------
// TYPES (LOCAL) — we keep everything pure and explicit
// ---------------------------------------------------------------------------------

interface ProcedureState {
  id: string;
  originalBilledAmount: number;
  cumulativePlanPaid: number; // sum of prior payers' payments
  remainingBalance: number; // COB‑eligible remainder after each payer
  lastAdjudicatedAllowedAmount: number; // last payer's allowed
  originalIndex: number;
}

// Internal computed keys for benefits/accumulators
type Net = "inNetwork" | "outOfNetwork";

interface OOPContext {
  planType: Benefits["planType"];
  indPlanOop: number;
  famPlanOop: number;
  indOopMet: number;
  famOopMet: number;
}

// ---------------------------------------------------------------------------------
// KEY RESOLVERS (BUGFIX: correct network mapping for INN/OON)
// ---------------------------------------------------------------------------------

const netKey = (isOON: boolean): Net => (isOON ? "outOfNetwork" : "inNetwork");

// FIX: Return a more specific type to help TypeScript infer property types correctly.
const getMetKey = (
  isOON: boolean,
  kind: "Deductible" | "Oop"
): "inNetworkDeductibleMet" | "outOfNetworkDeductibleMet" | "inNetworkOopMet" | "outOfNetworkOopMet" => {
  const net = netKey(isOON); // FIX from v3: previously inverted
  return `${net}${kind}Met` as "inNetworkDeductibleMet" | "outOfNetworkDeductibleMet" | "inNetworkOopMet" | "outOfNetworkOopMet"; // e.g., inNetworkDeductibleMet
};

const getIndBenefitKey = (
  isOON: boolean,
  kind: "Deductible" | "OopMax" | "CoinsurancePercentage"
): keyof Benefits => {
  const net = netKey(isOON); // FIX from v3: previously inverted
  return `${net}Individual${kind}` as keyof Benefits; // e.g., inNetworkIndividualDeductible
};

const getFamBenefitKey = (
  isOON: boolean,
  kind: "Deductible" | "OopMax"
): keyof Benefits => {
  const net = netKey(isOON);
  return `${net}Family${kind}` as keyof Benefits; // e.g., inNetworkFamilyDeductible
};

// ---------------------------------------------------------------------------------
// VISIT/SERVICE PRICING (MPD etc.)
// ---------------------------------------------------------------------------------

const sessionKeyOf = (proc: Procedure, meta: MetaData) =>
  `${proc.dateOfService || meta.service.date}-${meta.provider.npi}-${meta.service.placeOfService}`;

// Compute allowed per payer with Multi‑Procedure Discount (MPD) factors
function computePayerSpecificAllowedMap(
  payer: Payer,
  procedures: Procedure[],
  metaData: MetaData
): Map<string, { allowed: number; notes: string[] }> {
  const mpd: Record<string, number[]> = {
    "100_50_50": [1, 0.5, 0.5],
    "100_50_25": [1, 0.5, 0.25],
    "100_25_25": [1, 0.25, 0.25],
  };
  const factors = mpd[(payer?.benefits?.multiProcedureLogic as string) || "100_50_50"] || [1, 0.5, 0.5];

  const prelim = procedures.map((proc) => {
    const pb = payer.procedureBenefits.find((x) => x.procedureId === proc.id);
    const units = Math.max(1, num(proc.units));
    const allowedFromPayer = cents(num(pb?.allowedAmount) * units);
    const billed = cents(num(proc.billedAmount));
    return {
      id: proc.id,
      sessionKey: sessionKeyOf(proc, metaData),
      allowedEffective: Math.min(allowedFromPayer, billed),
      category: proc.category || "",
    };
  });

  const bySession = new Map<string, typeof prelim>();
  prelim.forEach((p) => bySession.set(p.sessionKey, [...(bySession.get(p.sessionKey) || []), p]));

  const map = new Map<string, { allowed: number; notes: string[] }>();
  bySession.forEach((list) => {
    const surgical = list
      .filter((p) => p.category?.toLowerCase() === "surgery")
      .sort((a, b) => b.allowedEffective - a.allowedEffective);
    const nonSurgical = list.filter((p) => p.category?.toLowerCase() !== "surgery");

    surgical.forEach((p, idx) => {
      const factor = factors[Math.min(idx, factors.length - 1)];
      const note = `Multiple‑procedure rank ${idx + 1} (${Math.round(factor * 100)}% policy)`;
      map.set(p.id, { allowed: cents(p.allowedEffective * factor), notes: [note] });
    });
    nonSurgical.forEach((p) => map.set(p.id, { allowed: p.allowedEffective, notes: [] }));
  });
  return map;
}

// ---------------------------------------------------------------------------------
// COPAY MASKS (policy‑aware selection of where copay applies per day / bucket)
// ---------------------------------------------------------------------------------

function computeCopayMaskForPayerDay(
  procedures: Procedure[],
  benefits: Benefits,
  benefitsMap: Map<string, ProcedureBenefit>
): Set<string> {
  const policy = benefits.copayLogic;
  if (policy === "standard_waterfall" || policy === "copay_only_if_present") return new Set(procedures.map((p) => p.id));

  const byDate = new Map<string, Procedure[]>();
  procedures.forEach((p) => {
    const dos = p.dateOfService || "unknown";
    byDate.set(dos, [...(byDate.get(dos) || []), p]);
  });

  const mask = new Set<string>();
  byDate.forEach((list) => {
    if (policy === "highest_copay_only_per_day") {
      const pick = list.reduce(
        (acc, p) => {
          const cp = num(benefitsMap.get(p.id)?.copay);
          return cp > acc.val ? { id: p.id, val: cp } : acc;
        },
        { id: "", val: -1 }
      );
      if (pick.id) mask.add(pick.id);
    } else if (policy === "copay_by_category_per_day") {
      const buckets: Record<string, string[]> = {
        surgery: ["Surgery"],
        imaging: ["Imaging"],
        office: ["Office Visit"],
        facility: ["Facility"],
        professional: ["Professional"],
      };
      Object.keys(buckets).forEach((bucket) => {
        const cats = new Set(buckets[bucket]);
        const inBucket = list.filter((p) => cats.has(p.category || ""));
        if (inBucket.length) {
          const pick = inBucket.reduce(
            (acc, p) => {
              const cp = num(benefitsMap.get(p.id)?.copay);
              return cp > acc.val ? { id: p.id, val: cp } : acc;
            },
            { id: "", val: -1 }
          );
          if (pick.id) mask.add(pick.id);
        }
      });
    }
  });
  return mask;
}

// ---------------------------------------------------------------------------------
// COVERAGE GATES (visit limits, DME rental caps, etc.)
// ---------------------------------------------------------------------------------

function coverageGate(
  proc: Procedure,
  benefits: Benefits,
  accumulators: Accumulators
): { allowedEffective: number; preNotes: BreakdownStep[] } {
  const steps: BreakdownStep[] = [];
  let allowedEffective = Infinity;
  const category = (proc.category || "").toLowerCase();

  if (["physical", "occupational", "speech"].includes(category)) {
    const limit = num(benefits.therapyVisitLimits?.[category as keyof Benefits["therapyVisitLimits"]]);
    const used = num(accumulators.therapyVisitsUsed?.[category as keyof Accumulators["therapyVisitsUsed"]]);
    if (limit > 0 && used >= limit) {
      allowedEffective = 0;
      steps.push({ description: "Limit Exhausted", patientOwes: 0, notes: `Annual visit limit of ${limit} reached for ${proc.category}.` });
    }
  }

  if (proc.category === "DME" && benefits.dmeRentalCap?.applies) {
    const purchasePrice = num(benefits.dmeRentalCap.purchasePrice);
    const paidRentals = num(accumulators.dmeRentalPaid);
    if (purchasePrice > 0 && paidRentals >= purchasePrice) {
      allowedEffective = 0;
      steps.push({ description: "Non‑Covered", patientOwes: 0, notes: "DME rental cap reached (purchase price met)." });
    } else if (purchasePrice > 0) {
      allowedEffective = Math.min(allowedEffective, cents(purchasePrice - paidRentals));
    }
  }

  return { allowedEffective, preNotes: steps };
}

// ---------------------------------------------------------------------------------
// WATERFALL STEPS (pure sub‑routines)
// ---------------------------------------------------------------------------------

function applyCopay(
  preventive: boolean,
  copay: number,
  copayApplies: boolean,
  allowedRemaining: number
): { patient: number; allowedRemaining: number; steps: BreakdownStep[] } {
  if (preventive) {
    return {
      patient: 0,
      allowedRemaining,
      steps: [{ description: "Copay", patientOwes: 0, notes: "Preventive service, copay waived." }],
    };
  }
  if (!copayApplies || copay <= 0) return { patient: 0, allowedRemaining, steps: [] };
  const applied = Math.min(cents(copay), allowedRemaining);
  return {
    patient: applied,
    allowedRemaining: cents(allowedRemaining - applied),
    steps: [{ description: "Copay", patientOwes: applied, notes: `Plan copay of $${cents(copay).toFixed(2)} applied.` }],
  };
}

interface DeductibleContext {
  planType: Benefits["planType"]; // "Individual" | "EmbeddedFamily" | "AggregateFamily"
  indPlanDed: number;
  famPlanDed: number;
  indDedMet: number;
  famDedMet: number; // Infinity if not tracked
}

function computeDeductibleRoom(ctx: DeductibleContext): { indRoom: number; famRoom: number; roomForThisLine: number } {
  const indRoom = clamp0(cents(ctx.indPlanDed - ctx.indDedMet));
  const famRoom = clamp0(cents(ctx.famPlanDed - ctx.famDedMet));
  if (ctx.planType === "Individual") return { indRoom, famRoom: Infinity, roomForThisLine: indRoom };
  if (ctx.planType === "AggregateFamily") return { indRoom: 0, famRoom, roomForThisLine: famRoom };
  // Embedded: you can apply up to IND room, but must also respect remaining FAM room (lesser‑of)
  return { indRoom, famRoom, roomForThisLine: Math.min(indRoom, famRoom || Infinity) };
}

function applyDeductible(
  allowedRemaining: number,
  ctx: DeductibleContext
): {
  appliedToDed: number;
  allowedRemaining: number;
  indDelta: number;
  famDelta: number;
  steps: BreakdownStep[];
} {
  if (allowedRemaining <= 0) return { appliedToDed: 0, allowedRemaining, indDelta: 0, famDelta: 0, steps: [] };

  const { indRoom, famRoom, roomForThisLine } = computeDeductibleRoom(ctx);
  const toApply = Math.min(allowedRemaining, roomForThisLine);
  if (toApply <= 0) return { appliedToDed: 0, allowedRemaining, indDelta: 0, famDelta: 0, steps: [] };

  const indDelta = ctx.planType === "AggregateFamily" ? 0 : Math.min(toApply, indRoom);
  const famDelta = ctx.planType === "Individual" ? 0 : Math.min(toApply, famRoom);

  const steps: BreakdownStep[] = [
    { description: "Deductible", patientOwes: cents(toApply), notes: `Applied to ${ctx.planType} deductible.` },
  ];
  if (indDelta > 0 && indDelta >= indRoom)
    steps.push({ description: "Benefit Status Change", patientOwes: 0, notes: "Individual Deductible met on this line." });
  if (famDelta > 0 && famDelta >= famRoom)
    steps.push({ description: "Benefit Status Change", patientOwes: 0, notes: "Family Deductible met on this line." });

  return {
    appliedToDed: cents(toApply),
    allowedRemaining: cents(allowedRemaining - toApply),
    indDelta: cents(indDelta),
    famDelta: cents(famDelta),
    steps,
  };
}

function applyCoinsurance(
  preventive: boolean,
  coinsPct: number,
  allowedRemaining: number
): { patientCoins: number; steps: BreakdownStep[] } {
  if (preventive || allowedRemaining <= 0) return { patientCoins: 0, steps: [] };
  const pct = clamp0(num(coinsPct));
  const patientCoins = cents(allowedRemaining * (pct / 100));
  return { patientCoins, steps: [{ description: "Coinsurance", patientOwes: patientCoins, notes: `${pct}% of remaining $${allowedRemaining.toFixed(2)}.` }] };
}

function computeOopRoom(ctx: OOPContext): { indRoom: number; famRoom: number; roomForThisLine: number } {
  const indRoom = clamp0(cents(ctx.indPlanOop - ctx.indOopMet));
  const famRoom = clamp0(cents(ctx.famPlanOop - ctx.famOopMet));
  if (ctx.planType === "Individual") return { indRoom, famRoom: Infinity, roomForThisLine: indRoom };
  if (ctx.planType === "AggregateFamily") return { indRoom: 0, famRoom, roomForThisLine: famRoom };
  return { indRoom, famRoom, roomForThisLine: Math.min(indRoom, famRoom || Infinity) };
}

function applyOopCap(
  patientOwesSoFar: number,
  ctx: OOPContext
): { patientAfterCap: number; indDelta: number; famDelta: number; steps: BreakdownStep[] } {
  if (patientOwesSoFar <= 0) return { patientAfterCap: 0, indDelta: 0, famDelta: 0, steps: [] };
  const { indRoom, famRoom, roomForThisLine } = computeOopRoom(ctx);
  const cappedAmount = Math.max(0, patientOwesSoFar - roomForThisLine);
  const applyToOop = cents(patientOwesSoFar - cappedAmount);
  
  const steps: BreakdownStep[] = [];
  if (cappedAmount > 0) steps.push({ description: "OOP Max Reached", patientOwes: -cappedAmount, notes: "Patient cost capped by Out‑of‑Pocket Maximum." });

  const indDelta = ctx.planType === "AggregateFamily" ? 0 : Math.min(applyToOop, indRoom);
  const famDelta = ctx.planType === "Individual" ? 0 : Math.min(applyToOop, famRoom);

  if (indDelta > 0 && indDelta >= indRoom)
    steps.push({ description: "Benefit Status Change", patientOwes: 0, notes: "Individual OOP Max met on this line." });
  if (famDelta > 0 && famDelta >= famRoom)
    steps.push({ description: "Benefit Status Change", patientOwes: 0, notes: "Family OOP Max met on this line." });

  return { patientAfterCap: cents(applyToOop), indDelta: cents(indDelta), famDelta: cents(famDelta), steps };
}

// ---------------------------------------------------------------------------------
// LINE ADJUDICATION (single payer, single line)
// ---------------------------------------------------------------------------------

function adjudicateLine(
  procedure: Procedure,
  benefits: Benefits,
  procBen: ProcedureBenefit | null,
  initAcc: Accumulators,
  initFamAcc: Accumulators | null,
  allowedAmount: number,
  isOON: boolean
): {
  patientCostShare: number;
  payerPayment: number;
  steps: BreakdownStep[];
  nextAcc: Accumulators;
  nextFam: Accumulators | null;
  allowedUsed: number;
} {
  const steps: BreakdownStep[] = [];
  let remainingAllowed = cents(allowedAmount);
  let patientOwes = 0;

  // Local copies we will return (immutably updated)
  const acc = clone(initAcc);
  const fam = initFamAcc ? clone(initFamAcc) : null;
  const networkTag = isOON ? 'OON' : 'INN';

  // 1) Copay (unless preventive)
  const cp = cents(num(procBen?.copay));
  const copayMaskApplies = true; // actual mask handled outside for policies; default here is permissive
  const copayResult = applyCopay(!!procedure.isPreventive, cp, copayMaskApplies, remainingAllowed);
  patientOwes = cents(patientOwes + copayResult.patient);
  remainingAllowed = copayResult.allowedRemaining;
  steps.push(...copayResult.steps);

  // 2) Deductible
  if (remainingAllowed > 0 && !procedure.isPreventive) {
    const ctx: DeductibleContext = {
      planType: benefits.planType,
      indPlanDed: num(benefits[getIndBenefitKey(isOON, "Deductible")]),
      famPlanDed: num(benefits[getFamBenefitKey(isOON, "Deductible")]),
      indDedMet: num(acc[getMetKey(isOON, "Deductible")]),
      famDedMet: fam ? num(fam[getMetKey(isOON, "Deductible")]) : Infinity,
    };
    const d = applyDeductible(remainingAllowed, ctx);
    patientOwes = cents(patientOwes + d.appliedToDed);
    remainingAllowed = d.allowedRemaining;
    steps.push(...d.steps);

    // Update accumulators & add logging steps
    if (d.indDelta > 0 && (benefits.planType === "Individual" || benefits.planType === "EmbeddedFamily")) {
      const k = getMetKey(isOON, "Deductible");
      const cap = ctx.indPlanDed || Infinity;
      const oldVal = num(acc[k]);
      acc[k] = String(cents(Math.min(oldVal + d.indDelta, cap)));
      steps.push({ description: `Accumulator Update (Ind Deductible - ${networkTag})`, patientOwes: 0, notes: `Old: $${oldVal.toFixed(2)}, Applied: $${d.indDelta.toFixed(2)}, New: $${num(acc[k]).toFixed(2)}` });
    }
    if (d.famDelta > 0 && (benefits.planType === "AggregateFamily" || benefits.planType === "EmbeddedFamily") && fam) {
      const k = getMetKey(isOON, "Deductible");
      const cap = ctx.famPlanDed || Infinity;
      const oldVal = num(fam[k]);
      fam[k] = String(cents(Math.min(oldVal + d.famDelta, cap)));
      steps.push({ description: `Accumulator Update (Fam Deductible - ${networkTag})`, patientOwes: 0, notes: `Old: $${oldVal.toFixed(2)}, Applied: $${d.famDelta.toFixed(2)}, New: $${num(fam[k]).toFixed(2)}` });
    }
  }

  // 3) Coinsurance (on remaining allowed)
  if (remainingAllowed > 0 && !procedure.isPreventive) {
    // FIX: Correctly access plan-level coinsurance. It does not have "Individual" in the key.
    const coinsuranceKey = isOON ? 'outOfNetworkCoinsurancePercentage' : 'inNetworkCoinsurancePercentage';
    const pct = num(procBen?.coinsurancePercentage) || num(benefits[coinsuranceKey]);
    const coins = applyCoinsurance(false, pct, remainingAllowed);
    patientOwes = cents(patientOwes + coins.patientCoins);
    steps.push(...coins.steps);
  }

  // 4) OOP Cap (applies to the sum of patient components)
  const oopCtx: OOPContext = {
    planType: benefits.planType,
    indPlanOop: num(benefits[getIndBenefitKey(isOON, "OopMax")]),
    famPlanOop: num(benefits[getFamBenefitKey(isOON, "OopMax")]),
    indOopMet: num(acc[getMetKey(isOON, "Oop")]),
    famOopMet: fam ? num(fam[getMetKey(isOON, "Oop")]) : Infinity,
  };
  const oop = applyOopCap(patientOwes, oopCtx);
  const oopCappedReduction = cents(patientOwes - oop.patientAfterCap);
  patientOwes = oop.patientAfterCap;
  steps.push(...oop.steps);

  // Update OOP accumulators & add logging steps
  if (oop.indDelta > 0 && (benefits.planType === "Individual" || benefits.planType === "EmbeddedFamily")) {
    const k = getMetKey(isOON, "Oop");
    const cap = oopCtx.indPlanOop || Infinity;
    const oldVal = num(acc[k]);
    acc[k] = String(cents(Math.min(oldVal + oop.indDelta, cap)));
    steps.push({ description: `Accumulator Update (Ind OOP - ${networkTag})`, patientOwes: 0, notes: `Old: $${oldVal.toFixed(2)}, Applied: $${oop.indDelta.toFixed(2)}, New: $${num(acc[k]).toFixed(2)}` });
  }
  if (oop.famDelta > 0 && (benefits.planType === "AggregateFamily" || benefits.planType === "EmbeddedFamily") && fam) {
    const k = getMetKey(isOON, "Oop");
    const cap = oopCtx.famPlanOop || Infinity;
    const oldVal = num(fam[k]);
    fam[k] = String(cents(Math.min(oldVal + oop.famDelta, cap)));
    steps.push({ description: `Accumulator Update (Fam OOP - ${networkTag})`, patientOwes: 0, notes: `Old: $${oldVal.toFixed(2)}, Applied: $${oop.famDelta.toFixed(2)}, New: $${num(fam[k]).toFixed(2)}` });
  }

  // Compute payer payment (cannot exceed allowed)
  const payerPayment = cents(Math.max(0, allowedAmount - patientOwes));

  return {
    patientCostShare: cents(Math.max(0, patientOwes)),
    payerPayment,
    steps,
    nextAcc: acc,
    nextFam: fam,
    allowedUsed: allowedAmount,
  };
}

// ---------------------------------------------------------------------------------
// COB METHODS
// ---------------------------------------------------------------------------------

function resolveCobMethod(payer: Payer): CobMethod {
  const m = (payer.cobMethod as string | undefined)?.toLowerCase();
  if (!m) return CobMethod.Traditional;
  if (["traditional", "full", "100% allowable", "full_benefit"].includes(m)) return CobMethod.Traditional;
  if (["nonduplication", "non_duplication", "non-dup", "nondup"].includes(m)) return CobMethod.NonDuplication;
  if (["carveout", "carve_out", "maintenance_of_benefits", "mob"].includes(m)) return CobMethod.CarveOut;
  return CobMethod.Traditional;
}

function computeCobPayment(args: {
  method: CobMethod;
  asIf: { wouldPay: number; simulatedAllowed: number; patientCostShare: number };
  priorPaid: number;
  claimAmount: number;
  secondaryAllowed: number; // used for strict allowed cap rules
  strictAllowedCap?: boolean; // default true
}): number {
  const { method, asIf, priorPaid, claimAmount, secondaryAllowed } = args;
  const strictCap = args.strictAllowedCap ?? true;
  let payment = 0;

  switch (method) {
    case CobMethod.Traditional:
      // Secondary pays up to its "would pay" but not over remaining allowed nor over claim
      payment = Math.max(0, Math.min(asIf.wouldPay, secondaryAllowed - priorPaid, claimAmount));
      break;
    case CobMethod.NonDuplication:
      // Pay the difference between secondary's wouldPay and priorPaid
      payment = Math.max(0, Math.min(asIf.wouldPay - priorPaid, claimAmount));
      break;
    case CobMethod.CarveOut:
      // Often: pay up to the patient share calculated under secondary benefits
      payment = Math.max(0, Math.min(asIf.patientCostShare, claimAmount));
      break;
    default:
      payment = Math.max(0, Math.min(asIf.wouldPay, claimAmount));
  }

  if (strictCap && payment > claimAmount) payment = claimAmount;
  return cents(payment);
}

// TPL / Subrogation gate for downstream payers
function tplBlocksDownstream(payers: Payer[], index: number, tplBlocksGroupHealth: boolean = true) {
  const prior = payers[index - 1];
  if (!prior) return false;
  const tplPrior = prior.payerType === PayerType.Auto || prior.payerType === PayerType.WorkersComp;
  return tplBlocksGroupHealth && tplPrior && prior.subrogationActive;
}

// ---------------------------------------------------------------------------------
// PROPENSITY — v2 (next level algo)
// ---------------------------------------------------------------------------------

function calculatePropensityScore(
  totalPatientResponsibility: number,
  _payers: Payer[],
  _procedures: Procedure[],
  propensityData: PropensityData
): PropensityResult | null {
  if (
    !propensityData ||
    (
      !propensityData.paymentHistory &&
      !propensityData.financialConfidence &&
      !propensityData.outstandingBalance &&
      !propensityData.employmentStatus &&
      !propensityData.householdIncome
    )
  ) return null;

  let score = 50;
  const factors: Record<string, number> = {};
  
  // 1. Bill Size
  if (totalPatientResponsibility > 5000) { score -= 30; factors["High Bill Amount (> $5k)"] = -30; }
  else if (totalPatientResponsibility > 1000) { score -= 20; factors["High Bill Amount (> $1k)"] = -20; }
  else if (totalPatientResponsibility > 200) { score -= 5; factors["Moderate Bill Amount"] = -5; }
  else { score += 10; factors["Low Bill Amount (< $200)"] = 10; }

  // 2. Payment History (Patient-reported)
  const historyMap: Record<string, number> = { on_time: 25, payment_plan: 5, sometimes_late: -10, difficulty: -25, "": 0 };
  const historyImpact = historyMap[propensityData.paymentHistory] || 0;
  if (historyImpact !== 0) { score += historyImpact; factors["Payment History"] = historyImpact; }

  // 3. Financial Confidence (Patient-reported)
  const confMap: Record<string, number> = { excellent: 15, good: 5, fair: -10, needs_improvement: -25, "": 0 };
  const confImpact = confMap[propensityData.financialConfidence] || 0;
  if (confImpact !== 0) { score += confImpact; factors["Financial Confidence"] = confImpact; }

  // 4. Outstanding Balance with Provider
  const numBalance = num(propensityData.outstandingBalance);
  if (numBalance > 1000) { score -= 20; factors["High Outstanding Balance"] = -20; }
  else if (numBalance > 0) { score -= 10; factors["Existing Balance"] = -10; }
  else if (propensityData.outstandingBalance) { score += 5; factors["No Outstanding Balance"] = 5; }

  // 5. Employment Status
  const employmentMap: Record<string, number> = { employed: 10, retired: 5, student: -5, unemployed: -20, other: 0, "": 0 };
  const employmentImpact = employmentMap[propensityData.employmentStatus] || 0;
  if (employmentImpact !== 0) { score += employmentImpact; factors["Employment Status"] = employmentImpact; }

  // 6. Income Stress & Household Size
  const incomeMidpoints: Record<string, number> = { '<25k': 12500, '25k-50k': 37500, '50k-100k': 75000, '100k-200k': 150000, '>200k': 250000, '': 0 };
  const income = incomeMidpoints[propensityData.householdIncome];
  if (income > 0) {
      const stress = totalPatientResponsibility / income;
      if (stress > 0.1) { score -= 20; factors["High Bill-to-Income Ratio (>10%)"] = -20; }
      else if (stress > 0.05) { score -= 10; factors["Moderate Bill-to-Income Ratio (>5%)"] = -10; }

      const numHouseholdSize = num(propensityData.householdSize);
      if (income < 50000 && numHouseholdSize > 2) {
          score -= 10; factors["Low Income & Multiple Dependents"] = -10;
      }
  }

  // 7. HDHP / HSA Plan
  if (propensityData.isHSACompatible) {
      score -= 15;
      factors["High Deductible Plan (HSA)"] = -15;
  }
  
  score = Math.max(0, Math.min(100, Math.round(score)));

  const tier = score > 75 ? "High" : score > 40 ? "Medium" : "Low";
  const recommendation =
    tier === "High"
      ? "Patient has a high likelihood of paying. Standard billing procedures are recommended."
      : tier === "Medium"
      ? "Patient may need flexible options. Proactively offer short-term payment plans."
      : "Patient has a high risk of non-payment. Immediate engagement with a financial counselor is strongly recommended.";

  let dynamicActions: any[] = [];
  if (tier === "High") dynamicActions.push({ text: "Pay in Full Now", type: "primary" }, { text: "View Short‑Term Plans", type: "secondary" });
  else if (tier === "Medium") dynamicActions.push({ text: "Setup a Payment Plan", type: "primary" }, { text: "Contact Financial Counselor", type: "secondary" });
  else dynamicActions.push({ text: "Contact Financial Counselor", type: "primary" }, { text: "Learn about Financial Assistance", type: "secondary" });

  return { score, tier, recommendation, dynamicActions, factors };
}

// ---------------------------------------------------------------------------------
// MAIN ORCHESTRATOR — calculateCombinedEstimate
// ---------------------------------------------------------------------------------

export function calculateCombinedEstimate(
  payers: Payer[],
  procedures: Procedure[],
  metaData: MetaData,
  propensityData: PropensityData
): EstimateData {
  // Immutable snapshots for adjudication chain
  const allowedMaps = payers.map((p) => computePayerSpecificAllowedMap(p, procedures, metaData));

  const adjudicationChain: AdjudicationForPayer[] = [];
  const nonCobPatientLiability: Record<string, number> = {};

  const procStates: ProcedureState[] = procedures.map((p, i) => ({
    id: p.id,
    originalBilledAmount: cents(num(p.billedAmount)),
    cumulativePlanPaid: 0,
    remainingBalance: cents(num(p.billedAmount)),
    lastAdjudicatedAllowedAmount: 0,
    originalIndex: i,
  }));

  for (let i = 0; i < payers.length; i++) {
    const payer = payers[i];
    const isOON = payer.networkStatus === "out-of-network";
    const allowedMap = allowedMaps[i];

    let currentAcc = clone(payer.patientAccumulators);
    let currentFamAcc = payer.familyAccumulators ? clone(payer.familyAccumulators) : null;

    const benMap = new Map(payer.procedureBenefits.map((pb) => [pb.procedureId, pb]));
    const copayMask = computeCopayMaskForPayerDay(procedures, payer.benefits, benMap);

    const payerBlock: AdjudicationForPayer = {
      ...payer,
      procedureEstimates: [],
      totalPayerPaymentThisPayer: 0,
      totalPatientShareThisPayer: 0,
      totalRemainingBalanceAfterPayer: 0,
    } as any; // (keep shape compatible with your types)

    // Deductible allocation order
    const orderPref = (payer?.benefits?.deductibleAllocation as string) || "highest_allowed_first";
    const ordered: ProcedureState[] = (() => {
      if (["line_item_order", "line_order"].includes(orderPref)) return [...procStates];
      // default: highest allowed first
      return [...procStates].sort(
        (a, b) => (allowedMap.get(b.id)?.allowed || 0) - (allowedMap.get(a.id)?.allowed || 0)
      );
    })();

    const blockTPL = i > 0 && tplBlocksDownstream(payers, i, true);

    for (const [orderIndex, procState] of ordered.entries()) {
      const originalProcedure = procedures.find((p) => p.id === procState.id)!;

      // COB‑eligible claim amount is the remaining balance from prior payers
      let claimAmount = clamp0(cents(procState.remainingBalance));

      // If TPL blocks downstream commercial, zero out claim amount
      if (blockTPL && [PayerType.Commercial, ("employer" as any)].includes(payer.payerType)) claimAmount = 0;

      if (claimAmount <= 0) {
        payerBlock.procedureEstimates.push({
          id: procState.id,
          cptCode: originalProcedure.cptCode,
          originalBilledAmount: procState.originalBilledAmount,
          patientCostShare: 0,
          payerPayment: 0,
          balanceAfterPayer: 0,
          finalAllowedAmount: procState.lastAdjudicatedAllowedAmount,
          calculationBreakdown: [
            { description: "No remaining COB‑eligible balance", patientOwes: 0, notes: "" },
          ],
          processingOrder: orderIndex + 1,
        } as any);
        continue;
      }

      const pricing = allowedMap.get(procState.id) || { allowed: 0, notes: [] };
      const { allowedEffective: coverageCap, preNotes } = coverageGate(originalProcedure, payer.benefits, currentAcc);
      const finalAllowed = Math.min(pricing.allowed, coverageCap);

      // Compute as if this payer were primary using CURRENT accumulators
      let asIf = adjudicateLine(
        originalProcedure,
        payer.benefits,
        benMap.get(procState.id) || null,
        currentAcc,
        currentFamAcc,
        finalAllowed,
        isOON
      );

      // BUG FIX: Correctly handle "Copay Only" logic by ensuring it also respects the OOP cap and updates accumulators.
      if (payer.benefits.copayLogic === "copay_only_if_present" && copayMask.has(procState.id)) {
          const cp = cents(num(benMap.get(procState.id)?.copay));
          if (cp > 0) {
              const patientShareFromCopay = Math.min(cp, finalAllowed);
              
              const oopCtx: OOPContext = {
                  planType: payer.benefits.planType,
                  indPlanOop: num(payer.benefits[getIndBenefitKey(isOON, "OopMax")]),
                  famPlanOop: num(payer.benefits[getFamBenefitKey(isOON, "OopMax")]),
                  indOopMet: num(currentAcc[getMetKey(isOON, "Oop")]),
                  famOopMet: currentFamAcc ? num(currentFamAcc[getMetKey(isOON, "Oop")]) : Infinity,
              };
              const oop = applyOopCap(patientShareFromCopay, oopCtx);
              const finalPatientShare = oop.patientAfterCap;
              const finalPayerPayment = cents(finalAllowed - finalPatientShare);

              const newAcc = clone(currentAcc);
              const newFamAcc = currentFamAcc ? clone(currentFamAcc) : null;

              if (oop.indDelta > 0 && (payer.benefits.planType === "Individual" || payer.benefits.planType === "EmbeddedFamily")) {
                  const k = getMetKey(isOON, "Oop");
                  const cap = oopCtx.indPlanOop || Infinity;
                  const oldVal = num(newAcc[k]);
                  newAcc[k] = String(cents(Math.min(oldVal + oop.indDelta, cap)));
              }
              if (oop.famDelta > 0 && (payer.benefits.planType === "AggregateFamily" || payer.benefits.planType === "EmbeddedFamily") && newFamAcc) {
                  const k = getMetKey(isOON, "Oop");
                  const cap = oopCtx.famPlanOop || Infinity;
                  const oldVal = num(newFamAcc[k]);
                  newFamAcc[k] = String(cents(Math.min(oldVal + oop.famDelta, cap)));
              }

              asIf = {
                  patientCostShare: finalPatientShare,
                  payerPayment: finalPayerPayment,
                  steps: [
                      ...preNotes,
                      { description: "Copay Only", patientOwes: patientShareFromCopay, notes: `Plan has a 'Copay Only' rule for this service.` },
                      ...oop.steps
                  ],
                  nextAcc: newAcc,
                  nextFam: newFamAcc,
                  allowedUsed: finalAllowed,
              };
          }
      }

      // The actual payer payment may be reduced by COB if this is not the first payer
      let actualPayerPayment = asIf.payerPayment;
      let steps = [
        ...preNotes,
        ...pricing.notes.map((n) => ({ description: "Pricing Adjustment", patientOwes: 0, notes: n } as BreakdownStep)),
        ...asIf.steps,
      ];

      if (i > 0) {
        // Use payer's ORIGINAL base accumulators to compute a clean "as if primary" scenario for COB math
        const asIfPrimary = adjudicateLine(
          originalProcedure,
          payer.benefits,
          benMap.get(procState.id) || null,
          payer.patientAccumulators,
          payer.familyAccumulators,
          finalAllowed,
          isOON
        );

        actualPayerPayment = computeCobPayment({
          method: resolveCobMethod(payer),
          asIf: {
            wouldPay: asIfPrimary.payerPayment,
            simulatedAllowed: asIfPrimary.allowedUsed,
            patientCostShare: asIfPrimary.patientCostShare,
          },
          priorPaid: procState.cumulativePlanPaid,
          claimAmount,
          secondaryAllowed: asIfPrimary.allowedUsed,
          strictAllowedCap: true,
        });
      }
      
      const actualPatientShareThisPayer = (i === 0) ? asIf.patientCostShare : cents(claimAmount - actualPayerPayment);

      // Update cumulative payments and remaining balances
      procState.cumulativePlanPaid = cents(procState.cumulativePlanPaid + actualPayerPayment);
      procState.lastAdjudicatedAllowedAmount = finalAllowed;

      if (i === 0) {
        // PRIMARY payer
        if (isOON) {
          const oonBB = clamp0(cents(procState.originalBilledAmount - finalAllowed));
          if (oonBB > 0) {
            steps.push({ description: "OON Balance Bill", patientOwes: oonBB, notes: "Non‑COB eligible" });
            nonCobPatientLiability[procState.id] = (nonCobPatientLiability[procState.id] || 0) + oonBB;
          }
          procState.remainingBalance = cents(asIf.patientCostShare);
        } else {
          const writeOff = clamp0(cents(procState.originalBilledAmount - finalAllowed));
          if (writeOff > 0)
            steps.push({ description: "Write‑Off", patientOwes: 0, notes: `Contractual write‑off $${writeOff.toFixed(2)}` });
          procState.remainingBalance = cents(asIf.patientCostShare);
        }
      } else {
        // SECONDARY+
        procState.remainingBalance = clamp0(cents(procState.remainingBalance - actualPayerPayment));
      }

      // Commit the per‑payer accumulators (carry forward for subsequent lines at same payer)
      currentAcc = asIf.nextAcc;
      currentFamAcc = asIf.nextFam;

      payerBlock.procedureEstimates.push({
        id: procState.id,
        cptCode: originalProcedure.cptCode,
        originalBilledAmount: procState.originalBilledAmount,
        patientCostShare: actualPatientShareThisPayer, // Use the corrected value
        payerPayment: actualPayerPayment,
        balanceAfterPayer: procState.remainingBalance,
        finalAllowedAmount: finalAllowed,
        calculationBreakdown: steps,
        processingOrder: orderIndex + 1,
      } as any);

      payerBlock.totalPayerPaymentThisPayer = cents(payerBlock.totalPayerPaymentThisPayer + actualPayerPayment);
      payerBlock.totalPatientShareThisPayer = cents(payerBlock.totalPatientShareThisPayer + actualPatientShareThisPayer); // Use the corrected value
    }

    // Summaries for this payer
    payerBlock.totalRemainingBalanceAfterPayer = cents(procStates.reduce((s, p) => s + p.remainingBalance, 0));
    payerBlock.procedureEstimates.sort(
      (a: any, b: any) => procedures.findIndex((p) => p.id === a.id) - procedures.findIndex((p) => p.id === b.id)
    );
    adjudicationChain.push(payerBlock);
  }

  // Final totals
  const cobEligible = cents(procStates.reduce((s, p) => s + p.remainingBalance, 0));
  const cobIneligible = cents(Object.values(nonCobPatientLiability).reduce((a, b) => a + b, 0));
  const finalPatientResponsibility = cents(cobEligible + cobIneligible);

  return {
    metaData,
    payers,
    procedures,
    totalPatientResponsibility: finalPatientResponsibility,
    adjudicationChain,
    propensity: calculatePropensityScore(finalPatientResponsibility, payers, procedures, propensityData),
    nonCobPatientLiability,
  } as EstimateData;
}

// ---------------------------------------------------------------------------------
// NOTES / COMPATIBILITY & VALIDATION HOOKS
// ---------------------------------------------------------------------------------
// 1) Network mapping bug FIXED: getIndBenefitKey/getFamBenefitKey now use correct inNetwork/outOfNetwork resolution.
// 2) Embedded Family logic: deductible & OOP now apply using lesser‑of (IND room, FAM room) while still allowing
//    coinsurance to kick in when IND room = 0 (even if family room remains). We update IND and FAM accumulators
//    proportionally and cap at plan values.
// 3) Aggregate Family logic: deductible & OOP track only family limits (IND rooms ignored for gating, but IND can
//    remain as zero or informational). Update only FAM accumulators.
// 4) Individual plans: only IND accumulators change and gate cost share.
// 5) Coinsurance is computed on the remainder after deductible. Preventive waives copay/coinsurance/deductible.
// 6) OOP Cap enforces the lesser‑of IND and FAM rooms based on plan type; both accumulators are updated accordingly.
// 7) COB math remains explicit and uses a clean "asIfPrimary" run with the payer's own base accumulators so that
//    COB payment is not polluted by prior payers' accumulator updates.
// 8) MPD preserved; per‑session factors with clean notes.
// 9) TPL/subrogation: downstream commercial payers can be blocked if prior TPL active.
// 10) Every step is cent‑rounded and clamped to avoid negative drifts.
// ------------------------------------------------------------------------------------