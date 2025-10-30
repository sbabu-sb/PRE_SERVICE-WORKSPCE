import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Bell, Settings, HelpCircle, UserCircle } from 'lucide-react';
import { MetaData, Payer, Procedure, WorklistPatient, CaseStatus, CaseDisposition, SortKey } from '../types';
import { worklistData, createNewWorklistPatient } from '../data/worklistData';
import WorklistTable from '../components/features/worklist/WorklistTable';
import SidePanel from '../components/common/SidePanel';
import EstimateCalculatorApp from '../EstimateCalculatorApp';
import BatchActionBar from '../components/features/worklist/BatchActionBar';
import { WorklistView } from '../components/features/worklist/ViewsDropdown';
import WorklistHeader, { Filter } from '../components/features/worklist/WorklistHeader';
import PaginationControls from '../components/features/worklist/PaginationControls';
import Toast from '../components/common/Toast';
import DispositionComposerModal from '../components/features/worklist/DispositionComposerModal';

const WorklistPage: React.FC = () => {
    const [patients, setPatients] = useState<WorklistPatient[]>(worklistData);
    const [selectedPatient, setSelectedPatient] = useState<WorklistPatient | null>(null);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [panelWidth, setPanelWidth] = useState<number>(window.innerWidth * 0.6);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [isPanelFullscreen, setIsPanelFullscreen] = useState<boolean>(false);
    const [lastNonFullscreenWidth, setLastNonFullscreenWidth] = useState<number>(window.innerWidth * 0.6);
    const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: 'asc' | 'desc' } | null>({ key: 'timeToService', direction: 'asc' });
    const [keywordFilter, setKeywordFilter] = useState('');
    const [filters, setFilters] = useState<Filter[]>([]);

    // v3.0 State: Intelligent Sort Toggle
    const [isPrioritySortMode, setIsPrioritySortMode] = useState(true);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    const clearDataTimeoutRef = useRef<number | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);

    const [views, setViews] = useState<WorklistView[]>([
        { id: 'default', name: 'All Open Cases', sortConfig: { key: 'timeToService', direction: 'asc' }, keywordFilter: '', filters: [{ id: 'status-open', field: 'status', operator: 'is-not', value: 'Completed' }] },
        { id: 'completed', name: 'Recently Completed', sortConfig: { key: 'lastWorkedBy', direction: 'desc' }, keywordFilter: '', filters: [{ id: 'status-completed', field: 'status', operator: 'is', value: 'Completed' }] },
        { id: 'blocked', name: 'Blocked Cases', sortConfig: { key: 'timeToService', direction: 'asc' }, keywordFilter: '', filters: [{ id: '1', field: 'financialClearance', operator: 'is', value: 'Blocked' }, { id: 'status-open-blocked', field: 'status', operator: 'is-not', value: 'Completed' }] },
    ]);
    const [activeViewId, setActiveViewId] = useState<string | null>('default');

    // Pinning State
    const [pinnedRows, setPinnedRows] = useState<Set<string>>(new Set());

    // Live Toggle State
    const [isLive, setIsLive] = useState(true);
    const [pendingPatients, setPendingPatients] = useState<WorklistPatient[]>([]);
    const [hasNewData, setHasNewData] = useState(false);

    // Toast State
    const [toastInfo, setToastInfo] = useState<{ id: string; message: string; onUndo?: () => void } | null>(null);
    const toastTimeoutRef = useRef<number | null>(null);

    // Disposition Modal State
    const [dispositionState, setDispositionState] = useState<{ isOpen: boolean; patient: WorklistPatient | null }>({ isOpen: false, patient: null });

    const showToast = (message: string, onUndo?: () => void) => {
        if (toastTimeoutRef.current) {
            clearTimeout(toastTimeoutRef.current);
        }
        setToastInfo({ id: crypto.randomUUID(), message, onUndo });
        toastTimeoutRef.current = window.setTimeout(() => {
            setToastInfo(null);
        }, 7000);
    };

    const handleOpenDispositionModal = useCallback((patient: WorklistPatient) => {
        setDispositionState({ isOpen: true, patient });
    }, []);

    const handleCloseDispositionModal = useCallback(() => {
        setDispositionState({ isOpen: false, patient: null });
    }, []);

    const handleConfirmDisposition = useCallback((patientId: string, disposition: CaseDisposition) => {
        let originalPatient: WorklistPatient | undefined;
        setPatients(prev => {
            const newPatients = [...prev];
            const patientIndex = newPatients.findIndex(p => p.id === patientId);
            if (patientIndex !== -1) {
                originalPatient = { ...newPatients[patientIndex] };
                newPatients[patientIndex] = {
                    ...newPatients[patientIndex],
                    status: CaseStatus.COMPLETED,
                    disposition: disposition,
                    lastUpdated: new Date().toISOString(),
                };
            }
            return newPatients;
        });

        handleCloseDispositionModal();
        setSelectedRows(prev => {
            const newSet = new Set(prev);
            newSet.delete(patientId);
            return newSet;
        });

        const onUndo = () => {
            if (originalPatient) {
                setPatients(prev => {
                    const patientIndex = prev.findIndex(p => p.id === patientId);
                    if (patientIndex !== -1) {
                        const newPatients = [...prev];
                        newPatients[patientIndex] = originalPatient!;
                        return newPatients;
                    }
                    return prev;
                });
            }
            setToastInfo(null);
        };
        showToast("1 case marked as complete.", onUndo);
    }, [handleCloseDispositionModal]);

    const handleMarkComplete = (patientIdsToUpdate: string[], newStatus: CaseStatus) => {
        const originalPatients = new Map<string, WorklistPatient>();
        
        setPatients(prev => prev.map(p => {
            if (patientIdsToUpdate.includes(p.id)) {
                originalPatients.set(p.id, { ...p });
                return { ...p, status: newStatus, lastUpdated: new Date().toISOString() };
            }
            return p;
        }));

        if (newStatus === CaseStatus.COMPLETED) {
            setSelectedRows(prev => {
                const newSet = new Set(prev);
                patientIdsToUpdate.forEach(id => newSet.delete(id));
                return newSet;
            });

            const onUndo = () => {
                setPatients(prev => {
                    const newPatients = [...prev];
                    originalPatients.forEach((originalPatient, id) => {
                        const index = newPatients.findIndex(p => p.id === id);
                        if (index !== -1) {
                            newPatients[index] = originalPatient;
                        }
                    });
                    return newPatients;
                });
                setToastInfo(null);
            };

            const message = `${patientIdsToUpdate.length} case${patientIdsToUpdate.length > 1 ? 's' : ''} marked as complete.`;
            showToast(message, onUndo);
        }
    };


    useEffect(() => {
        const interval = setInterval(() => {
            const newPatient = createNewWorklistPatient();
            if (isLive) {
                setPatients(prev => [newPatient, ...prev]);
            } else {
                setPendingPatients(prev => [newPatient, ...prev]);
                setHasNewData(true);
            }
        }, 15000);
        return () => clearInterval(interval);
    }, [isLive]);

    const handleToggleLive = () => {
        if (!isLive) {
            setPatients(prev => [...pendingPatients, ...prev]);
            setPendingPatients([]);
            setHasNewData(false);
        }
        setIsLive(!isLive);
    };

    const processedPatients = useMemo(() => {
        let filteredItems = [...patients];

        if (keywordFilter) {
            const lowercasedFilter = keywordFilter.toLowerCase();
            filteredItems = filteredItems.filter(patient => {
                const { metaData, payers, financialClearance, estimateStatus, assignedTo } = patient;
                return (
                    metaData.patient.name.toLowerCase().includes(lowercasedFilter) ||
                    payers.some(p => p.insurance.name.toLowerCase().includes(lowercasedFilter)) ||
                    metaData.provider.name.toLowerCase().includes(lowercasedFilter) ||
                    financialClearance.toLowerCase().includes(lowercasedFilter) ||
                    estimateStatus.toLowerCase().includes(lowercasedFilter) ||
                    assignedTo.name.toLowerCase().includes(lowercasedFilter)
                );
            });
        }
        
        if (filters.length > 0) {
            filteredItems = filteredItems.filter(patient => {
                return filters.every(filter => {
                    if (!filter.field || !filter.operator || filter.value === undefined) return true;
                    
                    let patientValue: string | Date;
                    switch(filter.field) {
                        case 'financialClearance': patientValue = patient.financialClearance; break;
                        case 'assignedTo': patientValue = patient.assignedTo.name; break;
                        case 'primaryPayer': patientValue = patient.payers[0]?.insurance.name || ''; break;
                        case 'dos': patientValue = new Date(patient.metaData.service.date); break;
                        case 'status': patientValue = patient.status; break;
                        default: return true;
                    }
                    
                    if (filter.field === 'dos' && patientValue instanceof Date) {
                         const filterDate = new Date(filter.value);
                         if (isNaN(filterDate.getTime())) return true;
                         patientValue.setHours(0,0,0,0);
                         filterDate.setHours(0,0,0,0);
                         switch(filter.operator) {
                            case 'is': return patientValue.getTime() === filterDate.getTime();
                            case 'is-not': return patientValue.getTime() !== filterDate.getTime();
                            case 'is-before': return patientValue < filterDate;
                            case 'is-after': return patientValue > filterDate;
                            default: return true;
                         }
                    } else if (typeof patientValue === 'string') {
                        switch(filter.operator) {
                            case 'is': return patientValue === filter.value;
                            case 'is-not': return patientValue !== filter.value;
                            default: return true;
                        }
                    }
                    return true;
                });
            });
        }
        
        let sortedItems;
        if (isPrioritySortMode) {
            sortedItems = [...filteredItems].sort((a, b) => (b.priorityDetails?.score ?? 0) - (a.priorityDetails?.score ?? 0));
        } else {
            sortedItems = [...filteredItems].sort((a, b) => {
                if (!sortConfig) return 0;
                let aValue: any;
                let bValue: any;
                switch (sortConfig.key) {
                    case 'patient': aValue = a.metaData.patient.name; bValue = b.metaData.patient.name; break;
                    case 'timeToService': case 'dos': aValue = new Date(a.metaData.service.date).getTime(); bValue = new Date(b.metaData.service.date).getTime(); break;
                    case 'primaryPayer': aValue = a.payers[0]?.insurance.name || ''; bValue = b.payers[0]?.insurance.name || ''; break;
                    case 'preServiceClearance': aValue = a.financialClearance; bValue = b.financialClearance; break;
                    case 'estimateStatus': aValue = a.estimateStatus; bValue = b.estimateStatus; break;
                    case 'lastWorkedBy': aValue = new Date(a.lastUpdated).getTime(); bValue = new Date(b.lastUpdated).getTime(); break;
                    case 'assignedTo': aValue = a.assignedTo?.name || ''; bValue = b.assignedTo?.name || ''; break;
                    case 'priority': aValue = a.priorityDetails?.score ?? 0; bValue = b.priorityDetails?.score ?? 0; break;
                    case 'status': aValue = a.status; bValue = b.status; break;
                    default: return 0;
                }
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        
        const pinnedItems = sortedItems.filter(p => pinnedRows.has(p.id));
        const unpinnedItems = sortedItems.filter(p => !pinnedRows.has(p.id));

        return [...pinnedItems, ...unpinnedItems];
    }, [patients, keywordFilter, filters, sortConfig, pinnedRows, isPrioritySortMode]);

    const totalPages = Math.ceil(processedPatients.length / rowsPerPage);

    const paginatedPatients = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        return processedPatients.slice(startIndex, startIndex + rowsPerPage);
    }, [processedPatients, currentPage, rowsPerPage]);

    const handlePageChange = (page: number) => {
        if (page > 0 && page <= totalPages) {
            setCurrentPage(page);
            setActiveRowIndex(null);
        }
    };
    
    const handleRowsPerPageChange = (size: number) => {
        setRowsPerPage(size);
        setCurrentPage(1);
        setActiveRowIndex(null);
    };

    const handleRowSelect = useCallback((patient: WorklistPatient) => {
        if (clearDataTimeoutRef.current) { clearTimeout(clearDataTimeoutRef.current); clearDataTimeoutRef.current = null; }
        setPatients(prev => prev.map(p => p.id === patient.id && p.status === CaseStatus.NEW ? {...p, status: CaseStatus.ACTIVE} : p));
        setSelectedPatient(patient);
        setIsPanelOpen(true);
        if (isPanelFullscreen) { setIsPanelFullscreen(false); setPanelWidth(lastNonFullscreenWidth); }
    }, [isPanelFullscreen, lastNonFullscreenWidth]);

    const handlePanelClose = useCallback(() => {
        setIsPanelOpen(false);
        clearDataTimeoutRef.current = window.setTimeout(() => setSelectedPatient(null), 300);
        if (isPanelFullscreen) { setIsPanelFullscreen(false); setPanelWidth(lastNonFullscreenWidth); }
    }, [isPanelFullscreen, lastNonFullscreenWidth]);
    
    const handleToggleRow = useCallback((patientId: string) => { setSelectedRows(prev => { const newSet = new Set(prev); if (newSet.has(patientId)) newSet.delete(patientId); else newSet.add(patientId); return newSet; }); }, []);
    
    const handleToggleAllRows = useCallback(() => {
        const currentPageIds = paginatedPatients.map(p => p.id);
        const allOnPageSelected = currentPageIds.length > 0 && currentPageIds.every(id => selectedRows.has(id));
        
        setSelectedRows(prev => {
            const newSet = new Set(prev);
            if (allOnPageSelected) {
                currentPageIds.forEach(id => newSet.delete(id));
            } else {
                currentPageIds.forEach(id => newSet.add(id));
            }
            return newSet;
        });
    }, [paginatedPatients, selectedRows]);

    const onToggleFullscreen = useCallback(() => { setIsPanelFullscreen(prev => { if (!prev) { setLastNonFullscreenWidth(panelWidth); setPanelWidth(window.innerWidth); } else { setPanelWidth(lastNonFullscreenWidth); } return !prev; }); }, [panelWidth, lastNonFullscreenWidth]);
    
    const handleSort = (key: SortKey) => {
        if (isPrioritySortMode) return; // Disable column sorting in priority mode
        setSortConfig(prev => ({ key, direction: prev && prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
        setActiveRowIndex(null);
    };

    const handleTogglePrioritySort = () => {
        setIsPrioritySortMode(prev => {
            if (prev) { // If turning OFF priority sort
                setSortConfig({ key: 'timeToService', direction: 'asc' }); // Revert to default manual sort
            }
            return !prev;
        });
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) { if (e.key === 'Escape') (e.target as HTMLElement).blur(); return; }
            if (['j', 'k', 'o', '/', ' ', 'Enter'].includes(e.key)) e.preventDefault();
            switch (e.key) {
                case 'j': setActiveRowIndex(prev => { const newIndex = prev === null ? 0 : Math.min(prev + 1, paginatedPatients.length - 1); document.getElementById(`worklist-row-${paginatedPatients[newIndex]?.id}`)?.scrollIntoView({ block: 'nearest' }); return newIndex; }); break;
                case 'k': setActiveRowIndex(prev => { const newIndex = prev === null ? 0 : Math.max(prev - 1, 0); document.getElementById(`worklist-row-${paginatedPatients[newIndex]?.id}`)?.scrollIntoView({ block: 'nearest' }); return newIndex; }); break;
                case 'o': case 'Enter': if (activeRowIndex !== null && paginatedPatients[activeRowIndex]) handleRowSelect(paginatedPatients[activeRowIndex]); break;
                case ' ': if (activeRowIndex !== null && paginatedPatients[activeRowIndex]) handleToggleRow(paginatedPatients[activeRowIndex].id); break;
                case 'Escape': if (dispositionState.isOpen) handleCloseDispositionModal(); else if (isPanelOpen) handlePanelClose(); else if (selectedRows.size > 0) setSelectedRows(new Set()); else setActiveRowIndex(null); break;
                case '/': searchInputRef.current?.focus(); break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeRowIndex, paginatedPatients, handleRowSelect, handlePanelClose, isPanelOpen, handleToggleRow, selectedRows.size, dispositionState.isOpen, handleCloseDispositionModal]);

    const handleBatchRunEB = () => { if (window.confirm(`Run E&B for ${selectedRows.size} items?`)) { alert(`Running E&B...`); setSelectedRows(new Set()); } };
    const handleBatchAssign = () => { const assignee = prompt(`Assign these ${selectedRows.size} items to:`); if (assignee) { alert(`Assigning to ${assignee}...`); setSelectedRows(new Set()); } };
    const handleBatchUpdateStatus = () => { const status = prompt(`New status for ${selectedRows.size} items:`); if (status) { alert(`Updating status...`); setSelectedRows(new Set()); } };
    const handleBatchAddNote = () => { const note = prompt(`Note for ${selectedRows.size} items:`); if (note) { alert(`Adding note...`); setSelectedRows(new Set()); } };
    const handleBatchExport = () => { if (window.confirm(`Export ${selectedRows.size} items?`)) { alert(`Exporting...`); setSelectedRows(new Set()); } };
    const handleBatchComplete = () => { handleMarkComplete(Array.from(selectedRows), CaseStatus.COMPLETED); };

    const handleAssignUser = (patientId: string, assigneeName: string) => {
        setPatients(prev => prev.map(p => p.id === patientId ? { ...p, assignedTo: { name: assigneeName, avatarUrl: `https://i.pravatar.cc/150?u=${assigneeName.replace(' ', '')}` } } : p));
    };

    const handleSelectView = (id: string) => {
        const selected = views.find(v => v.id === id);
        if (selected) {
            setSortConfig(selected.sortConfig);
            setKeywordFilter(selected.keywordFilter);
            setFilters(selected.filters || []);
            setActiveViewId(id);
        }
    };
    const handleSaveView = (name: string) => {
        const newView: WorklistView = { id: crypto.randomUUID(), name, sortConfig, keywordFilter, filters };
        setViews(prev => [...prev, newView]);
        setActiveViewId(newView.id);
    };
    const handleDeleteView = (id: string) => {
        if (id === 'default') {
            alert("Cannot delete the default view.");
            return;
        }
        setViews(prev => prev.filter(v => v.id !== id));
        if (activeViewId === id) handleSelectView('default');
    };
    
    useEffect(() => {
        if (!activeViewId) return;
        const activeView = views.find(v => v.id === activeViewId);
        if (!activeView) return;
        const sortIsSame = JSON.stringify(activeView.sortConfig) === JSON.stringify(sortConfig);
        const keywordIsSame = activeView.keywordFilter === keywordFilter;
        const filtersAreSame = JSON.stringify(activeView.filters) === JSON.stringify(filters);
        if (!sortIsSame || !keywordIsSame || !filtersAreSame) {
            setActiveViewId(null);
        }
    }, [sortConfig, keywordFilter, filters, activeViewId, views]);
    
    const handleTogglePin = useCallback((patientId: string) => {
        setPinnedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(patientId)) {
                newSet.delete(patientId);
            } else {
                if (newSet.size >= 5) {
                    alert('You can only pin a maximum of 5 items.');
                    return prev;
                }
                newSet.add(patientId);
            }
            return newSet;
        });
    }, []);

    const handleAddFilter = () => setFilters(prev => [...prev, { id: crypto.randomUUID(), field: 'financialClearance', operator: 'is', value: 'Cleared' }]);
    const handleRemoveFilter = (id: string) => setFilters(prev => prev.filter(f => f.id !== id));
    const handleUpdateFilter = (id: string, newFilter: Partial<Filter>) => {
        setFilters(prev => prev.map(f => f.id === id ? { ...f, ...newFilter } : f));
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
            <header className="flex-shrink-0 bg-white border-b h-16 flex items-center justify-between px-6 z-20">
                <h1 className="text-lg font-bold text-gray-800 tracking-tight">PRE-SERVICE WORKSPACE</h1>
                <div className="flex items-center space-x-4">
                    <button className="text-gray-500 hover:text-gray-700"><Bell className="h-6 w-6" /></button>
                    <button className="text-gray-500 hover:text-gray-700"><Settings className="h-6 w-6" /></button>
                    <button className="text-gray-500 hover:text-gray-700"><HelpCircle className="h-6 w-6" /></button>
                    <button className="text-gray-500 hover:text-gray-700"><UserCircle className="h-6 w-6" /></button>
                </div>
            </header>
            <div className="flex-1 flex overflow-hidden">
                <main className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden p-6">
                    <WorklistHeader
                        patients={patients}
                        keywordFilter={keywordFilter}
                        setKeywordFilter={setKeywordFilter}
                        searchInputRef={searchInputRef}
                        views={views}
                        activeViewId={activeViewId}
                        handleSelectView={handleSelectView}
                        handleSaveView={handleSaveView}
                        handleDeleteView={handleDeleteView}
                        isLive={isLive}
                        hasNewData={hasNewData}
                        pendingCount={pendingPatients.length}
                        onToggleLive={handleToggleLive}
                        filters={filters}
                        onAddFilter={handleAddFilter}
                        onRemoveFilter={handleRemoveFilter}
                        onUpdateFilter={handleUpdateFilter}
                        isPrioritySortMode={isPrioritySortMode}
                        onTogglePrioritySort={handleTogglePrioritySort}
                    />
                    <div className="overflow-x-auto mt-4">
                        <div className="inline-block min-w-full align-middle">
                            <WorklistTable 
                                patients={paginatedPatients} 
                                onSelectPatient={handleRowSelect} 
                                selectedRows={selectedRows} 
                                onToggleRow={handleToggleRow} 
                                onToggleAllRows={handleToggleAllRows} 
                                sortConfig={sortConfig} 
                                onSort={handleSort} 
                                activeRowIndex={activeRowIndex} 
                                onAssignUser={handleAssignUser} 
                                pinnedRows={pinnedRows}
                                onTogglePin={handleTogglePin}
                                isPrioritySortMode={isPrioritySortMode}
                                onOpenDispositionModal={handleOpenDispositionModal}
                            />
                            <PaginationControls 
                                currentPage={currentPage}
                                totalPages={totalPages}
                                rowsPerPage={rowsPerPage}
                                totalRows={processedPatients.length}
                                onPageChange={handlePageChange}
                                onRowsPerPageChange={handleRowsPerPageChange}
                            />
                        </div>
                    </div>
                </main>
            </div>
            <SidePanel isOpen={isPanelOpen} onClose={handlePanelClose} panelWidth={panelWidth} setPanelWidth={setPanelWidth} isPanelFullscreen={isPanelFullscreen} onToggleFullscreen={onToggleFullscreen} lastNonFullscreenWidth={lastNonFullscreenWidth}>
                {selectedPatient && (<EstimateCalculatorApp key={selectedPatient.id} patientData={{ metaData: selectedPatient.metaData, payers: selectedPatient.payers, procedures: selectedPatient.procedures }} onMarkComplete={() => handleOpenDispositionModal(selectedPatient)} />)}
            </SidePanel>
            <BatchActionBar selectedRowCount={selectedRows.size} onClearSelection={() => setSelectedRows(new Set())} onRunEB={handleBatchRunEB} onAssign={handleBatchAssign} onUpdateStatus={handleBatchUpdateStatus} onAddNote={handleBatchAddNote} onExport={handleBatchExport} onComplete={handleBatchComplete} />
            {toastInfo && <Toast key={toastInfo.id} message={toastInfo.message} onUndo={toastInfo.onUndo} onClose={() => setToastInfo(null)} />}
            <DispositionComposerModal patient={dispositionState.patient} onClose={handleCloseDispositionModal} onConfirm={handleConfirmDisposition} />
        </div>
    );
};

export default WorklistPage;
