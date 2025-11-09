// src/types/choice.ts

export type FollowUp = {
  id: string;
  text: string;
  createdAt: number; // epoch ms
};

export enum ChoiceAction {
  SetEmotion = "SetEmotion",
  SetIntensity = "SetIntensity",
  SaveReflection = "SaveReflection",
  TagTopic = "TagTopic",
  MarkImportant = "MarkImportant",
  CreateFollowUp = "CreateFollowUp",
  Dismiss = "Dismiss",
  Custom = "Custom",
}

export type Choice = {
  id: string;                  // stable id for idempotence
  label: string;               // text on the pill/button
  action: ChoiceAction;        // what to do when applied
  payload?: Record<string, any>; // e.g., { emotion: "calm" } or { tag: "sleep" }
  tooltip?: string;            // short hint for UI
  disabledReason?: string;     // optional: explain why disabled
};
