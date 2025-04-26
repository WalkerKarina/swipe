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
import Dashboard from './pages/Dashboard';
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
              <i className="fa-solid fa-home"></i>
              <span>Dashboard</span>
            </Link>
          </li>
          <li>
            <Link to="/transactions" className={location.pathname === '/transactions' ? 'active' : ''}>
              <i className="fa-solid fa-shopping-cart"></i>
              <span>Transactions</span>
            </Link>
          </li>
          <li>
            <Link to="/recs" className={location.pathname === '/recs' ? 'active' : ''}>
              <i className="fa-solid fa-star"></i>
              <span>Recs</span>
            </Link>
          </li>
        </ul>
      </nav>
      <div className="sidebar-footer">
        <Link to="/profile" className="user-profile-link">
          <i className="fa-solid fa-user"></i>
          <span>Profile</span>
        </Link>
        <button onClick={logout} className="logout-button">
          <i className="fa-solid fa-sign-out-alt"></i>
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
};

const UserInfo: React.FC = () => {
  const { user } = useAuth();
  
  if (!user) return null;
  
  return (
    <div className="user-info">
      <div className="user-name">{user.name}</div>
      <i className="fa-solid fa-bell"></i>
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
      {!isPublicRoute && !isSpecialRoute && <UserInfo />}
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
              <Dashboard />
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
          <Route path="/recs" element={
            <ProtectedRoute>
              <div className="recs-placeholder">
                <h1>Recommendations</h1>
                <p>Get personalized card recommendations based on your spending patterns.</p>
              </div>
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
