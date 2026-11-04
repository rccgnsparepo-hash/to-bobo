import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/AppShell";
import { PageTransition } from "@/components/PageTransition";

const WorldPage = lazy(() => import("@/pages/WorldPage"));
const ExplorePage = lazy(() => import("@/pages/Explore"));
const PrivacyCenterPage = lazy(() => import("@/pages/PrivacyCenter"));
const BookmarksPage = lazy(() => import("@/pages/Bookmarks"));
const AdminModerationPage = lazy(() => import("@/pages/AdminModerationPage"));
import HomePage from "@/pages/Home";
import CameraPage from "@/pages/Camera";
import MessagesPage from "@/pages/Messages";
import ThreadPage from "@/pages/Thread";
import ProfilePage from "@/pages/Profile";
import StoryComposerPage from "@/pages/StoryComposer";
import ChallengesPage from "@/pages/Challenges";
import SpacePage from "@/pages/Space";
import FlickGamesPage from "@/pages/FlickGames";
import AuthPage from "@/pages/Auth";
import OAuthConsentPage from "@/pages/OAuthConsent";
import IntroPage from "@/pages/Intro";
import NotFound from "@/pages/NotFound";
import NewsPage from "@/pages/News";
import NewsReaderPage from "@/pages/NewsReader";
import UserProfilePage from "@/pages/UserProfile";
import VerificationPage from "@/pages/Verification";
import CreatorInsightsPage from "@/pages/CreatorInsights";
import PostDetailPage from "@/pages/PostDetail";
import { ScrollToTop } from "@/components/ScrollToTop";

import { SystemLifeCycle } from "@/components/SystemLifeCycle";

import { Auth3DToastProvider } from "@/components/ui/Auth3DToast";
import { TenantProvider } from "@/lib/tenantContext";
import { NotchNotification } from "@/components/notifications/NotchNotification";
import { InteractiveMorphToast } from "@/components/ui/InteractiveMorphToast";
import { DuelChallengeReceiver } from "@/components/duel/DuelChallengeReceiver";
import { NotificationSoundPrompt } from "@/components/notifications/NotificationSoundPrompt";
import { GlobalIncomingCallOverlay } from "@/components/chat/GlobalIncomingCallOverlay";

const queryClient = new QueryClient();

function IntroGate() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (checked) return;
    const seen = sessionStorage.getItem("flick:intro");
    if (!seen && pathname !== "/intro" && !pathname.startsWith("/.lovable/")) {
      sessionStorage.setItem("flick:intro", "1");
      nav("/intro", { replace: true });
    }
    setChecked(true);
  }, [checked, pathname, nav]);
  return null;
}

