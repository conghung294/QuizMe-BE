import { QuestionType } from '@prisma/client';

export interface AIQuestionChoice {
  label: string;
  content: string;
}

export interface AIGeneratedQuestion {
  question: string;
  choices: AIQuestionChoice[];
  correctAnswers: string[];
  explanation?: string;
  type: QuestionType;
}

export interface AIResponse {
  questions: AIGeneratedQuestion[];
}

export interface ParsedAIResponse {
  questions: unknown[];
}
