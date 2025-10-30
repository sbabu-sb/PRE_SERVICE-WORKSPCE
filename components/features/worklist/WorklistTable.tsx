import React, { useState } from 'react';
import { WorklistPatient, SortKey, CaseStatus } from '../../../types';
import { formatRelativeTime, formatDate } from '../../../utils/formatters';
import { MoreHorizontal, FileCheck, PlusCircle, CheckSquare, UserPlus, Star, Copy, Info, ArrowUp, ArrowDown, ChevronDown, ChevronUp, FlaskConical, TrendingUp, TrendingDown, ArrowRightCircle } from 'lucide-react';

interface WorklistTableProps {
  patients: WorklistPatient[];
  onSelectPatient: (patient: WorklistPatient) => void;
  selectedRows: Set<string>;
  onToggleRow: (patientId: string) => void;
  onToggleAllRows: () => void;
  sortConfig: { key: SortKey, direction: 'asc' | 'desc' } | null;
  onSort: (key: SortKey) => void;
  activeRowIndex: number | null;
  onAssignUser: (patientId: string, assigneeName: string) => void;
  pinnedRows: Set<string>;
  onTogglePin: (patientId: string) => void;
  isPrioritySortMode: boolean;
  onOpenDispositionModal: (patient: WorklistPatient) => void;
  showToast: (message: string) => void;
}

