import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  rowsPerPage: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (size: number) => void;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({ currentPage, totalPages, rowsPerPage, totalRows, onPageChange, onRowsPerPageChange }) => {
  const startRow = Math.min((currentPage - 1) * rowsPerPage + 1, totalRows);
  const endRow = Math.min(currentPage * rowsPerPage, totalRows);

  if (totalRows === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-between text-sm text-gray-600 px-4 py-3 bg-white border-t border-gray-200/80 rounded-b-xl shadow-md mt-[-1px] min-w-[1600px]">
      <div className="flex items-center space-x-2">
        <span>Rows per page:</span>
        <select
          value={rowsPerPage}
          onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
          className="bg-white border-gray-300 rounded-md shadow-sm p-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
        >
          {[25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
        </select>
      </div>
      <div>
        <span>{startRow}–{endRow} of {totalRows}</span>
      </div>
      <div className="flex items-center space-x-2">
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="p-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span>Page {currentPage} of {totalPages}</span>
        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default PaginationControls;
