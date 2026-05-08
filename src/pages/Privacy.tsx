import { Link } from "react-router-dom";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

const effectiveDate = "May 8, 2026";

const sections = [
  {
    title: "Who This Policy Applies To",
    paragraphs: [
      "This Privacy Policy applies to the Game Changrs website, applications, reports, coaching workflows, analytics tools, Technique AI experiences, marketplace features, and related communications.",
      "In this policy, \"Game Changrs,\" \"we,\" \"us,\" and \"our\" refer to the Game Changrs platform currently operated from California, USA by Arth Arun. The platform is in active operation, but it is not yet organized as a separate registered company entity.",
    ],
  },
  {
    title: "Information We Collect",
    bullets: [
      "Account and profile data such as name, email address, role, club or team details, player details, and account preferences.",
      "Content you upload or submit, including videos, listings, profile images, reports, player or coach information, messages, forms, and marketplace or onboarding requests.",
      "Performance and analytics data generated through the platform, including technique outputs, cricket reports, player intelligence summaries, and related scoring or model outputs.",
      "Operational data such as device information, browser type, IP address, timestamps, log data, and usage events needed to secure and improve the platform.",
      "Communication data when you contact us or use connection, report-email, notification, booking, or marketplace contact flows.",
    ],
  },
  {
    title: "How We Use Information",
    bullets: [
      "To create and maintain accounts, authenticate users, and provide the features you request.",
      "To process videos, generate technique outputs, create cricket reports, support analytics workflows, and deliver related summaries or notifications.",
      "To operate the coaching and marketplace workflows, including connection requests, session coordination, listing communications, and support follow-up.",
      "To maintain platform security, prevent abuse, investigate misuse, troubleshoot errors, and improve reliability.",
      "To communicate with you about service updates, requested support, onboarding, and important account or platform notices.",
    ],
  },
  {
    title: "Sharing and Service Providers",
    paragraphs: [
      "We share information only as reasonably necessary to run the platform, respond to your requests, comply with law, or protect rights and safety.",
    ],
    bullets: [
      "Infrastructure, authentication, database, storage, and serverless tooling providers that help us operate the product.",
      "Email and notification providers when the platform sends requested reports, connection emails, alerts, or support responses.",
      "Other users when a feature is designed to connect participants, such as coaching requests, marketplace contact flows, or profile-based interactions you initiate.",
      "Authorities, advisers, or counterparties when required by law, legal process, or a good-faith safety or rights-protection need.",
    ],
  },
  {
    title: "California and U.S. Privacy Rights",
    paragraphs: [
      "If you are a California resident, you may request access to the personal information we hold about you, request correction of inaccurate information, request deletion of eligible information, and ask questions about how we collect, use, and disclose your information.",
      "As of the effective date above, Game Changrs does not sell personal information for money and does not use personal information for cross-context behavioral advertising.",
    ],
  },
  {
    title: "Youth Users",
    paragraphs: [
      "Game Changrs serves youth-cricket and development use cases. If you are under 18, you should use the platform with the involvement of a parent, guardian, coach, academy, or other authorized adult.",
      "If a user is under 13, personal information should not be submitted directly by that child without a parent or guardian acting on the child's behalf and authorizing the use of the service.",
    ],
  },
  {
    title: "Retention and Security",
    bullets: [
      "We keep information for as long as reasonably necessary to operate the service, maintain records, resolve disputes, enforce our terms, and meet legal or security needs.",
      "We use commercially reasonable technical and organizational safeguards, but no internet or storage system can be guaranteed fully secure.",
      "When you delete content or request account deletion, some records may remain in backups, logs, or legally required archives for a limited period.",
    ],
  },
  {
    title: "Reports, Analytics, and Automated Outputs",
    paragraphs: [
      "Game Changrs may generate automated insights, summaries, scores, and visual outputs. These outputs are intended to support cricket development, review, coaching, and strategy workflows. They are informational tools, not guarantees of performance, selection, health, or safety outcomes.",
    ],
  },
  {
    title: "Changes to This Policy",
    paragraphs: [
      "We may update this Privacy Policy as the platform evolves. When we make material changes, we may revise the effective date and post the updated version on the site. Continued use after an update means the updated policy applies prospectively.",
    ],
  },
];

const Privacy = () => {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      summary="This policy explains what information Game Changrs collects, how it is used, when it may be shared, and what choices users have. It is written for the platform as it exists today, including Technique AI, analytics, coaching, reports, and marketplace workflows."
      effectiveDate={effectiveDate}
      sections={sections}
      contactNote={
        <>
          Questions or privacy requests can be sent to{" "}
          <a href="mailto:arth@game-changrs.com" className="text-primary hover:underline">
            arth@game-changrs.com
          </a>
          . You can also review the platform{" "}
          <Link to="/terms" className="text-primary hover:underline">
            Terms of Service
          </Link>
          .
        </>
      }
    />
  );
};

export default Privacy;
