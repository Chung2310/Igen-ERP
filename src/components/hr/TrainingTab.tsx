import React, { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Plus,
  Play,
  CheckCircle,
  HelpCircle,
  FileText,
  Trash2,
  X,
  RefreshCw,
  Video,
  Eye,
  AlertCircle,
  Edit2,
  Upload,
  Paperclip
} from "lucide-react";
import { EmployeeNode, TrainingCourse, TrainingEnrollment, Lesson, QuizQuestion } from "../../types";
import { getAccessToken, authService } from "../../services/authService";
import { toast } from "../../pages/Toast";
import { getApiErrorMessage } from "../../utils/errorMessage";
import { ConfirmDialog } from "../common/ConfirmDialog";

const emojiIconPattern = /[\u2600-\u27BF\u{1F300}-\u{1FAFF}]/u;

function TrainingBookIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M4 5.5c4.7-1.5 8.4-1.2 12 1.3v20.7c-3.6-2.5-7.3-2.8-12-1.3V5.5Z" fill="#0089D0" />
      <path d="M28 5.5c-4.7-1.5-8.4-1.2-12 1.3v20.7c3.6-2.5 7.3-2.8 12-1.3V5.5Z" fill="#00ADFC" />
      <path d="M7.2 9c2.7-.5 4.9-.1 7 1.1M7.2 13c2.7-.5 4.9-.1 7 1.1M24.8 9c-2.7-.5-4.9-.1-7 1.1M24.8 13c-2.7-.5-4.9-.1-7 1.1" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity=".9" />
      <path d="M16 6.8v20.7" stroke="#006AA6" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 26.2c4.7-1.5 8.4-1.2 12 1.3 3.6-2.5 7.3-2.8 12-1.3" stroke="#005D93" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function TrainingProgressIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="26" height="24" rx="7" fill="#D9F3FF" stroke="#8DDCFF" />
      <path d="M8 22h16" stroke="#007EB8" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="9" y="17" width="3" height="5" rx="1" fill="#76CFFF" />
      <rect x="15" y="13" width="3" height="9" rx="1" fill="#25B6FA" />
      <rect x="21" y="9" width="3" height="13" rx="1" fill="#007EB8" />
      <path d="m9.5 12.5 4.2-3 3.4 1.5 5.2-4" stroke="#006AA6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m19.8 7 2.5-.5-.3 2.5" stroke="#006AA6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function displayTrainingIcon(icon: string | undefined, className?: string) {
  return icon && icon !== "book" && !emojiIconPattern.test(icon) ? icon : <TrainingBookIcon className={className} />;
}

type TrainingGlyphName = "clock" | "instructor" | "learners" | "document" | "video" | "tip";

function TrainingGlyph({ name, className = "h-4 w-4" }: { name: TrainingGlyphName; className?: string }) {
  const shapes: Record<TrainingGlyphName, React.ReactNode> = {
    clock: <><circle cx="12" cy="12" r="8.5" fill="#E8F7FF" /><path d="M12 7v5l3 2" /></>,
    instructor: <><circle cx="8" cy="8" r="2.5" fill="#85DDFF" /><path d="M3.5 19v-2a4.5 4.5 0 0 1 9 0v2M14 6h6v9h-5M16 11l2-2" /></>,
    learners: <><circle cx="8" cy="8" r="2.5" fill="#85DDFF" /><circle cx="16.5" cy="8.5" r="2" fill="#B7EAFE" /><path d="M3.5 19v-2a4.5 4.5 0 0 1 9 0v2M13 15a4 4 0 0 1 7.5 2v2h-5" /></>,
    document: <><path d="M5 3.5h9l5 5V21H5V3.5Z" fill="#E8F7FF" /><path d="M14 3.5v5h5M8 12h8M8 15h8M8 18h5" /></>,
    video: <><rect x="3.5" y="5" width="17" height="14" rx="3" fill="#E8F7FF" /><path d="m10 9 5 3-5 3V9Z" fill="#00ADFC" stroke="none" /></>,
    tip: <><path d="M8.5 16.5c-.2-2-3-3.2-3-6.8a6.5 6.5 0 0 1 13 0c0 3.6-2.8 4.8-3 6.8H8.5Z" fill="#E8F7FF" /><path d="M9 19h6M10 21h4" /></>,
  };
  return <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="#007EB8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]}</svg>;
}

interface TrainingTabProps {
  userProfile: any;
  selectedCompanyCode: string;
  isManager: boolean;
  courses: TrainingCourse[];
  setCourses: React.Dispatch<React.SetStateAction<TrainingCourse[]>>;
  fetchCourses: (compCode: string) => Promise<void>;
  employees: EmployeeNode[];
}

