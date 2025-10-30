import React, { useEffect, useRef, useCallback } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  panelWidth: number;
  setPanelWidth: (width: number) => void;
  isPanelFullscreen: boolean;
  onToggleFullscreen: () => void;
  lastNonFullscreenWidth: number;
}

const SidePanel: React.FC<SidePanelProps> = ({
  isOpen,
  onClose,
  children,
  panelWidth,
  setPanelWidth,
  isPanelFullscreen,
  onToggleFullscreen,
}) => {
  const isResizing = useRef(false);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    isResizing.current = true;
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = window.innerWidth - e.clientX;
    const minWidth = 500;
    const maxWidth = window.innerWidth * 0.9; // Allow up to 90%
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      setPanelWidth(newWidth);
    }
  }, [setPanelWidth]);

  const handleMouseUp = useCallback(() => {
    isResizing.current = false;
  }, []);

  useEffect(() => {
    if (isOpen && !isPanelFullscreen) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isOpen, isPanelFullscreen, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);
  
  const handleBackgroundClick = () => {
      if (isPanelFullscreen) {
          onToggleFullscreen();
      }
  };

  return (
    <>
      <div
        className={`fixed right-0 bg-white shadow-2xl z-[1100] flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ 
            width: isPanelFullscreen ? '100vw' : `${panelWidth}px`,
            top: isPanelFullscreen ? '0' : '4rem', // 64px for h-16 header
            height: isPanelFullscreen ? '100vh' : 'calc(100vh - 4rem)',
            transition: 'width 0.3s ease-in-out, transform 0.3s ease-in-out, top 0.3s ease-in-out, height 0.3s ease-in-out'
        }}
        role="dialog"
        aria-modal="false"
        aria-labelledby="side-panel-title"
      >
        {!isPanelFullscreen && (
            <div
              onMouseDown={handleMouseDown}
              className="absolute top-0 left-0 h-full w-2 cursor-col-resize z-50 bg-gray-200/50 hover:bg-blue-500 opacity-0 hover:opacity-100 transition-opacity"
              title="Resize panel"
            />
        )}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b">
            <div id="side-panel-title" className="text-lg font-semibold text-gray-800">
                Patient Estimate Details
            </div>
            <div className="flex items-center space-x-2 ml-auto">
                 <button
                    onClick={onToggleFullscreen}
                    className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                    aria-label={isPanelFullscreen ? 'Collapse panel' : 'Expand panel'}
                    title={isPanelFullscreen ? 'Collapse panel' : 'Expand panel'}
                >
                    {isPanelFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                </button>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                    aria-label="Close panel"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>
        </div>
        <div className="flex-1 overflow-y-auto" onClick={handleBackgroundClick}>
          <div 
            className="mx-auto"
            style={{ maxWidth: '960px' }}
            onClick={e => e.stopPropagation()}
          >
            {children}
          </div>
        </div>
      </div>
    </>
  );
};

export default SidePanel;