import { api } from "./client";
import type { Feedback, FeedbackCategory } from "./types";

export interface FeedbackInput {
  category: FeedbackCategory;
  subject: string;
  message: string;
}

export const feedbackApi = {
  submit: (payload: FeedbackInput) => api.post<Feedback>("/feedback", payload),
  getMine: () => api.get<Feedback[]>("/feedback/mine"),
};
