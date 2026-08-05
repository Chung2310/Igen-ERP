import React, { useState, useEffect, useRef } from "react";
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  Plus,
  Play,
  CheckCircle,
  HelpCircle,
  FileText,
  Activity,
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

interface TrainingTabProps {
  userProfile: any;
  selectedCompanyCode: string;
  isManager: boolean;
  courses: TrainingCourse[];
  setCourses: React.Dispatch<React.SetStateAction<TrainingCourse[]>>;
  fetchCourses: (compCode: string) => Promise<void>;
  employees: EmployeeNode[];
}

const isUrl = (str?: string): boolean => {
  if (!str) return false;
  return str.startsWith("http://") || str.startsWith("https://") || str.startsWith("data:image/") || str.startsWith("/");
};

const renderAvatar = (avatar: string, sizeClasses: string = "w-8 h-8", textClass: string = "text-base") => {
  if (isUrl(avatar)) {
    return (
      <div className={`${sizeClasses} rounded-full overflow-hidden shrink-0 flex items-center justify-center border border-gray-150`}>
        <img src={avatar} className="w-full h-full object-cover" alt="Avatar nhân sự" />
      </div>
    );
  }
  return (
    <div className={`${sizeClasses} bg-slate-50 rounded-full shrink-0 flex items-center justify-center border border-gray-100 select-none`}>
      <span className={textClass}>{avatar || "👤"}</span>
    </div>
  );
};

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
    cancelLabel?: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const askConfirm = (
    title: string,
    description: string,
    onConfirm: () => void | Promise<void>,
    confirmLabel = "Xác nhận",
    cancelLabel = "Hủy"
  ) => {
    setConfirmState({
      isOpen: true,
      title,
      description,
      confirmLabel,
      cancelLabel,
      onConfirm: async () => {
        await onConfirm();
        setConfirmState(null);
      },
    });
  };
  const [courseFormTitle, setCourseFormTitle] = useState("");
  const [courseFormDesc, setCourseFormDesc] = useState("");
  const [courseFormCategory, setCourseFormCategory] = useState("Văn hóa");
  const [courseFormInstructor, setCourseFormInstructor] = useState("");
  const [courseFormDuration, setCourseFormDuration] = useState("");
  const [courseFormIcon, setCourseFormIcon] = useState("📚");
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

  const fetchMyEnrollments = async (uid: string, companyCode: string) => {
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
      fetchMyEnrollments(userProfile.uid, selectedCompanyCode);
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
          await fetchMyEnrollments(userProfile.uid, companyCode);
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
        icon: "📚",
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
        await fetchMyEnrollments(userProfile.uid, companyCode);
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
          toast.success(`🎉 Chúc mừng! Bạn đã hoàn thành khóa học "${activeStudyCourse.title}"!`);
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
        toast.success("🎉 Xuất sắc! Bạn đã trả lời đúng tất cả các câu hỏi trắc nghiệm!");
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
    toast.success(`🎉 Chúc mừng! Bạn đã hoàn thành khóa học "${activeStudyCourse.title}"!`);
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
      toast.success(`🎉 Bạn đã hoàn thành khóa học "${activeStudyCourse.title}"!`);
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
      "Bạn có chắc chắn muốn xóa khóa học này? Thao tác này không thể hoàn tác.",
      () => deleteCourseConfirmed(courseId),
      "Xóa khóa học",
      "Hủy"
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
      const url = await authService.uploadFile(file);
      setCourseFormLessons(prev => prev.map((les, idx) =>
        idx === index ? { ...les, url } : les
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
      <div className="flex-1 p-6 overflow-y-auto" id="hr_tab_content">
        <div className="space-y-6" id="elearning_catalog">
          {/* Monitor Training Progress Banner */}
          {trainingFilter && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-850 p-5 rounded-2xl mb-6 relative text-left">
              <h5 className="font-bold text-xs uppercase tracking-wider text-emerald-900 flex items-center gap-1.5 mb-2">
                <Award className="h-4.5 w-4.5 text-emerald-700 animate-bounce" />
                Tiến trình Đào tạo của: {employees.find(e => e.id === trainingFilter)?.name || "Nhân sự"}
              </h5>
              <p className="text-xs text-emerald-700 mb-4">Các khóa học chuyên môn nhân sự này đã hoàn thành hoặc đang nghiên cứu phục vụ đánh giá thăng cấp và KPI.</p>
              <div className="mt-4 pt-4 border-t border-emerald-150 flex justify-end items-center text-xs">
                <button
                  onClick={() => setTrainingFilter(null)}
                  className="px-3 py-1 bg-white hover:bg-slate-100 border border-emerald-200 rounded-xl text-emerald-750 font-bold transition-all shadow-xs cursor-pointer text-xs"
                >
                  Đóng giám sát
                </button>
              </div>
            </div>
          )}

          {/* Supervisor view controls */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-white p-6 rounded-3xl border border-gray-200 shadow-2xs text-left">
            <div>
              <h3 className="font-bold text-lg text-slate-800 font-sans">Học Viện & Đào Tạo iGen</h3>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {isSupervisor && (
                <>
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-4 w-4 text-gray-400" />
                    <select
                      value={trainingFilter || ""}
                      onChange={(e) => setTrainingFilter(e.target.value || null)}
                      className="border border-gray-200 p-1.5 rounded-xl text-xs bg-white outline-none cursor-pointer"
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
                    className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95 cursor-pointer font-sans"
                  >
                    <Plus className="h-4 w-4" />
                    Tạo Khóa Học Mới
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Course Catalog list */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            {courses.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-450 italic select-none">
                📚 Chưa có khóa học nào được đăng tải trên học viện.
              </div>
            ) : (
              courses.map((course) => {
                const targetUid = trainingFilter || userProfile?.uid || "";

                const enrollList = trainingFilter ? supervisorEnrollments : enrollments;
                const myEnrollment = enrollList.find(e => e.courseId === course.id && e.uid === targetUid);

                const progress = myEnrollment ? myEnrollment.progress : 0;
                const isCompleted = myEnrollment ? myEnrollment.status === "completed" : false;

                return (
                  <div key={course.id} className="bg-white border border-gray-200 rounded-3xl p-6 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between relative group">
                    {course.isRequired && (
                      <span className="absolute top-4 right-4 px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 font-mono text-[9px] font-bold rounded-md uppercase select-none">
                        Bắt buộc
                      </span>
                    )}

                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl bg-slate-50 w-12 h-12 rounded-2xl border flex items-center justify-center select-none shadow-3xs">{course.icon || "📚"}</span>
                        <div>
                          <span className="text-[10px] font-bold text-indigo-650 uppercase tracking-wider font-mono bg-indigo-50/70 border border-indigo-100/50 px-2 py-0.5 rounded-md">{course.category || "Văn hóa"}</span>
                          <h4 className="font-bold text-slate-800 text-sm mt-1 leading-snug line-clamp-1">{course.title}</h4>
                        </div>
                      </div>

                      <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed min-h-[54px]">{course.description || "Không có mô tả chi tiết khóa đào tạo."}</p>

                      <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-650 bg-slate-50 p-3 rounded-2xl select-none font-medium border border-gray-150">
                        <div>⏱️ Thời lượng: <strong className="text-slate-800">{course.duration}</strong></div>
                        <div>👨‍🏫 Trình bày: <strong className="text-slate-800">{course.instructor}</strong></div>
                        <div>👥 Học viên: <strong className="text-indigo-650 font-bold">{course.enrolledCount || 0}</strong></div>
                        <div>📖 Bài giảng: <strong className="text-slate-800">{(course.lessons || []).length} bài</strong></div>
                      </div>

                      {/* Course learning progress bar */}
                      {myEnrollment && (
                        <div className="space-y-1 pt-1 select-none">
                          <div className="flex justify-between text-[9px] font-bold">
                            <span className="text-gray-400">TIẾN ĐỘ HỌC:</span>
                            <span className={isCompleted ? "text-emerald-600" : "text-indigo-600"}>{progress}% {isCompleted ? "(Đã xong)" : ""}</span>
                          </div>
                          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden border">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${isCompleted ? "bg-emerald-500" : "bg-indigo-600"}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-5 mt-5 border-t border-gray-100 flex justify-between items-center gap-3">
                      {isSupervisor && course.creatorUid === userProfile?.uid && !trainingFilter ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditCourse(course)}
                            className="p-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl hover:scale-105 transition-all cursor-pointer flex items-center justify-center"
                            title="Sửa khóa học"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCourse(course.id)}
                            className="p-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl hover:scale-105 transition-all cursor-pointer flex items-center justify-center"
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
                          className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-3xs cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${isCompleted
                              ? "bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-emerald-705 text-emerald-700"
                              : "bg-indigo-650 hover:bg-indigo-700 text-white"
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
        </div>
      </div>

      {/* CREATE NEW COURSE MODAL */}
      {isAddCourseModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCreateCourse} className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-lg p-6 relative text-left space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-gray-150">
              <h4 className="font-bold text-slate-800 text-sm font-sans uppercase flex items-center gap-2">
                <Award className="h-4 w-4 text-indigo-655" />
                {editingCourse ? "Cập Nhật Khóa Học" : "Tạo Khóa Học Mới"}
              </h4>
              <button type="button" onClick={handleCloseModal} className="text-gray-400 hover:text-slate-800 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-500 mb-1.5 font-sans">Tên khóa học *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Quy chế bảo mật và ISO 27001"
                  value={courseFormTitle}
                  onChange={(e) => setCourseFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-gray-200 text-slate-850 hover:border-gray-300 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-500 mb-1.5 font-sans">Mô tả tóm tắt</label>
                <textarea
                  placeholder="Mô tả nội dung chính khóa học..."
                  value={courseFormDesc}
                  onChange={(e) => setCourseFormDesc(e.target.value)}
                  className="w-full p-3 bg-white border border-gray-200 text-slate-850 hover:border-gray-300 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 rounded-xl min-h-[60px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-500 mb-1.5 font-sans">Danh mục đào tạo</label>
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
                  <label className="block font-bold text-gray-500 mb-1.5 font-sans">Thời lượng học (ước lượng)</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 2 giờ 30 phút"
                    value={courseFormDuration}
                    onChange={(e) => setCourseFormDuration(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-200 text-slate-850 hover:border-gray-300 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex gap-4 p-3 bg-slate-50 border border-gray-200 rounded-2xl select-none font-sans font-semibold">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={courseFormIsRequired}
                    onChange={(e) => setCourseFormIsRequired(e.target.checked)}
                    className="rounded text-indigo-650 focus:ring-indigo-500 cursor-pointer"
                  />
                  Khóa học bắt buộc (Tự gán toàn bộ nhân viên)
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={courseFormAutoOnboarding}
                    onChange={(e) => setCourseFormAutoOnboarding(e.target.checked)}
                    className="rounded text-indigo-650 focus:ring-indigo-500 cursor-pointer"
                  />
                  Tự động giao khi có nhân sự mới
                </label>
              </div>

              {/* Dynamic Lesson Form block */}
              <div className="space-y-3 pt-3 border-t">
                <div className="flex justify-between items-center select-none">
                  <h5 className="font-bold text-xs text-slate-800 uppercase font-sans">Cấu trúc bài giảng ({courseFormLessons.length})</h5>
                  <button
                    type="button"
                    onClick={handleAddLessonForm}
                    className="px-2.5 py-1.5 border border-dashed border-indigo-350 hover:bg-indigo-50 text-indigo-700 font-bold rounded-xl flex items-center gap-1 active:scale-95 transition-all cursor-pointer font-sans"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Thêm bài giảng
                  </button>
                </div>

                <div className="space-y-3.5 max-h-[320px] overflow-y-auto p-4 rounded-2xl bg-slate-50/60 border border-slate-100 pr-2">
                  {courseFormLessons.length === 0 ? (
                    <p className="text-[11px] text-gray-400 italic text-center py-2 select-none">Khóa học chưa có bài giảng nào. Vui lòng thêm bài giảng bằng nút phía trên.</p>
                  ) : (
                    courseFormLessons.map((les, index) => (
                      <div key={index} className="bg-white border-l-4 border-l-indigo-500 rounded-xl p-4.5 space-y-3 shadow-2xs relative text-left">
                        <div className="flex items-center justify-between pr-8 select-none">
                          <span className="text-[10px] font-bold text-indigo-650 bg-indigo-50 px-2 py-0.5 rounded-md uppercase font-mono">
                            Bài học {index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveLessonForm(index)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-rose-600 transition-colors p-1 hover:bg-slate-50 rounded-lg cursor-pointer"
                            title="Xóa bài học"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-2">
                            <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1 select-none">Tên bài học *</label>
                            <input
                              type="text"
                              required
                              placeholder="Bài giảng chính..."
                              value={les.title}
                              onChange={(e) => handleLessonFormChange(index, "title", e.target.value)}
                              className="w-full px-3 py-1.5 bg-slate-50 border border-transparent hover:border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg text-xs outline-none transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1 select-none">Loại bài giảng</label>
                            <select
                              value={les.type}
                              onChange={(e) => handleLessonFormChange(index, "type", e.target.value)}
                              className="w-full px-3 py-1.5 bg-slate-50 border border-transparent hover:border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg text-xs outline-none cursor-pointer transition-all"
                            >
                              <option value="text">📄 Văn bản / Doc</option>
                              <option value="video">🎥 Video</option>
                            </select>
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
                                className="w-full px-3 py-1.5 bg-slate-50 border border-transparent hover:border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg text-xs outline-none transition-all"
                              />
                            </div>
                          ) : (
                            <div className="space-y-2">
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
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg text-[10px] font-bold cursor-pointer active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                                  className="w-full p-3 bg-slate-50 border border-transparent hover:border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg text-xs outline-none min-h-[60px] transition-all resize-y"
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
              <div className="space-y-3 pt-3 border-t">
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

                <div className="space-y-3.5 max-h-[320px] overflow-y-auto p-4 rounded-2xl bg-slate-50/60 border border-slate-100 pr-2">
                  {courseFormQuizzes.length === 0 ? (
                    <p className="text-[11px] text-gray-400 italic text-center py-2 select-none">Khóa học chưa có bộ đề thi sát hạch nào. Không thi sát hạch sau khi học xong.</p>
                  ) : (
                    courseFormQuizzes.map((quiz, qIdx) => (
                      <div key={qIdx} className="bg-white border-l-4 border-l-emerald-500 rounded-xl p-4.5 space-y-3.5 shadow-2xs relative text-left">
                        <button
                          type="button"
                          onClick={() => handleRemoveQuizForm(qIdx)}
                          className="absolute top-4 right-4 text-slate-400 hover:text-rose-600 transition-colors p-1 hover:bg-slate-50 rounded-lg cursor-pointer"
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
                            className="w-full px-3 py-1.5 bg-slate-50 border border-transparent hover:border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg text-xs outline-none transition-all font-semibold text-slate-800"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center select-none border-b border-slate-100 pb-1.5">
                            <span className="text-[9px] font-extrabold text-slate-450 uppercase">Đáp án lựa chọn (Tích chọn đáp án đúng):</span>
                            <button
                              type="button"
                              onClick={() => handleAddQuizOption(qIdx)}
                              className="text-[9px] text-indigo-650 font-bold hover:text-indigo-800 hover:underline cursor-pointer"
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
                                  className="flex-1 px-3 py-1.5 bg-slate-50 border border-transparent hover:border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg text-[11px] outline-none transition-all"
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

            <div className="pt-4 border-t flex justify-end gap-3 text-xs font-bold shrink-0">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 border rounded-xl hover:bg-slate-50 cursor-pointer font-sans"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl cursor-pointer transition-all active:scale-95 font-sans"
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
          <div className="bg-white border border-gray-200 rounded-3xl shadow-2xl w-full max-w-4xl h-[90vh] overflow-hidden flex flex-col font-sans">
            {/* Player header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-2xl select-none">{activeStudyCourse.icon || "📚"}</span>
                <div className="text-left">
                  <span className="text-[9px] font-bold text-indigo-400 font-mono uppercase tracking-wider bg-indigo-950 border border-indigo-900 px-2 py-0.5 rounded-md">
                    {activeStudyCourse.category || "Đào tạo"}
                  </span>
                  <h4 className="font-bold text-sm text-slate-100 truncate max-w-md mt-1 leading-snug">{activeStudyCourse.title}</h4>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveStudyCourse(null)}
                className="text-slate-400 hover:text-white cursor-pointer transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Main view study space */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left sidebar: Course syllabus outline */}
              <div className="w-64 bg-slate-50 border-r border-gray-200 overflow-y-auto p-4 shrink-0 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="text-left select-none">
                    <span className="block text-[8px] font-extrabold text-gray-400 uppercase tracking-widest font-mono">TIẾN ĐỘ HOÀN THÀNH:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-gray-250 h-2 rounded-full overflow-hidden border">
                        <div
                          className="bg-indigo-650 h-full rounded-full transition-all duration-300"
                          style={{ width: `${enrollments.find(e => e.courseId === activeStudyCourse.id)?.progress ?? 0}%` }}
                        />
                      </div>
                      <span className="text-xs font-extrabold font-mono text-indigo-850">
                        {enrollments.find(e => e.courseId === activeStudyCourse.id)?.progress ?? 0}%
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 border-t pt-3">
                    <span className="block text-[9px] font-bold text-gray-400 uppercase select-none tracking-wider text-left font-mono">DANH SÁCH BÀI HỌC:</span>
                    <div className="space-y-1 text-xs">
                      {/* Course Overview / Introduction */}
                      <button
                        onClick={() => {
                          setActiveLessonIndex(-1);
                          setQuizSubmitted(false);
                        }}
                        className={`w-full p-2.5 rounded-xl text-left font-semibold transition-all flex items-center gap-2 cursor-pointer ${activeLessonIndex === -1 ? "bg-indigo-50 text-indigo-705 text-indigo-700 shadow-3xs" : "hover:bg-slate-200/50 text-slate-650"
                          }`}
                      >
                        <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
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
                            className={`w-full p-2.5 rounded-xl text-left font-semibold transition-all flex items-center justify-between gap-2 cursor-pointer ${isActive ? "bg-indigo-50 text-indigo-705 text-indigo-700 shadow-3xs" : "hover:bg-slate-200/50 text-slate-650"
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
                                ? "bg-indigo-50 text-indigo-750 shadow-3xs border border-indigo-200"
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
              <div className="flex-1 overflow-y-auto p-8 bg-slate-50 flex flex-col justify-between">
                {/* Section 1: Intro Overview display */}
                {activeLessonIndex === -1 && (
                  <div className="space-y-6 text-left max-w-2xl mx-auto h-full flex flex-col justify-between py-4">
                    <div className="space-y-5">
                      <div className="text-center pb-5 border-b select-none">
                        <span className="text-5xl block mb-2">{activeStudyCourse.icon || "📚"}</span>
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
                        className="px-6 py-2.5 bg-indigo-650 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 font-sans"
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
                          <span className="text-[10px] font-bold text-gray-450 uppercase tracking-widest font-mono">BÀI GIẢNG {activeLessonIndex + 1} / {activeStudyCourse.lessons?.length}</span>
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
                                  <a href={les.url} target="_blank" rel="noreferrer" className="text-indigo-400 underline text-[10px] mt-2 block break-all font-mono">
                                    {les.url}
                                  </a>
                                </div>
                              )}
                            </div>
                            <div className="p-4 bg-white border border-gray-150 rounded-2xl shadow-3xs text-xs text-slate-500 leading-relaxed font-semibold">
                              💡 Lớp học video: Nhấp vào nút chạy Video phía trên và hoàn thành theo thời lượng video trước khi nhấp "Hoàn thành bài học" bên dưới.
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
                                      href={les.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 font-sans"
                                    >
                                      <ExternalLink className="w-3 h-3" /> Tải về tài liệu
                                    </a>
                                  </div>
                                  <div className="relative w-full" style={{ height: "550px" }}>
                                    <iframe
                                      src={`https://docs.google.com/gview?url=${encodeURIComponent(les.url)}&embedded=true`}
                                      className="w-full h-full border-0"
                                      title={les.title}
                                    />
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
                              : "bg-indigo-650 hover:bg-indigo-700 text-white"
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
                                  <span className="font-mono text-indigo-650 shrink-0">Q{idx + 1}:</span>
                                  {q.question}
                                </h4>

                                <div className="mt-4 space-y-2.5 text-xs">
                                  {q.options.map((opt, oIdx) => {
                                    const isSelected = quizAnswers[idx] === oIdx;

                                    return (
                                      <label
                                        key={oIdx}
                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all ${isSelected
                                            ? "bg-indigo-50/60 border-indigo-300 ring-2 ring-indigo-500/10 text-indigo-850 font-semibold"
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
                                          className="text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4.5 h-4.5 shrink-0"
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
                            className="px-6 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 font-sans"
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
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          onClose={() => setConfirmState(null)}
          onConfirm={confirmState.onConfirm}
        />
      )}
    </>
  );
}
