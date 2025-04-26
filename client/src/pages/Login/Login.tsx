import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { authService, SignupData, LoginData } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import './Login.css';
import logo from '../../assets/swipe_card_black.png';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  
  // Set isSignup to true if accessed from /signup route
  const [isSignup, setIsSignup] = useState(location.pathname === '/signup');
  
  const [formData, setFormData] = useState<SignupData | LoginData>(
    isSignup 
      ? { email: '', password: '', name: '' } // Signup data
      : { email: '', password: '' }           // Login data
  );
  const [error, setError] = useState<string | null>(null);

  // Update form data structure when isSignup changes
  useEffect(() => {
    if (isSignup) {
      setFormData(prev => ({
        email: prev.email,
        password: prev.password,
        name: 'name' in prev ? prev.name : '',
      }));
    } else {
      const { email, password } = formData;
      setFormData({ email, password });
    }
  }, [isSignup]);

  // Update isSignup when URL changes
  useEffect(() => {
    setIsSignup(location.pathname === '/signup');
  }, [location.pathname]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (isSignup) {
        // Ensure we're sending the correct SignupData structure
        const signupData: SignupData = {
          email: formData.email,
          password: formData.password,
          name: (formData as SignupData).name || ''
        };
        console.log('Sending signup data:', signupData);
        const response = await authService.signup(signupData);
        login(response.user, response.session.access_token);
        navigate('/link-accounts'); // Redirect to link accounts page for new users
      } else {
        // Ensure we're sending the correct LoginData structure
        const loginData: LoginData = {
          email: formData.email,
          password: formData.password
        };
        console.log('Sending login data:', loginData);
        const response = await authService.login(loginData);
        login(response.user, response.session.access_token);
        navigate('/home');
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  return (
    <div className="auth-page">
      <div className="logo-area">
        <Link to="/">
          <img src={logo} alt="SmartSwipe Logo" className="auth-logo" />
        </Link>
      </div>
      
      <div className="auth-card-container">
        <div className="auth-card">
          <h1>{isSignup ? 'Create an Account' : 'Login'}</h1>
          
          {error && <div className="error-message">{error}</div>}
          
          <form onSubmit={handleSubmit}>
            {isSignup && (
              <div className="form-field">
                <label>Name</label>
                <div className="input-with-icon">
                  <span className="input-icon">
                    <i className="fas fa-user"></i>
                  </span>
                  <input
                    type="text"
                    name="name"
                    value={(formData as SignupData).name || ''}
                    onChange={handleChange}
                    required
                    placeholder="Sarah Smith"
                  />
                </div>
              </div>
            )}
            
            <div className="form-field">
              <label>Email</label>
              <div className="input-with-icon">
                <span className="input-icon">
                  <i className="fas fa-envelope"></i>
                </span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="example@gmail.com"
                />
              </div>
            </div>
            
            <div className="form-field">
              <label>Password</label>
              <div className="input-with-icon">
                <span className="input-icon">
                  <i className="fas fa-lock"></i>
                </span>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="Enter your password"
                />
              </div>
            </div>
            
            <button type="submit" className="submit-button">
              {isSignup ? 'Sign Up' : 'Login'}
            </button>
          </form>
          
          <div className="auth-footer">
            <div className="divider">
              <span>- or -</span>
            </div>
            
            <p className="auth-switch">
              {isSignup ? 'Already have an account?' : "Don't have an account?"}
              <Link to={isSignup ? '/login' : '/signup'} className="auth-link">
                {isSignup ? 'Login' : 'Sign Up'}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
