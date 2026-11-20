import { ShieldCheck } from "lucide-react";
import { SEOHead } from "../seo/SEOHead";
import {
  BRAND_NAME,
  PRIVACY_POLICY_URL,
  SERVICE_WEBSITE_URL,
  SUPPORT_EMAIL,
  TERMS_OF_SERVICE_URL,
  USER_DATA_DELETION_URL,
} from "../config/brand";

const lastUpdated = "October 21, 2026";

const policySections = [
  {
    title: "1. Scope",
    content: [
      `${BRAND_NAME} is a business management platform that may connect with Google Drive, TikTok Shop, Facebook and other approved services to help users manage company operations and content.`,
      "This Privacy Policy explains what data we collect, how we use it, how long we retain it and how users can revoke access or request deletion.",
    ],
  },
  {
    title: "2. Data We Receive",
    content: [
      "Account and profile data you provide directly, such as name, email address, phone number, company information and login credentials.",
      "For Google Drive, we receive the connected Google account email address and OAuth authorization metadata, including the granted scopes. We store a protected refresh token so the connection can continue until it is disconnected or revoked.",
      "Business data synchronized at your request, such as conversation metadata and media or text content that you choose to process through the platform.",
      "Technical usage data such as IP address, browser type, device information, timestamps, logs and security events.",
    ],
  },
  {
    title: "3. How We Use Data",
    content: [
      "To authenticate users and maintain secure access to the platform.",
      "To let organization administrators create and manage employee accounts, assign organization membership, and send verification codes or membership notices for existing accounts. Public account registration is unavailable. Organization administrators manage their members' business information within that organization.",
      "To establish and maintain integrations that you authorize, including Google Drive and other approved OAuth connections.",
      "For Google Drive, to create the Lux Care company folder and, at an authorized user's request, list, upload, download, preview, rename, move, or move application-related files and folders to trash.",
      "To sync and display the data you explicitly authorize, including profile, order, product, messaging or publishing-related data supported by the connected platform.",
      "To generate AI-assisted drafts, content suggestions, media prompts or workflow automations based only on the materials and instructions you submit to the system.",
      "To monitor service reliability, prevent abuse, troubleshoot incidents and comply with applicable legal obligations.",
    ],
  },
  {
    title: "4. Google Drive And Other Platform Permissions",
    content: [
      "Google Drive access is optional. Lux Care requests the https://www.googleapis.com/auth/drive.file scope, which is limited to files and folders created by the application or explicitly selected, opened, or shared with it. Lux Care does not use this scope for unrestricted access to your entire Google Drive.",
      "The userinfo.email and openid scopes identify the connected Google account and support the authorization flow.",
      "When you connect TikTok Shop or another third-party service, we likewise request and use only the permissions required for the features you activate.",
      "For TikTok-related features, this may include scopes such as user identity verification, shop order synchronization or product synchronization when those features are enabled in your account.",
      "We do not ask users to provide their TikTok password directly to us. Access is granted through the platform's official authorization flow.",
    ],
  },
  {
    title: "5. AI Processing And User-Provided Materials",
    content: [
      "When you submit text, upload files or request AI-assisted image or content generation, the system may process the exact materials you provide in order to generate drafts or outputs.",
      "We design the workflow to prioritize source fidelity. However, users remain responsible for reviewing generated outputs before publication or business use.",
      "You should not upload materials that you are not authorized to process.",
      "AI features are available only to authorized organization members. Business conversations and documents follow the applicable organizational retention rules. Legacy personal AI access is disabled. Only submit information you are authorized to share; do not enter sensitive personal, medical or confidential business information without permission.",
      "The company assistant uses OpenRouter (https://openrouter.ai/privacy), Lux Care's only configured AI service. OpenRouter may route a request to model endpoints under its Data Processing Agreement and subprocessor terms. Before sharing, the app identifies OpenRouter, explains the data categories and purpose, and asks for your explicit permission. Requests are restricted to the approved OpenRouter routes; changes require fresh permission.",
      "For company AI, your question, recent assistant messages and relevant excerpts from company documents or work records your account may access can be sent to OpenRouter to answer your request. When you ask AI to compare a legal amendment, relevant text from the selected draft and approved source legal documents is sent. When you create or upload a Knowledge document, its text and pages or images needing OCR may be sent for reading, indexing and search. The purpose, data categories and OpenRouter recipient are displayed before you agree. You can decline or withdraw permission, which stops subsequent AI requests without disabling other account features. Only submit information you are authorized to share.",
      "OpenRouter processes AI requests under a Data Processing Agreement with Lux Care and its subprocessor terms. OpenRouter may route requests to model endpoints; requests are restricted to eligible endpoints with zero data retention and data collection denied, fallback is disabled, and requests fail if no eligible endpoint is available. OpenRouter's subprocessor protections are required to be at least equivalent to the safeguards described in this Privacy Policy.",
    ],
  },
  {
    title: "6. Sharing And Disclosure",
    content: [
      "We may share data with infrastructure, hosting, notifications or support providers only to the extent necessary to operate the service. Data for company AI features is sent to OpenRouter only after you give permission. OpenRouter's DPA and subprocessor terms apply to any model endpoint routing. Reported chat content and relevant attachments may be reviewed by authorized company administrators to investigate abuse.",
      "We may disclose information when required by law, legal process, security response or to enforce our terms and protect the platform.",
      "We do not sell Google user data, personal data, or OAuth credentials, and we do not use Google user data or OAuth credentials for advertising.",
      "Lux Care's use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.",
    ],
  },
  {
    title: "7. Retention And Security",
    content: [
      "We retain account, connection and operational data only for as long as needed to provide the service, satisfy legal obligations, resolve disputes or enforce our agreements.",
      "Legacy personal AI questions, answers and usage records are automatically removed from the active database after 45 days. Deleting an eligible account removes its legacy personal AI history and quota records sooner. This legacy retention period does not set a deletion period for business conversations or documents.",
      "Deleting an unassigned account removes its profile, business applications, verification data and invitations. For company members, business records and limited historical identifiers may be retained by the organization to preserve operational records. A sole administrator can initiate a deletion request in-app, processed within seven days, without contacting support.",
      "Google OAuth refresh tokens and other platform connection credentials are stored with access controls. They are retained until the integration is disconnected, access is revoked, the account is deleted, or retention is no longer necessary to provide the service.",
      "We use reasonable administrative, technical and organizational safeguards, but no system can guarantee absolute security.",
    ],
  },
  {
    title: "8. Your Choices And Rights",
    content: [
      "You may disconnect Google Drive or another linked platform from the integration settings inside Lux Care.",
      "You may revoke Lux Care's Google Drive access from the third-party connections page in your Google Account. Revocation stops future access but does not automatically delete files already stored in Google Drive.",
      "You may initiate account deletion inside the app: unaffiliated users use Account → Account security; company members use Profile → Delete account. Eligible personal data is deleted, while records the organization must retain may remain as described above. You may also use the published deletion page or contact support for assistance.",
    ],
  },
];

