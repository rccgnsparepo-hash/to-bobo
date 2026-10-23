import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/AppShell";
import HomePage from "@/pages/Home";
import CameraPage from "@/pages/Camera";
import MessagesPage from "@/pages/Messages";
import ThreadPage from "@/pages/Thread";
import ProfilePage from "@/pages/Profile";
import StoryComposerPage from "@/pages/StoryComposer";
import ChallengesPage from "@/pages/Challenges";
import ComicsPage from "@/pages/Comics";
import ComicReaderPage from "@/pages/ComicReader";
import AuthPage from "@/pages/Auth";
import OAuthConsentPage from "@/pages/OAuthConsent";
import IntroPage from "@/pages/Intro";
import NotFound from "@/pages/NotFound";
import NewsPage from "@/pages/News";
import NewsReaderPage from "@/pages/NewsReader";
import UserProfilePage from "@/pages/UserProfile";
import VerificationPage from "@/pages/Verification";
import CreatorInsightsPage from "@/pages/CreatorInsights";
import { ScrollToTop } from "@/components/ScrollToTop";

import { SystemLifeCycle } from "@/components/SystemLifeCycle";

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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <IntroGate />
          <ScrollToTop />
          <SystemLifeCycle />
          <Routes>
            <Route path="/intro" element={<IntroPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsentPage />} />
            <Route
              element={
                <Protected>
                  <AppShell />
                </Protected>
              }
            >
              <Route path="/" element={<HomePage />} />
              <Route path="/camera" element={<CameraPage />} />
              <Route path="/stories/new" element={<StoryComposerPage />} />
              <Route path="/messages" element={<MessagesPage />}>
                <Route path=":userId" element={<ThreadPage />} />
              </Route>
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/verification" element={<VerificationPage />} />
              <Route path="/creator-insights" element={<CreatorInsightsPage />} />
              <Route path="/insights" element={<Navigate to="/creator-insights" replace />} />
              <Route path="/challenges" element={<ChallengesPage />} />
              <Route path="/news" element={<NewsPage />} />
              <Route path="/news/read" element={<NewsReaderPage />} />
              <Route path="/u/:handle" element={<UserProfilePage />} />
              <Route path="/comics" element={<ComicsPage />} />
              <Route path="/comics/:id" element={<ComicReaderPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster theme="dark" />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
