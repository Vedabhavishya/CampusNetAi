import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertCircle } from 'lucide-react';

interface UniversalConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmText: string;
  onConfirm: () => Promise<void> | void;
}

export const UniversalConfirmationDialog: React.FC<UniversalConfirmationDialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  confirmText,
  onConfirm,
}) => {
  const [userInput, setUserInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (userInput !== confirmText) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onConfirm();
      setUserInput('');
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message || 'Operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setUserInput('');
    setErrorMsg(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <div className="space-y-5 text-left">
        {/* Warning Indicator */}
        <div className="flex items-start gap-3 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400 text-xs leading-relaxed font-sans">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="font-bold">Dangerous Action Warning</p>
            <p className="mt-0.5">{message}</p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold rounded-lg">
            {errorMsg}
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
            To proceed, type <span className="font-mono font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded border">{confirmText}</span> below:
          </label>
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder={`Type "${confirmText}"`}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200/50 dark:border-slate-800/80 pt-4">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={userInput !== confirmText || isSubmitting}
            isLoading={isSubmitting}
            className="bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500"
          >
            Confirm Override
          </Button>
        </div>
      </div>
    </Modal>
  );
};