export default function PrivacyPolicy() {
  const meta = {
    title: `Privacy Policy | ${BRAND_NAME}`,
    description: `Privacy Policy for ${BRAND_NAME}, including account data, connected platform data, TikTok Shop integration data and deletion rights.`,
    keywords: "privacy policy, TikTok Shop, user data deletion, iGen ERP",
    path: "/privacy-policy",
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <SEOHead meta={meta} />

      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4" />
              <span>Legal</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">Privacy Policy</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              This page describes how {BRAND_NAME} handles account information, Google Drive data, connected platform
              data, uploaded materials and data deletion requests.
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
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-slate-700">
          {BRAND_NAME} only accesses third-party platform data after an explicit user authorization flow. Users can
          revoke access at any time from the application settings or the connected platform settings.
        </div>

        {policySections.map((section) => (
          <section key={section.title} className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">{section.title}</h2>
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              {section.content.map((paragraph) => (
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
              Privacy Policy:{" "}
              <a className="font-semibold text-blue-600 hover:underline" href={PRIVACY_POLICY_URL}>
                Privacy Policy
              </a>
            </p>
            <p>
              Terms of Service:{" "}
              <a className="font-semibold text-blue-600 hover:underline" href={TERMS_OF_SERVICE_URL}>
                Terms of Service
              </a>
            </p>
            <p>
              Data deletion instructions:{" "}
              <a className="font-semibold text-blue-600 hover:underline" href={USER_DATA_DELETION_URL}>
                Data deletion instructions
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
