import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components.jsx";
import { Home, Build, Tests, TestDetail, CaseStudy, Evidence } from "./pages.jsx";

// HashRouter so the static build works on any host (GitHub Pages, Netlify, S3) without rewrite rules.
export default function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/architecture" element={<Navigate to="/" replace />} />
          <Route path="/build" element={<Build />} />
          <Route path="/tests" element={<Tests />} />
          <Route path="/tests/:slug" element={<TestDetail />} />
          <Route path="/case-study" element={<CaseStudy />} />
          <Route path="/blockers" element={<Navigate to="/build" replace />} />
          <Route path="/evidence" element={<Evidence />} />
          <Route path="/code" element={<Navigate to="/build" replace />} />
          <Route path="/debugging" element={<Navigate to="/build" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
