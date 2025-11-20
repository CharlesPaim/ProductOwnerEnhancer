
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
  isSystemMessage?: boolean;
  educationalInsight?: string; // Novo campo: Coach Mode
}

export interface QuestionResponse {
  question: string;
  educationalInsight: string;
  isConsensus: boolean;
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

export interface BddFeatureSuggestion {
  title: string;
  summary: string;
}

export interface GherkinScenario {
  title: string;
  gherkin: string;
}

export interface BddScenario {
  id: number;
  title: string;
  gherkin: string | null;
  completed: boolean;
  type: 'scenario' | 'outline';
}

export interface SessionData {
  id: string;
  lastModified: number;
  title: string;
  data: {
    appState: string;
    navigationHistory: string[];
    originalStory: ParsedStory | null;
    suggestedStory: string | null;
    splitStories: SplitStory[];
    complexityAnalysis: ComplexityAnalysisResult | null;
    suggestionForReview: string | null;
    storyHistory: string[];
    transcriptionMode: any;
    transcriptionAnalysisResult: string | null;
    planningMode: 'story' | 'bdd';
    featureDescription: string;
    bddScenarios: any[];
    currentScenarioIndex: number | null;
    generatedSingleGherkin: string | null;
    generatedGroupGherkin: GherkinScenario[] | null;
    poChecklistContent: string | null;
    stepDefContent: string | null;
    selectedTechnology: string;
    documentToConvert: string;
    featureSuggestions: BddFeatureSuggestion[];
    convertedFeatureFile: string;
    selectedScenarioIds: number[];
    planningScope: 'single' | 'group';
    currentGroupIndexes: number[];
    activePersonas: Persona[];
    conversation: ConversationTurn[];
    conversationInsights: string | null;
    currentAnswer: string;
    satisfiedPersonas: Persona[];
    testScenarios: string | null;
    modelStory: string;
    prototypeModel: string;
    userFlowDiagram: string | null; // Novo campo
  };
}