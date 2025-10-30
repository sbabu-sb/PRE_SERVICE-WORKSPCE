import React, { useState } from 'react';
import { XCircle, CheckCircle } from 'lucide-react';
import { WorklistPatient, CaseDisposition } from '../../../types';

interface DispositionComposerModalProps {
    patient: WorklistPatient | null;
    onClose: () => void;
    onConfirm: (patientId: string, disposition: CaseDisposition) => void;
}

const dispositionOutcomes = [
    'Cleared for Service',
    'Denied — Payer Policy',
    'Denied — Incomplete / Missing Docs',
    'Converted to Self-Pay',
    'Deferred / Rescheduled',
    'Sent to Financial Counseling',
    'Escalated to Supervisor',
    'Other (requires text)',
];

const DispositionComposerModal: React.FC<DispositionComposerModalProps> = ({ patient, onClose, onConfirm }) => {
    const [outcome, setOutcome] = useState(dispositionOutcomes[0]);
    const [summary, setSummary] = useState('');

    if (!patient) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!summary.trim()) {
            alert('A resolution summary is required.');
            return;
        }
        onConfirm(patient.id, { outcome, summary });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[1500] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg m-4 flex flex-col max-h-[90vh] animate-fade-in" onClick={e => e.stopPropagation()}>
                <div className="flex-shrink-0 flex justify-between items-center border-b p-4">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800" id="modal-title">Complete Case</h3>
                        <p className="text-sm text-gray-500">{patient.metaData.patient.name}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle className="h-6 w-6" /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div>
                            <label className="text-sm font-semibold text-gray-700">Outcome</label>
                            <div className="mt-2 space-y-2">
                                {dispositionOutcomes.map(opt => (
                                    <label key={opt} className="flex items-center p-3 border rounded-lg has-[:checked]:bg-blue-50 has-[:checked]:border-blue-500 cursor-pointer">
                                        <input type="radio" name="outcome" value={opt} checked={outcome === opt} onChange={() => setOutcome(opt)} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"/>
                                        <span className="ml-3 text-sm text-gray-700">{opt}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label htmlFor="summary" className="text-sm font-semibold text-gray-700">Resolution Summary</label>
                            <textarea id="summary" value={summary} onChange={e => setSummary(e.target.value)}
                                className="mt-2 w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500"
                                rows={3} placeholder="e.g., Auth submitted and approved; patient informed." required
                            ></textarea>
                        </div>
                    </div>
                    <div className="flex-shrink-0 flex justify-end items-center border-t p-4 space-x-3">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition">Cancel</button>
                        <button type="submit" className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition flex items-center space-x-2">
                            <CheckCircle className="h-5 w-5" />
                            <span>Complete Case</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DispositionComposerModal;