function Protected({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">…</div>
    );
  }
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route
          path="/intro"
          element={
            <PageTransition>
              <IntroPage />
            </PageTransition>
          }
        />
        <Route
          path="/auth"
          element={
            <PageTransition>
              <AuthPage />
            </PageTransition>
          }
        />
        <Route path="/.lovable/oauth/consent" element={<OAuthConsentPage />} />
        <Route
          element={
            <Protected>
              <AppShell />
            </Protected>
          }
        >
          <Route
            path="/"
            element={
              <PageTransition>
                <HomePage />
              </PageTransition>
            }
          />
          <Route
            path="/camera"
            element={
              <PageTransition>
                <CameraPage />
              </PageTransition>
            }
          />
          <Route
            path="/stories/new"
            element={
              <PageTransition>
                <StoryComposerPage />
              </PageTransition>
            }
          />
          <Route
            path="/messages"
            element={
              <PageTransition>
                <MessagesPage />
              </PageTransition>
            }
          >
            <Route path=":userId" element={<ThreadPage />} />
          </Route>
          <Route
            path="/profile"
            element={
              <PageTransition>
                <ProfilePage />
              </PageTransition>
            }
          />
          <Route
            path="/verification"
            element={
              <PageTransition>
                <VerificationPage />
              </PageTransition>
            }
          />
          <Route
            path="/creator-insights"
            element={
              <PageTransition>
                <CreatorInsightsPage />
              </PageTransition>
            }
          />
          <Route path="/insights" element={<Navigate to="/creator-insights" replace />} />
          <Route
            path="/challenges"
            element={
              <PageTransition>
                <ChallengesPage />
              </PageTransition>
            }
          />
          <Route
            path="/explore"
            element={
              <Suspense fallback={<div className="min-h-screen bg-background" />}>
                <PageTransition>
                  <ExplorePage />
                </PageTransition>
              </Suspense>
            }
          />
          <Route
            path="/settings/privacy"
            element={
              <Suspense fallback={<div className="min-h-screen bg-background" />}>
                <PageTransition>
                  <PrivacyCenterPage />
                </PageTransition>
              </Suspense>
            }
          />
          <Route path="/privacy" element={<Navigate to="/settings/privacy" replace />} />
          <Route
            path="/bookmarks"
            element={
              <Suspense fallback={<div className="min-h-screen bg-background" />}>
                <PageTransition>
                  <BookmarksPage />
                </PageTransition>
              </Suspense>
            }
          />
          <Route
            path="/admin/moderation"
            element={
              <Suspense fallback={<div className="min-h-screen bg-background" />}>
                <PageTransition>
                  <AdminModerationPage />
                </PageTransition>
              </Suspense>
            }
          />
          <Route path="/me" element={<Navigate to="/profile" replace />} />
          <Route path="/news" element={<Navigate to="/?tab=following" replace />} />
          <Route
            path="/news/read"
            element={
              <PageTransition>
                <NewsReaderPage />
              </PageTransition>
            }
          />
          <Route
            path="/u/:handle"
            element={
              <PageTransition>
                <UserProfilePage />
              </PageTransition>
            }
          />
          <Route
            path="/space"
            element={
              <PageTransition>
                <SpacePage />
              </PageTransition>
            }
          />
          <Route path="/world" element={<Navigate to="/explore" replace />} />
          <Route path="/class" element={<Navigate to="/explore" replace />} />
          <Route path="/class/:roomId" element={<Navigate to="/explore" replace />} />
          <Route path="/classes" element={<Navigate to="/explore" replace />} />
          <Route path="/live" element={<Navigate to="/space?tab=live" replace />} />
          <Route path="/go-live" element={<Navigate to="/space?tab=live" replace />} />
          <Route path="/rooms" element={<Navigate to="/space?tab=rooms" replace />} />
          <Route path="/calls" element={<Navigate to="/space?tab=calls" replace />} />
          <Route path="/prep" element={<Navigate to="/space?tab=prep" replace />} />
          <Route path="/fashion" element={<Navigate to="/space" replace />} />
          <Route path="/wallpapers" element={<Navigate to="/space" replace />} />
          <Route
            path="/games"
            element={
              <PageTransition>
                <FlickGamesPage />
              </PageTransition>
            }
          />
          <Route path="/comics" element={<Navigate to="/wallpapers" replace />} />
          <Route path="/comics/:id" element={<Navigate to="/wallpapers" replace />} />
          <Route
            path="/post/:id"
            element={
              <PageTransition>
                <PostDetailPage />
              </PageTransition>
            }
          />
          <Route
            path="/flick/:id"
            element={
              <PageTransition>
                <PostDetailPage />
              </PageTransition>
            }
          />
        </Route>
        <Route
          path="*"
          element={
            <PageTransition>
              <NotFound />
            </PageTransition>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Auth3DToastProvider>
            <TenantProvider>
              <IntroGate />
              <ScrollToTop />
              <SystemLifeCycle />
              <NotchNotification />
              <InteractiveMorphToast />
              <DuelChallengeReceiver />
              <NotificationSoundPrompt />
              <GlobalIncomingCallOverlay />
              <AnimatedRoutes />
              <Toaster theme="dark" />
            </TenantProvider>
          </Auth3DToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