const getStatusPillStyles = (status: CaseStatus) => {
    switch (status) {
        case CaseStatus.COMPLETED: return 'bg-green-100 text-green-800';
        case CaseStatus.ACTIVE: return 'bg-blue-100 text-blue-800';
        case CaseStatus.NEW: return 'bg-indigo-100 text-indigo-800';
        case CaseStatus.PENDING_EXTERNAL: return 'bg-yellow-100 text-yellow-800';
        case CaseStatus.WAITING_INTERNAL: return 'bg-orange-100 text-orange-800';
        case CaseStatus.REOPENED: return 'bg-purple-100 text-purple-800';
        case CaseStatus.ARCHIVED: return 'bg-gray-100 text-gray-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

const StatusPill: React.FC<{ status: CaseStatus }> = ({ status }) => {
    const colorClass = getStatusPillStyles(status);
    return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colorClass}`}>{status}</span>;
};

const TimeToService: React.FC<{ dos: string }> = ({ dos }) => {
    const [timeLeft, setTimeLeft] = React.useState('');
    const [urgency, setUrgency] = React.useState({ color: 'text-gray-600', pulse: false });

    React.useEffect(() => {
        const calculateTime = () => {
            const serviceDate = new Date(dos);
            const now = new Date();
            const diff = serviceDate.getTime() - now.getTime();

            if (diff < 0) {
                setTimeLeft('Past Due');
                setUrgency({ color: 'text-red-600 font-bold', pulse: false });
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            
            if (hours >= 24) {
                const days = Math.floor(hours / 24);
                const remainingHours = hours % 24;
                setTimeLeft(`${days}d ${remainingHours}h`);
            } else {
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                setTimeLeft(`${hours}h ${minutes}m`);
            }

            if (hours < 4) setUrgency({ color: 'text-red-600', pulse: true });
            else if (hours < 24) setUrgency({ color: 'text-orange-600', pulse: false });
            else if (hours < 72) setUrgency({ color: 'text-yellow-600', pulse: false });
            else setUrgency({ color: 'text-green-600', pulse: false });
        };

        calculateTime();
        const interval = setInterval(calculateTime, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [dos]);

    return (
        <span className={`${urgency.color} ${urgency.pulse ? 'animate-pulse' : ''}`}>
            {timeLeft}
        </span>
    );
};

interface ActionsMenuProps {
    patient: WorklistPatient;
    onOpenDispositionModal: (patient: WorklistPatient) => void;
    onAssignUser: (patientId: string, assigneeName: string) => void;
    onTogglePin: (patientId: string) => void;
    isPinned: boolean;
    showToast: (message: string) => void;
}

const ActionsMenu: React.FC<ActionsMenuProps> = ({ patient, onOpenDispositionModal, onAssignUser, onTogglePin, isPinned, showToast }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const menuRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsOpen(false); };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleActionClick = (e: React.MouseEvent, action: string) => {
        e.stopPropagation();
        setIsOpen(false);
        switch (action) {
            case 'mark-complete':
                onOpenDispositionModal(patient);
                break;
            case 'request-eb':
                showToast(`E&B request sent for ${patient.metaData.patient.name}.`);
                break;
            case 'add-note':
                const note = prompt(`Enter note for case ${patient.id}:`);
                if (note) {
                    showToast(`Note added to case ${patient.id}.`);
                }
                break;
            case 'assign-me':
                const currentUser = 'Maria Garcia'; // Current user assumed
                onAssignUser(patient.id, currentUser);
                showToast(`Case assigned to ${currentUser}.`);
                break;
            case 'pin-top':
                onTogglePin(patient.id);
                showToast(`Case ${isPinned ? 'unpinned' : 'pinned'} successfully.`);
                break;
            case 'copy-id':
                navigator.clipboard.writeText(patient.id)
                    .then(() => showToast('Case ID copied to clipboard!'))
                    .catch(() => alert('Failed to copy ID.'));
                break;
            default:
                console.log(`Action "${action}" not implemented.`);
        }
    };

    return (
        <div className="relative" ref={menuRef}>
            <button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} className="p-1 rounded-full hover:bg-gray-200 text-gray-500"><MoreHorizontal className="h-5 w-5" /></button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border"><ul className="py-1 text-sm text-gray-700">
                    <li onClick={(e) => handleActionClick(e, 'mark-complete')} className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center"><CheckSquare className="h-4 w-4 mr-2" />Mark Complete</li>
                    <li onClick={(e) => handleActionClick(e, 'request-eb')} className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center"><FileCheck className="h-4 w-4 mr-2" />Request E&B</li>
                    <li onClick={(e) => handleActionClick(e, 'add-note')} className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center"><PlusCircle className="h-4 w-4 mr-2" />Add Note</li>
                    <li onClick={(e) => handleActionClick(e, 'assign-me')} className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center"><UserPlus className="h-4 w-4 mr-2" />Assign to Me</li>
                    <li onClick={(e) => handleActionClick(e, 'pin-top')} className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center"><Star className="h-4 w-4 mr-2" />{isPinned ? 'Unpin' : 'Pin to Top'}</li>
                    <li onClick={(e) => handleActionClick(e, 'copy-id')} className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center"><Copy className="h-4 w-4 mr-2" />Copy Patient ID</li>
                </ul></div>
            )}
        </div>
    );
};

const SortableHeader: React.FC<{
    sortKey: SortKey, title: string, sortConfig: { key: SortKey, direction: 'asc' | 'desc' } | null, onSort: (key: SortKey) => void, tooltip?: string, disabled?: boolean
}> = ({ sortKey, title, sortConfig, onSort, tooltip, disabled = false }) => {
    const isSorted = sortConfig?.key === sortKey;
    const direction = isSorted ? sortConfig?.direction : null;

    return (
        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <button onClick={() => onSort(sortKey)} disabled={disabled} className={`flex items-center space-x-1 ${disabled ? 'cursor-not-allowed text-gray-400' : 'group'}`}>
                <span>{title}</span>
                {tooltip && <Info className="h-3 w-3 text-gray-400" />}
                {!disabled && (isSorted ? (direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />) : <span className="h-4 w-4 opacity-0 group-hover:opacity-50 transition-opacity text-gray-400">↑↓</span>)}
            </button>
        </th>
    );
};

const XaiDetailPanel: React.FC<{ patient: WorklistPatient }> = ({ patient }) => {
    if (!patient.priorityDetails) return null;

    const { score, topFactors, nextBestAction, modelConfidence, percentileRank } = patient.priorityDetails;
    const positiveFactors = topFactors.filter(f => f.impact > 0).sort((a, b) => b.impact - a.impact);
    const negativeFactors = topFactors.filter(f => f.impact < 0).sort((a, b) => a.impact - b.impact);

    return (
        <div className="bg-slate-50 p-4 border-t-2 border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Left Section: Score & Stats */}
                <div className="md:col-span-3 text-center md:text-left border-r md:pr-6 border-slate-200">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Priority Score</p>
                    <p className="text-5xl font-extrabold text-blue-600 my-1">{score.toFixed(1)}</p>
                    <div className="space-y-2 text-xs text-gray-600">
                        <div className="flex justify-between"><span>Model Confidence:</span> <span className="font-semibold">{modelConfidence ? `${(modelConfidence * 100).toFixed(0)}%` : 'N/A'}</span></div>
                        <div className="flex justify-between"><span>Percentile Rank:</span> <span className="font-semibold">{percentileRank ? `${percentileRank}th` : 'N/A'}</span></div>
                    </div>
                </div>

                {/* Center Section: Factors */}
                <div className="md:col-span-6">
                     <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Critical Factors (Audit Trail)</p>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <h5 className="font-semibold text-sm text-green-700 flex items-center mb-1"><TrendingUp className="h-4 w-4 mr-1"/> Positive Drivers</h5>
                            <ul className="space-y-1">
                                {positiveFactors.map((factor, i) => (
                                    <li key={i} className="text-sm p-1.5 bg-green-50 rounded-md flex justify-between">
                                        <div>
                                            <span className="text-gray-800">{factor.feature}</span>
                                            {factor.value && <span className="text-gray-500 text-xs ml-2">({factor.value})</span>}
                                        </div>
                                        <span className="font-bold text-green-600">+{factor.impact.toFixed(1)}</span>
                                    </li>
                                ))}
                                 {positiveFactors.length === 0 && <li className="text-xs text-gray-500 p-1.5">No positive drivers identified.</li>}
                            </ul>
                        </div>
                        <div>
                            <h5 className="font-semibold text-sm text-red-700 flex items-center mb-1"><TrendingDown className="h-4 w-4 mr-1"/> Negative Drivers</h5>
                            <ul className="space-y-1">
                                {negativeFactors.map((factor, i) => (
                                    <li key={i} className="text-sm p-1.5 bg-red-50 rounded-md flex justify-between">
                                        <div>
                                            <span className="text-gray-800">{factor.feature}</span>
                                            {factor.value && <span className="text-gray-500 text-xs ml-2">({factor.value})</span>}
                                        </div>
                                        <span className="font-bold text-red-600">{factor.impact.toFixed(1)}</span>
                                    </li>
                                ))}
                                {negativeFactors.length === 0 && <li className="text-xs text-gray-500 p-1.5">No negative drivers identified.</li>}
                            </ul>
                        </div>
                     </div>
                </div>

                {/* Right Section: Next Best Action */}
                <div className="md:col-span-3 md:border-l md:pl-6 border-slate-200 flex flex-col">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Next Best Action</p>
                    <div className="p-3 bg-white rounded-lg border border-blue-300 shadow-sm flex-grow flex flex-col justify-center">
                        <p className="text-base font-semibold text-blue-900 flex items-center">
                            <ArrowRightCircle className="h-5 w-5 mr-2 text-blue-600 flex-shrink-0" />
                            <span>{nextBestAction.display_text}</span>
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
};


const WorklistTable: React.FC<WorklistTableProps> = ({ patients, onSelectPatient, selectedRows, onToggleRow, onToggleAllRows, sortConfig, onSort, activeRowIndex, onAssignUser, pinnedRows, onTogglePin, isPrioritySortMode, onOpenDispositionModal, showToast }) => {
    const isAllOnPageSelected = patients.length > 0 && patients.every(p => selectedRows.has(p.id));
    const teamMembers = ['Maria Garcia', 'David Chen', 'Unassigned'];
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const toggleRowExpansion = (e: React.MouseEvent, patientId: string) => {
        e.stopPropagation();
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(patientId)) newSet.delete(patientId); else newSet.add(patientId);
            return newSet;
        });
    };

    return (
        <div className="bg-white rounded-xl shadow-md border border-gray-200/80 overflow-hidden min-w-[1600px]">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/70"><tr>
                    <th scope="col" className="w-12 p-4"><input type="checkbox" className={`cursor-pointer appearance-none h-4 w-4 rounded border border-gray-300 bg-white checked:bg-blue-600 checked:border-transparent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 checked:bg-no-repeat checked:bg-center checked:bg-cover checked:bg-[url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e")]`} checked={isAllOnPageSelected} onChange={onToggleAllRows} /></th>
                    <th scope="col" className="w-12 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider"><Star className="h-4 w-4 inline-block" /></th>
                    <th scope="col" className="w-12"></th>
                    <SortableHeader sortKey="patient" title="Patient" sortConfig={sortConfig} onSort={onSort} disabled={isPrioritySortMode} />
                    <SortableHeader sortKey="priority" title="Priority / Next Best Action" sortConfig={sortConfig} onSort={onSort} tooltip="AI-driven score based on intervention uplift." disabled={!isPrioritySortMode} />
                    <SortableHeader sortKey="status" title="Status" sortConfig={sortConfig} onSort={onSort} disabled={isPrioritySortMode} />
                    <SortableHeader sortKey="timeToService" title="Time to Service" sortConfig={sortConfig} onSort={onSort} disabled={isPrioritySortMode} tooltip="Time remaining until the scheduled Date of Service." />
                    <SortableHeader sortKey="dos" title="DOS" sortConfig={sortConfig} onSort={onSort} disabled={isPrioritySortMode}/>
                    <SortableHeader sortKey="primaryPayer" title="Primary Payer" sortConfig={sortConfig} onSort={onSort} disabled={isPrioritySortMode}/>
                    <SortableHeader sortKey="lastWorkedBy" title="Last Worked By" sortConfig={sortConfig} onSort={onSort} disabled={isPrioritySortMode}/>
                    <SortableHeader sortKey="assignedTo" title="Assigned To" sortConfig={sortConfig} onSort={onSort} disabled={isPrioritySortMode}/>
                    <SortableHeader sortKey="estimateStatus" title="Estimate Status" sortConfig={sortConfig} onSort={onSort} disabled={isPrioritySortMode}/>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr></thead>
                <tbody className="bg-white divide-y divide-gray-200">{patients.map((patient, index) => {
                    const isPinned = pinnedRows.has(patient.id);
                    const isExpanded = expandedRows.has(patient.id);
                    return (
                    <React.Fragment key={patient.id}>
                        <tr id={`worklist-row-${patient.id}`} onClick={() => onSelectPatient(patient)} className={`group hover:bg-blue-50/50 cursor-pointer transition-colors duration-150 ${index === activeRowIndex ? 'bg-blue-100' : ''} ${isPinned ? 'bg-yellow-50/50' : ''}`}>
                            <td className="p-4 align-top" onClick={(e) => e.stopPropagation()}><input type="checkbox" className={`cursor-pointer appearance-none h-4 w-4 rounded border border-gray-300 bg-white checked:bg-blue-600 checked:border-transparent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 checked:bg-no-repeat checked:bg-center checked:bg-cover checked:bg-[url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e")]`} checked={selectedRows.has(patient.id)} onChange={() => onToggleRow(patient.id)} /></td>
                            <td className="text-center align-top pt-4" onClick={e => e.stopPropagation()}><button onClick={() => onTogglePin(patient.id)} className="text-gray-400 hover:text-yellow-500"><Star className={`h-5 w-5 transition-colors ${isPinned ? 'text-yellow-400 fill-current' : ''}`} /></button></td>
                            <td className="text-center align-top pt-4"><button onClick={(e) => toggleRowExpansion(e, patient.id)} className="p-1 rounded-full hover:bg-gray-200">{isExpanded ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}</button></td>
                            <td className="px-4 py-4 whitespace-nowrap align-top"><div className="flex items-center space-x-3"><div><div className="text-sm font-semibold text-gray-900 flex items-center">{patient.metaData.patient.name}{patient.isExplorationItem && <FlaskConical title="Exploration Item" className="h-4 w-4 text-purple-600 ml-2" />}</div><div className="text-sm text-gray-500">DOB: {formatDate(patient.metaData.patient.dob)}</div></div></div></td>
                            <td className="px-4 py-4 whitespace-nowrap align-top"><div className="text-center"><div className="text-base font-bold text-gray-800 flex items-center justify-center space-x-1"><TrendingUp className="h-4 w-4 text-blue-600" /><span>{(patient.priorityDetails?.score ?? 0).toFixed(2)}</span></div><p className="text-xs text-blue-700 font-medium truncate max-w-[200px]" title={patient.priorityDetails?.nextBestAction.display_text}>{patient.priorityDetails?.nextBestAction.display_text}</p></div></td>
                            <td className="px-4 py-4 whitespace-nowrap align-top"><StatusPill status={patient.status} /></td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium align-top"><TimeToService dos={patient.metaData.service.date} /></td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 align-top">{formatDate(patient.metaData.service.date)}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 align-top">{patient.payers[0]?.insurance.name || 'N/A'}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 align-top">
                                <div className="flex items-center space-x-2">
                                    {patient.lastWorkedBy.name === 'Unassigned' || !patient.lastWorkedBy.avatarUrl ? (
                                        <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                                            UN
                                        </div>
                                    ) : (
                                        <img className="h-6 w-6 rounded-full" src={patient.lastWorkedBy.avatarUrl} alt={patient.lastWorkedBy.name} />
                                    )}
                                    <div>
                                        <p className="font-medium text-gray-800">{patient.lastWorkedBy.name}</p>
                                        <p className="text-xs">{formatRelativeTime(patient.lastUpdated)}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 align-top" onClick={(e) => e.stopPropagation()}><select value={patient.assignedTo.name} onChange={(e) => onAssignUser(patient.id, e.target.value)} className="bg-white text-gray-900 text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"><option value="Unassigned">Unassigned</option>{teamMembers.map(name => <option key={name} value={name}>{name}</option>)}</select></td>
                             <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 align-top">{patient.estimateStatus}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium align-top"><div className={`transition-opacity ${index === activeRowIndex ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`} onClick={(e) => e.stopPropagation()}><ActionsMenu patient={patient} onOpenDispositionModal={onOpenDispositionModal} onAssignUser={onAssignUser} onTogglePin={onTogglePin} isPinned={isPinned} showToast={showToast} /></div></td>
                        </tr>
                        {isExpanded && (
                            <tr className={`${index === activeRowIndex ? 'bg-blue-100' : ''} ${isPinned ? 'bg-yellow-50/50' : ''}`}>
                                <td colSpan={14} className="p-0"><XaiDetailPanel patient={patient} /></td>
                            </tr>
                        )}
                    </React.Fragment>
                )})}</tbody>
            </table>
        </div>
    );
};

export default WorklistTable;