import React, { useState } from "react";
import { 
  Building2, 
  UserSquare, 
  Briefcase, 
  MapPin, 
  Phone, 
  Mail, 
  Plus, 
  UserPlus, 
  BookOpen, 
  Search,
  CheckCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Award
} from "lucide-react";
import { HRSubTabType, EmployeeNode, HRTask, TrainingCourse } from "../types";

export default function HRTab() {
  const [subTab, setSubTab] = useState<HRSubTabType>("SƠ ĐỒ TỔ CHỨC");

  // 1. Employees Data for Interactive Org Chart
  const employees: EmployeeNode[] = [
    { id: "e1", name: "Phạm Minh Hoàng", role: "Chief Executive Officer (CEO)", department: "Ban Giám Đốc", email: "hoang.pm@igen.vn", phone: "0901234567", avatar: "👨‍💼", level: 1 },
    
    { id: "e2", name: "Nguyễn Lê Hải", role: "Chief Operations Officer (COO)", department: "Ban Giám Đốc", email: "hai.nl@igen.vn", phone: "0901112223", avatar: "👨‍💻", level: 2, parentId: "e1" },
    { id: "e3", name: "Trần Mai Anh", role: "Chief CMO", department: "Ban Giám Đốc", email: "anh.tm@igen.vn", phone: "0903334445", avatar: "👩‍💼", level: 2, parentId: "e1" },
    
    { id: "e4", name: "Hoàng Gia Huy", role: "Trưởng phòng Kho vận", department: "Phòng Kho Vận", email: "huy.hg@igen.vn", phone: "0905556667", avatar: "📦", level: 3, parentId: "e2" },
    { id: "e5", name: "Lưu Quốc Tuấn", role: "Trưởng phòng Marketing", department: "Phòng Marketing", email: "tuan.lq@igen.vn", phone: "0907778889", avatar: "📣", level: 3, parentId: "e3" },
    { id: "e6", name: "Nguyễn Bích Vy", role: "Trưởng phòng Sales CRM", department: "Phòng Sales", email: "vy.nb@igen.vn", phone: "0908889990", avatar: "👩‍💻", level: 3, parentId: "e2" },

    { id: "e7", name: "Lê Ngọc Sang", role: "Chuyên viên Vận chuyển", department: "Phòng Kho Vận", email: "sang.ln@igen.vn", phone: "0909990001", avatar: "🚛", level: 4, parentId: "e4" },
    { id: "e8", name: "Phan Đình Nam", role: "AI Copywriter Specialist", department: "Phòng Marketing", email: "nam.pd@igen.vn", phone: "0909990002", avatar: "💡", level: 4, parentId: "e5" },
    { id: "e9", name: "Vũ Thùy Linh", role: "Chăm sóc khách hàng VIP", department: "Phòng Sales", email: "linh.vt@igen.vn", phone: "0909990003", avatar: "👩‍⚕️", level: 4, parentId: "e6" }
  ];

  const [selectedEmp, setSelectedEmp] = useState<EmployeeNode | null>(employees[0]);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // 2. HR Tasks Data for Recruitment & Onboarding Kanban
  const [tasks, setTasks] = useState<HRTask[]>([
    { id: "t1", title: "Phỏng vấn ứng viên Sales Supervisor", assignee: "Vũ Thùy Linh", assigneeAvatar: "👩‍⚕️", dueDate: "Ngày mai, 14:00", priority: "Cao", status: "todo", category: "Tuyển dụng" },
    { id: "t2", title: "Thiết lập tài khoản ERP cho nhân sự Kho mới", assignee: "Hoàng Gia Huy", assigneeAvatar: "📦", dueDate: "15/10/2026", priority: "Trung bình", status: "doing", category: "Onboarding" },
    { id: "t3", title: "Hoàn thành video Đào tạo Bảo mật hệ thống", assignee: "Trần Mai Anh", assigneeAvatar: "👩‍💼", dueDate: "18/10/2026", priority: "Thấp", status: "doing", category: "Đào tạo" },
    { id: "t4", title: "Soạn thảo tài liệu Quy tắc Văn hóa Ứng xử", assignee: "Phạm Minh Hoàng", assigneeAvatar: "👨‍💼", dueDate: "Đã xong", priority: "Cao", status: "done", category: "Văn hóa" },
  ]);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState<"Onboarding" | "Đào tạo" | "Tuyển dụng" | "Văn hóa">("Onboarding");
  const [newTaskPriority, setNewTaskPriority] = useState<"Cao" | "Trung bình" | "Thấp">("Trung bình");

  // Add a task to Kanban board
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskTitle.trim() === "") return;
    const newTask: HRTask = {
      id: "t_" + Date.now(),
      title: newTaskTitle,
      assignee: "Chưa phân công",
      assigneeAvatar: "🤔",
      dueDate: "Chưa cập nhật",
      priority: newTaskPriority,
      status: "todo",
      category: newTaskCategory
    };
    setTasks([...tasks, newTask]);
    setNewTaskTitle("");
  };

  // Move a task progress status
  const moveTaskStatus = (id: string, newStatus: "todo" | "doing" | "done") => {
    setTasks(tasks.map(t => t.id === id ? { ...t, status: newStatus } : t));
  };

  // Delete a task task
  const deleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  // 3. Onboarding Video Training Courses List Catalog
  const [courses, setCourses] = useState<TrainingCourse[]>([
    { id: "c1", title: "Hội nhập Văn hóa doanh nghiệp iGen", category: "Văn hóa", duration: "1.5 giờ (5 bài học)", progress: 100, instructor: "Phạm Minh Hoàng", icon: "🏫", enrolledStudents: 15 },
    { id: "c2", title: "Làm chủ AI Copywriter & Ideas Engine", category: "Công cụ AI", duration: "2 giờ (6 bài học)", progress: 45, instructor: "Phan Đình Nam", icon: "🧠", enrolledStudents: 8 },
    { id: "c3", title: "Quy trình Vận hành phân khu Kho ERP", category: "Nghiệp vụ", duration: "1 tiếng (4 bài học)", progress: 0, instructor: "Hoàng Gia Huy", icon: "📦", enrolledStudents: 12 },
    { id: "c4", title: "Kỹ năng Chăm sóc khách hàng VIP & Giải quyết than phiền", category: "Sales CRM", duration: "3 giờ (8 bài học)", progress: 85, instructor: "Trần Mai Anh", icon: "🏅", enrolledStudents: 22 }
  ]);

  const handleStudyProgress = (courseId: string) => {
    setCourses(courses.map(course => {
      if (course.id === courseId) {
        const nextProgress = Math.min(course.progress + 15, 100);
        return { ...course, progress: nextProgress };
      }
      return course;
    }));
  };

  return (
    <div className="flex flex-col h-full bg-white max-h-[85vh] overflow-hidden" id="hr_tab_wrapper">
      {/* Sub Tabs switcher navigation bar */}
      <div className="border-b border-gray-200 bg-gray-50/50 p-2 text-xs flex justify-between shrink-0" id="hr_sub_tabs_bar">
        <div className="flex gap-2">
          {["SƠ ĐỒ TỔ CHỨC", "GIAO VIỆC KANBAN", "ĐÀO TẠO"].map((tab) => (
            <button
              key={tab}
              onClick={() => setSubTab(tab as HRSubTabType)}
              className={`px-4 py-2 bg-white rounded-lg border font-bold uppercase transition-all tracking-wide ${
                subTab === tab 
                  ? "bg-slate-800 text-white border-slate-800 shadow-xs" 
                  : "text-gray-500 border-gray-200 hover:bg-gray-100"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-200 text-emerald-800 font-mono text-[10px]">
          <ActivityIndicator />
          <span>Lưu tự động vào iGen ERP</span>
        </div>
      </div>

      {/* Primary Sub Tab Layout View */}
      <div className="flex-1 p-6 overflow-y-auto" id="hr_tab_content">
        
        {/* SUB TAB 1: SƠ ĐỒ TỔ CHỨC */}
        {subTab === "SƠ ĐỒ TỔ CHỨC" && (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-full" id="org_chart_block">
            {/* Sidebar View employee card detail panel */}
            <div className="xl:col-span-1 bg-gray-55/40 p-5 rounded-2xl border border-gray-100 max-h-[70vh] overflow-y-auto flex flex-col justify-between" id="employee_detail_card">
              {selectedEmp ? (
                <div>
                  <div className="text-center">
                    <div className="text-5xl my-4 inline-block p-4 bg-white rounded-full shadow-md select-none border border-gray-100">
                      {selectedEmp.avatar}
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 font-sans">{selectedEmp.name}</h3>
                    <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider mt-1">{selectedEmp.role}</p>
                    <span className="inline-block mt-3 px-3 py-1 bg-slate-100 rounded-full text-[10px] text-gray-600 font-mono">
                      Phòng: {selectedEmp.department}
                    </span>
                  </div>

                  <div className="mt-8 space-y-4 text-xs text-gray-600 border-t border-gray-150 pt-5">
                    <div className="flex items-center gap-2.5">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="font-mono">{selectedEmp.email}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="font-mono">{selectedEmp.phone}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <UserSquare className="h-4 w-4 text-gray-400" />
                      <span>Cấp quản lý: <strong className="text-gray-800">Cấp {selectedEmp.level}</strong></span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400">
                  Click chọn nhân sự trên sơ đồ để xem thông tin liên hệ chi tiết.
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-gray-150 flex flex-col gap-2">
                <button className="w-full text-center py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95">
                  <UserPlus className="h-4 w-4" />
                  Thêm thành viên mới
                </button>
              </div>
            </div>

            {/* Hierarchical Org Index tree container */}
            <div className="xl:col-span-3 bg-gray-50 border border-gray-200/60 rounded-3xl relative overflow-hidden flex flex-col justify-between" id="org_chart_interactive_canvas">
              {/* Zoom Controls Overlay */}
              <div className="absolute top-4 right-4 bg-white/90 shadow-lg border border-gray-100 rounded-lg p-1.5 flex items-center gap-1 text-[11px] font-mono z-10 select-none">
                <button 
                  onClick={() => setZoomLevel(Math.max(0.7, zoomLevel - 0.15))}
                  className="px-2 py-0.5 bg-gray-100 hover:bg-gray-250 hover:bg-gray-150 text-slate-700 font-bold rounded-sm text-xs transition-colors"
                >
                  -
                </button>
                <span className="px-1 text-slate-500 text-xxs shrink-0 font-semibold">Tỷ lệ: {Math.round(zoomLevel * 100)}%</span>
                <button 
                  onClick={() => setZoomLevel(Math.min(1.3, zoomLevel + 0.15))}
                  className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-250 hover:bg-gray-150 text-slate-700 font-bold rounded-sm text-xs transition-colors"
                >
                  +
                </button>
              </div>

              {/* Hierarchy Tree Grid Canvas */}
              <div className="p-8 flex-1 flex flex-col justify-center items-center overflow-auto" style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center", transition: "transform 0.2s ease-out" }}>
                
                {/* Level 1: CEO */}
                <div className="flex justify-center mb-10 w-full relative">
                  {employees.filter(e => e.level === 1).map((emp) => (
                    <div 
                      key={emp.id}
                      onClick={() => setSelectedEmp(emp)}
                      className={`p-4 bg-slate-900 text-white rounded-2xl shadow-xl w-64 text-center cursor-pointer relative hover:scale-105 active:scale-95 transition-all ${
                        selectedEmp?.id === emp.id ? "ring-4 ring-blue-500 shadow-blue-500/10" : ""
                      }`}
                    >
                      <div className="text-3xl mb-1">{emp.avatar}</div>
                      <h4 className="font-bold text-sm tracking-tight">{emp.name}</h4>
                      <p className="text-[10px] text-blue-400 font-medium font-mono leading-normal mt-1 uppercase">{emp.role}</p>
                    </div>
                  ))}
                  {/* Vertical linking line */}
                  <div className="absolute bottom-[-40px] left-1/2 -translate-x-1/2 w-0.5 h-10 bg-slate-300" />
                </div>

                {/* Level 2: Directors */}
                <div className="flex justify-center gap-16 mb-12 w-full relative">
                  {/* Connecting Horizontal Line bar */}
                  <div className="absolute top-0 left-[23%] right-[23%] h-0.5 bg-slate-300" />
                  
                  {employees.filter(e => e.level === 2).map((emp) => (
                    <div className="relative flex flex-col items-center" key={emp.id}>
                      {/* Short helper vertical line above */}
                      <div className="w-0.5 h-6 bg-slate-300 mb-0.5" />
                      
                      <div 
                        onClick={() => setSelectedEmp(emp)}
                        className={`p-3.5 bg-white text-gray-800 border border-gray-200 rounded-xl shadow-md w-48 text-center cursor-pointer hover:scale-105 active:scale-95 transition-all ${
                          selectedEmp?.id === emp.id ? "ring-3 ring-blue-500" : ""
                        }`}
                      >
                        <div className="text-2xl mb-1 text-slate-100 inline-block p-1 bg-blue-50 rounded-full">{emp.avatar}</div>
                        <h4 className="font-bold text-xs leading-tight text-slate-800">{emp.name}</h4>
                        <p className="text-[9px] text-emerald-600 font-semibold font-mono mt-0.5 uppercase leading-none">{emp.role}</p>
                      </div>

                      {/* Line below directed to managers */}
                      <div className="w-0.5 h-12 bg-slate-300" />
                    </div>
                  ))}
                </div>

                {/* Level 3: Department Managers */}
                <div className="flex justify-center gap-8 w-full relative">
                  {/* Outer connecting horizontal line */}
                  <div className="absolute top-0 left-[12%] right-[12%] h-0.5 bg-slate-300" />
                  
                  {employees.filter(e => e.level === 3).map((emp) => (
                    <div className="relative flex flex-col items-center" key={emp.id}>
                      {/* Segment pointing from parent */}
                      <div className="w-0.5 h-4 bg-slate-300 mb-0.5" />
                      
                      <div 
                        onClick={() => setSelectedEmp(emp)}
                        className={`p-3 bg-white text-gray-800 border border-gray-200 rounded-xl shadow-xs w-44 text-center cursor-pointer hover:scale-105 active:scale-95 transition-all ${
                          selectedEmp?.id === emp.id ? "ring-3 ring-blue-500" : ""
                        }`}
                      >
                        <div className="text-xl mb-1 text-slate-100 inline-block p-1 bg-slate-50 border rounded-lg">{emp.avatar}</div>
                        <h4 className="font-bold text-xs text-slate-800 truncate">{emp.name}</h4>
                        <p className="text-[9px] text-slate-500 font-mono mt-0.5 select-none">{emp.role}</p>
                      </div>

                      {/* Short segment pointing to staff */}
                      <div className="w-0.5 h-6 bg-slate-300" />
                      <div className="text-[10px] text-gray-400 font-mono flex items-center gap-0.5 select-none hover:text-blue-500 cursor-pointer">
                        <span>Nhân sự cấp dưới</span>
                        <ChevronRight className="h-3 w-3 rotate-90" />
                      </div>
                    </div>
                  ))}
                </div>

              </div>

              {/* Chart footer notification guide */}
              <div className="p-3 bg-gray-50 border-t border-gray-200 select-none text-center text-xs text-gray-400 font-medium">
                🖱️ Zoom bằng thanh công cụ góc trên • Click nhân sự để truy lục thông tin liên hệ trong iGen ERP
              </div>
            </div>
          </div>
        )}

        {/* SUB TAB 2: GIAO VIỆC KANBAN */}
        {subTab === "GIAO VIỆC KANBAN" && (
          <div className="space-y-6" id="job_delegation_kanban">
            
            {/* Quick Task creation panel */}
            <form onSubmit={handleAddTask} className="bg-slate-50 border border-gray-200 p-5 rounded-2xl flex flex-wrap gap-4 items-end" id="add_task_form">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Công việc mới</label>
                <input 
                  type="text" 
                  placeholder="Ví dụ: Hoàn tất giấy tờ tuyển dụng thử việc..." 
                  className="w-full px-4 py-2 border border-gray-200 bg-white rounded-lg text-xs font-sans focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 font-sans">Bắc Phận</label>
                <select 
                  className="px-3 py-2 border border-gray-200 bg-white rounded-lg text-xs font-mono"
                  value={newTaskCategory}
                  onChange={(e: any) => setNewTaskCategory(e.target.value)}
                >
                  <option value="Onboarding">Onboarding</option>
                  <option value="Đào tạo">Đào tạo</option>
                  <option value="Tuyển dụng">Tuyển dụng</option>
                  <option value="Văn hóa">Văn hóa</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 font-sans">Độ ưu tiên</label>
                <select 
                  className="px-3 py-2 border border-gray-200 bg-white rounded-lg text-xs font-mono"
                  value={newTaskPriority}
                  onChange={(e: any) => setNewTaskPriority(e.target.value)}
                >
                  <option value="Cao">Cao</option>
                  <option value="Trung bình">Trung bình</option>
                  <option value="Thấp">Thấp</option>
                </select>
              </div>

              <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 select-none shadow-sm transition-all focus:outline-hidden">
                <Plus className="h-4 w-4" />
                Thêm Công Việc
              </button>
            </form>

            {/* Kanban columns flex board */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="three_column_kanban">
              
              {/* TO DO (CẦN LÀM) */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-150/60 flex flex-col min-h-[450px]">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200/50">
                  <span className="text-xs font-bold text-slate-700 tracking-wider font-sans uppercase">CHỜ THỰC HIỆN</span>
                  <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {tasks.filter(t => t.status === "todo").length}
                  </span>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {tasks.filter(t => t.status === "todo").length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs italic">Hết công việc chờ!</div>
                  ) : (
                    tasks.filter(t => t.status === "todo").map(task => (
                      <KanbanCard 
                        key={task.id} 
                        task={task} 
                        onMove={(newSt) => moveTaskStatus(task.id, newSt)} 
                        onDelete={() => deleteTask(task.id)}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* DOING (ĐANG LÀM) */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-150/60 flex flex-col min-h-[450px]">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200/50">
                  <span className="text-xs font-bold text-amber-700 tracking-wider font-sans uppercase">ĐANG THỰC HIỆN</span>
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {tasks.filter(t => t.status === "doing").length}
                  </span>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {tasks.filter(t => t.status === "doing").length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs italic">Kéo thả hoặc click tiến độ để bắt đầu</div>
                  ) : (
                    tasks.filter(t => t.status === "doing").map(task => (
                      <KanbanCard 
                        key={task.id} 
                        task={task} 
                        onMove={(newSt) => moveTaskStatus(task.id, newSt)} 
                        onDelete={() => deleteTask(task.id)}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* DONE (ĐÃ XONG) */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-150/60 flex flex-col min-h-[450px]">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200/50">
                  <span className="text-xs font-bold text-emerald-800 tracking-wider font-sans uppercase font-medium">ĐÃ HOÀN THÀNH</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {tasks.filter(t => t.status === "done").length}
                  </span>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {tasks.filter(t => t.status === "done").length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs italic">Chưa có công việc nào hoàn tất</div>
                  ) : (
                    tasks.filter(t => t.status === "done").map(task => (
                      <KanbanCard 
                        key={task.id} 
                        task={task} 
                        onMove={(newSt) => moveTaskStatus(task.id, newSt)} 
                        onDelete={() => deleteTask(task.id)}
                      />
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* SUB TAB 3: ĐÀO TẠO */}
        {subTab === "ĐÀO TẠO" && (
          <div className="space-y-6" id="elearning_catalog">
            <div className="flex justify-between items-center" id="training_header_info">
              <div>
                <h4 className="text-sm font-bold text-slate-800 font-sans tracking-wide uppercase">Cổng Học Tập & Hội Nhập iGen e-Learning</h4>
                <p className="text-xs text-gray-500 mt-1">Đào tạo nhân sự tự động, rèn luyện kỹ năng và nắm bắt hệ thống ERP</p>
              </div>
              <div className="flex gap-2 text-xs font-semibold px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg">
                <Award className="h-4 w-4 animate-bounce" />
                <span>Hoàn tất khóa học nhận ERP Token</span>
              </div>
            </div>

            {/* Courses grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="courses_grid">
              {courses.map((course) => {
                const isCompleted = course.progress === 100;
                return (
                  <div key={course.id} className="p-5 bg-white border border-gray-200 hover:border-blue-300 hover:shadow-md rounded-2xl transition-all flex flex-col justify-between" id={`course_card_${course.id}`}>
                    <div>
                      <div className="flex justify-between items-start gap-4">
                        <div className="p-3 bg-gray-50 border rounded-xl my-1 text-2xl select-none">{course.icon}</div>
                        <div className="text-right">
                          <span className="inline-block px-2.5 py-0.5 bg-slate-100 text-[9px] font-bold font-mono rounded-full text-slate-500 uppercase tracking-widest leading-none">
                            {course.category}
                          </span>
                          <p className="text-[10px] text-gray-400 mt-1.5 font-mono">Giảng viên: {course.instructor}</p>
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-slate-800 font-sans text-left mt-4 leading-snug">{course.title}</h4>
                      
                      <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-2">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>{course.duration}</span>
                        <span className="mx-1">•</span>
                        <span>{course.enrolledStudents} học viên đang học</span>
                      </div>
                    </div>

                    {/* Progreession Bar section */}
                    <div className="mt-5 border-t border-gray-100 pt-4">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-mono text-gray-400">Tiến trình lớp học:</span>
                        <span className="font-bold text-gray-700 font-mono">{course.progress}%</span>
                      </div>
                      
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mb-4">
                        <div 
                          className={`h-full transition-all duration-500 ${isCompleted ? "bg-green-500" : "bg-blue-600"}`}
                          style={{ width: `${course.progress}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        {isCompleted ? (
                          <span className="text-green-600 font-bold flex items-center gap-1.5">
                            <CheckCircle className="h-4.5 w-4.5" />
                            Đã tốt nghiệp
                          </span>
                        ) : (
                          <span className="text-gray-400 font-mono text-[10px]">ERP Token: 15 đ</span>
                        )}

                        <button 
                          onClick={() => handleStudyProgress(course.id)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            isCompleted 
                              ? "bg-gray-100 text-gray-500 cursor-not-allowed" 
                              : "bg-blue-600 hover:bg-blue-700 text-white active:scale-95"
                          }`}
                          disabled={isCompleted}
                        >
                          {course.progress === 0 ? "Bắt đầu học" : isCompleted ? "Xem văn bằng" : "Học tiếp bài sau"}
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// Kanban drag helper subcard
function KanbanCard({ task, onMove, onDelete }: { key?: any; task: HRTask; onMove: (status: "todo" | "doing" | "done") => void; onDelete: () => void }) {
  return (
    <div className="bg-white border text-left border-gray-200/70 p-4 rounded-xl shadow-xs hover:shadow-md transition-all flex flex-col gap-3 relative group" id={`kanban_card_${task.id}`}>
      
      {/* Category and priority indicator tags */}
      <div className="flex justify-between items-center">
        <span className="px-2 py-0.5 bg-gray-50 border border-gray-100 rounded-sm text-[9px] font-mono font-bold text-gray-500 tracking-wider">
          {task.category}
        </span>
        <span className={`px-2 py-0.5 rounded-sm text-[9px] font-mono font-bold font-semibold uppercase ${
          task.priority === "Cao" 
            ? "bg-red-50 text-red-700" 
            : task.priority === "Trung bình" 
              ? "bg-amber-50 text-amber-700" 
              : "bg-blue-50 text-blue-700"
        }`}>
          ƯU TIÊN: {task.priority}
        </span>
      </div>

      <h5 className="font-semibold text-gray-800 leading-normal text-xs font-sans line-clamp-2">{task.title}</h5>

      <div className="flex items-center justify-between border-t border-gray-100 pt-2.5 text-[10px]">
        {/* Assignee profile avatar */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm select-none">{task.assigneeAvatar}</span>
          <span className="text-gray-500 font-medium">{task.assignee}</span>
        </div>

        {/* Due date */}
        <span className="text-gray-400 font-mono">Hạn: {task.dueDate}</span>
      </div>

      {/* Interactive transition buttons */}
      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between opacity-80 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={onDelete}
          className="text-red-500 hover:text-red-700 text-[10px] font-bold font-mono transition-colors"
        >
          Xóa bỏ
        </button>
        <div className="flex gap-2">
          {task.status !== "todo" && (
            <button 
              onClick={() => onMove(task.status === "done" ? "doing" : "todo")}
              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-slate-700 rounded-md text-[9px] font-bold"
            >
              ← Quay lại
            </button>
          )}
          {task.status !== "done" && (
            <button 
              onClick={() => onMove(task.status === "todo" ? "doing" : "done")}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[9px] font-bold"
            >
              Tiếp tục →
            </button>
          )}
        </div>
      </div>

    </div>
  );
}

// Activity indicator pulsing circle icon
function ActivityIndicator() {
  return (
    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse mr-1" />
  );
}
