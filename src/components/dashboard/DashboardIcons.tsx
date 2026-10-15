import React from "react";

type IconProps = { className?: string };
type IconName =
  | "LayoutDashboard" | "TrendingUp" | "TrendingDown" | "Wallet" | "UserPlus" | "BookOpen"
  | "Receipt" | "CheckCircle2" | "Users" | "Banknote" | "CalendarCheck"
  | "Clock" | "UserX" | "TimerReset" | "Search" | "RotateCcw"
  | "AlertTriangle" | "ClipboardList" | "PackageCheck" | "BarChart3"
  | "PieChart" | "Calendar" | "Loader2";

const art: Record<IconName, React.ReactNode> = {
  LayoutDashboard: <><rect x="2.5" y="2.5" width="8" height="8" rx="2" fill="#C8EFFF" /><rect x="13.5" y="2.5" width="8" height="5" rx="2" fill="#BBE9FF" /><rect x="13.5" y="10.5" width="8" height="11" rx="2" fill="#D9F7FF" /><rect x="2.5" y="13.5" width="8" height="8" rx="2" fill="#D7EEFF" /></>,
  TrendingUp: <><path d="M3 17.5h18" stroke="#B8DFF2" /><path d="m3.5 15 5.5-5 4 3.5L20.5 6" /><path d="M16 6h4.5v4.5" /><circle cx="9" cy="10" r="1.4" fill="#71D5FF" stroke="none" /><circle cx="13" cy="13.5" r="1.4" fill="#9EEBE5" stroke="none" /></>,
  TrendingDown: <><path d="M3 6.5h18" stroke="#FFD6DC" /><path d="m3.5 9 5.5 5 4-3.5 7.5 7.5" /><path d="M16 18h4.5v-4.5" /><circle cx="9" cy="14" r="1.4" fill="#FFB7C4" stroke="none" /><circle cx="13" cy="10.5" r="1.4" fill="#FFD7AA" stroke="none" /></>,
  Wallet: <><rect x="3" y="5" width="18" height="15" rx="3" fill="#D8F4FF" /><path d="M3.5 8V6a2 2 0 0 1 2-2H18" /><path d="M14 11h7v5h-7a2.5 2.5 0 0 1 0-5Z" fill="#9BDEFB" /><circle cx="15" cy="13.5" r=".7" fill="#fff" stroke="none" /></>,
  UserPlus: <><circle cx="9" cy="7.5" r="3.5" fill="#BCEAFF" /><path d="M2.5 20c0-4 2.4-6.5 6.5-6.5 2.2 0 4 .7 5 2.1" fill="#E1F7FF" /><path d="M18 14v7m-3.5-3.5h7" stroke="#16A7E7" /></>,
  BookOpen: <><path d="M12 5C9 3.2 6 3 2.5 4.5v15c3.5-1.5 6.5-1.2 9.5.5 3-1.7 6-2 9.5-.5v-15C18 3 15 3.2 12 5Z" fill="#DCF2FF" /><path d="M12 5v15M5 8h4m-4 3h4m6-3h4m-4 3h4" /></>,
  Receipt: <><path d="M5 2.5h14v19l-2.5-1.6-2.5 1.6-2-1.6-2 1.6-2.5-1.6L5 21.5v-19Z" fill="#DEF5FF" /><path d="M8 7h8M8 11h8M8 15h5" /><circle cx="16.5" cy="15.5" r="1.8" fill="#FFCD85" stroke="none" /></>,
  CheckCircle2: <><circle cx="12" cy="12" r="9" fill="#D9F8F0" /><path d="m7.5 12 3 3 6-6" stroke="#11AFA0" /></>,
  Users: <><circle cx="8.5" cy="8" r="3" fill="#BBEAFF" /><circle cx="17" cy="9" r="2.5" fill="#E3D8FF" /><path d="M2.5 20c0-4 2-6.5 6-6.5s6 2.5 6 6.5M15 14c3.7-.4 6.5 1.8 6.5 6" fill="#E2F7FF" /></>,
  Banknote: <><rect x="2.5" y="5" width="19" height="14" rx="2.5" fill="#D7F3FF" /><circle cx="12" cy="12" r="3.5" fill="#A8E5F9" /><path d="M5.5 8h2m9 8h2M12 9.5v5m-1.5-3.5h3" /></>,
  CalendarCheck: <><rect x="3" y="5" width="18" height="16" rx="2.5" fill="#DDF6FF" /><path d="M3 10h18M7.5 3v4m9-4v4m-9 9 2.5 2.5L17 13" stroke="#0D9DCA" /></>,
  Clock: <><circle cx="12" cy="12" r="9" fill="#FFF0DA" /><path d="M12 6.5V12l4 2.5" stroke="#B77A20" /></>,
  UserX: <><circle cx="9" cy="7.5" r="3.5" fill="#FFE2E7" /><path d="M2.5 20c0-4 2.3-6.5 6.5-6.5 2.3 0 4 .8 5 2.2" fill="#FFF0F2" /><path d="m16 15 5 5m0-5-5 5" stroke="#DF5A77" /></>,
  TimerReset: <><circle cx="12" cy="13" r="8" fill="#FFEFD9" /><path d="M12 9v4.5l-2.5 2M9 2.5h6m-3 0v2M5 4.5 3.5 6M19 4.5 20.5 6" stroke="#C87821" /></>,
  Search: <><circle cx="10.5" cy="10.5" r="6.5" fill="#E4F6FF" /><path d="m15.5 15.5 5 5" /></>,
  RotateCcw: <><path d="M4 8V3.5M4 8h4.5M4.5 8A8.5 8.5 0 1 1 3.5 15" /><path d="M13 7v5l3 2" stroke="#69CCE9" /></>,
  AlertTriangle: <><path d="m12 3 10 17H2L12 3Z" fill="#FFE6D8" stroke="#D96C54" /><path d="M12 9v5m0 3h.01" stroke="#D96C54" /></>,
  ClipboardList: <><rect x="4" y="4.5" width="16" height="17" rx="2.5" fill="#E0F4FF" /><rect x="8" y="2.5" width="8" height="4" rx="1.5" fill="#A5E1FF" /><path d="M8 11h8M8 15h8M8 19h5" /></>,
  PackageCheck: <><path d="m3 7.5 9-4.5 9 4.5v9L12 21l-9-4.5v-9Z" fill="#DDF6FF" /><path d="m3 7.5 9 4.5 9-4.5M12 12v9m2-14-8.5 4.2" /><path d="m16 15 1.5 1.5 3-3" stroke="#13A88C" /></>,
  BarChart3: <><path d="M3 20.5h18" /><rect x="4" y="11" width="4" height="9" rx="1" fill="#BCEBFF" /><rect x="10" y="7" width="4" height="13" rx="1" fill="#80D6FA" /><rect x="16" y="3" width="4" height="17" rx="1" fill="#4DBFF0" /></>,
  PieChart: <><path d="M11 3a9 9 0 1 0 10 10H11V3Z" fill="#D6F1FF" /><path d="M14 3.2A9 9 0 0 1 20.8 10H14V3.2Z" fill="#75D1FA" /></>,
  Calendar: <><rect x="3" y="5" width="18" height="16" rx="2.5" fill="#E2F5FF" /><path d="M3 10h18M8 3v4m8-4v4M7 14h3m4 0h3m-10 4h3" /></>,
  Loader2: <><circle cx="12" cy="12" r="8" fill="none" stroke="#D9F2FF" /><path d="M12 4a8 8 0 0 1 8 8" stroke="#00ADFC" strokeWidth="2.5" /></>,
};

function DashboardIcon({ name, className }: IconProps & { name: IconName }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{art[name]}</svg>;
}

const icon = (name: IconName) => ({ className }: IconProps) => <DashboardIcon name={name} className={className} />;

export const LayoutDashboard = icon("LayoutDashboard");
export const TrendingUp = icon("TrendingUp");
export const TrendingDown = icon("TrendingDown");
export const Wallet = icon("Wallet");
export const UserPlus = icon("UserPlus");
export const BookOpen = icon("BookOpen");
export const Receipt = icon("Receipt");
export const CheckCircle2 = icon("CheckCircle2");
export const Users = icon("Users");
export const Banknote = icon("Banknote");
export const CalendarCheck = icon("CalendarCheck");
export const Clock = icon("Clock");
export const UserX = icon("UserX");
export const TimerReset = icon("TimerReset");
export const Search = icon("Search");
export const RotateCcw = icon("RotateCcw");
export const AlertTriangle = icon("AlertTriangle");
export const ClipboardList = icon("ClipboardList");
export const PackageCheck = icon("PackageCheck");
export const BarChart3 = icon("BarChart3");
export const PieChart = icon("PieChart");
export const Calendar = icon("Calendar");
export const Loader2 = icon("Loader2");
