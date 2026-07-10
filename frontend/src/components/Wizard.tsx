import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Check, ArrowRight, ArrowLeft } from 'lucide-react';

interface Step {
  title: string;
  content: React.ReactNode;
  validate?: () => boolean | string; // Returns true if valid, or a string error message if invalid
}

interface WizardProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  steps: Step[];
  onFinish: () => Promise<boolean | void> | void;
  finishText?: string;
}

export const Wizard: React.FC<WizardProps> = ({
  isOpen,
  onClose,
  title,
  steps,
  onFinish,
  finishText = 'Submit Provisioning Task',
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNext = () => {
    setErrorMsg(null);
    const step = steps[currentStep];
    
    if (step.validate) {
      const validationResult = step.validate();
      if (typeof validationResult === 'string') {
        setErrorMsg(validationResult);
        return;
      } else if (validationResult === false) {
        setErrorMsg('Please correct inputs before proceeding.');
        return;
      }
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setErrorMsg(null);
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setErrorMsg(null);
    const step = steps[currentStep];
    
    if (step.validate) {
      const validationResult = step.validate();
      if (typeof validationResult === 'string') {
        setErrorMsg(validationResult);
        return;
      } else if (validationResult === false) {
        setErrorMsg('Please correct inputs before proceeding.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onFinish();
      setCurrentStep(0);
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message || 'Provisioning workflow failed to launch.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-6">
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/80 pb-4 overflow-x-auto gap-2">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center shrink-0">
              <div className="flex items-center gap-2">
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border transition-all ${
                    index < currentStep
                      ? 'bg-brand-500 border-brand-500 text-white'
                      : index === currentStep
                      ? 'border-brand-500 text-brand-500 bg-brand-50/50 dark:bg-brand-950/20'
                      : 'border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {index < currentStep ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                <span
                  className={`text-xs font-bold transition-colors ${
                    index === currentStep
                      ? 'text-slate-800 dark:text-slate-100 font-bold'
                      : 'text-slate-400 dark:text-slate-500 font-medium'
                  }`}
                >
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className="h-[1px] w-8 bg-slate-200 dark:bg-slate-800 mx-2" />
              )}
            </div>
          ))}
        </div>

        {/* Validation Errors Alert Box */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs font-medium leading-relaxed">
            {errorMsg}
          </div>
        )}

        {/* Step Content */}
        <div className="min-h-[220px] max-h-[50vh] overflow-y-auto pr-1">
          {steps[currentStep].content}
        </div>

        {/* Step Controls Footer */}
        <div className="flex items-center justify-between border-t border-slate-200/50 dark:border-slate-800/80 pt-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0 || isSubmitting}
            className="flex items-center gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>

          {currentStep === steps.length - 1 ? (
            <Button
              variant="primary"
              onClick={handleSubmit}
              isLoading={isSubmitting}
              className="flex items-center gap-1.5"
            >
              {finishText}
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleNext}
              className="flex items-center gap-1.5"
            >
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
