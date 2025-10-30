import React, { useMemo } from 'react';
import { Search, Plus, Activity, X, BrainCircuit, List } from 'lucide-react';
import ViewsDropdown, { WorklistView } from './ViewsDropdown';
import { WorklistPatient, CaseStatus } from '../../../types';

export interface Filter {
    id: string;
    field: 'financialClearance' | 'assignedTo' | 'primaryPayer' | 'dos' | 'status';
    operator: 'is' | 'is-not' | 'is-before' | 'is-after';
    value: string;
}

type UserFilterField = 'financialClearance' | 'assignedTo' | 'primaryPayer' | 'dos';

type UserFilter = Omit<Filter, 'field'> & {
    field: UserFilterField;
};

interface WorklistHeaderProps {
    patients: WorklistPatient[];
    keywordFilter: string;
    setKeywordFilter: (query: string) => void;
    searchInputRef: React.RefObject<HTMLInputElement>;
    views: WorklistView[];
    activeViewId: string | null;
    handleSelectView: (id: string) => void;
    handleSaveView: (name: string) => void;
    handleDeleteView: (id: string) => void;
    isLive: boolean;
    hasNewData: boolean;
    pendingCount: number;
    onToggleLive: () => void;
    filters: Filter[];
    onAddFilter: () => void;
    onRemoveFilter: (id: string) => void;
    onUpdateFilter: (id: string, newFilter: Partial<Filter>) => void;
    isPrioritySortMode: boolean;
    onTogglePrioritySort: () => void;
}

const FilterPill: React.FC<{ filter: UserFilter; onRemove: (id: string) => void; onUpdate: (id: string, newFilter: Partial<UserFilter>) => void; uniqueOptions: Record<string, string[]>}> = ({ filter, onRemove, onUpdate, uniqueOptions }) => {
    const fieldOptions: Record<UserFilterField, { name: string; operators: ('is' | 'is-not' | 'is-before' | 'is-after')[]; type: 'select' | 'date'; options?: string[] }> = {
        'financialClearance': { name: 'Clearance', operators: ['is', 'is-not'], type: 'select', options: ['Cleared', 'Needs Review', 'Blocked'] },
        'assignedTo': { name: 'Assigned To', operators: ['is', 'is-not'], type: 'select', options: uniqueOptions.assignedTo },
        'primaryPayer': { name: 'Primary Payer', operators: ['is', 'is-not'], type: 'select', options: uniqueOptions.primaryPayer },
        'dos': { name: 'DOS', operators: ['is', 'is-before', 'is-after'], type: 'date' },
    };

    const currentField = fieldOptions[filter.field];

    return (
        <div className="flex items-center space-x-1 bg-gray-200 text-gray-800 rounded-md p-1 text-sm">
            <span className="font-semibold pl-1">{currentField.name}</span>
            <select value={filter.operator} onChange={e => onUpdate(filter.id, { operator: e.target.value as UserFilter['operator'] })} className="bg-gray-200 border-none focus:ring-0 text-sm">
                {currentField.operators.map(op => <option key={op} value={op}>{op.replace('-', ' ')}</option>)}
            </select>
            {currentField.type === 'select' && currentField.options ? (
                <select value={filter.value} onChange={e => onUpdate(filter.id, { value: e.target.value })} className="bg-white border-gray-300 rounded shadow-sm text-sm p-1">
                    {currentField.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            ) : (
                <input type="date" value={filter.value} onChange={e => onUpdate(filter.id, { value: e.target.value })} className="bg-white border-gray-300 rounded shadow-sm text-sm p-1"/>
            )}
            <button onClick={() => onRemove(filter.id)} className="p-1 rounded-full hover:bg-gray-300"><X className="h-3 w-3" /></button>
        </div>
    );
};

const WorklistHeader: React.FC<WorklistHeaderProps> = ({
    patients, keywordFilter, setKeywordFilter, searchInputRef, views, activeViewId, handleSelectView,
    handleSaveView, handleDeleteView, isLive, hasNewData, pendingCount, onToggleLive,
    filters, onAddFilter, onRemoveFilter, onUpdateFilter, isPrioritySortMode, onTogglePrioritySort
}) => {
    const uniqueOptions = useMemo(() => {
        const assignedTo = new Set<string>();
        const primaryPayer = new Set<string>();
        patients.forEach(p => {
            assignedTo.add(p.assignedTo.name);
            if (p.payers[0]?.insurance.name) primaryPayer.add(p.payers[0].insurance.name);
        });
        return {
            assignedTo: Array.from(assignedTo),
            primaryPayer: Array.from(primaryPayer)
        };
    }, [patients]);
    
    const userVisibleFilters = useMemo(() => filters.filter(f => f.field !== 'status') as UserFilter[], [filters]);

    return (
        <div className="flex-shrink-0 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <h2 className="text-2xl font-bold text-gray-800">Cases</h2>
                    <ViewsDropdown views={views} activeViewId={activeViewId} onSelectView={handleSelectView} onSaveView={handleSaveView} onDeleteView={handleDeleteView} />
                     <button onClick={onTogglePrioritySort} title="Toggle between AI-powered priority ranking and manual column sorting"
                        className={`flex items-center space-x-2 text-sm font-semibold h-10 px-4 rounded-md border transition-colors ${
                            isPrioritySortMode 
                                ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        {isPrioritySortMode ? <BrainCircuit className="h-4 w-4 text-blue-500" /> : <List className="h-4 w-4 text-gray-500" />}
                        <span>{isPrioritySortMode ? 'Priority Rank' : 'Manual Sort'}</span>
                    </button>
                </div>
                <div className="flex items-center space-x-2">
                     <button onClick={onToggleLive} className="relative flex items-center space-x-2 text-sm font-semibold h-10 px-4 rounded-md border border-gray-300 bg-white hover:bg-gray-50">
                        <Activity className={`h-4 w-4 ${isLive ? 'text-green-500' : hasNewData ? 'text-blue-500' : 'text-gray-500'}`} />
                        <span className={`${isLive ? 'text-green-700' : hasNewData ? 'text-blue-700' : 'text-gray-600'}`}>{isLive ? 'Live' : `Paused ${hasNewData ? `(${pendingCount} New)` : ''}`}</span>
                        {hasNewData && !isLive && <span className="absolute top-0 right-0 -mr-1 -mt-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span></span>}
                    </button>
                    <button className="h-10 px-4 flex items-center space-x-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition shadow-sm">
                        <Plus className="h-5 w-5" /><span>Create</span>
                    </button>
                </div>
            </div>
            <div className="p-2 bg-white rounded-lg border border-gray-200/80 flex items-center space-x-2 flex-wrap gap-y-2">
                <div className="relative flex-shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input ref={searchInputRef} type="text" value={keywordFilter} onChange={(e) => setKeywordFilter(e.target.value)} placeholder="Keyword search..."
                        className="w-52 h-9 pl-9 pr-3 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition bg-white text-sm" />
                </div>
                {userVisibleFilters.map(filter => <FilterPill key={filter.id} filter={filter} onRemove={onRemoveFilter} onUpdate={onUpdateFilter as any} uniqueOptions={uniqueOptions} />)}
                <button onClick={onAddFilter} className="flex items-center space-x-1 h-9 px-3 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md transition"><Plus className="h-4 w-4"/><span>Add Filter</span></button>
            </div>
        </div>
    );
};

export default WorklistHeader;
