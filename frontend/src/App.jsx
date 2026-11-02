import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/common/ErrorBoundary';

// Public Unauthenticated Pages
import PublicHomePage from './pages/public/PublicHomePage';
import PublicClubsListPage from './pages/public/PublicClubsListPage';
import PublicClubDetailPage from './pages/public/PublicClubDetailPage';
import PublicEventDetailPage from './pages/public/PublicEventDetailPage';
import PublicDepartmentsListPage from './pages/public/PublicDepartmentsListPage';
import PublicDepartmentDetailPage from './pages/public/PublicDepartmentDetailPage';

// Dedicated Login & Auth Pages
import Login from './pages/Login';
import AcceptInvitePage from './pages/AcceptInvitePage';

// Protected Route & Layouts
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/admin/AdminLayout';
import ManagerLayout from './components/layout/ManagerLayout';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProfilePage from './pages/admin/AdminProfilePage';
import UsersPage from './pages/admin/UsersPage';
import UserDetailsPage from './pages/admin/UserDetailsPage';
import ClubsPage from './pages/admin/ClubsPage';
import CreateClubPage from './pages/admin/CreateClubPage';
import ClubDetailsPage from './pages/admin/ClubDetailsPage';
import AdminDepartmentsPage from './pages/admin/AdminDepartmentsPage';

// Manager Pages
import ManagerDashboard from './pages/manager/ManagerDashboard';
import MyClubsPage from './pages/manager/MyClubsPage';
import ManagerClubDetailPage from './pages/manager/ManagerClubDetailPage';
import ManagerEventDetailPage from './pages/manager/ManagerEventDetailPage';
import ManagerProfilePage from './pages/manager/ManagerProfilePage';

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <ScrollToTop />
              <Routes>
                {/* Public Unauthenticated Routes */}
                <Route path="/" element={<PublicHomePage />} />
                <Route path="/events/:eventId" element={<PublicEventDetailPage />} />
                <Route path="/clubs" element={<PublicClubsListPage />} />
                <Route path="/clubs/:clubId" element={<PublicClubDetailPage />} />
                <Route path="/clubs/:clubId/events/:eventId" element={<PublicEventDetailPage />} />
                <Route path="/departments" element={<PublicDepartmentsListPage />} />
                <Route path="/departments/:departmentId" element={<PublicDepartmentDetailPage />} />

                {/* Dedicated Login & Auth Routes */}
                <Route path="/accept-invite/:token" element={<AcceptInvitePage />} />
                <Route path="/login/admin" element={<Login role="admin" />} />
                <Route path="/login/manager" element={<Login role="manager" />} />
                <Route path="/login" element={<Navigate to="/login/manager" replace />} />

                {/* Protected Admin Portal Routes */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRole="admin">
                      <AdminLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<AdminDashboard />} />
                  <Route path="profile" element={<AdminProfilePage />} />
                  <Route path="users" element={<UsersPage />} />
                  <Route path="users/:userId" element={<UserDetailsPage />} />
                  <Route path="clubs" element={<ClubsPage />} />
                  <Route path="clubs/create" element={<CreateClubPage />} />
                  <Route path="clubs/:clubId" element={<ClubDetailsPage />} />
                  <Route path="departments" element={<AdminDepartmentsPage />} />
                </Route>

                {/* Protected Manager Portal Routes */}
                <Route
                  path="/manager"
                  element={
                    <ProtectedRoute allowedRole="manager">
                      <ManagerLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<ManagerDashboard />} />
                  <Route path="profile" element={<ManagerProfilePage />} />
                  <Route path="clubs" element={<MyClubsPage />} />
                  <Route path="clubs/:clubId" element={<ManagerClubDetailPage />} />
                  <Route path="clubs/:clubId/events/:eventId" element={<ManagerEventDetailPage />} />
                </Route>

                {/* Catch-all redirect to public Home */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
        </Router>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
