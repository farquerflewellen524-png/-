
export enum AppTab {
  HABITS = 'habits',
  CLINICAL = 'clinical',
  RESEARCH = 'research',
}

export enum HabitCategory {
  PATIENT = '患者管理',
  LIFE = '生活',
  FITNESS = '健身',
  RESEARCH = '科研',
  FINANCE = '财商',
}

export interface Habit {
  id: string;
  name: string;
  category: HabitCategory;
  completedDates: string[]; // ISO Strings
  scheduledDays?: number[]; // 0-6 for Sun-Sat
  time?: string; // HH:mm format
}

export interface ClinicalAnalysis {
  diagnosis: string[];
  omitted: string[];
  medications: string[];
  complications: string[];
  guidelines: { title: string; url: string }[];
  scales: { name: string; items: string[] }[];
  plan: string;
  followUpTasks: string[];
}

export interface ResearchInsight {
  literatures: { title: string; journal: string; link: string }[];
  ideas: string[];
  managementTips: string[];
}

export interface HistoryItem {
  id: string;
  timestamp: string;
  type: 'clinical' | 'research';
  title: string;
  data: ClinicalAnalysis | ResearchInsight;
}