export default function TrainingTab({
  userProfile,
  selectedCompanyCode,
  isManager,
  courses,
  setCourses,
  fetchCourses,
  employees
}: TrainingTabProps) {
  const isSupervisor = isManager || (userProfile?.level !== undefined && userProfile?.level <= 3);
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [editingCourse, setEditingCourse] = useState<TrainingCourse | null>(null);
  const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const askConfirm = (
    title: string,
    description: string,
    onConfirm: () => void | Promise<void>,
    confirmLabel = "Xác nhận"
  ) => {
    setConfirmState({
      isOpen: true,
      title,
      description,
      confirmLabel,
      onConfirm: async () => {
        await onConfirm();
        setConfirmState(null);
      },
    });
  };
  const [courseFormTitle, setCourseFormTitle] = useState("");
  const [courseFormDesc, setCourseFormDesc] = useState("");
  const [courseFormCategory, setCourseFormCategory] = useState("Văn hóa");
  const [courseFormDuration, setCourseFormDuration] = useState("");
  const [courseFormIsRequired, setCourseFormIsRequired] = useState(false);
  const [courseFormAutoOnboarding, setCourseFormAutoOnboarding] = useState(false);

  // New state variables for lessons and quizzes
  const [courseFormLessons, setCourseFormLessons] = useState<Lesson[]>([]);
  const [courseFormQuizzes, setCourseFormQuizzes] = useState<QuizQuestion[]>([]);
  const [uploadingLessonFileIndex, setUploadingLessonFileIndex] = useState<number | null>(null);
  const lessonFileInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Active study player state
  const [activeStudyCourse, setActiveStudyCourse] = useState<TrainingCourse | null>(null);
  const [activeLessonIndex, setActiveLessonIndex] = useState<number>(-1);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);
  const [quizErrors, setQuizErrors] = useState<boolean[]>([]);
  const [isQuizEvaluating, setIsQuizEvaluating] = useState<boolean>(false);

  // Supervisory view filter
  const [trainingFilter, setTrainingFilter] = useState<string | null>(null);
  const [supervisorEnrollments, setSupervisorEnrollments] = useState<TrainingEnrollment[]>([]);

  const fetchMyEnrollments = async (uid: string) => {
    try {
      const res = await fetch(`/api/v1/crud/training-enrollments?uid=${encodeURIComponent(uid)}`, {
        headers: {
          "Authorization": `Bearer ${getAccessToken()}`,
        },
      });
      if (!res.ok) throw new Error("Không thể tải tiến độ học");
      const json = await res.json();
      const list: TrainingEnrollment[] = (json.data || []).map((item: any) => ({
        ...item,
        id: item._id,
      }));
      setEnrollments(list);
    } catch (err) {
      console.error("Lỗi tải tiến độ học:", err);
    }
  };

  const fetchSupervisorEnrollments = async (companyCode: string) => {
    try {
      const res = await fetch(`/api/v1/crud/training-enrollments?companyCode=${encodeURIComponent(companyCode)}`, {
        headers: {
          "Authorization": `Bearer ${getAccessToken()}`,
        },
      });
      if (!res.ok) throw new Error("Không thể tải tiến độ đào tạo cấp dưới");
      const json = await res.json();
      const list: TrainingEnrollment[] = (json.data || []).map((item: any) => ({
        ...item,
        id: item._id,
      }));
      setSupervisorEnrollments(list);
    } catch (err) {
      console.error("Lỗi tải tiến độ học giám sát:", err);
    }
  };

  useEffect(() => {
    if (selectedCompanyCode && userProfile) {
      fetchMyEnrollments(userProfile.uid);
      if (isSupervisor) {
        fetchSupervisorEnrollments(selectedCompanyCode);
      }
    }
  }, [selectedCompanyCode, userProfile, isSupervisor]);

  const handleOpenEditCourse = (course: TrainingCourse) => {
    setEditingCourse(course);
    setCourseFormTitle(course.title);
    setCourseFormDesc(course.description || "");
    setCourseFormCategory(course.category || "Văn hóa");
    setCourseFormDuration(course.duration || "");
    setCourseFormIsRequired(course.isRequired || false);
    setCourseFormAutoOnboarding(course.autoAssignOnboarding || false);
    setCourseFormLessons(course.lessons || []);
    setCourseFormQuizzes(course.quizzes || []);
    setIsAddCourseModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsAddCourseModalOpen(false);
    setEditingCourse(null);
    setCourseFormTitle("");
    setCourseFormDesc("");
    setCourseFormCategory("Văn hóa");
    setCourseFormDuration("");
    setCourseFormIsRequired(false);
    setCourseFormAutoOnboarding(false);
    setCourseFormLessons([]);
    setCourseFormQuizzes([]);
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !courseFormTitle.trim()) return;
    const companyCode = selectedCompanyCode || userProfile.companyCode || "SYSTEM";
    if (userProfile.role !== "superadmin" && (!companyCode || companyCode === "SYSTEM")) {
      toast.error("Tài khoản của bạn chưa được gắn với doanh nghiệp. Không thể tạo khóa học.");
      return;
    }
    const creatorName = userProfile.displayName || userProfile.email || "iGen Academy";
    try {
      if (editingCourse) {
        // Edit Mode
        const courseData = {
          title: courseFormTitle.trim(),
          description: courseFormDesc.trim(),
          category: courseFormCategory,
          tags: courseFormIsRequired ? ["Bắt buộc"] : [courseFormCategory],
          isRequired: courseFormIsRequired,
          duration: courseFormDuration.trim() || "Chưa xác định",
          instructor: creatorName,
          companyCode: companyCode,
          autoAssignOnboarding: courseFormAutoOnboarding,
          lessons: courseFormLessons,
          quizzes: courseFormQuizzes,
        };

        const res = await fetch(`/api/v1/crud/training-courses/${editingCourse.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify(courseData),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Cập nhật khóa học thất bại");
        }

        toast.success("Đã cập nhật khóa học thành công!");
        handleCloseModal();

        // Update local state
        setCourses(prev => prev.map(c => c.id === editingCourse.id
          ? { ...c, ...courseData }
          : c
        ));

        if (courseFormIsRequired) {
          await fetchMyEnrollments(userProfile.uid);
        }
        if (isSupervisor) {
          await fetchSupervisorEnrollments(companyCode);
        }
        return;
      }

      // Create Mode
      const courseData = {
        title: courseFormTitle.trim(),
        description: courseFormDesc.trim(),
        category: courseFormCategory,
        tags: courseFormIsRequired ? ["Bắt buộc"] : [courseFormCategory],
        isRequired: courseFormIsRequired,
        icon: "book",
        duration: courseFormDuration.trim() || "Chưa xác định",
        instructor: creatorName,
        companyCode: companyCode,
        creatorUid: userProfile.uid,
        createdAt: new Date().toISOString(),
        enrolledCount: 0,
        companyProgress: 0,
        autoAssignOnboarding: courseFormAutoOnboarding,
        lessons: courseFormLessons,
        quizzes: courseFormQuizzes,
      };

      const res = await fetch("/api/v1/crud/training-courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify(courseData),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Tạo khóa học thất bại");
      }

      const json = await res.json();
      const createdCourseId = json.data._id;

      let enrolledCount = 0;
      if (courseFormIsRequired) {
        try {
          const companyUsers = await authService.getUsersByCompany(companyCode);
          const targetEmployees = companyUsers.filter(u => u.role !== "superadmin");

          if (targetEmployees.length > 0) {
            await Promise.all(
              targetEmployees.map(emp =>
                fetch("/api/v1/crud/training-enrollments", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${getAccessToken()}`,
                  },
                  body: JSON.stringify({
                    courseId: createdCourseId,
                    courseTitle: courseFormTitle.trim(),
                    uid: emp.uid,
                    userName: emp.displayName || emp.email || "Nhân viên",
                    companyCode: companyCode,
                    progress: 0,
                    status: "in_progress",
                    createdAt: new Date().toISOString(),
                    startedAt: new Date().toISOString(),
                    completedLessons: [],
                    quizPassed: false,
                  }),
                })
              )
            );
            enrolledCount = targetEmployees.length;

            // Cập nhật lại enrolledCount trên khóa học
            await fetch(`/api/v1/crud/training-courses/${createdCourseId}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${getAccessToken()}`,
              },
              body: JSON.stringify({
                enrolledCount: enrolledCount
              }),
            });
          }
        } catch (enrollErr) {
          console.error("Lỗi tự động gán khóa học bắt buộc:", enrollErr);
        }
      }

      toast.success("Đã tạo khóa học thành công!");
      handleCloseModal();

      // Thêm vào local state ngay không cần reload
      setCourses(prev => [...prev, {
        ...courseData,
        id: createdCourseId,
        enrolledCount: enrolledCount,
      }]);

      if (courseFormIsRequired) {
        await fetchMyEnrollments(userProfile.uid);
      }
      if (isSupervisor) {
        await fetchSupervisorEnrollments(companyCode);
      }
    } catch (err) {
      console.error("Lỗi tạo khóa học:", err);
      toast.error(getApiErrorMessage(err, "Không thể tạo khóa học."));
    }
  };

  const handleEnrollAndStart = async (course: TrainingCourse) => {
    if (!userProfile) return;
    const existing = enrollments.find(e => e.courseId === course.id);
    if (!existing) {
      try {
        const res = await fetch("/api/v1/crud/training-enrollments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({
            courseId: course.id,
            courseTitle: course.title,
            uid: userProfile.uid,
            userName: userProfile.displayName || userProfile.email || "Nhân viên",
            companyCode: course.companyCode,
            progress: 0,
            status: "in_progress",
            startedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            completedLessons: [],
            quizPassed: false,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Đăng ký khóa học thất bại");
        }

        const json = await res.json();
        const createdEnrollId = json.data._id;

        // Tăng enrolledCount trên course
        await fetch(`/api/v1/crud/training-courses/${course.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({
            enrolledCount: (course.enrolledCount || 0) + 1
          }),
        });

        const newEnroll: TrainingEnrollment = {
          id: createdEnrollId, courseId: course.id, courseTitle: course.title,
          uid: userProfile.uid, userName: userProfile.displayName || userProfile.email || "Nhân viên",
          companyCode: course.companyCode, progress: 0,
          status: "in_progress", createdAt: new Date().toISOString(),
          completedLessons: [],
          quizPassed: false,
        };
        setEnrollments(prev => [...prev, newEnroll]);
        setCourses(prev => prev.map(c => c.id === course.id
          ? { ...c, enrolledCount: (c.enrolledCount || 0) + 1 }
          : c
        ));

        // Mở modal học tập
        setActiveStudyCourse(course);
        setActiveLessonIndex(-1); // Intro
        setQuizAnswers([]);
        setQuizSubmitted(false);
        setQuizErrors([]);
        toast.success(`Bắt đầu học "${course.title}"!`);
      } catch (err) {
        console.error(err);
        toast.error(getApiErrorMessage(err, "Không thể đăng ký khóa học."));
      }
    } else {
      // Đã enroll → Mở modal học tập
      setActiveStudyCourse(course);

      const completed = existing.completedLessons || [];
      const lessons = course.lessons || [];
      let nextIdx = -1;
      for (let i = 0; i < lessons.length; i++) {
        if (!completed.includes(`lesson_${i}`)) {
          nextIdx = i;
          break;
        }
      }

      if (nextIdx === -1 && lessons.length > 0 && !existing.quizPassed && (course.quizzes && course.quizzes.length > 0)) {
        nextIdx = lessons.length;
      }

      setActiveLessonIndex(nextIdx);
      setQuizAnswers([]);
      setQuizSubmitted(false);
      setQuizErrors([]);
    }
  };

  const handleMarkLessonComplete = async (lesson: Lesson, currentIdx?: number) => {
    if (!activeStudyCourse || !userProfile) return;
    const enroll = enrollments.find(e => e.courseId === activeStudyCourse.id);
    if (!enroll) return;

    const completed = enroll.completedLessons || [];
    const lessons = activeStudyCourse.lessons || [];
    const currentIndex = currentIdx !== undefined ? currentIdx : lessons.findIndex(l => l.url === lesson.url);
    const lessonKey = `lesson_${currentIndex}`;

    if (!completed.includes(lessonKey)) {
      const nextCompleted = [...completed, lessonKey];

      const totalLessons = lessons.length;
      const totalQuizzes = (activeStudyCourse.quizzes && activeStudyCourse.quizzes.length > 0) ? 1 : 0;
      const totalItems = totalLessons + totalQuizzes;

      const finishedItems = nextCompleted.length + (enroll.quizPassed ? 1 : 0);
      const progressPercent = Math.round((finishedItems / (totalItems || 1)) * 100);
      const isCourseDone = progressPercent >= 100;
      const newStatus = isCourseDone ? "completed" : "in_progress";

      try {
        const updateData: Record<string, any> = {
          completedLessons: nextCompleted,
          progress: progressPercent,
          status: newStatus,
        };
        if (isCourseDone) {
          updateData.completedAt = new Date().toISOString();
        }

        const res = await fetch(`/api/v1/crud/training-enrollments/${enroll.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify(updateData),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Cập nhật bài học thất bại");
        }

        setEnrollments(prev => prev.map(e => e.id === enroll.id
          ? { ...e, completedLessons: nextCompleted, progress: progressPercent, status: newStatus }
          : e
        ));

        // Tự động chuyển bài học tiếp theo hoặc quiz
        if (currentIndex < lessons.length - 1) {
          setActiveLessonIndex(currentIndex + 1);
        } else if (totalQuizzes > 0) {
          setActiveLessonIndex(lessons.length); // Chuyển sang phần thi trắc nghiệm
        } else {
          toast.success(`Chúc mừng! Bạn đã hoàn thành khóa học "${activeStudyCourse.title}"!`);
          setActiveStudyCourse(null);
          fetchCourses(userProfile.companyCode!);
        }
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Không thể lưu tiến độ học tập."));
      }
    } else {
      const totalQuizzes = (activeStudyCourse.quizzes && activeStudyCourse.quizzes.length > 0) ? 1 : 0;

      if (currentIndex < lessons.length - 1) {
        setActiveLessonIndex(currentIndex + 1);
      } else if (totalQuizzes > 0) {
        setActiveLessonIndex(lessons.length);
      } else {
        setActiveStudyCourse(null);
      }
    }
  };

  const handleSubmitQuiz = async () => {
    if (!activeStudyCourse || !userProfile) return;
    const enroll = enrollments.find(e => e.courseId === activeStudyCourse.id);
    if (!enroll) return;

    const quizzes = activeStudyCourse.quizzes || [];
    if (quizzes.length === 0) return;

    const unanswered = quizzes.some((_, idx) => quizAnswers[idx] === undefined || quizAnswers[idx] === null);
    if (unanswered) {
      toast.warning("Vui lòng trả lời đầy đủ tất cả các câu hỏi trắc nghiệm!");
      return;
    }

    let allCorrect = true;
    const errorsCopy = new Array(quizzes.length).fill(false);
    for (let i = 0; i < quizzes.length; i++) {
      if (quizAnswers[i] !== quizzes[i].correctOptionIndex) {
        allCorrect = false;
        errorsCopy[i] = true;
      }
    }

    if (allCorrect) {
      setIsQuizEvaluating(true);
      const totalLessons = activeStudyCourse.lessons?.length ?? 0;
      const totalItems = totalLessons + 1;
      const finishedItems = (enroll.completedLessons || []).length + 1;
      const progressPercent = Math.round((finishedItems / (totalItems || 1)) * 100);
      const isCourseDone = progressPercent >= 100;
      const newStatus = isCourseDone ? "completed" : "in_progress";

      try {
        const updateData: Record<string, any> = {
          quizPassed: true,
          progress: progressPercent,
          status: newStatus,
        };
        if (isCourseDone) {
          updateData.completedAt = new Date().toISOString();
        }

        const res = await fetch(`/api/v1/crud/training-enrollments/${enroll.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify(updateData),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Nộp bài thi thất bại");
        }

        setEnrollments(prev => prev.map(e => e.id === enroll.id
          ? { ...e, quizPassed: true, progress: progressPercent, status: newStatus }
          : e
        ));

        setQuizSubmitted(true);
        setQuizErrors(errorsCopy);
        toast.success("Xuất sắc! Bạn đã trả lời đúng tất cả các câu hỏi trắc nghiệm!");
      } catch (err) {
        console.error(err);
        toast.error(getApiErrorMessage(err, "Không thể lưu kết quả thi."));
      } finally {
        setIsQuizEvaluating(false);
      }
    } else {
      setQuizSubmitted(true);
      setQuizErrors(errorsCopy);
      toast.error("Có câu trả lời chưa đúng. Vui lòng kiểm tra lại!");
    }
  };

  const handleFinishCourse = () => {
    if (!activeStudyCourse || !userProfile) return;
    toast.success(`Chúc mừng! Bạn đã hoàn thành khóa học "${activeStudyCourse.title}"!`);
    setActiveStudyCourse(null);
    fetchCourses(userProfile.companyCode!);
  };

  const handleCompleteCourseDirectly = async () => {
    if (!activeStudyCourse || !userProfile) return;
    const enroll = enrollments.find(e => e.courseId === activeStudyCourse.id);
    if (!enroll) return;

    try {
      const res = await fetch(`/api/v1/crud/training-enrollments/${enroll.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          progress: 100,
          status: "completed",
          completedAt: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Hoàn thành khóa học thất bại");
      }

      setEnrollments(prev => prev.map(e => e.id === enroll.id
        ? { ...e, progress: 100, status: "completed" }
        : e
      ));
      toast.success(`Bạn đã hoàn thành khóa học "${activeStudyCourse.title}"!`);
      setActiveStudyCourse(null);
      fetchCourses(userProfile.companyCode!);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không thể hoàn thành khóa học."));
    }
  };

  const deleteCourseConfirmed = async (courseId: string) => {
    try {
      const res = await fetch(`/api/v1/crud/training-courses/${courseId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${getAccessToken()}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Xóa khóa học thất bại");
      }

      setCourses(prev => prev.filter(c => c.id !== courseId));
      toast.success("Đã xóa khóa học.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không thể xóa khóa học."));
    }
  };

  const handleDeleteCourse = (courseId: string) => {
    askConfirm(
      "Xóa khóa học này?",
      "Thao tác này không thể hoàn tác.",
      () => deleteCourseConfirmed(courseId),
      "Xóa khóa học"
    );
  };

  const handleAddLessonForm = () => {
    setCourseFormLessons(prev => [
      ...prev,
      { title: "", type: "text", content: "", url: "" }
    ]);
  };

  const handleRemoveLessonForm = (index: number) => {
    setCourseFormLessons(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleLessonFormChange = (index: number, field: keyof Lesson, value: string) => {
    setCourseFormLessons(prev => prev.map((les, idx) => {
      if (idx === index) {
        return { ...les, [field]: value };
      }
      return les;
    }));
  };

  const handleLessonFileUpload = async (index: number, file: File) => {
    if (!file) return;
    setUploadingLessonFileIndex(index);
    try {
      const { url, uploadToken } = await authService.uploadManagedFile(file, "hr.training");
      setCourseFormLessons(prev => prev.map((les, idx) =>
        idx === index ? { ...les, url, fileName: file.name, uploadToken } : les
      ));
      toast.success(`Đã tải lên tài liệu "${file.name}" thành công!`);
    } catch (err: any) {
      toast.error(err?.message || "Tải file tài liệu thất bại.");
    } finally {
      setUploadingLessonFileIndex(null);
    }
  };

  const handleAddQuizForm = () => {
    setCourseFormQuizzes(prev => [
      ...prev,
      { question: "", options: ["", ""], correctOptionIndex: 0 }
    ]);
  };

  const handleRemoveQuizForm = (index: number) => {
    setCourseFormQuizzes(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleQuizQuestionChange = (index: number, question: string) => {
    setCourseFormQuizzes(prev => prev.map((q, idx) => idx === index ? { ...q, question } : q));
  };

  const handleQuizOptionChange = (qIndex: number, optIndex: number, value: string) => {
    setCourseFormQuizzes(prev => prev.map((q, idx) => {
      if (idx === qIndex) {
        const updatedOptions = [...q.options];
        updatedOptions[optIndex] = value;
        return { ...q, options: updatedOptions };
      }
      return q;
    }));
  };

  const handleAddQuizOption = (qIndex: number) => {
    setCourseFormQuizzes(prev => prev.map((q, idx) => {
      if (idx === qIndex) {
        return { ...q, options: [...q.options, ""] };
      }
      return q;
    }));
  };

  const handleRemoveQuizOption = (qIndex: number, optIndex: number) => {
    setCourseFormQuizzes(prev => prev.map((q, idx) => {
      if (idx === qIndex && q.options.length > 2) {
        const updatedOptions = q.options.filter((_, oIdx) => oIdx !== optIndex);
        let updatedCorrectIndex = q.correctOptionIndex;
        if (updatedCorrectIndex >= updatedOptions.length) {
          updatedCorrectIndex = updatedOptions.length - 1;
        }
        return { ...q, options: updatedOptions, correctOptionIndex: updatedCorrectIndex };
      }
      return q;
    }));
  };

  const handleQuizCorrectIndexChange = (qIndex: number, val: number) => {
    setCourseFormQuizzes(prev => prev.map((q, idx) => idx === qIndex ? { ...q, correctOptionIndex: val } : q));
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-3 md:p-5" id="hr_tab_content">
        <div className="space-y-4" id="elearning_catalog">
          {/* Supervisor view controls */}
          <div className="flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-[#E1EAF5] bg-white p-3 shadow-2xs text-left md:px-4">
            <div className="flex flex-wrap items-center gap-2">
              {isSupervisor && (
                <>
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-4 w-4 text-[#0099da]" />
                    <select
                      value={trainingFilter || ""}
                      onChange={(e) => setTrainingFilter(e.target.value || null)}
                      className="rounded-xl border border-[#DCE7F4] bg-white px-3 py-2 text-xs text-slate-800 outline-none cursor-pointer focus:border-[#00ADFC]"
                    >
                      <option value="">Giám sát tiến độ học nhân viên</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      handleCloseModal();
                      setIsAddCourseModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-[#00ADFC] px-4 py-2 text-xs font-medium text-white shadow-xs transition-all hover:bg-[#0097dc] active:scale-95 cursor-pointer font-sans"
                  >
                    <Plus className="h-4 w-4" />
                    Tạo Khóa Học Mới
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Course Catalog list */}
          <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {courses.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-[#DCE7F4] bg-white py-12 text-center text-sm text-slate-600 select-none">
                Chưa có khóa học nào được đăng tải trên học viện.
              </div>
            ) : (
              courses.map((course) => {
                const targetUid = trainingFilter || userProfile?.uid || "";

                const enrollList = trainingFilter ? supervisorEnrollments : enrollments;
                const myEnrollment = enrollList.find(e => e.courseId === course.id && e.uid === targetUid);

                const progress = myEnrollment ? myEnrollment.progress : 0;
                const isCompleted = myEnrollment ? myEnrollment.status === "completed" : false;

                return (
                  <div key={course.id} className="group flex min-w-0 flex-col justify-between rounded-2xl border border-[#DCE7F4] bg-white p-3 shadow-2xs transition-all hover:border-[#8edcff] hover:shadow-md">
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sky-100 bg-[#E8F7FF] text-xl select-none">{displayTrainingIcon(course.icon)}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="max-w-full truncate rounded-md border border-sky-100 bg-[#E8F7FF] px-1.5 py-0.5 text-[10px] text-[#007eb8]">{course.category || "Văn hóa"}</span>
                            {course.isRequired && <span className="shrink-0 rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-700">Bắt buộc</span>}
                          </div>
                          <h4 className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug text-slate-900" title={course.title}>{course.title}</h4>
                        </div>
                      </div>

                      {course.description && <p className="truncate text-xs text-slate-600" title={course.description}>{course.description}</p>}

                      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 rounded-lg border border-[#E1EAF5] bg-[#F8FBFF] px-2 py-1.5 text-[11px] text-slate-700 select-none">
                        <div className="flex min-w-0 items-center gap-1" title={`Thời lượng: ${course.duration}`}><TrainingGlyph name="clock" /><span className="truncate">{course.duration}</span></div>
                        <div className="flex min-w-0 items-center gap-1" title={`Trình bày: ${course.instructor}`}><TrainingGlyph name="instructor" /><span className="truncate">{course.instructor}</span></div>
                        <div className="flex min-w-0 items-center gap-1" title={`Học viên: ${course.enrolledCount || 0}`}><TrainingGlyph name="learners" /><span className="truncate">{course.enrolledCount || 0} học viên</span></div>
                        <div className="flex min-w-0 items-center gap-1" title={`Bài giảng: ${(course.lessons || []).length}`}><TrainingBookIcon className="h-4 w-4 shrink-0" /><span className="truncate">{(course.lessons || []).length} bài</span></div>
                      </div>

                      {/* Course learning progress bar */}
                      {myEnrollment && (
                        <div className="space-y-1 select-none">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-700">Tiến độ học</span>
                            <span className="text-[#007eb8]">{progress}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#DDF7FF]">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#00DFFF] to-[#00ADFC] transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#E1EAF5] pt-2.5">
                      {isSupervisor && course.creatorUid === userProfile?.uid && !trainingFilter ? (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditCourse(course)}
                            className="p-1.5 bg-[#E8F7FF] hover:bg-[#D8F1FF] border border-[#beeaff] text-[#007eb8] rounded-lg hover:scale-105 transition-all cursor-pointer flex items-center justify-center"
                            title="Sửa khóa học"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCourse(course.id)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg hover:scale-105 transition-all cursor-pointer flex items-center justify-center"
                            title="Xóa khóa học"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div />
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={!!trainingFilter}
                          onClick={() => handleEnrollAndStart(course)}
                          className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all shadow-3xs cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${isCompleted
                              ? "bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-emerald-705 text-emerald-700"
                              : "bg-[#00ADFC] hover:bg-[#0097dc] text-white"
                            }`}
                        >
                          {!myEnrollment ? 'Bắt đầu học' : isCompleted ? 'Xem văn bằng' : 'Học tiếp bài sau'}
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })
            )}
          </div>
          {/* Monitor Training Progress Banner */}
          {trainingFilter && (
            <div className="flex flex-col gap-2 rounded-xl border border-[#beeaff] bg-[#E8F7FF] px-3 py-2.5 text-left sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2.5">
                <TrainingProgressIcon className="h-8 w-8 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-[#007eb8]">Tiến trình đào tạo của: {employees.find(e => e.id === trainingFilter)?.name || "Nhân sự"}</p>
                  <p className="text-xs text-slate-700">Các khóa học chuyên môn nhân sự này đã hoàn thành hoặc đang nghiên cứu phục vụ đánh giá thăng cấp và KPI.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTrainingFilter(null)}
                aria-label="Đóng giám sát"
                title="Đóng giám sát"
                className="flex h-8 w-8 shrink-0 self-end items-center justify-center rounded-full bg-rose-500 text-white shadow-xs transition-colors hover:bg-rose-600 cursor-pointer sm:self-auto"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CREATE NEW COURSE MODAL */}
      {isAddCourseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-2xs sm:p-4">
          <form onSubmit={handleCreateCourse} className="training-course-popup relative flex max-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-xl md:p-4">
            <div className="mb-2 flex shrink-0 items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="flex items-center gap-2 text-sm text-slate-900 font-sans">
                <span className="h-4 w-1 rounded-full bg-[#00ADFC]" />
                {editingCourse ? "Cập Nhật Khóa Học" : "Tạo Khóa Học Mới"}
              </h4>
              <button type="button" onClick={handleCloseModal} aria-label="Đóng" className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white transition-colors hover:bg-rose-600 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid min-h-0 grid-cols-1 gap-3 overflow-y-auto pr-1 text-xs lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="grid min-w-0 content-start gap-2.5">
              <div>
                <label className="block font-bold text-gray-500 mb-1 font-sans">Tên khóa học *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Quy chế bảo mật và ISO 27001"
                  value={courseFormTitle}
                  onChange={(e) => setCourseFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-gray-200 text-slate-850 hover:border-gray-300 outline-none focus:border-[#00ADFC] focus:ring-2 focus:ring-[#00ADFC]/20 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-500 mb-1 font-sans">Mô tả tóm tắt</label>
                <textarea
                  placeholder="Mô tả nội dung chính khóa học..."
                  value={courseFormDesc}
                  onChange={(e) => setCourseFormDesc(e.target.value)}
                  className="w-full resize-y rounded-xl border border-gray-200 bg-white p-2.5 text-slate-850 outline-none min-h-[56px] hover:border-gray-300 focus:border-[#00ADFC] focus:ring-2 focus:ring-[#00ADFC]/20"
                />
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="block font-bold text-gray-500 mb-1 font-sans">Danh mục đào tạo</label>
                  <select
                    value={courseFormCategory}
                    onChange={(e) => setCourseFormCategory(e.target.value)}
                    className="w-full p-2 border border-gray-200 bg-white text-slate-850 outline-none rounded-xl cursor-pointer"
                  >
                    <option value="Văn hóa">Văn hóa & Quy chế</option>
                    <option value="Kỹ thuật">Nghiệp vụ kỹ thuật</option>
                    <option value="Kinh doanh">Kỹ năng bán hàng</option>
                    <option value="Công nghệ">Công nghệ & Tooling</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-500 mb-1 font-sans">Thời lượng học</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 2 giờ 30 phút"
                    value={courseFormDuration}
                    onChange={(e) => setCourseFormDuration(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-200 text-slate-850 hover:border-gray-300 outline-none focus:border-[#00ADFC] focus:ring-2 focus:ring-[#00ADFC]/20 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-2 rounded-xl border border-[#E1EAF5] bg-[#F8FBFF] p-2.5 select-none font-sans">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={courseFormIsRequired}
                    onChange={(e) => setCourseFormIsRequired(e.target.checked)}
                    className="rounded text-[#007eb8] focus:ring-[#00ADFC]/20 cursor-pointer"
                  />
                  Khóa học bắt buộc (Tự gán toàn bộ nhân viên)
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={courseFormAutoOnboarding}
                    onChange={(e) => setCourseFormAutoOnboarding(e.target.checked)}
                    className="rounded text-[#007eb8] focus:ring-[#00ADFC]/20 cursor-pointer"
                  />
                  Tự động giao khi có nhân sự mới
                </label>
              </div>
              </div>

              <div className="min-w-0 space-y-2.5">

              {/* Dynamic Lesson Form block */}
              <div className="space-y-2">
                <div className="flex justify-between items-center select-none">
                  <h5 className="font-bold text-xs text-slate-800 uppercase font-sans">Cấu trúc bài giảng ({courseFormLessons.length})</h5>
                  <button
                    type="button"
                    onClick={handleAddLessonForm}
                    className="px-2.5 py-1.5 border border-dashed border-[#9bdfff] hover:bg-[#E8F7FF] text-[#007eb8] font-bold rounded-xl flex items-center gap-1 active:scale-95 transition-all cursor-pointer font-sans"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Thêm bài giảng
                  </button>
                </div>

                <div className="max-h-[min(48dvh,440px)] space-y-2 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/60 p-2">
                  {courseFormLessons.length === 0 ? (
                    <p className="text-[11px] text-gray-400 italic text-center py-2 select-none">Khóa học chưa có bài giảng nào. Vui lòng thêm bài giảng bằng nút phía trên.</p>
                  ) : (
                    courseFormLessons.map((les, index) => (
                      <div key={index} className="relative space-y-2 rounded-xl border border-[#beeaff] bg-white p-3 text-left shadow-2xs">
                        <div className="flex items-center justify-between pr-8 select-none">
                          <span className="text-[10px] font-bold text-[#007eb8] bg-[#E8F7FF] px-2 py-0.5 rounded-md uppercase font-mono">
                            Bài học {index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveLessonForm(index)}
                            className="absolute top-2 right-2 text-slate-400 hover:text-rose-600 transition-colors p-1 hover:bg-slate-50 rounded-lg cursor-pointer"
                            title="Xóa bài học"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">
                            <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1 select-none">Tên bài học *</label>
                            <input
                              type="text"
                              required
                              placeholder="Bài giảng chính..."
                              value={les.title}
                              onChange={(e) => handleLessonFormChange(index, "title", e.target.value)}
                              className="w-full px-3 py-1.5 bg-slate-50 border border-transparent hover:border-slate-200 focus:bg-white focus:border-[#00ADFC] rounded-lg text-xs outline-none transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1 select-none">Loại bài giảng</label>
                            <div className="relative">
                              <TrainingGlyph name={les.type === "video" ? "video" : "document"} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                              <select
                                value={les.type}
                                onChange={(e) => handleLessonFormChange(index, "type", e.target.value)}
                                className="w-full rounded-lg border border-transparent bg-slate-50 py-1.5 pl-9 pr-3 text-xs outline-none transition-all hover:border-slate-200 focus:border-[#00ADFC] focus:bg-white cursor-pointer"
                              >
                                <option value="text">Văn bản / Doc</option>
                                <option value="video">Video</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          {les.type === "video" ? (
                            <div>
                              <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1 select-none">Đường dẫn Video YouTube / Vimeo *</label>
                              <input
                                type="text"
                                required
                                placeholder="http://youtube.com/watch?v=..."
                                value={les.url}
                                onChange={(e) => handleLessonFormChange(index, "url", e.target.value)}
                                className="w-full px-3 py-1.5 bg-slate-50 border border-transparent hover:border-slate-200 focus:bg-white focus:border-[#00ADFC] rounded-lg text-xs outline-none transition-all"
                              />
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {/* File upload for text/document lesson */}
                              <div>
                                <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1 select-none">Tài liệu đính kèm (PDF, Word, PPT...)</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    ref={el => { lessonFileInputsRef.current[index] = el; }}
                                    type="file"
                                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      e.target.value = "";
                                      if (file) handleLessonFileUpload(index, file);
                                    }}
                                  />
                                  <button
                                    type="button"
                                    disabled={uploadingLessonFileIndex === index}
                                    onClick={() => lessonFileInputsRef.current[index]?.click()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E8F7FF] hover:bg-[#D8F1FF] border border-[#beeaff] text-[#007eb8] rounded-lg text-[10px] font-bold cursor-pointer active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {uploadingLessonFileIndex === index ? (
                                      <><RefreshCw className="w-3 h-3 animate-spin" /> Đang tải lên...</>
                                    ) : (
                                      <><Upload className="w-3 h-3" /> Tải file lên</>  
                                    )}
                                  </button>
                                  {les.url && (
                                    <a
                                      href={les.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-[10px] text-emerald-700 font-bold hover:underline truncate max-w-[180px]"
                                      title={les.url}
                                    >
                                      <Paperclip className="w-3 h-3 shrink-0" />
                                      Xem tài liệu
                                    </a>
                                  )}
                                  {les.url && (
                                    <button
                                      type="button"
                                      onClick={() => handleLessonFormChange(index, "url", "")}
                                      className="text-[10px] text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
                                      title="Xóa tài liệu"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              {/* Text content area */}
                              <div>
                                <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1 select-none">Nội dung bài viết (Tùy chọn)</label>
                                <textarea
                                  placeholder="Nhập giáo trình lý thuyết chi tiết..."
                                  value={les.content}
                                  onChange={(e) => handleLessonFormChange(index, "content", e.target.value)}
                                  className="w-full min-h-[48px] resize-y rounded-lg border border-transparent bg-slate-50 p-2 text-xs outline-none transition-all hover:border-slate-200 focus:border-[#00ADFC] focus:bg-white"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Dynamic Quiz Form block */}
              <div className="space-y-2 border-t border-slate-100 pt-2">
                <div className="flex justify-between items-center select-none">
                  <h5 className="font-bold text-xs text-slate-800 uppercase font-sans">Bài Sát hạch Trắc nghiệm ({courseFormQuizzes.length})</h5>
                  <button
                    type="button"
                    onClick={handleAddQuizForm}
                    className="px-2.5 py-1.5 border border-dashed border-emerald-350 hover:bg-emerald-50 text-emerald-705 text-emerald-700 font-bold rounded-xl flex items-center gap-1 active:scale-95 transition-all cursor-pointer font-sans"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Thêm câu trắc nghiệm
                  </button>
                </div>

                <div className="max-h-[min(28dvh,240px)] space-y-2 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/60 p-2">
                  {courseFormQuizzes.length === 0 ? (
                    <p className="text-[11px] text-gray-400 italic text-center py-2 select-none">Khóa học chưa có bộ đề thi sát hạch nào. Không thi sát hạch sau khi học xong.</p>
                  ) : (
                    courseFormQuizzes.map((quiz, qIdx) => (
                      <div key={qIdx} className="relative space-y-2 rounded-xl border border-emerald-200 bg-white p-3 text-left shadow-2xs">
                        <button
                          type="button"
                          onClick={() => handleRemoveQuizForm(qIdx)}
                          className="absolute top-2 right-2 text-slate-400 hover:text-rose-600 transition-colors p-1 hover:bg-slate-50 rounded-lg cursor-pointer"
                          title="Xóa câu hỏi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <div>
                          <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1 select-none">Câu hỏi {qIdx + 1} *</label>
                          <input
                            type="text"
                            required
                            placeholder="Ví dụ: Đâu là định nghĩa đúng về bảo mật thông tin?"
                            value={quiz.question}
                            onChange={(e) => handleQuizQuestionChange(qIdx, e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-transparent hover:border-slate-200 focus:bg-white focus:border-[#00ADFC] rounded-lg text-xs outline-none transition-all font-semibold text-slate-800"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center select-none border-b border-slate-100 pb-1.5">
                            <span className="text-[9px] font-extrabold text-slate-450 uppercase">Đáp án lựa chọn (Tích chọn đáp án đúng):</span>
                            <button
                              type="button"
                              onClick={() => handleAddQuizOption(qIdx)}
                              className="text-[9px] text-[#007eb8] font-bold hover:text-[#006b9d] hover:underline cursor-pointer"
                            >
                              + Thêm đáp án
                            </button>
                          </div>

                          <div className="space-y-2">
                            {quiz.options.map((opt, optIdx) => (
                              <div key={optIdx} className="flex items-center gap-3 group">
                                <input
                                  type="radio"
                                  name={`quiz_${qIdx}_correct`}
                                  checked={quiz.correctOptionIndex === optIdx}
                                  onChange={() => handleQuizCorrectIndexChange(qIdx, optIdx)}
                                  className="text-emerald-500 focus:ring-emerald-500 cursor-pointer w-4 h-4 shrink-0 border-gray-300"
                                  title="Đánh dấu đáp án ĐÚNG"
                                />
                                <input
                                  type="text"
                                  required
                                  placeholder={`Đáp án số ${optIdx + 1}`}
                                  value={opt}
                                  onChange={(e) => handleQuizOptionChange(qIdx, optIdx, e.target.value)}
                                  className="flex-1 px-3 py-1.5 bg-slate-50 border border-transparent hover:border-slate-200 focus:bg-white focus:border-[#00ADFC] rounded-lg text-[11px] outline-none transition-all"
                                />
                                {quiz.options.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveQuizOption(qIdx, optIdx)}
                                    className="text-gray-400 hover:text-rose-600 transition-colors p-1 hover:bg-slate-50 rounded-lg cursor-pointer text-base leading-none"
                                    title="Xóa đáp án này"
                                  >
                                    &times;
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              </div>
            </div>

            <div className="mt-2 flex shrink-0 justify-end gap-2 border-t border-slate-100 pt-2 text-xs">
              <button
                type="button"
                onClick={handleCloseModal}
                className="cursor-pointer rounded-xl bg-rose-500 px-4 py-2 text-white transition-colors hover:bg-rose-600 font-sans"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#00ADFC] px-5 py-2 text-white transition-all hover:bg-[#0097dc] active:scale-95 cursor-pointer font-sans"
              >
                {editingCourse ? "Cập nhật khóa học" : "Đăng tải khóa học"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ACTIVE STUDY PLAYER / E-LEARNING STUDY ROOM */}
      {activeStudyCourse && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <div className="training-study-popup flex h-[min(90dvh,780px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white font-sans shadow-xl">
            {/* Player header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-4 py-3 text-slate-900 md:px-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E8F7FF] text-2xl select-none">{displayTrainingIcon(activeStudyCourse.icon)}</span>
                <div className="text-left">
                  <span className="rounded-md border border-sky-100 bg-[#E8F7FF] px-2 py-0.5 text-[10px] text-[#007eb8]">
                    {activeStudyCourse.category || "Đào tạo"}
                  </span>
                  <h4 className="mt-1 max-w-md truncate text-sm leading-snug text-slate-900">{activeStudyCourse.title}</h4>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveStudyCourse(null)}
                aria-label="Đóng"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white transition-colors hover:bg-rose-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Main view study space */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
              {/* Left sidebar: Course syllabus outline */}
              <div className="flex max-h-48 w-full shrink-0 flex-col justify-between overflow-y-auto border-b border-[#E1EAF5] bg-[#F8FBFF] p-4 md:max-h-none md:w-56 md:border-b-0 md:border-r">
                <div className="space-y-4">
                  <div className="text-left select-none">
                    <span className="block text-sm text-slate-800">Tiến độ hoàn thành</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#DDF7FF] shadow-[0_0_8px_rgba(0,173,252,0.22)]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#00DFFF] to-[#00ADFC] transition-all duration-300"
                          style={{ width: `${enrollments.find(e => e.courseId === activeStudyCourse.id)?.progress ?? 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-[#007eb8]">
                        {enrollments.find(e => e.courseId === activeStudyCourse.id)?.progress ?? 0}%
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 border-t pt-3">
                    <span className="block text-left text-sm text-slate-800 select-none">Danh sách bài học</span>
                    <div className="space-y-1 text-xs">
                      {/* Course Overview / Introduction */}
                      <button
                        onClick={() => {
                          setActiveLessonIndex(-1);
                          setQuizSubmitted(false);
                        }}
                        className={`w-full p-2.5 rounded-xl text-left font-semibold transition-all flex items-center gap-2 cursor-pointer ${activeLessonIndex === -1 ? "bg-[#E8F7FF] text-[#007eb8] text-[#007eb8] shadow-3xs" : "hover:bg-slate-200/50 text-slate-650"
                          }`}
                      >
                        <BookOpen className="w-4 h-4 text-[#00ADFC] shrink-0" />
                        <span>Giới thiệu khóa học</span>
                      </button>

                      {/* Course Lesson Syllabus items */}
                      {(activeStudyCourse.lessons || []).map((les, index) => {
                        const isCompleted = enrollments.find(e => e.courseId === activeStudyCourse.id)?.completedLessons?.includes(`lesson_${index}`);
                        const isActive = activeLessonIndex === index;

                        return (
                          <button
                            key={index}
                            onClick={() => {
                              setActiveLessonIndex(index);
                              setQuizSubmitted(false);
                            }}
                            className={`w-full p-2.5 rounded-xl text-left font-semibold transition-all flex items-center justify-between gap-2 cursor-pointer ${isActive ? "bg-[#E8F7FF] text-[#007eb8] text-[#007eb8] shadow-3xs" : "hover:bg-slate-200/50 text-slate-650"
                              }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {les.type === "video" ? (
                                <Video className="w-4 h-4 text-slate-400 shrink-0" />
                              ) : (
                                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                              <span className="truncate">{index + 1}. {les.title}</span>
                            </div>
                            {isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                          </button>
                        );
                      })}

                      {/* Course Quiz Syllabus item */}
                      {activeStudyCourse.quizzes && activeStudyCourse.quizzes.length > 0 && (() => {
                        const isPassed = enrollments.find(e => e.courseId === activeStudyCourse.id)?.quizPassed;
                        const isLessonsDone = (activeStudyCourse.lessons || []).every((_, idx) =>
                          enrollments.find(e => e.courseId === activeStudyCourse.id)?.completedLessons?.includes(`lesson_${idx}`)
                        );

                        return (
                          <button
                            onClick={() => {
                              if (!isLessonsDone) {
                                toast.warning("Bạn phải hoàn thành tất cả các bài giảng lý thuyết trước khi thi sát hạch!");
                                return;
                              }
                              setActiveLessonIndex((activeStudyCourse.lessons || []).length);
                            }}
                            disabled={!isLessonsDone}
                            className={`w-full p-2.5 rounded-xl text-left font-semibold transition-all flex items-center justify-between gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${activeLessonIndex === (activeStudyCourse.lessons || []).length
                                ? "bg-[#E8F7FF] text-[#007eb8] shadow-3xs border border-[#beeaff]"
                                : "hover:bg-slate-200/50 text-slate-650"
                              }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>Thi sát hạch MCQ</span>
                            </div>
                            {isPassed && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Supervisor fast finish bypass */}
                {isSupervisor && (
                  <div className="border-t pt-3 mt-4 text-[10px] space-y-2 select-none text-left">
                    <span className="block font-bold text-gray-400 uppercase tracking-wider">Đặc quyền Quản lý:</span>
                    <button
                      type="button"
                      onClick={handleCompleteCourseDirectly}
                      className="w-full py-1.5 border border-dashed border-emerald-350 hover:bg-emerald-50 text-emerald-705 text-emerald-700 rounded-lg font-bold transition-all cursor-pointer text-center"
                    >
                      Bỏ qua & Hoàn thành học
                    </button>
                  </div>
                )}
              </div>

              {/* Right panel: Active lesson reader viewport */}
              <div className="flex min-h-0 flex-1 flex-col justify-between overflow-y-auto bg-[#F8FBFF] p-4 md:p-6">
                {/* Section 1: Intro Overview display */}
                {activeLessonIndex === -1 && (
                  <div className="space-y-6 text-left max-w-2xl mx-auto h-full flex flex-col justify-between py-4">
                    <div className="space-y-5">
                      <div className="text-center pb-5 border-b select-none">
                        <span className="mb-2 flex justify-center text-5xl">{displayTrainingIcon(activeStudyCourse.icon, "h-12 w-12")}</span>
                        <h2 className="text-xl font-bold text-slate-800 font-sans leading-tight">{activeStudyCourse.title}</h2>
                        <span className="inline-block text-[10px] font-bold text-gray-400 font-mono uppercase mt-1">Đăng tải bởi: {activeStudyCourse.instructor}</span>
                      </div>

                      <div className="space-y-3">
                        <h5 className="font-bold text-xs text-slate-700 uppercase tracking-wide">1. Giới thiệu tổng quan</h5>
                        <p className="text-xs text-slate-500 leading-relaxed bg-white border border-gray-150 p-4 rounded-2xl shadow-3xs">{activeStudyCourse.description || "Không có nội dung mô tả."}</p>
                      </div>

                      <div className="space-y-2 select-none">
                        <h5 className="font-bold text-xs text-slate-700 uppercase tracking-wide">2. Yêu cầu khóa học</h5>
                        <ul className="text-xs text-slate-650 list-disc list-inside space-y-1 bg-white border border-gray-150 p-4 rounded-2xl shadow-3xs font-medium">
                          <li>Số bài học: <strong className="text-slate-700">{activeStudyCourse.lessons?.length ?? 0} bài học</strong></li>
                          {activeStudyCourse.quizzes && activeStudyCourse.quizzes.length > 0 ? (
                            <li>Yêu cầu: <strong className="text-emerald-700">Thi trắc nghiệm đạt 100% điểm số</strong></li>
                          ) : (
                            <li>Yêu cầu: <strong className="text-slate-700">Đọc hết giáo trình</strong></li>
                          )}
                        </ul>
                      </div>
                    </div>

                    <div className="pt-8 border-t flex justify-end shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (activeStudyCourse.lessons && activeStudyCourse.lessons.length > 0) {
                            setActiveLessonIndex(0);
                          } else if (activeStudyCourse.quizzes && activeStudyCourse.quizzes.length > 0) {
                            setActiveLessonIndex(0);
                          } else {
                            toast.warning("Khóa học chưa có tài liệu giảng dạy!");
                          }
                        }}
                        className="px-6 py-2.5 bg-[#00ADFC] hover:bg-[#0097dc] active:scale-95 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 font-sans"
                      >
                        <Play className="h-4 w-4 fill-white" />
                        Bắt đầu bài giảng đầu tiên
                      </button>
                    </div>
                  </div>
                )}

                {/* Section 2: Active study lesson viewer */}
                {activeLessonIndex >= 0 && activeLessonIndex < (activeStudyCourse.lessons?.length ?? 0) && (() => {
                  const les = activeStudyCourse.lessons?.[activeLessonIndex];
                  if (!les) return null;
                  const isCompleted = enrollments.find(e => e.courseId === activeStudyCourse.id)?.completedLessons?.includes(`lesson_${activeLessonIndex}`);

                  return (
                    <div className="space-y-6 text-left max-w-2xl mx-auto h-full flex flex-col justify-between py-4 w-full">
                      <div className="space-y-5 flex-1 overflow-y-auto pr-1">
                        <div className="pb-4 border-b">
                          <span className="text-xs text-slate-600">Bài giảng {activeLessonIndex + 1} / {activeStudyCourse.lessons?.length}</span>
                          <h3 className="text-lg font-bold text-slate-800 mt-1 font-sans leading-snug">{les.title}</h3>
                        </div>

                        {les.type === "video" ? (
                          <div className="space-y-4">
                            <div className="aspect-video bg-black rounded-2xl overflow-hidden shadow-md border border-slate-350 relative flex items-center justify-center">
                              {/* Youtube standard embed iframe */}
                              {les.url && (les.url.includes("youtube.com") || les.url.includes("youtu.be")) ? (() => {
                                let ytId = "";
                                if (les.url.includes("v=")) {
                                  ytId = les.url.split("v=")[1]?.split("&")[0] || "";
                                } else if (les.url.includes("youtu.be/")) {
                                  ytId = les.url.split("youtu.be/")[1]?.split("?")[0] || "";
                                }
                                return (
                                  <iframe
                                    className="w-full h-full"
                                    src={`https://www.youtube.com/embed/${ytId}`}
                                    title={les.title}
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                  />
                                );
                              })() : (
                                <div className="text-slate-400 p-8 text-center flex flex-col items-center">
                                  <Video className="w-12 h-12 text-slate-600 mb-3" />
                                  <p className="text-xs font-bold font-sans">Bài giảng Video</p>
                                  <a href={les.url} target="_blank" rel="noreferrer" className="mt-2 block break-all text-[10px] text-[#007eb8] underline font-mono">
                                    {les.url}
                                  </a>
                                </div>
                              )}
                            </div>
                            <div className="flex items-start gap-2 rounded-2xl border border-gray-150 bg-white p-4 text-xs leading-relaxed text-slate-600 shadow-3xs">
                              <TrainingGlyph name="tip" />
                              <span>Lớp học video: Nhấp vào nút chạy Video phía trên và hoàn thành theo thời lượng video trước khi nhấp "Hoàn thành bài học" bên dưới.</span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Document attachment preview */}
                            {les.url && (
                              <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-gray-100 select-none">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 font-sans">
                                      <FileText className="w-3.5 h-3.5" /> Xem tài liệu bài giảng
                                    </span>
                                    <a
                                      href={`/api/v1/media/download?url=${encodeURIComponent(les.url)}&filename=${encodeURIComponent(les.fileName || les.title || "tai-lieu-bai-giang")}&token=${encodeURIComponent(localStorage.getItem("accessToken") || "")}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[10px] font-bold text-[#007eb8] hover:text-[#006b9d] hover:underline flex items-center gap-1 font-sans"
                                    >
                                      <ExternalLink className="w-3 h-3" /> Tải về tài liệu
                                    </a>
                                  </div>
                                  <div className="relative w-full" style={{ height: "550px" }}>
                                    {(() => {
                                      const url = les.url || "";
                                      const token = localStorage.getItem("accessToken") || "";
                                      const previewSrc = `/api/v1/media/preview?url=${encodeURIComponent(url)}&token=${encodeURIComponent(token)}`;
                                      const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
                                      const isPdf = ext === "pdf" || url.includes(".pdf");
                                      const isOffice = ["doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(ext);
                                      if (isPdf) {
                                        return (
                                          <iframe
                                            src={previewSrc}
                                            className="w-full h-full border-0"
                                            title={les.title}
                                          />
                                        );
                                      }
                                      if (isOffice) {
                                        return (
                                          <iframe
                                            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
                                            className="w-full h-full border-0"
                                            title={les.title}
                                          />
                                        );
                                      }
                                      return (
                                        <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
                                          <FileText className="w-12 h-12 opacity-30" />
                                          <p className="text-xs font-medium">Không thể hiển thị trước định dạng này.</p>
                                          <a
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-4 py-2 bg-[#E8F7FF] hover:bg-[#D8F1FF] border border-[#beeaff] text-[#007eb8] rounded-xl text-xs font-bold transition-all"
                                          >
                                            Mở tài liệu trong tab mới
                                          </a>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                            )}
                            {/* Text content */}
                            {les.content && (
                              <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs leading-relaxed text-xs text-slate-700 whitespace-pre-wrap font-sans">
                                {les.content}
                              </div>
                            )}
                            {!les.url && !les.content && (
                              <div className="bg-slate-50 border border-dashed border-slate-200 p-8 rounded-2xl text-center text-xs text-slate-400">
                                Bài giảng này chưa có nội dung hoặc tài liệu đính kèm.
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="pt-6 border-t flex justify-between items-center shrink-0 select-none">
                        <button
                          type="button"
                          onClick={() => setActiveLessonIndex(prev => prev - 1)}
                          className="px-4 py-2 border border-gray-200 hover:bg-slate-100 text-slate-650 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          ← Bài trước
                        </button>

                        <button
                          type="button"
                          onClick={() => handleMarkLessonComplete(les, activeLessonIndex)}
                          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer active:scale-95 flex items-center gap-1.5 font-sans ${isCompleted
                              ? "bg-slate-100 border border-gray-200 text-slate-450 hover:bg-slate-200"
                              : "bg-[#00ADFC] hover:bg-[#0097dc] text-white"
                            }`}
                        >
                          <CheckCircle className="h-4 w-4" />
                          {activeLessonIndex === (activeStudyCourse.lessons?.length ?? 0) - 1 ? "Hoàn thành" : "Hoàn thành bài & Tiếp tục →"}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Section 3: Quiz test room */}
                {activeLessonIndex === (activeStudyCourse.lessons?.length ?? 0) && activeStudyCourse.quizzes && activeStudyCourse.quizzes.length > 0 && (() => {
                  const quizzes = activeStudyCourse.quizzes || [];
                  const isPassed = enrollments.find(e => e.courseId === activeStudyCourse.id)?.quizPassed;

                  return (
                    <div className="space-y-6 text-left max-w-2xl mx-auto h-full flex flex-col justify-between py-4 w-full">
                      <div className="space-y-5 flex-1 overflow-y-auto pr-1">
                        <div className="pb-4 border-b select-none">
                          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest font-mono flex items-center gap-1">
                            <HelpCircle className="w-3.5 h-3.5" />
                            Đánh giá sát hạch trắc nghiệm
                          </span>
                          <h3 className="text-lg font-bold text-slate-800 mt-1 font-sans leading-snug">Bài thi cuối khóa: {activeStudyCourse.title}</h3>
                          <p className="text-[10px] text-gray-400 mt-1">Trả lời đúng 100% số câu hỏi ({quizzes.length} câu) để được cấp chứng nhận và tokens.</p>
                        </div>

                        {/* Quiz form listing */}
                        <div className="space-y-5">
                          {quizzes.map((q, idx) => {
                            const isError = quizSubmitted && quizErrors[idx];

                            return (
                              <div
                                key={idx}
                                className={`p-5 rounded-2xl border transition-all ${isError ? "bg-rose-50/50 border-rose-200 shadow-rose-50" : "bg-white border-gray-150 shadow-3xs"
                                  }`}
                              >
                                <h4 className="font-bold text-xs text-slate-800 leading-snug flex gap-2">
                                  <span className="font-mono text-[#007eb8] shrink-0">Q{idx + 1}:</span>
                                  {q.question}
                                </h4>

                                <div className="mt-4 space-y-2.5 text-xs">
                                  {q.options.map((opt, oIdx) => {
                                    const isSelected = quizAnswers[idx] === oIdx;

                                    return (
                                      <label
                                        key={oIdx}
                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all ${isSelected
                                            ? "bg-[#E8F7FF] border-[#9bdfff] ring-2 ring-[#00ADFC]/10 text-[#006b9d] font-semibold"
                                            : "hover:bg-slate-50 border-gray-150 text-slate-650 font-medium"
                                          }`}
                                      >
                                        <input
                                          type="radio"
                                          name={`test_q_${idx}`}
                                          checked={isSelected}
                                          disabled={isQuizEvaluating || isPassed}
                                          onChange={() => {
                                            setQuizAnswers(prev => {
                                              const next = [...prev];
                                              next[idx] = oIdx;
                                              return next;
                                            });
                                            // Xóa lỗi khi người dùng sửa
                                            if (quizSubmitted) {
                                              setQuizErrors(prev => {
                                                const next = [...prev];
                                                next[idx] = false;
                                                return next;
                                              });
                                            }
                                          }}
                                          className="text-[#007eb8] focus:ring-[#00ADFC]/20 cursor-pointer w-4.5 h-4.5 shrink-0"
                                        />
                                        <span>{opt}</span>
                                      </label>
                                    );
                                  })}
                                </div>

                                {isError && (
                                  <div className="mt-3 text-[10px] text-rose-650 font-bold flex items-center gap-1 font-sans">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Câu trả lời chưa chính xác. Vui lòng chọn lại.
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-6 border-t flex justify-between items-center shrink-0 select-none">
                        <button
                          type="button"
                          onClick={() => {
                            if (activeStudyCourse.lessons && activeStudyCourse.lessons.length > 0) {
                              setActiveLessonIndex(activeStudyCourse.lessons.length - 1);
                            }
                          }}
                          className="px-4 py-2 border border-gray-200 hover:bg-slate-100 text-slate-655 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          ← Quay lại bài giảng
                        </button>

                        {!isPassed ? (
                          <button
                            type="button"
                            onClick={handleSubmitQuiz}
                            disabled={isQuizEvaluating}
                            className="px-6 py-2.5 bg-[#00ADFC] hover:bg-[#0097dc] text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 font-sans"
                          >
                            {isQuizEvaluating ? (
                              <>
                                <RefreshCw className="animate-spin w-4 h-4" />
                                Đang đánh giá...
                              </>
                            ) : (
                              "Nộp bài thi & Đánh giá →"
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleFinishCourse}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer font-sans"
                          >
                            Hoàn thành
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom confirm dialog */}
      {confirmState && (
        <ConfirmDialog
          appearance="erp"
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          showCancel={false}
          onClose={() => setConfirmState(null)}
          onConfirm={confirmState.onConfirm}
        />
      )}
    </>
  );
}
