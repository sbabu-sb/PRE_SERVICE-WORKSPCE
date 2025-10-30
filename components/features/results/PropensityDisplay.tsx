import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Wallet, CalendarPlus, Phone, Info } from 'lucide-react';
import { PropensityResult } from '../../../types';

interface PropensityDisplayProps {
    propensity: PropensityResult | null;
    showActionModal: (title: string, message: string) => void;
}

const PropensityDisplay: React.FC<PropensityDisplayProps> = ({ propensity, showActionModal }) => {
    if (!propensity) return null;

    const { tier, recommendation, dynamicActions } = propensity;
    const tierStyles = { 
        High: { icon: <TrendingUp/>, title: 'High Readiness', borderClass: 'border-green-500', textClass: 'text-green-600', bgClass: 'bg-green-600', hoverBgClass: 'hover:bg-green-700' }, 
        Medium: { icon: <TrendingDown/>, title: 'Medium Readiness', borderClass: 'border-yellow-500', textClass: 'text-yellow-600', bgClass: 'bg-yellow-600', hoverBgClass: 'hover:bg-yellow-700' }, 
        Low: { icon: <AlertTriangle/>, title: 'Low Readiness', borderClass: 'border-red-500', textClass: 'text-red-600', bgClass: 'bg-red-600', hoverBgClass: 'hover:bg-red-700' }, 
    };
    const currentTier = tierStyles[tier] || tierStyles.Medium;
    const actionIcons: Record<string, React.ReactNode> = { 'Pay in Full Now': <Wallet/>, 'View Short-Term Plans': <CalendarPlus/>, 'Setup a Payment Plan': <CalendarPlus/>, 'Contact Financial Counselor': <Phone/>, 'Learn about Financial Assistance': <Info/> };
    
    const handleActionClick = (action: {text: string}) => { 
        const messages: Record<string, string> = { 
            'Pay in Full Now': "This would typically redirect to a secure payment portal.", 
            'View Short-Term Plans': "This would display available short-term payment plans for this balance.", 
            'Setup a Payment Plan': "This would guide the user through setting up a structured payment plan.", 
            'Contact Financial Counselor': "This would provide contact information for the financial counseling department.", 
            'Learn about Financial Assistance': "This would link to information about financial assistance programs." 
        }; 
        showActionModal(`Action: ${action.text}`, messages[action.text] || "This will perform the selected action."); 
    };

    return ( 
        <div className={`bg-white p-6 rounded-xl shadow-lg border-l-4 ${currentTier.borderClass}`}>
            <h3 className="text-xl font-semibold text-gray-800 mb-2 flex items-center">
                <span className={`${currentTier.textClass} mr-2`}>{currentTier.icon}</span> Payment Readiness Guide: <span className={`ml-2 ${currentTier.textClass}`}>{currentTier.title}</span>
            </h3>
            <p className="text-gray-600 text-sm mb-4">{recommendation}</p>
            <div className="flex flex-wrap items-center gap-3">
                {dynamicActions && dynamicActions.map(action => ( 
                    <button key={action.text} onClick={() => handleActionClick(action)} 
                        className={`flex items-center space-x-2 text-sm font-semibold py-2 px-4 rounded-lg transition transform hover:scale-105 ${ 
                            action.type === 'primary' ? `${currentTier.bgClass} text-white ${currentTier.hoverBgClass}` : `bg-gray-200 text-gray-800 hover:bg-gray-300` }`}>
                        {actionIcons[action.text] || <Info/>}<span>{action.text}</span>
                    </button> 
                ))}
            </div>
        </div> 
    );
};

export default PropensityDisplay;
