import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import InquiryListPage from './pages/InquiryListPage.jsx';
import NewInquiryPage from './pages/NewInquiryPage.jsx';
import InquiryDetailPage from './pages/InquiryDetailPage.jsx';

// TODO: wrap the /inquiries routes in a <RequireAuth> component that loads
// /api/auth/me and redirects to /login on 401 (PLAN.md "Frontend screens").
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/inquiries" element={<InquiryListPage />} />
      <Route path="/inquiries/new" element={<NewInquiryPage />} />
      <Route path="/inquiries/:id" element={<InquiryDetailPage />} />
      <Route path="*" element={<Navigate to="/inquiries" replace />} />
    </Routes>
  );
}
