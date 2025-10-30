import React from 'react';
import { UserPlus, CheckSquare, FilePlus, Download, X, ShieldCheck } from 'lucide-react';

interface BatchActionBarProps {
    selectedRowCount: number;
    onClearSelection: () => void;
    onRunEB: () => void;
    onAssign: () => void;
    onUpdateStatus: () => void;
    onAddNote: () => void;
    onExport: () => void;
    onComplete: () => void;
}

const BatchActionBar: React.FC<BatchActionBarProps> = ({ 
    selectedRowCount, 
    onClearSelection,
    onRunEB,
    onAssign,
    onUpdateStatus,
    onAddNote,
    onExport,
    onComplete
}) => {
    if (selectedRowCount === 0) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 transition-transform duration-300 animate-fade-in">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center space-x-4">
                        <span className="text-sm font-semibold text-gray-800">
                            {selectedRowCount} item{selectedRowCount > 1 ? 's' : ''} selected
                        </span>
                        <button onClick={onClearSelection} className="flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium">
                            <X className="h-4 w-4 mr-1" />
                            Clear selection
                        </button>
                    </div>
                    <div className="flex items-center space-x-3">
                         <button onClick={onRunEB} className="flex items-center space-x-2 text-sm bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition">
                            <ShieldCheck className="h-4 w-4" />
                            <span>Run E&B</span>
                        </button>
                        <button onClick={onAssign} className="flex items-center space-x-2 text-sm bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition">
                            <UserPlus className="h-4 w-4" />
                            <span>Assign to...</span>
                        </button>
                         <button onClick={onUpdateStatus} className="flex items-center space-x-2 text-sm bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition">
                            <CheckSquare className="h-4 w-4" />
                            <span>Update Status</span>
                        </button>
                         <button onClick={onComplete} className="flex items-center space-x-2 text-sm bg-green-100 text-green-800 font-semibold py-2 px-4 rounded-lg hover:bg-green-200 transition">
                            <CheckSquare className="h-4 w-4" />
                            <span>Complete</span>
                        </button>
                        <button onClick={onAddNote} className="flex items-center space-x-2 text-sm bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition">
                            <FilePlus className="h-4 w-4" />
                            <span>Add Note</span>
                        </button>
                        <button onClick={onExport} className="flex items-center space-x-2 text-sm bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition">
                            <Download className="h-4 w-4" />
                            <span>Export Selected</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BatchActionBar;
