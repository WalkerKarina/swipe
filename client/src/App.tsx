import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import Profile from './pages/Profile/Profile';
import Transactions from './pages/Transactions/Transactions';
import Landing from './pages/Landing/Landing';
import Login from './pages/Login/Login';
import LinkAccounts from './pages/LinkAccounts/LinkAccounts';
import RewardsSummary from './pages/RewardsSummary';
import CardDetails from './pages/CardDetails/CardDetails';
import VirtualCardDetails from './pages/VirtualCardDetails/VirtualCardDetails';
import CardInfo from './pages/CardInfo/CardInfo';
import Dashboard from './pages/Dashboard/Dashboard';
import PitchPage from './pages/PitchPage';
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
            <Link to="/card-info" className={location.pathname === '/card-info' ? 'active' : ''}>
              <i className="fa-solid fa-credit-card"></i>
              <span>Card Rewards</span>
            </Link>
          </li>
        </ul>
      </nav>
      <div className="sidebar-footer">
        <Link to="/profile" className={location.pathname === '/profile' ? 'user-profile-link active' : 'user-profile-link'}>
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
  const navigate = useNavigate();
  
  if (!user) return null;
  
  const handleProfileClick = () => {
    navigate('/profile');
  };
  
  return (
    <div className="user-info">
      <div className="notification-icon">
        <i className="fa-solid fa-bell"></i>
      </div>
      <div className="user-profile-info" onClick={handleProfileClick}>
        <div className="user-profile-photo">
          <i className="fa-solid fa-user-circle"></i>
        </div>
        <div className="user-details">
          <div className="user-name">{user.name}</div>
          <div className="user-email">{user.email}</div>
        </div>
      </div>
    </div>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  // Show loading indicator while auth is being checked
  if (loading) {
    return (
      <div className="loading-container" style={{ margin: '2rem auto' }}>
        <div className="loading-spinner-wrapper">
          <div className="spinner-only"></div>
        </div>
        <div className="loading-text-wrapper">
          <p>Loading...</p>
        </div>
      </div>
    );
  }
  
  // Only redirect when loading is complete and user is not present
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
                         location.pathname === '/card-details' ||
                         location.pathname === '/pitch';

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
              <VirtualCardDetails />
            </ProtectedRoute>
          } />
          <Route path="/pitch" element={
            <ProtectedRoute>
              <PitchPage />
            </ProtectedRoute>
          } />
          <Route path="/card-details/:cardName" element={
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
          <Route path="/card-info" element={
            <ProtectedRoute>
              <CardInfo />
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
