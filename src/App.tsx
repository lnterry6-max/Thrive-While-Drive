import { useEffect } from "react";
import {
  NavLink,
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Compass,
  Map,
  Users,
  BarChart3,
  UserRound,
  ArrowUpRight,
} from "lucide-react";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import Community from "./pages/Community";
import Statistics from "./pages/Statistics";
import Profile, { PublicProfile } from "./Profile";
import Settings from "./pages/Settings";
import ResetPassword from "./pages/ResetPassword";
const tabs = [
  { path: "/", label: "Home", icon: Compass },
  { path: "/explore", label: "Explore", icon: Map },
  { path: "/community", label: "Community", icon: Users },
  { path: "/statistics", label: "Stats", icon: BarChart3 },
  { path: "/profile", label: "Profile", icon: UserRound },
];
function Shell() {
  const { session, recovery } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (recovery && location.pathname !== "/reset-password")
      navigate("/reset-password", { replace: true });
  }, [recovery, location.pathname, navigate]);
  useEffect(() => {
    window.scrollTo?.(0, 0);
    document.title = `${location.pathname === "/explore" ? "Plan a drive" : location.pathname === "/profile" ? "Your profile" : location.pathname === "/settings" ? "Account settings" : "Explore at your own pace"} · Thrive While You Drive`;
  }, [location.pathname]);
  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="topbar">
        <Link className="brand" to="/" aria-label="Thrive While You Drive home">
          <span className="brand-mark">
            <Compass size={25} />
          </span>
          <span>
            thrive<span className="brand-subtitle">WHILE YOU DRIVE</span>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          {tabs.slice(0, 4).map(({ path, label }) => (
            <NavLink end={path === "/"} key={path} to={path}>
              {label === "Stats" ? "Your journey" : label}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          <span className="beta">BETA 0.3</span>
          <Link className="account-link" to="/profile">
            <UserRound size={18} />
            <span>{session ? "My profile" : "Join the journey"}</span>
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/community" element={<Community />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/people/:username" element={<PublicProfile />} />
          <Route
            path="/credits"
            element={
              <section className="narrow stack">
                <span className="eyebrow">REAL PLACES. REAL PHOTOGRAPHY.</span>
                <h1>Behind the scenery.</h1>
                <p>
                  Our scenic-road photograph is “The Road To Heaven” by{" "}
                  <a href="https://unsplash.com/@davidmoum">David Moum</a>,
                  photographed in Rocky Mountain National Park, United States.
                </p>
                <p>
                  Used under the{" "}
                  <a href="https://unsplash.com/license">Unsplash License</a>.
                  Local copies have been resized and converted to WebP.{" "}
                  <a href="https://unsplash.com/photos/foggy-empty-winding-road-FI8aV6rbwZk">
                    View the original photograph.
                  </a>
                </p>
                <p>
                  Scenery is inspiration, not a route recommendation. No
                  AI-generated images are used.
                </p>
                <Link to="/">Back to Thrive</Link>
              </section>
            }
          />
          <Route
            path="*"
            element={
              <section className="narrow stack">
                <span className="eyebrow">A SMALL DETOUR</span>
                <h1>This road isn’t on our map.</h1>
                <p>The page you’re looking for isn’t here.</p>
                <Link className="button primary" to="/">
                  Find your way home
                </Link>
              </section>
            }
          />
        </Routes>
      </main>
      <footer className="footer">
        <Link className="footer-brand" to="/">
          thrive <span>Less rush. More wonder.</span>
        </Link>
        <Link to="/credits">Photography & credits</Link>
        <span>Made for the journey.</span>
      </footer>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {tabs.map(({ path, label, icon: Icon }) => (
          <NavLink end={path === "/"} key={path} to={path}>
            <Icon size={21} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
