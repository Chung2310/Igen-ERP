import React from "react";

export type LandingIconName =
  | "marketing" | "content" | "inbox" | "customers" | "assistant"
  | "retail" | "checkout" | "orders" | "payment" | "reports"
  | "labor" | "recruitment" | "people" | "attendance" | "payroll"
  | "education" | "students" | "classes" | "tuition" | "courses"
  | "construction" | "manufacturing" | "healthcare";

const palette: Record<LandingIconName, [string, string, string]> = {
  marketing: ["#FF6B89", "#FFBB66", "#8238D3"], content: ["#FF6B89", "#FFC45C", "#7D45CE"],
  inbox: ["#7C6CFF", "#53D8FA", "#3C43AE"], customers: ["#FFB451", "#FF7C73", "#985A27"],
  assistant: ["#A56DFF", "#FF83C7", "#6531AA"], retail: ["#00ADFC", "#52DBDE", "#006EA9"],
  checkout: ["#00ADFC", "#7DE0E9", "#006EA9"], orders: ["#5CCB9A", "#B5E77A", "#267A68"],
  payment: ["#6387FF", "#5CE0E2", "#2E58B8"], reports: ["#3AB5F1", "#A2D7FF", "#2467B9"],
  labor: ["#735CF2", "#BA92FF", "#4935A5"], recruitment: ["#8C6CF5", "#FF9BC6", "#5741A2"],
  people: ["#725FF3", "#74D9EF", "#4335A5"], attendance: ["#FF9B54", "#FFD879", "#A85C22"],
  payroll: ["#5FCF9D", "#C0E88B", "#237F68"], education: ["#FFAA49", "#FFD871", "#B26123"],
  students: ["#FFAA49", "#FFD871", "#B26123"], classes: ["#3BBCE8", "#8EE5F4", "#2079A8"],
  tuition: ["#5BC89A", "#B1E18B", "#267C65"], courses: ["#FF7F91", "#FFC47B", "#A54864"],
  construction: ["#FFAD58", "#FFE0A0", "#B56727"], manufacturing: ["#52BEE9", "#A8E8F8", "#1A7DA5"],
  healthcare: ["#54CDAF", "#B5F2E3", "#247F71"],
};

