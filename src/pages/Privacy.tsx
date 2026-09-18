import Seo from "../components/Seo";
import { Link } from "react-router-dom";
import LegalPageLayout, { type LegalSection } from "../components/LegalPageLayout";
import { CONTACT_EMAIL } from "../lib/constants";

const INFO_OFFICER_EMAIL = `privacy@chatsched.com`;

const sections: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: (
      <>
        <p>
          ChatSched ("we", "us", "the platform") connects South African small businesses ("Businesses", "Advertisers") with social media pages, influencers, website owners, podcasters and radio stations ("Publishers", "Creators") who want to sell advertising placements. This policy explains how we collect, use, store and protect personal information in the course of running that marketplace, in line with the Protection of Personal Information Act 4 of 2013 ("POPIA").
        </p>
        <p>
          This policy applies to everyone who uses the site or app — visitors browsing publishers, businesses submitting requests, and publishers/creators applying to list a channel.
        </p>
      </>
    ),
  },
  {
    id: "what-we-collect",
    title: "What personal information we collect",
    body: (
      <>
        <p>What we collect depends on how you use the platform:</p>
        <ul>
          <li><strong>Account details</strong> — name, email address, phone number, and password (stored securely, never in plain text).</li>
          <li><strong>Business details</strong> — company name, industry, province/city, website, and social profile links, for businesses submitting campaign requests.</li>
          <li><strong>Creator/publisher details</strong> — channel name, category, social media handles or website/podcast/radio details, follower or audience figures, bio, and the ad formats or placement types you offer.</li>
          <li><strong>Payout details</strong> — banking or payment information needed to pay creators for completed campaigns.</li>
          <li><strong>Contact and communications</strong> — messages sent through request threads, contact form submissions, and support correspondence.</li>
          <li><strong>Verification information</strong> — where relevant, business registration numbers, VAT numbers, and identity details used to confirm you are who you say you are.</li>
          <li><strong>Technical information</strong> — basic usage data (pages visited, device/browser type) collected automatically to keep the platform working and secure. This includes recording, against your account, which publisher profiles you view — publishers see an aggregate count of how many businesses viewed their listing, never who specifically.</li>
        </ul>
      </>
    ),
  },
  {
    id: "purpose",
    title: "Why we collect it (purpose of processing)",
    body: (
      <>
        <p>We only collect personal information for specific, explained purposes, including to:</p>
        <ul>
          <li>Create and manage your account and verify who you are.</li>
          <li>Operate the marketplace — matching businesses with publishers, handling feature requests, approvals and scheduling.</li>
          <li>Process payments and payouts between businesses and creators.</li>
          <li>Communicate with you about requests, campaigns, account activity, and support queries.</li>
          <li>Maintain trust and safety — reviewing applications, verifying business/creator details, and investigating disputes or policy breaches.</li>
          <li>Meet our legal, tax and regulatory obligations.</li>
          <li>Improve the platform based on aggregated, non-identifying usage patterns.</li>
        </ul>
        <p>We don't collect information beyond what's reasonably needed for these purposes, and we don't sell personal information to third parties.</p>
      </>
    ),
  },
  {
    id: "legal-basis",
    title: "Our basis for processing",
    body: (
      <p>
        We process personal information because it's necessary to perform our agreement with you (running your account and campaigns), to meet our legal obligations (such as tax and payment recordkeeping), on the basis of your consent where you've given it (such as marketing communications you can opt out of at any time), and where we have a legitimate interest in keeping the platform safe, functional and fraud-free — balanced against your right to privacy.
      </p>
    ),
  },
  {
    id: "storage-security",
    title: "How we store and protect your information",
    body: (
      <>
        <p>
          Personal information is stored using reputable, access-controlled infrastructure with encryption in transit and at rest. Access is limited to the people and systems that need it to run the platform — for example, only admins can view sensitive verification or payout information, enforced at the database level, not just in the interface.
        </p>
        <p>
          We keep personal information only for as long as it's needed for the purposes described in this policy, or as required by law (for example, tax and financial records), after which it's deleted or anonymised.
        </p>
      </>
    ),
  },
  {
    id: "third-parties",
    title: "Sharing with third parties",
    body: (
      <>
        <p>We share personal information only where necessary to run the platform, including with:</p>
        <ul>
          <li><strong>Payment gateways</strong> (such as PayFast) — to process payments securely; we don't store your full card details ourselves.</li>
          <li><strong>Email and notification providers</strong> — to send account, request, and campaign notifications.</li>
          <li><strong>The other party to a campaign</strong> — a business and a publisher/creator can see the details relevant to a request they're both part of (such as contact and campaign details), so they can work together directly.</li>
          <li><strong>Regulators or authorities</strong> — where we're legally required to disclose information.</li>
        </ul>
        <p>
          Any third party we share information with is required to protect it to a standard consistent with POPIA and to use it only for the purpose we've shared it for.
        </p>
      </>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    body: (
      <>
        <p>Under POPIA, you have the right to:</p>
        <ul>
          <li>Ask us to confirm what personal information we hold about you, and request a copy of it.</li>
          <li>Ask us to correct or update personal information that's inaccurate, incomplete, or outdated.</li>
          <li>Ask us to delete personal information we no longer have a valid reason to keep.</li>
          <li>Object to processing carried out on the basis of legitimate interest, or withdraw consent where processing depends on it.</li>
          <li>Lodge a complaint with the Information Regulator if you believe we've handled your information incorrectly.</li>
        </ul>
        <p>
          Access and deletion are self-service — see "Manage your data" below. For correction of
          inaccurate details, objecting to processing, or anything the self-service tools don't
          cover, contact our Information Officer using the details below — we'll respond within a
          reasonable time and in line with POPIA's requirements.
        </p>
      </>
    ),
  },
  {
    id: "manage-your-data",
    title: "Manage your data",
    body: (
      <>
        <p>
          If you have a ChatSched account, <Link to="/account">Account Settings</Link> lets you handle
          the two most common requests yourself, immediately, without waiting on us:
        </p>
        <ul>
          <li><strong>Download everything we hold about you</strong> — a JSON file covering your profile and every request, payment, message, review, and other record tied to your account.</li>
          <li><strong>Delete your account permanently</strong> — removes your login and the personal data tied to it. If you have a campaign or dispute still in progress, we ask you to resolve it first, since deleting your account would also remove records the other party (a business or creator) may still need.</li>
        </ul>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies & similar technology",
    body: (
      <p>
        We use essential cookies and similar technologies to keep you logged in and the platform functioning correctly, and limited analytics to understand how the site is used so we can improve it. We don't use these technologies to build advertising profiles about you for third parties.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children's information",
    body: (
      <p>
        ChatSched is intended for use by businesses and publishers/creators operating as adults or registered entities. We don't knowingly collect personal information from children without the consent required under POPIA. If you believe a child has provided us with personal information, please contact us so we can address it.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        We may update this policy from time to time as the platform grows or regulations change. We'll update the "last updated" date above when we do, and where a change is significant, we'll take reasonable steps to let you know.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Information Officer & privacy support",
    body: (
      <>
        <p>
          For any question about this policy, or to exercise your rights under POPIA, contact our Information Officer:
        </p>
        <ul>
          <li>Email: <a href={`mailto:${INFO_OFFICER_EMAIL}`}>{INFO_OFFICER_EMAIL}</a></li>
          <li>General support: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></li>
          <li>You can also reach us through the <a href="/contact">Contact page</a>.</li>
        </ul>
        <p>
          If you're not satisfied with our response, you have the right to lodge a complaint with South Africa's Information Regulator (<a href="https://inforegulator.org.za" target="_blank" rel="noopener noreferrer">inforegulator.org.za</a>).
        </p>
      </>
    ),
  },
];

export default function Privacy() {
  return (
    <>
      <Seo title="Privacy Policy & POPIA Compliance · ChatSched" description="How ChatSched collects, uses, stores and protects personal information, in line with South Africa's Protection of Personal Information Act (POPIA)." />
      <LegalPageLayout
        eyebrow="Legal"
        title="Privacy Policy & POPIA Compliance"
        intro="How we collect, use, store and protect your personal information as a business, publisher or creator on ChatSched, in line with South Africa's Protection of Personal Information Act (POPIA)."
        lastUpdated="6 August 2026"
        sections={sections}
      />
    </>
  );
}
