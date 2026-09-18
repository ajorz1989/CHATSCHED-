import Seo from "../components/Seo";
import LegalPageLayout, { type LegalSection } from "../components/LegalPageLayout";
import { CONTACT_EMAIL, PLATFORM_COMMISSION_RATE, CREATOR_APPROVAL_WINDOW_DAYS, BUSINESS_PAYMENT_WINDOW_DAYS, CREATOR_PAYOUT_WINDOW_HOURS } from "../lib/constants";

const commissionPct = Math.round(PLATFORM_COMMISSION_RATE * 100);

const sections: LegalSection[] = [
  {
    id: "acceptance",
    title: "Acceptance of these terms",
    body: (
      <p>
        These Terms & Conditions govern your use of ChatSched, whether you're registering as a Business/Advertiser or as a Publisher/Creator. By creating an account or using the platform, you agree to these terms. If you don't agree with them, please don't use the platform.
      </p>
    ),
  },
  {
    id: "platform-role",
    title: "Our role — platform, not party to your deal",
    body: (
      <>
        <p>
          ChatSched is a marketplace that connects Businesses with Publishers/Creators, and provides the tools to submit requests, approve or decline them, schedule placements, and process payment between the two parties. We are not a party to the advertising arrangement itself — the content, quality, and delivery of a campaign is agreed by the Business and Publisher/Creator within the applicable campaign arrangement and platform workflow.
        </p>
        <p>
          We don't guarantee outcomes such as sales, engagement, or audience response from any campaign. We do our best to verify publishers before they're listed, but we can't guarantee the accuracy of every follower count, reach figure, or audience claim a creator provides.
        </p>
      </>
    ),
  },
  {
    id: "publisher-status",
    title: "Publisher/Creator status",
    body: (
      <p>
        Publishers and Creators use ChatSched as independent businesses or independent service providers. Nothing in these Terms creates an employment relationship, agency relationship, partnership, joint venture, or authority for a Publisher/Creator to act on ChatSched's behalf. Publishers/Creators are responsible for their own taxes, registrations, equipment, insurance, working methods, and legal obligations. The actual nature of any relationship is determined by applicable law and the facts of the relationship.
      </p>
    ),
  },
  {
    id: "accounts",
    title: "Account registration & responsibilities",
    body: (
      <>
        <p>When you register, you agree to:</p>
        <ul>
          <li>Provide accurate, current information about yourself or your business/channel, and keep it up to date.</li>
          <li>Keep your login credentials confidential and be responsible for activity under your account.</li>
          <li>Only register on behalf of a business or channel you're authorised to represent.</li>
          <li>Notify us promptly if you believe your account has been compromised.</li>
        </ul>
        <p>
          We may suspend or terminate an account that provides false information, breaches these terms, or is used for fraudulent or abusive purposes.
        </p>
      </>
    ),
  },
  {
    id: "content-standards",
    title: "Content standards",
    body: (
      <>
        <p>All campaigns, promotions, and listings on the platform must comply with South African law and the following standards. You may not use ChatSched to promote or feature:</p>
        <ul>
          <li>Illegal products, services, or activities.</li>
          <li>Hate speech, harassment, or discriminatory content.</li>
          <li>Sexually explicit or exploitative content.</li>
          <li>Misleading, fraudulent, or deceptive claims.</li>
          <li>Content that infringes someone else's intellectual property or privacy rights.</li>
          <li>Anything that violates the advertising standards or codes applicable in South Africa.</li>
        </ul>
        <p>
          We reserve the right to decline, remove, or suspend a listing or campaign request that breaches these standards, and to suspend the account responsible.
        </p>
      </>
    ),
  },
  {
    id: "how-it-works",
    title: "How requests, approval & scheduling work",
    body: (
      <>
        <p>
          Businesses submit a feature request to a Publisher/Creator describing what they'd like promoted. The Publisher/Creator has {CREATOR_APPROVAL_WINDOW_DAYS} days to approve or decline the request — unanswered requests simply expire. Once approved, the Publisher/Creator schedules and carries out the placement, and marks it live once it's done.
        </p>
        <p>
          Either party may decline a request they're not comfortable with, for any legitimate reason, before it's approved.
        </p>
      </>
    ),
  },
  {
    id: "fees-payments",
    title: "Platform fees, payments & payouts",
    body: (
      <>
        <p>Our financial model works as follows:</p>
        <ul>
          <li><strong>Platform commission:</strong> ChatSched charges a {commissionPct}% commission on the value of each completed campaign. The Publisher/Creator receives the remaining {100 - commissionPct}%.</li>
          <li><strong>Business payment timing:</strong> once a Publisher/Creator approves a request, the Business has {BUSINESS_PAYMENT_WINDOW_DAYS} days to pay the platform directly. Nothing goes live until that payment is confirmed.</li>
          <li><strong>Creator payout timing:</strong> once a placement is confirmed live, the Publisher/Creator is paid out within {CREATOR_PAYOUT_WINDOW_HOURS} hours.</li>
          <li>All fees and figures are shown in South African Rand (ZAR) and may be updated from time to time — the current figures always apply at the time a request is submitted.</li>
        </ul>
        <p>
          Payment processing for online transactions is handled by a third-party payment gateway (such as PayFast); we don't store your full card details.
        </p>
      </>
    ),
  },
  {
    id: "content-ip",
    title: "Content ownership & licence",
    body: (
      <p>
        You retain ownership of the original content, creative assets, profile material, photographs, trademarks, and other intellectual property you upload to ChatSched, subject to rights belonging to third parties. By uploading or publishing material through the platform, you grant ChatSched a non-exclusive, worldwide, royalty-free licence to host, store, reproduce, display, format, and otherwise use that material as reasonably necessary to operate, promote, and improve the marketplace, including displaying publisher profiles, campaign listings, portfolios, and media kits. You confirm that you have the rights and permissions needed to grant this licence. The licence ends for material when it is removed from the platform, except to the extent retention is required for legal, security, dispute, accounting, or backup purposes.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <>
        <p>
          To the maximum extent permitted by law, ChatSched is not liable for any indirect, incidental, or consequential loss arising from your use of the platform, including loss of revenue, business, or goodwill resulting from a campaign's performance or a dispute between a Business and a Publisher/Creator.
        </p>
        <p>
          Nothing in these terms limits any liability that cannot lawfully be limited or excluded under South African law, including the Consumer Protection Act where it applies.
        </p>
      </>
    ),
  },
  {
    id: "disputes",
    title: "Disputes between users",
    body: (
      <>
        <p>
          If a disagreement arises between a Business and a Publisher/Creator about a campaign, both parties should first try to resolve it directly through the applicable ChatSched campaign communication tools. If that doesn't work, either party can contact us to help mediate, though we're not obligated to make a binding decision in every case.
        </p>
        <p>
          Disputes about these Terms themselves are governed by South African law, and the courts of South Africa have jurisdiction over them.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        We may update these Terms from time to time as the platform evolves. Continuing to use ChatSched after an update means you accept the revised terms. We'll update the "last updated" date whenever changes are made.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact us",
    body: (
      <p>
        Questions about these Terms can be sent to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>, or via the <a href="/contact">Contact page</a>. For questions about how we handle personal information specifically, see our <a href="/privacy">Privacy Policy & POPIA Compliance</a> page.
      </p>
    ),
  },
];

export default function Terms() {
  return (
    <>
      <Seo title="Terms & Conditions · ChatSched" description="The terms governing use of the ChatSched marketplace by Businesses/Advertisers and Publishers/Creators, including fees, payment timing, content standards and dispute resolution." />
      <LegalPageLayout
        eyebrow="Legal"
        title="Terms & Conditions"
        intro="The terms governing use of the ChatSched marketplace by Businesses/Advertisers and Publishers/Creators."
        lastUpdated="17 September 2026"
        sections={sections}
      />
    </>
  );
}
