import React from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';
import logo from '../../assets/smartswipe-logo.png';
import swipeCard from '../../assets/swipe_card.png';

const Landing: React.FC = () => {
  return (
    <div className="landing-container">
      <div className="landing-header">
        <div className="logo">
          <img src={logo} alt="SmartSwipe Logo" />
        </div>
        <div className="nav-links">
          <Link to="/login" className="login-button">Login</Link>
        </div>
      </div>
      
      <div className="landing-content">
        <div className="content-left">
          <h1>Maximize Every Swipe.</h1>
          <Link to="/signup" className="cta-button">Get Started</Link>
        </div>
        
        <div className="content-right">
          <img 
            src={swipeCard} 
            alt="SmartSwipe Credit Card" 
            className="card-image" 
          />
        </div>
      </div>

      <div className="fade-transition">
        <div className="fade-transition-content">
          <h2>Just Swipe.</h2>
        </div>
      </div>

      <div className="features-grid">
        <div className="feature-tile tile-dark">
          <div className="tile-content">
            <h3>💳 One Card</h3>
            <p>Swipe unifies all your cards into one smart wallet. Just Swipe.</p>
            <div className="tile-action">
              <span className="action-text">Learn more</span>
              <span className="action-icon">→</span>
            </div>
          </div>
        </div>
        
        <div className="feature-tile tile-accent">
          <div className="tile-content">
            <h3>✈️ Travel Easy</h3>
            <p>No foreign fees. SmartSwipe always chooses the right card abroad.</p>
            <div className="tile-action">
              <span className="action-text">Save on fees</span>
              <span className="action-icon">→</span>
            </div>
          </div>
        </div>
        
        <div className="feature-tile tile-main">
          <div className="tile-content">
            <h3>💰 SmartSwipe</h3>
            <p>Maximize rewards effortlessly and earn more on every purchase — we pick the best card automatically.</p>
            <div className="tile-action">
              <span className="action-text">Earn more</span>
              <span className="action-icon">→</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="white-section"></div>
      
      <footer className="landing-footer">
        <p>Made with love by Karina and Saya</p>
      </footer>
    </div>
  );
};

export default Landing; 
