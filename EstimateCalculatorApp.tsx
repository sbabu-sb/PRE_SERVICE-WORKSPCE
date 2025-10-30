import React, { useEffect } from 'react';
import {
  EstimateProvider,
  useEstimateDispatch,
} from './context/EstimateContext';
import EligibilityAuthPage from './pages/EligibilityAuthPage';
import RiskAnalysisPage from './pages/RiskAnalysisPage';
import EstimateFormPage from './pages/EstimateFormPage';
import EstimateResultsPage from './pages/EstimateResultsPage';
import Modal from './components/common/Modal';
import ChatbotWidget from './components/features/chatbot/ChatbotWidget';
import { useEstimateState } from './context/EstimateContext';
import { MetaData, Payer, Procedure } from './types';
import GlobalSearch from './components/features/search/GlobalSearch';
import { CheckSquare } from 'lucide-react';

const PageRenderer: React.FC = () => {
  const { page, estimateData, aiEstimate } = useEstimateState();
  switch (page) {
    case 'eligibility':
      return <EligibilityAuthPage />;
    case 'risk-analysis':
      return <RiskAnalysisPage />;
    case 'form':
      return <EstimateFormPage />;
    case 'results':
      return estimateData ? (
        <EstimateResultsPage data={estimateData} aiEstimate={aiEstimate} />
      ) : null;
    default:
      return <div>Error: Page not found</div>;
  }
};

interface EstimateCalculatorAppProps {
    patientData: {
        metaData: MetaData;
        payers: Payer[];
        procedures: Procedure[];
    },
    onMarkComplete?: () => void;
}

const AppContent: React.FC<EstimateCalculatorAppProps> = ({ patientData, onMarkComplete }) => {
    const dispatch = useEstimateDispatch();
    const { metaData } = useEstimateState();

    useEffect(() => {
        dispatch({ type: 'PREFILL_FORM', payload: patientData });
    }, [patientData, dispatch]);

    return (
        <div className="bg-gray-50 min-h-full text-gray-900 flex flex-col">
            <div className="flex-grow">
              <div className="p-4 sm:p-6 lg:p-8">
                  <header className="mb-8 flex justify-between items-start">
                      <div>
                          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">
                              Good Faith Estimate
                          </h2>
                          <p className="text-gray-500 mt-1">
                            For: <span className="font-semibold">{metaData.patient.name || '...'}</span>
                          </p>
                      </div>
                      <div className="flex items-center space-x-2">
                          {onMarkComplete && (
                                <button 
                                    onClick={onMarkComplete} 
                                    className="flex items-center space-x-2 text-sm bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 transition"
                                    title="Mark this case as complete"
                                >
                                    <CheckSquare className="h-4 w-4" />
                                    <span>Mark as Complete</span>
                                </button>
                          )}
                          <GlobalSearch />
                      </div>
                  </header>
                  <main className="transition-opacity duration-500">
                      <PageRenderer />
                  </main>
              </div>
            </div>
            <footer className="sticky bottom-0 bg-gray-50 p-4 sm:p-6 lg:p-8 border-t flex justify-end z-10">
              <ChatbotWidget />
            </footer>
            <Modal />
        </div>
    );
};


const EstimateCalculatorApp: React.FC<EstimateCalculatorAppProps> = ({ patientData, onMarkComplete }) => {
  return (
    <EstimateProvider>
        <AppContent patientData={patientData} onMarkComplete={onMarkComplete} />
    </EstimateProvider>
  );
};

export default EstimateCalculatorApp;
