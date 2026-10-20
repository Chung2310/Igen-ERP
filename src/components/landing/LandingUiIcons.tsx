import React from "react";

type IconName =
  | "ArrowRight" | "CheckCircle2" | "MessageSquare" | "ShoppingBag" | "Users"
  | "ShieldCheck" | "Globe" | "Database" | "Lock" | "ChevronRight" | "Menu"
  | "X" | "ChevronDown" | "MapPin" | "ExternalLink" | "Bot" | "Check"
  | "CalendarCheck" | "Boxes" | "CreditCard" | "FileSpreadsheet" | "Sparkles"
  | "Zap" | "GraduationCap" | "BookOpen" | "BriefcaseBusiness" | "ShoppingCart"
  | "Landmark" | "Wrench" | "ContactRound" | "Layers" | "Phone";

function Icon({ name, className }: { name: IconName; className?: string }) {
  const body: Record<IconName, React.ReactNode> = {
    ArrowRight: <><path d="M4 12h15m-6-6 6 6-6 6" /></>,
    ChevronRight: <path d="m9 5 7 7-7 7" />,
    ChevronDown: <path d="m5 9 7 7 7-7" />,
    Menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    X: <path d="M5 5 19 19M19 5 5 19" />,
    Check: <path d="m4 12 5 5L20 6" />,
    CheckCircle2: <><circle cx="12" cy="12" r="9" fill="#DCF8EE" stroke="#18A981" /><path d="m7 12 3 3 7-7" /></>,
    MessageSquare: <><path d="M4 5h16v12H9l-5 3V5Z" fill="#D6F4FF" /><path d="M8 9h8M8 13h5" /></>,
    ShoppingBag: <><path d="M5 8h14l-1 12H6L5 8Z" fill="#DDF6FF" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
    Users: <><circle cx="9" cy="8" r="3" fill="#E5DAFF" /><circle cx="17" cy="9" r="2.5" fill="#BDEDF8" /><path d="M3 20c0-4 2-6 6-6s6 2 6 6m0-5c4 0 6 2 6 5" /></>,
    ShieldCheck: <><path d="m12 2 8 4v6c0 5-3 8-8 10-5-2-8-5-8-10V6l8-4Z" fill="#DDF8EB" /><path d="m8 12 3 3 5-6" /></>,
    Globe: <><circle cx="12" cy="12" r="9" fill="#DBF3FF" /><path d="M3 12h18M12 3c-5 5-5 13 0 18m0-18c5 5 5 13 0 18" /></>,
    Database: <><ellipse cx="12" cy="5" rx="8" ry="3" fill="#D9F2FF" /><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0" /></>,
    Lock: <><rect x="5" y="10" width="14" height="11" rx="2" fill="#E9E0FF" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>,
    MapPin: <><path d="M12 22S5 15 5 10a7 7 0 1 1 14 0c0 5-7 12-7 12Z" fill="#FFE5D5" /><circle cx="12" cy="10" r="2.5" fill="white" /></>,
    ExternalLink: <><path d="M12 4H5v15h15v-7M12 12l8-8m-6 0h6v6" /></>,
    Bot: <><rect x="3" y="7" width="18" height="13" rx="4" fill="#E8DFFF" /><path d="M12 7V4m-5 8h.1m10 0h.1M9 16c2 1 4 1 6 0" /></>,
    Phone: <path d="M5 3h4l1.2 4.2-2.1 1.7a15 15 0 0 0 7 7l1.7-2.1L21 15v4a2 2 0 0 1-2 2C10.2 21 3 13.8 3 5a2 2 0 0 1 2-2Z" fill="#DDF6FF" />,
    CalendarCheck: <><rect x="3" y="5" width="18" height="16" rx="2" fill="#DFF7FF" /><path d="M3 10h18M8 3v4m8-4v4m-9 8 3 3 6-6" /></>,
    Boxes: <><path d="m4 7 6-3 6 3-6 3-6-3Zm0 0v7l6 3v-7m6-3v7l-6 3m1 2 5-3 5 2-5 3-5-2Z" fill="#D9F2FF" /></>,
    CreditCard: <><rect x="2" y="5" width="20" height="14" rx="3" fill="#DCF5FF" /><path d="M2 10h20M6 15h5" /></>,
    FileSpreadsheet: <><path d="M5 2h10l4 4v16H5V2Z" fill="#E0F8EF" /><path d="M15 2v5h4M8 11h8M8 15h8M11 11v8" /></>,
    Sparkles: <><path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2Z" fill="#FFE2A8" /><path d="m18 2 1 2 2 1-2 1-1 2" /></>,
    Zap: <path d="M13 2 4 13h7l-1 9 10-12h-7V2Z" fill="#FFE6A2" />,
    GraduationCap: <><path d="m2 9 10-5 10 5-10 5L2 9Z" fill="#FFE5B9" /><path d="M6 12v5c3 3 9 3 12 0v-5m4-3v8" /></>,
    BookOpen: <><path d="M2 5c4-2 7-1 10 1 3-2 6-3 10-1v15c-4-2-7-1-10 1-3-2-6-3-10-1V5Z" fill="#E6EBFF" /><path d="M12 6v15" /></>,
    BriefcaseBusiness: <><rect x="2" y="7" width="20" height="14" rx="2" fill="#E1EDFF" /><path d="M8 7V4h8v3M2 13h20m-12 0v3h4v-3" /></>,
    ShoppingCart: <><path d="M2 4h3l3 12h12l2-8H6" fill="#DDF9E9" /><circle cx="9" cy="20" r="1.5" /><circle cx="19" cy="20" r="1.5" /></>,
    Landmark: <><path d="m2 9 10-6 10 6H2Zm2 11h16M6 10v9m6-9v9m6-9v9" fill="#E5EAFF" /></>,
    Wrench: <><path d="M14 4a6 6 0 0 0-7 7L2 17l5 5 6-5a6 6 0 0 0 7-7l-4 3-4-4 2-5Z" fill="#DDF5F8" /></>,
    ContactRound: <><rect x="3" y="3" width="18" height="18" rx="4" fill="#FFF0D7" /><circle cx="12" cy="9" r="3" /><path d="M6 19c0-4 2-6 6-6s6 2 6 6" /></>,
    Layers: <><path d="m2 8 10-5 10 5-10 5L2 8Zm0 5 10 5 10-5m-20 5 10 5 10-5" fill="#E6EEFF" /></>,
  };
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{body[name]}</svg>;
}

