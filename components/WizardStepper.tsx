import React from 'react';
import { BookOpenIcon, SparklesIcon, ScaleIcon, ClipboardListIcon, CheckCircleIcon, DocumentTextIcon, MenuIcon, CodeIcon } from './icons';

type Step = {
  name: string;
  icon: React.FC<{ className?: string }>;
};

const storySteps: Step[] = [
  { name: 'História', icon: BookOpenIcon },
  { name: 'Perguntas', icon: SparklesIcon },
  { name: 'Complexidade', icon: ScaleIcon },
  { name: 'Testes', icon: ClipboardListIcon },
  { name: 'Pronto', icon: CheckCircleIcon },
];

const bddSteps: Step[] = [
  { name: 'Feature', icon: DocumentTextIcon },
  { name: 'Cenários', icon: MenuIcon },
  { name: 'Gherkin', icon: SparklesIcon },
  { name: 'Steps', icon: CodeIcon },
  { name: 'Pronto', icon: CheckCircleIcon },
];

type WizardStepperProps = {
  mode: 'story' | 'bdd';
  activeStepName: string;
};

const WizardStepper: React.FC<WizardStepperProps> = ({ mode, activeStepName }) => {
  const steps = mode === 'story' ? storySteps : bddSteps;
  const activeIndex = steps.findIndex(step => step.name === activeStepName);

  // O passo 'Pronto' só fica ativo se o passo anterior estiver completo.
  // Como não temos um estado explícito para 'Pronto', consideramos o último passo como ativo se o penúltimo estiver ativo.
  const finalActiveIndex = activeStepName === 'Pronto' ? steps.length -1 : activeIndex;


  return (
    <div className="w-full mb-6">
      <div className="flex items-center">
        {steps.map((step, index) => {
          const isCompleted = finalActiveIndex > index;
          const isActive = finalActiveIndex === index;

          const iconColor = isActive ? 'text-cyan-300' : isCompleted ? 'text-purple-400' : 'text-gray-500';
          const textColor = isActive ? 'text-cyan-300' : isCompleted ? 'text-purple-400' : 'text-gray-500';
          const lineColor = isCompleted ? 'bg-purple-500' : 'bg-gray-600';

          return (
            <React.Fragment key={step.name}>
              <div className="flex flex-col items-center text-center w-20">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${isActive ? 'border-cyan-300 animate-pulse' : isCompleted ? 'border-purple-400' : 'border-gray-600'}`}>
                  <step.icon className={`w-5 h-5 transition-colors ${iconColor}`} />
                </div>
                <p className={`mt-2 text-xs font-medium transition-colors ${textColor}`}>{step.name}</p>
              </div>

              {index < steps.length - 1 && (
                <div className={`flex-auto h-0.5 transition-colors ${lineColor}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default WizardStepper;
