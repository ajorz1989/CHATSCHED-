import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { ComparisonProvider } from "./contexts/ComparisonContext";
import { SavedListsProvider } from "./contexts/SavedListsContext";
import { CookieConsentProvider } from "./contexts/CookieConsentContext";
import RequireAuth from "./components/RequireAuth";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import Footer from "./components/Footer";
import ErrorBoundary from "./components/ErrorBoundary";
import AnalyticsListener from "./components/AnalyticsListener";
import CookieConsentBanner from "./components/CookieConsentBanner";
import CookieConsentScript from "./components/CookieConsentScript";
import { SkeletonBlock } from "./components/Skeleton";
import Home from "./pages/Home";
import Browse from "./pages/Browse";
import PublisherProfile from "./pages/PublisherProfile";
import BackToTop from "./components/BackToTop";

// Everything below is lazy-loaded. Same reasoning as the original MapView
// case (kept below, with its own nested Suspense for a page-shaped
// fallback), just applied across the board now that the app has grown to
// 40+ pages: no visitor needs the Admin panel's bundle (which pulls in
// AdminAnalytics/AdminChannelRequests/AdminPayouts/AdminSecurity along
// with it, since those are imported inside Admin.tsx, not routed here
// directly), the Marketing Suite's bundle, or the MFA/auth flow's bundle
// just to load Home. Home/Browse/PublisherProfile stay eager because
// they're the most common first-paint targets — a fresh visit from
// search, social, or a shared link — where an extra chunk fetch before
// anything renders would cost more than it saves.
const ComparePublishers = lazy(() => import("./pages/ComparePublishers"));
const SavedLists = lazy(() => import("./pages/SavedLists"));
const Categories = lazy(() => import("./pages/Categories"));
const Suburbs = lazy(() => import("./pages/Suburbs"));
const AudienceFinder = lazy(() => import("./pages/AudienceFinder"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Fees = lazy(() => import("./pages/Fees"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const HowPaymentWorks = lazy(() => import("./pages/HowPaymentWorks"));
const ForBusinesses = lazy(() => import("./pages/ForBusinesses"));
const BuildMyCampaign = lazy(() => import("./pages/BuildMyCampaign"));
const ForPublishers = lazy(() => import("./pages/ForPublishers"));
const CaseStudies = lazy(() => import("./pages/CaseStudies"));
const TrustCentre = lazy(() => import("./pages/TrustCentre"));
const Faq = lazy(() => import("./pages/Faq"));
const Compliance = lazy(() => import("./pages/Compliance"));
const PlatformRules = lazy(() => import("./pages/PlatformRules"));
const CreatorStandards = lazy(() => import("./pages/CreatorStandards"));
const BusinessStandards = lazy(() => import("./pages/BusinessStandards"));
const FraudPrevention = lazy(() => import("./pages/FraudPrevention"));
const Safety = lazy(() => import("./pages/Safety"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const BusinessSuccess = lazy(() => import("./pages/BusinessSuccess"));
const BusinessSuccessArticle = lazy(() => import("./pages/BusinessSuccessArticle"));
const PublisherSuccess = lazy(() => import("./pages/PublisherSuccess"));
const PublisherSuccessArticle = lazy(() => import("./pages/PublisherSuccessArticle"));
const Transparency = lazy(() => import("./pages/Transparency"));
// Advertise + Investors merged into CollaborateWithUs — old URLs redirect below
const CollaborateWithUs = lazy(() => import("./pages/CollaborateWithUs"));
const Security = lazy(() => import("./pages/Security"));
const Help = lazy(() => import("./pages/Help"));
const Accessibility = lazy(() => import("./pages/Accessibility"));
const Glossary = lazy(() => import("./pages/Glossary"));
const BudgetCalculator = lazy(() => import("./pages/BudgetCalculator"));
const EarningsEstimator = lazy(() => import("./pages/EarningsEstimator"));
const ReachChecker = lazy(() => import("./pages/ReachChecker"));
const ChannelQuiz = lazy(() => import("./pages/ChannelQuiz"));
const Community = lazy(() => import("./pages/Community"));
const CommunityQa = lazy(() => import("./pages/CommunityQa"));
const CommunityAnnouncements = lazy(() => import("./pages/CommunityAnnouncements"));
const CommunityEvents = lazy(() => import("./pages/CommunityEvents"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const MfaSetup = lazy(() => import("./pages/MfaSetup"));
const MfaVerify = lazy(() => import("./pages/MfaVerify"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
// Unlisted — not linked from Header/Footer, only reached via
// ActivationNudge on the dashboard or a direct link.
const ActivationFeeInfo = lazy(() => import("./pages/ActivationFeeInfo"));
const PublisherApply = lazy(() => import("./pages/PublisherApply"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Messages = lazy(() => import("./pages/Messages"));
const EarningsDashboard = lazy(() => import("./pages/EarningsDashboard"));
const BusinessPublisherRelationships = lazy(() => import("./pages/BusinessPublisherRelationships"));
const PublisherRelationships = lazy(() => import("./pages/PublisherRelationships"));
const BusinessOpportunities = lazy(() => import("./pages/BusinessOpportunities"));
const OpportunityFeed = lazy(() => import("./pages/OpportunityFeed"));
const OpportunityGate = lazy(() => import("./pages/OpportunityGate"));
const OpportunityPreview = lazy(() => import("./pages/OpportunityPreview"));
const Admin = lazy(() => import("./pages/Admin"));
const PaymentResult = lazy(() => import("./pages/PaymentResult"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ChannelHub = lazy(() => import("./pages/ChannelHub"));
// Channel Comparison Hub — /channels/compare. Declared before /channels/:slug
// below so "compare" is never swallowed by the :slug param.
const ChannelComparison = lazy(() => import("./pages/ChannelComparison"));
const MediaNetwork = lazy(() => import("./pages/MediaNetwork"));
const ChannelPage = lazy(() => import("./pages/ChannelPage"));
const TrackRedirect = lazy(() => import("./pages/TrackRedirect"));
const MediaKit = lazy(() => import("./pages/MediaKit"));
const SavedSearches = lazy(() => import("./pages/SavedSearches"));
const CampaignCompliance = lazy(() => import("./pages/CampaignCompliance"));
const CampaignWorkspace = lazy(() => import("./pages/CampaignWorkspace"));
const Careers = lazy(() => import("./pages/Careers"));
const AdminCareers = lazy(() => import("./pages/AdminCareers"));
const AdminTools = lazy(() => import("./pages/AdminTools"));
const AdminVisualIdentity = lazy(() => import("./pages/AdminVisualIdentity"));
const Tools = lazy(() => import("./pages/Tools"));
const ToolDetail = lazy(() => import("./pages/ToolDetail"));
// WorkWithUs merged into Careers — /work-with-us redirects below
const Partners = lazy(() => import("./pages/Partners"));
const PartnersApply = lazy(() => import("./pages/PartnersApply"));

// react-leaflet + leaflet pull in a real chunk of JS+CSS for a map only a
// fraction of visitors will open — kept as its own case (rather than
// folding into the block above) because it gets a tailored, map-shaped
// Suspense fallback below instead of the generic one.
const MapView = lazy(() => import("./pages/MapView"));

function RoutedContent() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="animate-[page-fade-in_150ms_ease-out]">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/map" element={
          <Suspense fallback={<div className="max-w-6xl mx-auto px-5 py-16"><SkeletonBlock className="h-[480px]" /></div>}>
            <MapView />
          </Suspense>
        } />
        <Route path="/browse/:id" element={<PublisherProfile />} />
        {/* Browse and Search merged into one page — old links still resolve */}
        <Route path="/search" element={<Navigate to="/browse" replace />} />
        <Route path="/compare" element={<ComparePublishers />} />
        <Route path="/lists" element={<SavedLists />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/suburbs" element={<Suburbs />} />
        <Route path="/audience-finder" element={<AudienceFinder />} />
        {/* "AI Match" tab renamed to Audience Finder — old links still resolve */}
        <Route path="/match" element={<Navigate to="/audience-finder" replace />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/fees" element={<Fees />} />
        <Route path="/fees/calculator" element={<Navigate to="/fees" replace />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/how-payment-works" element={<HowPaymentWorks />} />
        <Route path="/for-businesses" element={<ForBusinesses />} />
        <Route path="/build-my-campaign" element={<BuildMyCampaign />} />
        <Route path="/for-publishers" element={<ForPublishers />} />
        <Route path="/case-studies" element={<CaseStudies />} />
        <Route path="/trust" element={<TrustCentre />} />
        <Route path="/faq" element={<Faq />} />
        <Route path="/trust/creator-standards" element={<CreatorStandards />} />
        <Route path="/trust/business-standards" element={<BusinessStandards />} />
        <Route path="/trust/safety" element={<Safety />} />
        <Route path="/trust/fraud-prevention" element={<FraudPrevention />} />
        {/* verification/disputes already live in depth on /trust itself (see TrustCentre.tsx's
            id="verification"/id="disputes" section anchors) — redirect rather than duplicate. */}
        <Route path="/trust/verification" element={<Navigate to="/trust#verification" replace />} />
        <Route path="/trust/disputes" element={<Navigate to="/trust#disputes" replace />} />
        {/* payments and platform-compliance already have their own full pages — same reasoning. */}
        <Route path="/trust/payments" element={<Navigate to="/how-payment-works" replace />} />
        <Route path="/trust/platform-compliance" element={<Navigate to="/compliance" replace />} />
        <Route path="/compliance" element={<Compliance />} />
        <Route path="/platform-rules" element={<PlatformRules />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/business-success" element={<BusinessSuccess />} />
        <Route path="/business-success/:slug" element={<BusinessSuccessArticle />} />
        <Route path="/publisher-success" element={<PublisherSuccess />} />
        <Route path="/publisher-success/:slug" element={<PublisherSuccessArticle />} />
        <Route path="/transparency" element={<Transparency />} />
        {/* Advertise + Investors merged — old URLs redirect to the unified page */}
        <Route path="/collaborate" element={<CollaborateWithUs />} />
        <Route path="/advertise" element={<Navigate to="/collaborate" replace />} />
        <Route path="/investors" element={<Navigate to="/collaborate" replace />} />
        <Route path="/security" element={<Security />} />
        <Route path="/help" element={<Help />} />
        <Route path="/accessibility" element={<Accessibility />} />
        <Route path="/glossary" element={<Glossary />} />
        <Route path="/budget-calculator" element={<BudgetCalculator />} />
        <Route path="/earnings-estimator" element={<EarningsEstimator />} />
        <Route path="/reach-checker" element={<ReachChecker />} />
        <Route path="/channel-quiz" element={<ChannelQuiz />} />
        <Route path="/community" element={<Community />} />
        <Route path="/community/qa" element={<CommunityQa />} />
        <Route path="/community/announcements" element={<CommunityAnnouncements />} />
        <Route path="/community/events" element={<CommunityEvents />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/mfa-setup" element={<MfaSetup />} />
        <Route path="/mfa-verify" element={<MfaVerify />} />
        <Route path="/account" element={<AccountSettings />} />
        <Route path="/activation-fee-info" element={<RequireAuth role="business"><ActivationFeeInfo /></RequireAuth>} />
        <Route path="/apply" element={<RequireAuth role="publisher"><PublisherApply /></RequireAuth>} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/messages" element={<RequireAuth><Messages /></RequireAuth>} />
        <Route path="/dashboard/earnings" element={<RequireAuth role="publisher"><EarningsDashboard /></RequireAuth>} />
        <Route path="/business/publishers" element={<RequireAuth role="business"><BusinessPublisherRelationships /></RequireAuth>} />
        <Route path="/publisher/relationships" element={<RequireAuth role="publisher"><PublisherRelationships /></RequireAuth>} />
        <Route path="/opportunities" element={<OpportunityGate business={<BusinessOpportunities />} publisher={<OpportunityFeed />} />} />
        <Route path="/opportunities/preview" element={<OpportunityPreview />} />
        <Route path="/business/opportunities" element={<Navigate to="/opportunities" replace />} />
        <Route path="/publisher/opportunities" element={<Navigate to="/opportunities" replace />} />
        <Route path="/admin" element={<RequireAuth role="admin"><Admin /></RequireAuth>} />
        <Route path="/payment/return" element={<RequireAuth><PaymentResult status="return" /></RequireAuth>} />
        <Route path="/payment/cancel" element={<RequireAuth><PaymentResult status="cancel" /></RequireAuth>} />
        <Route path="/channels" element={<ChannelHub />} />
        <Route path="/channels/compare" element={<ChannelComparison />} />
        <Route path="/network" element={<MediaNetwork />} />
        <Route path="/channels/:slug" element={<ChannelPage />} />
        <Route path="/t/:slug" element={<TrackRedirect />} />
        <Route path="/media-kit" element={<MediaKit />} />
        <Route path="/saved-searches" element={<SavedSearches />} />
        <Route path="/campaigns/:id/compliance" element={<RequireAuth><CampaignCompliance /></RequireAuth>} />
        <Route path="/campaigns/:id" element={<RequireAuth><CampaignWorkspace /></RequireAuth>} />
        <Route path="/careers" element={<Careers />} />
        {/* WorkWithUs merged into Careers — redirect so old links and bookmarks still work */}
        <Route path="/work-with-us" element={<Navigate to="/careers" replace />} />
        <Route path="/admin/careers" element={<RequireAuth role="admin"><AdminCareers /></RequireAuth>} />
        <Route path="/admin/tools" element={<RequireAuth role="admin"><AdminTools /></RequireAuth>} />
        <Route path="/admin/visual-identity" element={<RequireAuth role="admin"><AdminVisualIdentity /></RequireAuth>} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/tools/:slug" element={<ToolDetail />} />
        <Route path="/partners" element={<Partners />} />
        <Route path="/partners/apply" element={<PartnersApply />} />
        {/* Mission + Roadmap merged into About — old URLs redirect to the
            matching section anchors so bookmarks and any inbound links survive. */}
        <Route path="/mission" element={<Navigate to="/about#mission" replace />} />
        <Route path="/roadmap" element={<Navigate to="/about#roadmap" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ComparisonProvider>
          <SavedListsProvider>
            <CookieConsentProvider>
              <div className="min-h-screen flex flex-col">
                <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:bg-billboard-ink focus:text-billboard-paper focus:font-semibold focus:rounded focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-billboard-green">
                  Skip to main content
                </a>
                <AnalyticsListener />
                <CookieConsentScript />
                <Header />
                <main id="main-content" tabIndex={-1} className="flex-1 pb-bottom-nav outline-none">
                  <ErrorBoundary>
                    <Suspense fallback={<div className="max-w-6xl mx-auto px-5 py-16"><SkeletonBlock className="h-96" /></div>}>
                      <RoutedContent />
                    </Suspense>
                  </ErrorBoundary>
                </main>
                <Footer />
                <BottomNav />
                <BackToTop />
                <CookieConsentBanner />
              </div>
            </CookieConsentProvider>
          </SavedListsProvider>
        </ComparisonProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
