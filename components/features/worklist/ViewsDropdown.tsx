
import React, { useState, useRef, useEffect } from 'react';
import { View, ChevronDown, Check, Save, Settings, Trash2 } from 'lucide-react';
// FIX: `SortKey` is defined in `types.ts`, not exported from `WorklistPage.tsx`. Corrected the import path.
import { SortKey } from '../../../types';
import { Filter } from './WorklistHeader';

export interface WorklistView {
  id: string;
  name: string;
  sortConfig: { key: SortKey; direction: 'asc' | 'desc' } | null;
  keywordFilter: string;
  filters: Filter[];
}

interface ViewsDropdownProps {
  views: WorklistView[];
  activeViewId: string | null;
  onSelectView: (id: string) => void;
  onSaveView: (name: string) => void;
  onDeleteView: (id: string) => void;
}

const ViewsDropdown: React.FC<ViewsDropdownProps> = ({ views, activeViewId, onSelectView, onSaveView, onDeleteView }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [isManaging, setIsManaging] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeViewName = activeViewId ? (views.find(v => v.id === activeViewId)?.name || 'Custom View') : 'Custom View';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsSaving(false);
        setIsManaging(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSave = () => {
    if (newViewName.trim()) {
      onSaveView(newViewName.trim());
      setNewViewName('');
      setIsSaving(false);
      setIsOpen(false);
    }
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    setIsSaving(false);
    setIsManaging(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={toggleDropdown} className="flex items-center space-x-2 text-sm font-semibold text-gray-700 h-10 px-4 rounded-md border border-gray-300 bg-white hover:bg-gray-50">
        <View className="h-4 w-4 text-gray-500" />
        <span>{activeViewName}</span>
        <ChevronDown className="h-4 w-4 text-gray-500" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 bg-white rounded-md shadow-lg z-20 border">
          {isSaving ? (
            <div className="p-2">
              <input
                type="text"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="New view name..."
                className="w-full px-2 py-1.5 border rounded-md text-sm"
                autoFocus
              />
              <div className="flex justify-end space-x-2 mt-2">
                <button onClick={() => setIsSaving(false)} className="text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300">Cancel</button>
                <button onClick={handleSave} className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">Save</button>
              </div>
            </div>
          ) : isManaging ? (
             <div className="p-2">
                <h4 className="font-semibold text-xs uppercase text-gray-500 px-2 py-1">Manage Views</h4>
                <ul className="mt-1 max-h-48 overflow-y-auto">
                    {views.filter(v => v.id !== 'default').map(view => (
                        <li key={view.id} className="flex items-center justify-between text-sm p-2 rounded hover:bg-gray-100">
                            <span>{view.name}</span>
                            <button onClick={() => onDeleteView(view.id)} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </li>
                    ))}
                </ul>
                <button onClick={() => setIsManaging(false)} className="text-xs w-full mt-2 px-2 py-1 rounded bg-gray-200 hover:bg-gray-300">Done</button>
             </div>
          ) : (
            <ul className="py-1 text-sm text-gray-700">
              <li className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">My Views</li>
              {views.map(view => (
                <li key={view.id} onClick={() => { onSelectView(view.id); setIsOpen(false); }} className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center justify-between">
                  <span>{view.name}</span>
                  {activeViewId === view.id && <Check className="h-4 w-4 text-blue-600" />}
                </li>
              ))}
              <div className="border-t my-1"></div>
              <li onClick={() => { setIsSaving(true); setNewViewName(''); }} className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center"><Save className="h-4 w-4 mr-2" />Save current view</li>
              <li onClick={() => setIsManaging(true)} className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center"><Settings className="h-4 w-4 mr-2" />Manage views</li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default ViewsDropdown;
