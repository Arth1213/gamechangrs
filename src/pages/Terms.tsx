import { Link } from "react-router-dom";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

const effectiveDate = "May 8, 2026";

const sections = [
  {
    title: "Acceptance of Terms",
    paragraphs: [
      "These Terms of Service govern your use of the Game Changrs website, applications, analytics reports, Technique AI tools, coaching marketplace, gear marketplace, communications, and related features.",
      "By accessing or using Game Changrs, you agree to these terms. If you are using the platform for a team, academy, club, player, or child, you represent that you have authority to do so.",
    ],
  },
  {
    title: "Operator Status",
    paragraphs: [
      "Game Changrs is currently operated from California, USA by Arth Arun. The platform is active, but it is not yet organized as a separate registered corporate entity. For these terms, \"Game Changrs,\" \"we,\" \"us,\" and \"our\" refer to the platform and its operator.",
    ],
  },
  {
    title: "Who May Use the Service",
    bullets: [
      "You must provide reasonably accurate information when creating or using an account or profile.",
      "Users under 18 should use the service with parent, guardian, coach, academy, or club involvement.",
      "Children under 13 may not independently create accounts or submit personal information; a parent or guardian must act on their behalf.",
      "You are responsible for maintaining the confidentiality of your login credentials and for activity under your account.",
    ],
  },
  {
    title: "Permitted Use",
    bullets: [
      "You may use the platform for lawful cricket-development, coaching, analytics, marketplace, and community purposes.",
      "You may not misuse the service, interfere with security, scrape or copy data at scale without permission, reverse engineer protected workflows except as allowed by law, or use the platform to harass, defraud, impersonate, or violate others' rights.",
      "You may not upload unlawful, infringing, abusive, deceptive, or harmful content, or content you do not have the right to use.",
    ],
  },
  {
    title: "User Content and Licenses",
    paragraphs: [
      "You retain ownership of content you submit, upload, or provide, subject to the rights needed for us to operate the platform.",
    ],
    bullets: [
      "You grant Game Changrs a non-exclusive, worldwide, royalty-free license to host, store, copy, process, transmit, analyze, format, and display your content as needed to provide, secure, improve, and support the service.",
      "You represent that you have the rights and permissions needed to upload the content and to allow the uses described in these terms.",
      "If you submit player data, videos, reports, or other third-party information, you are responsible for having the necessary authority or consent.",
    ],
  },
  {
    title: "Platform Intellectual Property",
    bullets: [
      "All Game Changrs software, branding, product design, prompts, analytics frameworks, report structures, text, graphics, and associated materials are protected by intellectual property and other laws.",
      "Except for your own content and as otherwise expressly allowed, you may not reproduce, sell, sublicense, republish, or create derivative commercial works from the platform or its protected materials without prior written permission.",
      "All rights not expressly granted are reserved.",
    ],
  },
  {
    title: "Reports, Insights, and No Performance Guarantee",
    paragraphs: [
      "Game Changrs may generate automated reports, rankings, technique feedback, player assessments, intelligence outputs, recommendations, or visualizations. These are decision-support tools only.",
    ],
    bullets: [
      "They do not guarantee selection, playing time, performance, injury prevention, match outcomes, or commercial value.",
      "Coaches, parents, players, clubs, selectors, and teams remain responsible for their own decisions, supervision, and risk assessment.",
      "You should not treat platform outputs as medical, legal, mental-health, or professional licensing advice.",
    ],
  },
  {
    title: "Marketplace and Coaching Relationships",
    bullets: [
      "Game Changrs may help users discover coaches, connect players and coaches, or communicate around gear listings, donations, or sales.",
      "Unless expressly stated otherwise, Game Changrs is not the seller, buyer, coach, employer, academy, insurer, payment processor, or contracting party between users.",
      "Users are responsible for evaluating fit, safety, legality, pricing, training arrangements, payments, shipping, pickup, condition, and all other transaction or coaching details.",
      "We may remove listings, profiles, or interactions that create safety, abuse, fraud, policy, or quality concerns.",
    ],
  },
  {
    title: "Availability, Changes, and Suspension",
    bullets: [
      "We may change, improve, pause, or discontinue features at any time.",
      "We may suspend or terminate access if we believe a user has violated these terms, created risk, or misused the platform.",
      "We are not liable for feature changes, downtime, delayed outputs, or temporary unavailability.",
    ],
  },
  {
    title: "Disclaimers and Limitation of Liability",
    paragraphs: [
      "The service is provided on an \"as is\" and \"as available\" basis to the fullest extent permitted by law. We disclaim implied warranties, including merchantability, fitness for a particular purpose, title, and non-infringement.",
      "To the fullest extent permitted by law, Game Changrs will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, revenue, goodwill, data, opportunities, or sporting outcomes arising from or related to the service.",
    ],
  },
  {
    title: "Indemnity",
    paragraphs: [
      "You agree to defend, indemnify, and hold harmless Game Changrs and its operator from claims, losses, liabilities, costs, and expenses arising out of your content, your misuse of the service, your violation of these terms, or your violation of another person's rights.",
    ],
  },
  {
    title: "California Law",
    paragraphs: [
      "These terms are governed by the laws of the State of California, without regard to conflict-of-law principles. Any dispute arising from these terms or the service will be brought in a state or federal court located in California, unless applicable law requires otherwise.",
    ],
  },
  {
    title: "Changes to These Terms",
    paragraphs: [
      "We may revise these terms from time to time. Updated terms become effective when posted, unless a later date is stated. Continued use of the platform after the effective date means you accept the revised terms.",
    ],
  },
];

const Terms = () => {
  return (
    <LegalPageLayout
      title="Terms of Service"
      summary="These terms set the rules for using Game Changrs and explain user responsibilities, platform rights, report disclaimers, youth-use expectations, and how the marketplace and coaching workflows are intended to work."
      effectiveDate={effectiveDate}
      sections={sections}
      contactNote={
        <>
          Questions about these terms can be sent to{" "}
          <a href="mailto:arth@game-changrs.com" className="text-primary hover:underline">
            arth@game-changrs.com
          </a>
          . For data-handling details, review the{" "}
          <Link to="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          .
        </>
      }
    />
  );
};

export default Terms;
