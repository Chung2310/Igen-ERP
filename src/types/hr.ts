export type HRSubTabType = "SƠ ĐỒ TỔ CHỨC" | "GIAO VIỆC KANBAN" | "ĐÀO TẠO" | "QUY TRÌNH" | "LỊCH";

export interface WorkflowSubTask {
  id: string;
  title: string;
  assigneeUid?: string;
  assignee?: string;
  done?: boolean;
}

export interface WorkflowStep {
  id: string;
  title: string;
  description?: string;
  /** Single assignee (legacy) */
  assigneeUid?: string;
  assignee?: string;
  /** Multiple assignees */
  assigneeUids?: string[];
  /** Related persons (người liên quan) */
  relatedUids?: string[];
  /** Domain / project tag */
  domain?: string;
  /** Priority: urgent_important | urgent | important | normal */
  priority?: "urgent_important" | "urgent" | "important" | "normal";
  /** Deadline type relative to stage start */
  deadlineType?: "same_day" | "after_1" | "after_2" | "after_x" | "none" | "custom_time";
  /** Used when deadlineType = after_x */
  deadlineDays?: number;
  /** Specific time HH:mm when deadlineType = custom_time */
  deadlineTime?: string;
  /** @deprecated Không còn phân loại ô — giữ lại để tương thích dữ liệu cũ */
  type?: "start" | "task" | "approval" | "end";
  estDays?: number;
  /** Kết quả / đầu ra mong đợi của bước */
  deliverable?: string;
  /** Lưu ý / điều kiện thực hiện */
  note?: string;
  /** Sub-tasks (công việc con) */
  subTasks?: WorkflowSubTask[];
  /** @deprecated Không còn dùng canvas — giữ lại để tương thích dữ liệu cũ */
  position?: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

/** Một "công việc" (case) đang đi qua quy trình, đứng ở cột (bước) hiện tại */
export interface WorkflowParticipant {
  id: string;
  /** Tên công việc (VD: "Onboarding Nguyễn Văn A") */
  name: string;
  /** Người phụ trách chính — fallback nhận task khi bước không gán ai */
  userUid?: string;
  avatar?: string;
  /** id của bước hiện tại; "__done__" = đã hoàn thành */
  currentStepId: string;
  note?: string;
  /** Mô tả chi tiết công việc */
  description?: string;
  /** Người liên quan */
  relatedUids?: string[];
  /** Độ ưu tiên của công việc (dùng khi bước không có priority riêng) */
  priority?: "urgent_important" | "urgent" | "important" | "normal";
  /** Ngày bắt đầu dự kiến (YYYY-MM-DD) */
  startDate?: string;
  /** Hạn hoàn thành toàn quy trình (YYYY-MM-DD) */
  dueDate?: string;
  /** Link tài liệu/hồ sơ đính kèm */
  docLinks?: string[];
  /** Công việc con riêng của case — sinh task Kanban ở bước đầu tiên */
  customSubTasks?: WorkflowSubTask[];
  startedAt?: string;
  updatedAt?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  category?: string;
  steps: WorkflowStep[];
  edges?: WorkflowEdge[];
  participants?: WorkflowParticipant[];
  /** Tự chuyển case sang bước kế khi mọi task Kanban của bước hiện tại hoàn thành */
  autoAdvance?: boolean;
  companyCode: string;
  creatorUid: string;
  createdAt: any;
}

export interface EmployeeNode {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  avatar: string;
  level: number; // 1 = CEO, 2 = Director, 3 = Manager, 4 = Staff
  parentId?: string;
  status: "online" | "offline";
  division: string;
}

export interface Project {
  id: string;
  name: string;
  companyCode: string;
  creatorUid: string;
  createdAt: any;
}

export interface TaskHistoryEntry {
  time: string;
  user: string;
  action: string;
}

export interface HRTask {
  id: string;
  title: string;
  description?: string;
  assigneeUid: string;
  assignee: string;
  assigneeAvatar: string;
  dueDate: string;
  priority: "High" | "Medium" | "Low" | "Cao" | "Trung bình" | "Thấp";
  status: "Not Started" | "In Progress" | "Review/Testing" | "Done" | "Archived" | "todo" | "doing" | "done";
  category?: "Onboarding" | "Đào tạo" | "Tuyển dụng" | "Văn hóa";
  companyCode: string;
  creatorUid: string;
  createdAt: any;

  // New Notion fields
  projectId?: string;
  startTime?: string;
  estTime?: number;
  endTime?: string;
  actualTime?: number;
  tags?: string[];
  linkNote?: string;
  history?: TaskHistoryEntry[];
  workflowId?: string;
  workflowStepId?: string;
  participantId?: string;
  isFromWorkflow?: boolean;
}

export interface Lesson {
  title: string;
  url: string;
  type: "youtube" | "document" | "other" | "text" | "video";
  content?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctOptionIndex: number;
}

export interface TrainingCourse {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  isRequired: boolean;
  icon: string;
  imageUrl?: string;
  duration: string;
  instructor: string;
  companyCode: string;
  creatorUid: string;
  createdAt: any;
  enrolledCount: number;
  companyProgress: number;
  autoAssignOnboarding: boolean;
  lessons?: Lesson[];
  quizzes?: QuizQuestion[];
}

export interface TrainingEnrollment {
  id: string;
  courseId: string;
  courseTitle: string;
  uid: string;
  userName: string;
  companyCode: string;
  progress: number;
  status: "not_started" | "in_progress" | "completed";
  startedAt?: any;
  completedAt?: any;
  createdAt: any;
  completedLessons?: string[];
  quizPassed?: boolean;
}
