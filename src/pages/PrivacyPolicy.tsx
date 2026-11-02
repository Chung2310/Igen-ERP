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

const lastUpdated = "November 2, 2026";

const policySections = [
  {
    title: "1. Scope",
    content: [
      `${BRAND_NAME} is a business management platform that may connect with TikTok Shop, Facebook Pages, Facebook Messenger, TikTok Business Messaging and other approved services. Social messaging integrations are used to manage customer conversations and automatic replies; they are not used to publish posts or videos. TikTok Shop order and product synchronization is a separate feature.`,
      "This Privacy Policy explains what data we collect, how we use it, how long we retain it and how users can revoke access or request deletion.",
    ],
  },
  {
    title: "2. Data We Receive",
    content: [
      "Account and workspace data you provide, such as your name, email address, phone number and company information.",
      "Platform connection data, such as Facebook Page IDs, TikTok account identifiers, profile names and images, permission scopes, and access or refresh tokens. Tokens are stored on our servers and are not exposed to other workspace members through the interface.",
      "Customer communication data received through enabled integrations, including Facebook Messenger messages, Facebook Page comments, TikTok direct messages, sender and conversation identifiers, timestamps, delivery status, and attachments or attachment URLs. We also store automatic-reply text and related processing logs.",
      "When TikTok Shop synchronization is enabled, selected shop, product, order and inventory data.",
      "Technical usage data such as IP address, browser type, device information, timestamps, logs and security events.",
    ],
  },
  {
    title: "3. How We Use Data",
    content: [
      "To authenticate users and maintain secure access to the platform.",
      "To establish and maintain the platform connections you choose, including the separate TikTok Shop synchronization feature.",
      "To receive, display, organize and respond to customer messages and Facebook Page comments through the connected business accounts.",
      "When automatic replies are enabled, to send the message or comment text and relevant conversation context to our configured AI provider, Google Gemini, to generate a response, then send that response through the connected platform according to the workspace settings.",
      "To maintain reply history, prevent duplicate processing, troubleshoot delivery and support the customer-service workflows you enable.",
      "To monitor service reliability, prevent abuse, troubleshoot incidents and comply with applicable legal obligations.",
    ],
  },
  {
    title: "4. Platform Connections And Permissions",
    content: [
      "Facebook permissions are used to list the Pages you choose, receive Page and Messenger webhook events, read comments needed for the enabled comment-reply workflow, and send replies through Messenger or to comments.",
      "TikTok Login Kit profile authorization requests the user.info.basic scope to identify the connected profile. It does not grant access to direct messages. TikTok direct-message features require a separate TikTok API for Business Business Messaging authorization and are available only when that authorization is enabled for the account and application. TikTok Shop authorization and synchronization are separate features.",
      "We do not ask users to provide Facebook or TikTok passwords directly to us. Access is granted through the applicable platform authorization flow. We do not use these social messaging connections to publish posts or videos.",
    ],
  },
  {
    title: "5. AI Processing And User-Provided Materials",
    content: [
      "For automatic replies, the incoming customer message and relevant conversation context may be processed by Google Gemini to generate a response. The response may be sent automatically when the workspace has enabled automatic replies; an employee does not review every response before it is sent.",
      "Workspace administrators are responsible for configuring the reply rules, reviewing reply history, pausing automation when needed and ensuring that the connected business account is authorized to process the conversation.",
      "Do not submit or configure personal data or materials that you are not authorized to process.",
    ],
  },
  {
    title: "6. Sharing And Disclosure",
    content: [
      "We share data with platform providers to operate the integrations you authorize, and with hosting, infrastructure, support and AI service providers (including Google Gemini for enabled AI replies) only as needed to provide the requested features.",
      "We may disclose information when required by law, legal process, security response or to enforce our terms and protect the platform.",
      "We do not sell personal data provided through the service.",
    ],
  },
  {
    title: "7. Retention And Security",
    content: [
      "We retain conversation history and reply logs while the connected workspace feature is in use and until an authorized workspace administrator requests deletion. We may retain limited records longer when required by law, for security, or to resolve disputes.",
      "Disconnecting an integration stops future platform access and synchronization; it does not by itself delete conversation history already stored in the workspace. Access tokens are disabled when an integration is disconnected. Verified deletion requests are processed within 30 days, subject to legal retention requirements.",
      "We use reasonable administrative, technical and organizational safeguards, but no system can guarantee absolute security.",
    ],
  },
  {
    title: "8. Your Choices And Rights",
    content: [
      "You may disconnect a linked platform from the integration settings inside the application.",
      "You may also revoke the application's access directly from the settings page of the connected third-party platform.",
      "You may request access, correction or deletion of eligible data through the public deletion page or by contacting support. A Facebook callback request immediately revokes the matching connection tokens and removes the Facebook identifier for the person who authorized the connection. Page connection records and workspace conversation history are not removed by that callback; an authorized workspace administrator can request their deletion separately.",
    ],
  },
  {
    title: "9. Contact",
    content: [
      `Service website: ${SERVICE_WEBSITE_URL}`,
      `Privacy Policy: ${PRIVACY_POLICY_URL}`,
      `Terms of Service: ${TERMS_OF_SERVICE_URL}`,
      `Data deletion instructions: ${USER_DATA_DELETION_URL}`,
      `Support email: ${SUPPORT_EMAIL}`,
    ],
  },
];

export default function PrivacyPolicy() {
  const meta = {
    title: `Privacy Policy | ${BRAND_NAME}`,
    description: `Privacy Policy for ${BRAND_NAME}, including Facebook and TikTok business messaging, automatic replies, TikTok Shop synchronization and deletion rights.`,
    keywords: "privacy policy, Facebook Messenger, TikTok Business Messaging, automatic replies, user data deletion, iGen ERP",
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
            <h1 className="text-balance text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
              Privacy Policy
            </h1>
            <p className="max-w-2xl text-pretty text-sm leading-6 text-slate-600">
              This page describes how {BRAND_NAME} handles account information, connected
              platform data, uploaded materials and data deletion requests for public app
              review and user reference.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm shrink-0">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Service
              </p>
              <p className="mt-1 font-semibold text-slate-800">{BRAND_NAME}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Last Updated
              </p>
              <p className="mt-1 font-semibold text-slate-800">{lastUpdated}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-slate-700">
          {BRAND_NAME} only accesses third-party platform data after an explicit user
          authorization flow. Users can revoke access at any time from the application
          settings or the connected platform settings.
        </div>

        {policySections.map((section) => (
          <section key={section.title} className="space-y-3">
            <h2 className="text-balance text-lg font-bold text-slate-900">{section.title}</h2>
            <div className="space-y-3 text-pretty text-sm leading-6 text-slate-600">
              {section.content.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
