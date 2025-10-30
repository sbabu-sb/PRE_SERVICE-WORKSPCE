import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, Loader, Wand2, ArrowRight } from 'lucide-react';
import { useEstimateState, useEstimateDispatch } from '../../../context/EstimateContext';
import { fetchGlobalSearchResults } from '../../../services/geminiService';
import { SearchResultItem } from '../../../types';

// Debounce hook
const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
};

const GlobalSearch: React.FC = () => {
    const { search } = useEstimateState();
    const dispatch = useEstimateDispatch();
    const debouncedQuery = useDebounce(search.query, 500);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleClose = useCallback(() => {
        dispatch({ type: 'TOGGLE_SEARCH', payload: false });
    }, [dispatch]);

    useEffect(() => {
        if (search.isOpen) {
            inputRef.current?.focus();
        }
    }, [search.isOpen]);
    
    useEffect(() => {
        const handleSearch = async () => {
            if (!debouncedQuery.trim()) {
                dispatch({ type: 'SET_SEARCH_STATE', payload: { results: null, error: null, isLoading: false } });
                return;
            }
            dispatch({ type: 'SET_SEARCH_STATE', payload: { isLoading: true, error: null } });
            const result = await fetchGlobalSearchResults(debouncedQuery);
            if (result.success && result.data) {
                dispatch({ type: 'SET_SEARCH_STATE', payload: { isLoading: false, results: result.data } });
            } else {
                dispatch({ type: 'SET_SEARCH_STATE', payload: { isLoading: false, error: result.error || 'Search failed' } });
            }
        };
        handleSearch();
    }, [debouncedQuery, dispatch]);
    
    const handleApplyResult = (item: SearchResultItem) => {
        dispatch({ type: 'APPLY_SEARCH_RESULT', payload: item });
    };

    return (
        <>
            <button
                onClick={() => dispatch({ type: 'TOGGLE_SEARCH', payload: true })}
                className="bg-blue-600 text-white p-3 rounded-full shadow-md hover:bg-blue-700 transition"
                aria-label="Open AI Global Search"
                title="AI Global Search"
            >
                <Search className="h-6 w-6" />
            </button>

            {search.isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[2000] flex justify-center items-start pt-20" onClick={handleClose}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b relative">
                            <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={search.query}
                                onChange={(e) => dispatch({ type: 'SET_SEARCH_STATE', payload: { query: e.target.value } })}
                                placeholder="Search CPT, ICD-10, Payers or ask a question..."
                                className="w-full bg-gray-50 text-gray-900 pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                            {search.isLoading && <Loader className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-blue-500" />}
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto p-4">
                            {search.error && <p className="text-center text-red-500">{search.error}</p>}
                            {!search.results && !search.isLoading && !search.error && (
                                <div className="text-center text-gray-500 py-8">
                                    <p>Search for codes, payers, or ask billing questions like:</p>
                                    <p className="text-xs mt-2 italic">"Is auth required for 99214?"</p>
                                </div>
                            )}
                            
                            {search.results?.quickAnswer && (
                                <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                                    <h3 className="font-bold text-purple-800 flex items-center"><Wand2 className="h-5 w-5 mr-2" /> Quick Answer</h3>
                                    <p className="text-gray-800 mt-2">{search.results.quickAnswer.answer}</p>
                                    <p className="text-xs text-gray-500 mt-2">Confidence: {search.results.quickAnswer.confidence} | Source: {search.results.quickAnswer.source}</p>
                                </div>
                            )}

                            {search.results && (['procedures', 'diagnoses', 'payers'] as const).map(category => (
                                search.results[category] && search.results[category].length > 0 && (
                                    <div key={category} className="mb-4">
                                        <h4 className="font-semibold text-gray-600 text-sm uppercase mb-2">{category}</h4>
                                        <ul className="space-y-1">
                                            {search.results[category].map((item, index) => (
                                                <li key={`${category}-${index}`} className="group p-2 hover:bg-blue-50 rounded-md cursor-pointer flex justify-between items-center" onClick={() => handleApplyResult(item)}>
                                                    <div>
                                                        <p className="font-medium text-gray-900">{item.code} <span className="text-gray-600 font-normal">- {item.description}</span></p>
                                                        <p className="text-xs text-gray-500">{item.relevance}</p>
                                                    </div>
                                                    <ArrowRight className="h-5 w-5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default GlobalSearch;