export const ArrowRight = (props: { className?: string }) => <Icon name="ArrowRight" {...props} />;
export const CheckCircle2 = (props: { className?: string }) => <Icon name="CheckCircle2" {...props} />;
export const MessageSquare = (props: { className?: string }) => <Icon name="MessageSquare" {...props} />;
export const ShoppingBag = (props: { className?: string }) => <Icon name="ShoppingBag" {...props} />;
export const Users = (props: { className?: string }) => <Icon name="Users" {...props} />;
export const ShieldCheck = (props: { className?: string }) => <Icon name="ShieldCheck" {...props} />;
export const Globe = (props: { className?: string }) => <Icon name="Globe" {...props} />;
export const Database = (props: { className?: string }) => <Icon name="Database" {...props} />;
export const Lock = (props: { className?: string }) => <Icon name="Lock" {...props} />;
export const ChevronRight = (props: { className?: string }) => <Icon name="ChevronRight" {...props} />;
export const Menu = (props: { className?: string }) => <Icon name="Menu" {...props} />;
export const X = (props: { className?: string }) => <Icon name="X" {...props} />;
export const ChevronDown = (props: { className?: string }) => <Icon name="ChevronDown" {...props} />;
export const MapPin = (props: { className?: string }) => <Icon name="MapPin" {...props} />;
export const ExternalLink = (props: { className?: string }) => <Icon name="ExternalLink" {...props} />;
export const Bot = (props: { className?: string }) => <Icon name="Bot" {...props} />;
export const Phone = (props: { className?: string }) => <Icon name="Phone" {...props} />;
export const Check = (props: { className?: string }) => <Icon name="Check" {...props} />;
export const CalendarCheck = (props: { className?: string }) => <Icon name="CalendarCheck" {...props} />;
export const Boxes = (props: { className?: string }) => <Icon name="Boxes" {...props} />;
export const CreditCard = (props: { className?: string }) => <Icon name="CreditCard" {...props} />;
export const FileSpreadsheet = (props: { className?: string }) => <Icon name="FileSpreadsheet" {...props} />;
export const Sparkles = (props: { className?: string }) => <Icon name="Sparkles" {...props} />;
export const Zap = (props: { className?: string }) => <Icon name="Zap" {...props} />;
export const GraduationCap = (props: { className?: string }) => <Icon name="GraduationCap" {...props} />;
export const BookOpen = (props: { className?: string }) => <Icon name="BookOpen" {...props} />;
export const BriefcaseBusiness = (props: { className?: string }) => <Icon name="BriefcaseBusiness" {...props} />;
export const ShoppingCart = (props: { className?: string }) => <Icon name="ShoppingCart" {...props} />;
export const Landmark = (props: { className?: string }) => <Icon name="Landmark" {...props} />;
export const Wrench = (props: { className?: string }) => <Icon name="Wrench" {...props} />;
export const ContactRound = (props: { className?: string }) => <Icon name="ContactRound" {...props} />;
export const Layers = (props: { className?: string }) => <Icon name="Layers" {...props} />;
