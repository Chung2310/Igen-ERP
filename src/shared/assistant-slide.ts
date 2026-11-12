export type AssistantSlideStyle = "rewrite" | "preserve" | "shorten";
export const assistantSlideThemeIds = ["ocean", "meadow", "sunrise", "berry"] as const;
export type AssistantSlideThemeId = typeof assistantSlideThemeIds[number];
export const assistantSlideLayouts = ["cards", "timeline", "steps", "comparison", "chart"] as const;
export type AssistantSlideLayout = typeof assistantSlideLayouts[number];
export const assistantSlideFontFamilies = ["Inter", "Aptos", "Arial", "Georgia", "Trebuchet MS"] as const;
export type AssistantSlideFontFamily = typeof assistantSlideFontFamilies[number];

export interface AssistantSlideTextStyle {
  fontFamily?: AssistantSlideFontFamily;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  align?: "left" | "center" | "right";
}

export interface AssistantSlideCanvasObject {
  id: string;
  type: "text" | "image";
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  src?: string;
  alt?: string;
  style?: AssistantSlideTextStyle;
}

export interface AssistantSlideAnalysis {
  audience: string;
  objective: string;
  storyline: string;
}

export interface AssistantSlideContent {
  title: string;
  keyMessage: string;
  bullets: string[];
  speakerNotes: string;
  layout?: AssistantSlideLayout;
  textStyles?: Record<string, AssistantSlideTextStyle>;
  objects?: AssistantSlideCanvasObject[];
}

export interface AssistantSlideDeck {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  sourceFileName: string;
  style: AssistantSlideStyle;
  analysis?: AssistantSlideAnalysis;
  themeId: AssistantSlideThemeId;
  coverTextStyles?: Record<string, AssistantSlideTextStyle>;
  coverObjects?: AssistantSlideCanvasObject[];
  slides: AssistantSlideContent[];
  createdAt: string;
}

export interface AssistantSlideHistoryItem {
  id: string;
  title: string;
  subtitle: string;
  sourceFileName: string;
  slideCount: number;
  createdAt: string;
}

export interface AssistantSlideDeckUpdate {
  title: string;
  subtitle: string;
  themeId: AssistantSlideThemeId;
  coverTextStyles?: Record<string, AssistantSlideTextStyle>;
  coverObjects?: AssistantSlideCanvasObject[];
  slides: AssistantSlideContent[];
}
