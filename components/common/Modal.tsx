
import React from 'react';
import { XCircle } from 'lucide-react';
import { useEstimateState, useEstimateDispatch } from '../../context/EstimateContext';

const Modal: React.FC = () => {
    const { modal } = useEstimateState();
    const dispatch = useEstimateDispatch();
    const { isOpen, title, message } = modal;

    const onClose = () => {
        dispatch({ type: 'HIDE_MODAL' });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md m-4 flex flex-col max-h-[90vh]">
                <div className="flex-shrink-0 flex justify-between items-center border-b pb-3 p-6">
                    <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle className="h-6 w-6" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="text-sm text-gray-600 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: message.replace(/\n/g, '<br />') }}></div>
                </div>
                <div className="flex-shrink-0 flex justify-end border-t p-6">
                    <button onClick={onClose} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition">OK</button>
                </div>
            </div>
        </div>
    );
};

export default Modal;
