export enum Persona {
  Dev = 'Desenvolvedor Sênior',
  QA = 'Engenheiro de QA Sênior',
  Architect = 'Arquiteto Sênior',
  UX = 'Designer de UX/UI',
  DevOps = 'Engenheiro de DevOps',
  PO = 'Product Owner Sênior',
}

export interface ConversationTurn {
  id: number;
  persona: Persona;
  question: string;
  answer?: string;
}

export interface ParsedStory {
  title: string;
  description: string;
}

export interface RedmineIssue {
  issue: {
    id: number;
    subject: string;
    description: string;
  };
}

export type InitialQuestions = Record<string, string>;

export interface SplitStory {
  title: string;
  description: string;
}

export interface ComplexityAnalysisResult {
  complexity: 'Baixa' | 'Média' | 'Alta';
  justification: string;
  suggestedStories?: SplitStory[];
}