const drawings: Record<LandingIconName, React.ReactNode> = {
  marketing: <><path d="M16 31 40 22v20L16 33Z" fill="white"/><path d="M40 25v14l7 4V21l-7 4Z" fill="#FFE9A6"/><path d="m19 34 3 9h8l-4-11" fill="white"/><path d="m49 13 3-5m3 20 6-1m-12 21 4 5" stroke="white" strokeWidth="3" strokeLinecap="round"/></>,
  content: <><rect x="17" y="15" width="30" height="35" rx="5" fill="white"/><path d="M25 25h14M25 31h11M25 37h8" stroke="#FC6B87" strokeWidth="3" strokeLinecap="round"/><path d="m46 38 3-7 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#FFE6A2"/></>,
  inbox: <><path d="M15 20a6 6 0 0 1 6-6h27a6 6 0 0 1 6 6v22a6 6 0 0 1-6 6H29l-9 6v-6a6 6 0 0 1-5-6V20Z" fill="white"/><path d="M23 26h23M23 33h17M23 40h10" stroke="#766CDA" strokeWidth="3" strokeLinecap="round"/><circle cx="51" cy="17" r="6" fill="#FF9BAA"/></>,
  customers: <><circle cx="27" cy="25" r="8" fill="white"/><path d="M13 46c1-9 7-14 14-14s13 5 14 14" fill="white"/><circle cx="45" cy="26" r="6" fill="#FFF3CE"/><path d="M42 35c7-1 12 4 13 11H43" fill="#FFF3CE"/></>,
  assistant: <><rect x="15" y="21" width="38" height="30" rx="9" fill="white"/><rect x="19" y="25" width="30" height="20" rx="6" fill="#EFE1FF"/><circle cx="28" cy="35" r="3" fill="#7542CA"/><circle cx="40" cy="35" r="3" fill="#7542CA"/><path d="M30 41c3 2 6 2 9 0M34 21v-6" stroke="#7542CA" strokeWidth="2.5" strokeLinecap="round"/><circle cx="34" cy="13" r="3" fill="#FFE4A5"/></>,
  retail: <><path d="M15 26h38l-3 25H18l-3-25Z" fill="white"/><path d="M22 27v-5a10 10 0 0 1 20 0v5" fill="none" stroke="white" strokeWidth="4"/><path d="M25 38h16" stroke="#00A5DC" strokeWidth="3" strokeLinecap="round"/><circle cx="48" cy="17" r="6" fill="#FFE87B"/></>,
  checkout: <><rect x="16" y="14" width="36" height="37" rx="5" fill="white"/><rect x="21" y="20" width="26" height="11" rx="2" fill="#A5EAF3"/><path d="M23 38h5m5 0h5m5 0h2M23 44h5m5 0h5m5 0h2" stroke="#138FC9" strokeWidth="3" strokeLinecap="round"/></>,
  orders: <><path d="M18 19h32v33H18V19Z" fill="white"/><path d="M25 15h18v9H25v-9Z" fill="#DFF8CB"/><path d="m25 34 3 3 5-6m3 4h8m-19 8 3 3 5-6m3 4h8" stroke="#389A78" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/></>,
  payment: <><rect x="13" y="20" width="43" height="30" rx="6" fill="white"/><path d="M13 27h43" stroke="#A4E2F0" strokeWidth="6"/><rect x="20" y="38" width="11" height="5" rx="2" fill="#667FE8"/><circle cx="50" cy="17" r="8" fill="#FFE77B"/></>,
  reports: <><rect x="15" y="14" width="38" height="38" rx="6" fill="white"/><path d="M24 43V34m9 9V26m9 17V21" stroke="#2D9DCF" strokeWidth="5" strokeLinecap="round"/><path d="M22 22h6" stroke="#A3D6F4" strokeWidth="3" strokeLinecap="round"/></>,
  labor: <><circle cx="25" cy="24" r="7" fill="white"/><circle cx="42" cy="24" r="7" fill="#E3D6FF"/><path d="M14 46c1-9 5-14 12-14 6 0 10 5 11 14m-2 0c1-8 5-12 9-12 5 0 9 4 10 12" fill="white"/></>,
  recruitment: <><rect x="17" y="18" width="34" height="32" rx="5" fill="white"/><circle cx="28" cy="30" r="5" fill="#BEA8FF"/><path d="M22 42c1-5 3-7 6-7s5 2 6 7m5-13h6m-6 7h6m-6 7h6" stroke="#7358C8" strokeWidth="2.6" strokeLinecap="round"/></>,
  people: <><circle cx="27" cy="24" r="7" fill="white"/><path d="M15 47c1-9 5-14 12-14s11 5 12 14" fill="white"/><rect x="38" y="24" width="16" height="21" rx="3" fill="#DFF8FF"/><path d="M42 31h8m-8 6h6" stroke="#5C74D9" strokeWidth="2.5" strokeLinecap="round"/></>,
  attendance: <><rect x="16" y="18" width="36" height="33" rx="5" fill="white"/><path d="M16 27h36M25 15v7m18-7v7" stroke="#EF9556" strokeWidth="3" strokeLinecap="round"/><path d="m25 39 5 5 12-12" stroke="#5CB999" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></>,
  payroll: <><rect x="14" y="23" width="41" height="27" rx="5" fill="white"/><rect x="18" y="17" width="31" height="28" rx="4" fill="#E6F8DA"/><circle cx="34" cy="31" r="8" fill="white"/><path d="M34 26v10m-3-7h6m-6 5h6" stroke="#48A178" strokeWidth="2" strokeLinecap="round"/></>,
  education: <><path d="m10 27 23-11 23 11-23 11-23-11Z" fill="white"/><path d="M20 33v10c8 7 18 7 26 0V33" fill="#FFF3D2"/><path d="M56 28v15" stroke="white" strokeWidth="3" strokeLinecap="round"/><circle cx="56" cy="46" r="3" fill="white"/></>,
  students: <><path d="m10 27 23-11 23 11-23 11-23-11Z" fill="white"/><path d="M20 33v10c8 7 18 7 26 0V33" fill="#FFF3D2"/><path d="M56 28v15" stroke="white" strokeWidth="3" strokeLinecap="round"/><circle cx="56" cy="46" r="3" fill="white"/></>,
  classes: <><rect x="14" y="18" width="40" height="32" rx="5" fill="white"/><path d="M22 24h24v17H22z" fill="#D9F8FC"/><path d="M33 27v14m-7-10h4m7 0h4" stroke="#2AA3C8" strokeWidth="2" strokeLinecap="round"/><path d="M25 49v5m19-5v5" stroke="white" strokeWidth="3"/></>,
  tuition: <><rect x="15" y="21" width="38" height="29" rx="5" fill="white"/><path d="M15 28h38" stroke="#AFDFB1" strokeWidth="5"/><circle cx="34" cy="39" r="7" fill="#DFF6C9"/><path d="M34 35v8m-3-5h6" stroke="#51A47B" strokeWidth="2" strokeLinecap="round"/></>,
  courses: <><path d="M15 19c8-4 14-2 18 1 4-3 10-5 18-1v30c-8-3-14-2-18 1-4-3-10-4-18-1V19Z" fill="white"/><path d="M33 20v29M21 28h7m-7 7h7m10-7h7m-7 7h7" stroke="#E3838E" strokeWidth="2.5" strokeLinecap="round"/></>,
  construction: <><path d="M17 37a17 17 0 0 1 34 0v5H17v-5Z" fill="white"/><path d="M28 21v12m12-12v12M15 42h38" stroke="#CE8242" strokeWidth="3" strokeLinecap="round"/><path d="M21 46h26v6H21z" fill="#FFF1CD"/></>,
  manufacturing: <><path d="M14 32 28 24v8l13-8v8l12-8v26H14V32Z" fill="white"/><path d="M19 20h8v12M24 40h5m6 0h5m6 0h3" stroke="#2B94BD" strokeWidth="3" strokeLinecap="round"/><rect x="20" y="44" width="27" height="6" rx="2" fill="#C6F4F8"/></>,
  healthcare: <><rect x="17" y="16" width="34" height="38" rx="8" fill="white"/><path d="M30 25h8v7h7v8h-7v7h-8v-7h-7v-8h7v-7Z" fill="#57CDAF"/><circle cx="47" cy="20" r="5" fill="#FFE7B7"/></>,
};

export function LandingIcon({ name, className = "h-12 w-12" }: { name: LandingIconName; className?: string }) {
  const [base, light, dark] = palette[name];
  return (
    <svg viewBox="0 0 68 68" className={className} aria-hidden="true" focusable="false" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="64" height="64" rx="18" fill={base} />
      <path d="M10 13C22 1 45 0 59 14v10C46 18 28 17 10 31V13Z" fill={light} opacity=".72" />
      <circle cx="54" cy="54" r="18" fill={dark} opacity=".14" />
      <circle cx="11" cy="55" r="8" fill="white" opacity=".15" />
      {drawings[name]}
    </svg>
  );
}
