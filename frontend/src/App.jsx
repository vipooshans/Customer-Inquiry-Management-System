import { Routes, Route, Navigate } from 'react-router-dom';
import RequireAuth from './auth/RequireAuth.jsx';
import AppLayout from './components/AppLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import InquiryListPage from './pages/InquiryListPage.jsx';
import NewInquiryPage from './pages/NewInquiryPage.jsx';
import InquiryDetailPage from './pages/InquiryDetailPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Everything below needs a signed-in user. */}
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/inquiries" element={<InquiryListPage />} />
        <Route path="/inquiries/new" element={<NewInquiryPage />} />
        <Route path="/inquiries/:id" element={<InquiryDetailPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/inquiries" replace />} />
    </Routes>
  );
}
