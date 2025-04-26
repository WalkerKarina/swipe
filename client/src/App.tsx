import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import Profile from './pages/Profile/Profile';
import Transactions from './pages/Transactions/Transactions';
import Landing from './pages/Landing/Landing';
import Login from './pages/Login/Login';
import LinkAccounts from './pages/LinkAccounts';
import RewardsSummary from './pages/RewardsSummary';
import CardDetails from './pages/CardDetails';
import logo from './assets/smartswipe-logo.png';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!user) return null; // Don't show sidebar for unauthenticated users

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <Link to="/">
          <img src={logo} alt="SmartSwipe Logo" />
        </Link>
      </div>
      <nav className="sidebar-nav">
        <ul>
          <li>
            <Link to="/home" className={location.pathname === '/home' ? 'active' : ''}>
              <i className="fas fa-home"></i>
              <span>Home</span>
            </Link>
          </li>
          <li>
            <Link to="/transactions" className={location.pathname === '/transactions' ? 'active' : ''}>
              <i className="fas fa-credit-card"></i>
              <span>Transactions</span>
            </Link>
          </li>
          <li>
            <Link to="/profile" className={location.pathname === '/profile' ? 'active' : ''}>
              <i className="fas fa-user"></i>
              <span>Profile</span>
            </Link>
          </li>
        </ul>
      </nav>
      <div className="sidebar-footer">
        <Link to="/profile" className="user-profile-link">
          {user.name}
        </Link>
        <button onClick={logout} className="logout-button">
          Logout
        </button>
      </div>
    </div>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isPublicRoute = !user && (location.pathname === '/' || location.pathname === '/login' || location.pathname === '/signup');
  const isSpecialRoute = location.pathname === '/link-accounts' || 
                         location.pathname === '/rewards-summary' ||
                         location.pathname === '/card-details';

  return (
    <>
      {!isPublicRoute && !isSpecialRoute && <Sidebar />}
      <div className={isPublicRoute || isSpecialRoute ? 'public-page' : 'main-content'}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={user ? <Navigate to="/home" replace /> : <Landing />} />
          <Route path="/login" element={user ? <Navigate to="/home" replace /> : <Login />} />
          <Route path="/signup" element={user ? <Navigate to="/home" replace /> : <Login />} />
          
          {/* Special routes - protected but with special layout */}
          <Route path="/link-accounts" element={
            <ProtectedRoute>
              <LinkAccounts />
            </ProtectedRoute>
          } />
          <Route path="/rewards-summary" element={
            <ProtectedRoute>
              <RewardsSummary />
            </ProtectedRoute>
          } />
          <Route path="/card-details" element={
            <ProtectedRoute>
              <CardDetails />
            </ProtectedRoute>
          } />
          
          {/* Protected routes */}
          <Route path="/home" element={
            <ProtectedRoute>
              <div>
                <h1>Home Dashboard</h1>
                <p>Welcome to your Smart Swipe dashboard</p>
              </div>
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="/transactions" element={
            <ProtectedRoute>
              <Transactions />
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <AppRoutes />
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App; 
