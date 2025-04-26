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
    </div>
  );
};

export default Landing; 
