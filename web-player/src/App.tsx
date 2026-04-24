import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import HomePage from "./pages/HomePage";
import SearchPage from "./pages/SearchPage";
import WatchPage from "./pages/WatchPage";

function AppNav() {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const isSearch = location.pathname.startsWith("/search");

  return (
    <header className="atv-nav">
      <div className="atv-nav-inner">
        <Link className="atv-brand" to="/">
          <span className="atv-brand-mark" />
          <span className="atv-brand-text">YQK</span>
        </Link>
        <nav className="atv-nav-links">
          <Link className={isHome ? "active" : ""} to="/">
            首页
          </Link>
          <Link className={isSearch ? "active" : ""} to="/search">
            搜索
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="atv-shell">
      <AppNav />
      <main className="atv-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/watch/:vodId" element={<WatchPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
