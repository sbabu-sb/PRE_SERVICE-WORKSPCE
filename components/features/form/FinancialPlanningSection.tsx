import React, { useCallback } from 'react';
import { Wallet, ShieldCheck } from 'lucide-react';
import { useEstimateState, useEstimateDispatch } from '../../../context/EstimateContext';
import SelectField from '../../common/SelectField';
import InputField from '../../common/InputField';
import { PropensityData } from '../../../types';

const FinancialPlanningSection: React.FC = () => {
    const { propensityData } = useEstimateState();
    const dispatch = useEstimateDispatch();

    const handlePropensityChange = useCallback((e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const { name, value, type } = e.target;
        const finalValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        dispatch({ type: 'UPDATE_PROPENSITY', payload: { name, value: finalValue } });
    }, [dispatch]);


    return (
         <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200/80">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-3 mb-4 flex items-center space-x-2">
                <Wallet className="text-blue-600" /> 
                <span>Financial Planning Inputs (Optional & Confidential)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Column 1 */}
                <div className="space-y-4">
                     <SelectField
                        label="Patient Payment History"
                        name="paymentHistory"
                        value={propensityData.paymentHistory}
                        onChange={handlePropensityChange}
                        tooltip="Helps understand past behavior with medical bills."
                    >
                        <option value="">Select an option</option>
                        <option value="on_time">Always pay medical bills on time</option>
                        <option value="payment_plan">Have used payment plans before</option>
                        <option value="sometimes_late">Sometimes late, but always pay</option>
                        <option value="difficulty">Have had difficulty paying large bills</option>
                    </SelectField>
                    <InputField 
                        label="Outstanding Balance ($)"
                        name="outstandingBalance"
                        type="number"
                        value={propensityData.outstandingBalance}
                        onChange={handlePropensityChange}
                        placeholder="e.g., 500"
                        tooltip="Current unpaid balance with this provider, if any."
                    />
                </div>
                {/* Column 2 */}
                <div className="space-y-4">
                    <SelectField
                        label="Current Financial Confidence"
                        name="financialConfidence"
                        value={propensityData.financialConfidence}
                        onChange={handlePropensityChange}
                        tooltip="A self-assessment of ability to handle this bill."
                    >
                        <option value="">Select an option</option>
                        <option value="excellent">Excellent - Confident I can cover costs</option>
                        <option value="good">Good - Can cover costs, may need to budget</option>
                        <option value="fair">Fair - A large bill would be a challenge</option>
                        <option value="needs_improvement">Needs Improvement - Concerned about ability to pay</option>
                    </SelectField>
                     <SelectField
                        label="Employment Status"
                        name="employmentStatus"
                        value={propensityData.employmentStatus}
                        onChange={handlePropensityChange}
                        tooltip="Employment is a key factor in financial stability."
                    >
                        <option value="">Select an option</option>
                        <option value="employed">Employed / Self-Employed</option>
                        <option value="unemployed">Unemployed</option>
                        <option value="student">Student</option>
                        <option value="retired">Retired</option>
                        <option value="other">Other</option>
                    </SelectField>
                </div>
                {/* Column 3 */}
                <div className="space-y-4">
                     <SelectField
                        label="Annual Household Income"
                        name="householdIncome"
                        value={propensityData.householdIncome}
                        onChange={handlePropensityChange}
                        tooltip="Provides context for the bill's size and eligibility for assistance."
                    >
                        <option value="">Select a range</option>
                        <option value="<25k">Less than $25,000</option>
                        <option value="25k-50k">$25,000 - $49,999</option>
                        <option value="50k-100k">$50,000 - $99,999</option>
                        <option value="100k-200k">$100,000 - $199,999</option>
                        <option value=">200k">More than $200,000</option>
                    </SelectField>
                     <InputField 
                        label="Household Size"
                        name="householdSize"
                        type="number"
                        min="1"
                        step="1"
                        value={propensityData.householdSize}
                        onChange={handlePropensityChange}
                        tooltip="Number of people supported by the household income."
                    />
                </div>
                <div className="md:col-span-2 lg:col-span-3 pt-4">
                     <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 cursor-pointer">
                        <input
                            type="checkbox"
                            name="isHSACompatible"
                            checked={propensityData.isHSACompatible}
                            onChange={handlePropensityChange}
                            className={`appearance-none h-5 w-5 rounded border border-gray-300 bg-white checked:bg-blue-600 checked:border-transparent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 checked:bg-no-repeat checked:bg-center checked:bg-cover checked:bg-[url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e")]`}
                        />
                        <span className="text-sm font-medium text-gray-700">Patient is on a High-Deductible Health Plan (HDHP) / HSA-Compatible Plan</span>
                    </label>
                </div>
            </div>
             <p className="text-xs text-gray-500 mt-4 text-center">
                 <ShieldCheck className="h-4 w-4 inline mr-1"/>
                 This information is confidential, not stored, and used only to provide helpful guidance on managing your estimated costs.
             </p>
        </div>
    );
};

export default FinancialPlanningSection;