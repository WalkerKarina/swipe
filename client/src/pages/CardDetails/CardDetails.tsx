import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './CardDetails.css';
import logo from '../../assets/swipe_card_black.png';
import copyIcon from '../../assets/copy_icon.svg';

const CardDetails: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // Constants for card details - these would come from an API in a real application
  const cardNumber = "4147 5488 2846 2485";
  const expirationDate = "05/31";
  const securityCode = "907";

  const handleCopyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        // Set toast message based on which field was copied
        let message = '';
        switch(fieldName) {
          case 'cardNumber':
            message = 'Card number copied to clipboard!';
            break;
          case 'expirationDate':
            message = 'Expiration date copied to clipboard!';
            break;
          case 'securityCode':
            message = 'Security code copied to clipboard!';
            break;
          default:
            message = 'Copied to clipboard!';
        }
        
        setToastMessage(message);
        setShowToast(true);
        
        // Hide toast after 2 seconds
        setTimeout(() => {
          setShowToast(false);
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
        setToastMessage('Failed to copy to clipboard');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      });
  };

  const handleContinue = () => {
    navigate('/profile');
  };

  return (
    <div className="card-details-page">
      <div className="logo-area">
        <Link to="/">
          <img src={logo} alt="SmartSwipe Logo" className="logo" />
        </Link>
      </div>

      {showToast && (
        <div className="toast-notification">
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="card-details-container">
        <div className="card-details-card">
          <h1>Your New <span className="text-highlight">Swipe</span> Card Details</h1>
          <p className="card-instructions">Please save these details and add this card to your Apple Wallet</p>
          
          <div className="card-detail-field">
            <label>Card Number</label>
            <div className="detail-value-container">
              <span className="detail-value">{cardNumber}</span>
              <button 
                className="copy-button" 
                onClick={() => handleCopyToClipboard(cardNumber.replace(/\s/g, ''), 'cardNumber')}
                aria-label="Copy card number"
              >
                <img src={copyIcon} alt="Copy" className="copy-icon" />
              </button>
            </div>
          </div>

          <div className="card-detail-field">
            <label>Expiration Date</label>
            <div className="detail-value-container">
              <span className="detail-value">{expirationDate}</span>
              <button 
                className="copy-button" 
                onClick={() => handleCopyToClipboard(expirationDate, 'expirationDate')}
                aria-label="Copy expiration date"
              >
                <img src={copyIcon} alt="Copy" className="copy-icon" />
              </button>
            </div>
          </div>

          <div className="card-detail-field">
            <label>Security Code</label>
            <div className="detail-value-container">
              <span className="detail-value">{securityCode}</span>
              <button 
                className="copy-button" 
                onClick={() => handleCopyToClipboard(securityCode, 'securityCode')}
                aria-label="Copy security code"
              >
                <img src={copyIcon} alt="Copy" className="copy-icon" />
              </button>
            </div>
          </div>

          <button onClick={handleContinue} className="continue-button">
            Continue to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default CardDetails; 