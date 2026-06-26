export type FeedbackType = "bug" | "suggestion" | "comment";
export type FeedbackStatus = "open" | "in_review" | "resolved";

export interface FeedbackReport {
  id: string;
  type: FeedbackType;
  title: string;
  description: string;
  page_url: string | null;
  user_agent: string | null;
  status: FeedbackStatus;
  created_at: string;
}

export type FeedbackInsert = Omit<FeedbackReport, "id" | "status" | "created_at">;
