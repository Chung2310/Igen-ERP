import { Scale } from "lucide-react";
import { SEOHead } from "../seo/SEOHead";
import {
  BRAND_NAME,
  PRIVACY_POLICY_URL,
  SERVICE_WEBSITE_URL,
  SUPPORT_EMAIL,
  TERMS_OF_SERVICE_URL,
} from "../config/brand";

const lastUpdated = "October 19, 2026";

const sections = [
  {
    title: "1. Acceptance",
    body: [
      `These Terms of Service govern access to and use of ${BRAND_NAME}, including its web application, connected platform integrations, APIs, AI-assisted workflows and related services.`,
      "By accessing or using the service, you agree to comply with these terms and all applicable laws and platform rules.",
    ],
  },
  {
    title: "2. Account Responsibility",
    body: [
      "You are responsible for maintaining the confidentiality of your account credentials and for the activities performed under your account.",
      "You must provide accurate registration and operational information and keep it up to date.",
      "LuxCare is provided to organizations and groups for their employees or members under direct business agreements. Organization administrators create and manage employee accounts. Employees sign in using the credentials provided by their organization; self-registration and invitation-based account activation are unavailable. Individual, consumer and family plans and personal trial workspaces are not offered.",
    ],
  },
  {
    title: "3. Google Drive And Connected Platform Integrations",
    body: [
      "Google Drive access is optional and begins only after an authorized company administrator completes the Google OAuth consent flow.",
      "Lux Care uses the https://www.googleapis.com/auth/drive.file scope. This scope is limited to application-created files and folders or items explicitly selected, opened, or shared with Lux Care; it does not grant unrestricted access to the entire Google Drive.",
      "At an authorized user's request, Lux Care may create the company folder and manage app-related items by listing, uploading, downloading, previewing, renaming, moving, and trashing files and folders.",
      "The service may also integrate with TikTok Shop, Facebook and other approved third-party platforms through their official authorization mechanisms.",
      "Your use of any connected platform through the service must also comply with that platform's own developer terms, content policies, commerce policies and community rules.",
      "If you disconnect Google Drive or revoke access in your Google Account, Drive-dependent features stop working. Disconnecting does not automatically delete files already stored in Google Drive.",
    ],
  },
  {
    title: "4. Customer Content And Lawful Use",
    body: [
      "You retain responsibility for all text, files, prompts, images, videos, listings, messages and other content submitted through the service.",
      "You must have authority to connect the Google account and to access, process, share, or modify each file used through Lux Care.",
      "You must ensure that your use of the service and any published output does not infringe intellectual property rights, violate privacy rights, mislead users or break any law or platform policy.",
      "You may not use the service for spam, fraud, harassment, hate speech, sexually explicit content, threats, unauthorized automation, credential abuse or illegal commercial activity. Chat and blog submissions are filtered for prohibited text, links and unsafe attachment metadata. You may report abusive messages and block users; reports are reviewed by authorized company administrators.",
    ],
  },
  {
    title: "5. AI-Assisted Features",
    body: [
      "The service may offer AI-assisted drafting, analysis, prompt generation, media generation and automation support.",
      "AI-assisted features are available to authorized organization members within enabled modules and configured usage limits. AI access does not grant a standalone personal workspace. Limits and provider availability may change with notice.",
      "LuxCare covers AI provider costs within the organization's configured allowance. No separate AI credit or additional-usage purchases are offered. When a limit is reached, AI access pauses until the allowance resets.",
      "The general-purpose assistant is not a medical service and cannot diagnose, prescribe or provide treatment advice.",
      "AI outputs are generated from the instructions and materials submitted by the user and may still require human review. The company assistant requests explicit permission before sharing data with the AI processors listed in the app; you may decline or withdraw that permission.",
      "You are solely responsible for reviewing outputs before publication, advertising, commerce or legal reliance.",
    ],
  },
  {
    title: "6. Availability And Changes",
    body: [
      "We may update, suspend or refine features, integrations or technical requirements as platforms, laws or infrastructure change.",
      "We may restrict access to protect service integrity, prevent abuse, address security risks or comply with legal obligations.",
    ],
  },
  {
    title: "7. Termination",
    body: [
      "You may stop using the service at any time and may disconnect integrated accounts from the settings area where available.",
      "You may initiate account deletion in the app. A sole company administrator's request is processed within seven days; its status and cancellation option are available in Account. Other employees and business records are not automatically deleted with your account.",
      "We may suspend or terminate access if we reasonably believe there is a violation of these terms, a platform policy breach, a security issue or unlawful use of the service.",
    ],
  },
  {
    title: "8. Disclaimer And Limitation",
    body: [
      "The service is provided on an as-available basis. We do not guarantee uninterrupted availability, platform compatibility at all times or that AI-generated results will be error-free.",
      "To the maximum extent allowed by law, we are not liable for indirect, incidental or consequential losses arising from your use of the service.",
    ],
  },
];

export default function TermsOfService() {
  const meta = {
    title: `Terms of Service | ${BRAND_NAME}`,
    description: `Terms of Service for ${BRAND_NAME}, including connected platform use, AI-assisted features and customer responsibilities.`,
    keywords: "terms of service, TikTok Shop, platform integrations, iGen ERP",
    path: "/terms-of-service",
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <SEOHead meta={meta} />

      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-bold uppercase tracking-wider">
              <Scale className="h-4 w-4" />
              <span>Legal</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">Terms of Service</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              These terms explain the rules for using {BRAND_NAME}, including Google Drive, other platform integrations,
              AI-assisted features and customer responsibilities.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm shrink-0">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Service</p>
              <p className="mt-1 font-semibold text-slate-800">{BRAND_NAME}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Last Updated</p>
              <p className="mt-1 font-semibold text-slate-800">{lastUpdated}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-8">
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm leading-6 text-slate-700">
          Use of Google Drive, TikTok Shop, or another connected-platform feature through {BRAND_NAME} remains subject
          to that platform's applicable terms, policies, and technical limitations.
        </div>

        {sections.map((section) => (
          <section key={section.title} className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">{section.title}</h2>
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">9. Contact</h2>
          <div className="space-y-3 text-sm leading-6 text-slate-600">
            <p>
              Service website:{" "}
              <a className="font-semibold text-blue-600 hover:underline" href={SERVICE_WEBSITE_URL}>
                {SERVICE_WEBSITE_URL}
              </a>
            </p>
            <p>
              Terms of Service:{" "}
              <a className="font-semibold text-blue-600 hover:underline" href={TERMS_OF_SERVICE_URL}>
                Terms of Service
              </a>
            </p>
            <p>
              Privacy Policy:{" "}
              <a className="font-semibold text-blue-600 hover:underline" href={PRIVACY_POLICY_URL}>
                Privacy Policy
              </a>
            </p>
            <p>
              Support email:{" "}
              <a className="font-semibold text-blue-600 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
