import React, { useEffect, useState } from 'react';
import { CheckCircle, Info, X } from 'lucide-react';

interface ToastProps {
  message: string;
  onUndo?: () => void;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, onUndo, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, 6500); // Start fade-out before it disappears
    return () => clearTimeout(timer);
  }, [onClose]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300); // Wait for animation to finish
  };

  return (
    <div
      className={`fixed bottom-24 right-6 w-full max-w-sm rounded-lg shadow-lg bg-gray-800 text-white p-4 flex items-center justify-between z-[2000] transition-all duration-300 ${
        isExiting ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0 animate-fade-in'
      }`}
    >
      <div className="flex items-center">
        {onUndo ? (
          <Info className="h-5 w-5 text-blue-400 mr-3" />
        ) : (
          <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
        )}
        <span className="text-sm font-medium">{message}</span>
      </div>
      <div className="flex items-center space-x-2">
        {onUndo && (
          <button
            onClick={onUndo}
            className="text-sm font-bold text-blue-300 hover:text-blue-100"
          >
            Undo
          </button>
        )}
        <button onClick={handleClose} className="text-gray-400 hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default Toast;
