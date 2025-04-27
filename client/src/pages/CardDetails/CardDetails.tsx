import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { plaidService } from '../../services/api';
import './CardDetails.css';

interface CardRewardDetails {
  card_type: string;
  reward_categories: string[];
  extra_info: {
    annual_fee: string;
    card_name: string;
    notes: string;
    signup_bonus: string;
  };
  raw_content: string;
}

const CardDetails: React.FC = () => {
  const { cardName } = useParams<{ cardName: string }>();
  const navigate = useNavigate();
  const [cardDetails, setCardDetails] = useState<CardRewardDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Function to decode the URL-encoded card name
  const decodedCardName = cardName ? decodeURIComponent(cardName) : '';

  useEffect(() => {
    console.log("Card name parameter:", cardName);
    console.log("Decoded card name:", decodedCardName);
    
    // Try to load from localStorage first
    const loadCardDetails = () => {
      setIsLoading(true);
      
      // Check if we have cached data
      const cachedData = localStorage.getItem(`card_details_${decodedCardName}`);
      
      if (cachedData) {
        try {
          setCardDetails(JSON.parse(cachedData));
          setIsLoading(false);
          return true;
        } catch (e) {
          console.error('Error parsing cached card details:', e);
          // Continue to fetch from API if parsing fails
        }
      }
      return false;
    };

    // If no cached data or refresh is requested, fetch from API
    const fetchCardDetails = async () => {
      try {
        setIsLoading(true);
        // Call the chat completions endpoint with the card name
        const response = await plaidService.getCardDetails(decodedCardName);
        
        if (response) {
          // Store in state
          setCardDetails(response);
          
          // Cache in localStorage
          localStorage.setItem(`card_details_${decodedCardName}`, JSON.stringify(response));
          
          setError(null);
        } else {
          setError('Could not load card details.');
        }
      } catch (err: any) {
        console.error('Error fetching card details:', err);
        // Enhanced error details
        let errorMessage = 'Could not load card details. Please try again later.';
        
        if (err.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.error('Response data:', err.response.data);
          console.error('Response status:', err.response.status);
          
          if (err.response.data && err.response.data.error) {
            errorMessage = `Error: ${err.response.data.error}`;
          }
        } else if (err.request) {
          // The request was made but no response was received
          console.error('No response received:', err.request);
          errorMessage = 'No response received from server.';
        }
        
        setError(errorMessage);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    };

    // First try to load from cache, then fetch if needed
    const hasCachedData = loadCardDetails();
    if (!hasCachedData || isRefreshing) {
      fetchCardDetails();
    }
  }, [decodedCardName, isRefreshing]);

  const handleRefresh = () => {
    setIsRefreshing(true);
  };

  const handleBack = () => {
    navigate('/card-info');
  };

  if (isLoading) {
    return (
      <div className="card-details-page">
        <div className="card-details-container">
          <div className="loading-container">
            <div className="loading-spinner-wrapper">
              <div className="spinner-only"></div>
            </div>
            <div className="loading-text-wrapper">
              <p>Loading card details...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !cardDetails) {
    return (
      <div className="card-details-page">
        <div className="card-details-container">
          <div className="error-message">
            <p>{error || 'Could not load card details.'}</p>
            <button className="back-button" onClick={handleBack}>Back to Card Rewards</button>
            <button className="refresh-button" onClick={handleRefresh}>
              <i className="fas fa-sync-alt refresh-icon"></i>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-details-page">
      <div className="card-details-container">
        <div className="card-details-header">
          <button className="back-button" onClick={handleBack}>← Back to Card Rewards</button>
          <h1>{cardDetails.extra_info.card_name}</h1>
          <button className="refresh-button" onClick={handleRefresh} disabled={isRefreshing}>
            <i className="fas fa-sync-alt refresh-icon"></i>
            {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
        
        <div className="card-details-content">
          <div className="card-info-section">
            <h2>Card Information</h2>
            <div className="card-info-item">
              <span className="label">Annual Fee:</span>
              <span className="value">{cardDetails.extra_info.annual_fee}</span>
            </div>
            <div className="card-info-item">
              <span className="label">Sign-up Bonus:</span>
              <span className="value">{cardDetails.extra_info.signup_bonus}</span>
            </div>
            {cardDetails.extra_info.notes && (
              <div className="card-info-item">
                <span className="label">Additional Notes:</span>
                <span className="value">{cardDetails.extra_info.notes}</span>
              </div>
            )}
          </div>
          
          <div className="rewards-section">
            <h2>Reward Categories</h2>
            <ul className="rewards-list">
              {cardDetails.reward_categories.map((reward, index) => (
                <li key={index} className="reward-item">{reward}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardDetails; 