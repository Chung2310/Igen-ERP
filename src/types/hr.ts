export type HRSubTabType = "SƠ ĐỒ TỔ CHỨC" | "Giao Việc" | "ĐÀO TẠO" | "QUY TRÌNH" | "LỊCH" | "ĐƠN TỪ" | "PAYROLL" | "HỢP ĐỒNG" | "EMAIL CHÚC MỪNG" | "TUYỂN DỤNG";

/** File/du?ng d?n d�nh k�m v�o task: ghi �m, h�nh ?nh, video, t�i li?u, link� */
export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  type: "image" | "video" | "audio" | "file" | "link";
  size?: number;
}

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
  /** Related persons (ngu?i li�n quan) */
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
  /** @deprecated Kh�ng c�n ph�n lo?i � � gi? l?i d? tuong th�ch d? li?u cu */
  type?: "start" | "task" | "approval" | "end";
  estDays?: number;
  /** K?t qu? / d?u ra mong d?i c?a bu?c */
  deliverable?: string;
  /** Luu � / di?u ki?n th?c hi?n */
  note?: string;
  /** Sub-tasks (c�ng vi?c con) */
  subTasks?: WorkflowSubTask[];
  docLinks?: string[];
  /** T?p v� li�n k?t g?n v?i ri�ng bu?c quy tr�nh. */
  attachments?: TaskAttachment[];
  /** @deprecated Kh�ng c�n d�ng canvas � gi? l?i d? tuong th�ch d? li?u cu */
  position?: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  category?: string;
  steps: WorkflowStep[];
  edges?: WorkflowEdge[];
  /** T? chuy?n case sang bu?c k? khi m?i task Kanban c?a bu?c hi?n t?i ho�n th�nh */
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
  jobDescriptionLink?: string;
  monthlySalary?: number;
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
  category?: "Onboarding" | "Hướng dẫn nhân viên mới" | "Đào tạo" | "Tuyển dụng" | "Văn hóa";
  companyCode: string;
  creatorUid: string;
  createdAt: any;

  // New Notion fields
  projectId?: string;
  startTime?: string;
  actualStartTime?: string;
  estTime?: number;
  endTime?: string;
  actualTime?: number;
  completedAt?: string;
  revision?: number;
  tags?: string[];
  linkNote?: string;
  attachments?: TaskAttachment[];
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
