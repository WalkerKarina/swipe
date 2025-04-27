import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { plaidService } from '../../services/api';
import './CardInfo.css';

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

const CardInfo: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cardRewards, setCardRewards] = useState<CardRewardDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to get color for a card
  const getCardColor = (index: number): string => {
    const baseColors = [
      '#F9A825', // Amber/yellow
      '#00695C', // Dark teal
      '#673AB7', // Purple
      '#3949AB', // Indigo
      '#FB8C00'  // Orange
    ];
    return baseColors[index % baseColors.length];
  };

  // Load all card rewards from localStorage
  useEffect(() => {
    const loadAllCardRewards = () => {
      setIsLoading(true);
      
      try {
        // Get all items from localStorage
        const rewards: CardRewardDetails[] = [];
        const cardNames: string[] = [];
        
        // Get cashback data to extract card names
        const cashbackDataString = localStorage.getItem('cashback_data');
        if (cashbackDataString) {
          try {
            const cashbackData = JSON.parse(cashbackDataString);
            if (cashbackData && cashbackData.cashback_by_card) {
              Object.keys(cashbackData.cashback_by_card).forEach(cardName => {
                cardNames.push(cardName);
              });
            }
          } catch (e) {
            console.error('Error parsing cashback data:', e);
          }
        }
        
        // If no card names from cashback data, use some defaults
        if (cardNames.length === 0) {
          cardNames.push('Chase Sapphire Preferred');
          cardNames.push('Citi Double Cash');
          cardNames.push('American Express Gold');
          cardNames.push('Capital One Venture');
        }
        
        // Try to load details for each card
        cardNames.forEach(cardName => {
          const cardDetailsString = localStorage.getItem(`card_details_${cardName}`);
          if (cardDetailsString) {
            try {
              const cardDetails = JSON.parse(cardDetailsString);
              rewards.push(cardDetails);
            } catch (e) {
              console.error(`Error parsing card details for ${cardName}:`, e);
            }
          }
        });
        
        setCardRewards(rewards);
        setError(null);
      } catch (e) {
        console.error('Error loading card rewards:', e);
        setError('Failed to load reward details.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadAllCardRewards();
  }, []);

  const handleCardClick = (cardName: string) => {
    navigate(`/card-details/${encodeURIComponent(cardName)}`);
  };

  const handleViewDetails = (event: React.MouseEvent, cardName: string) => {
    // Prevent the click from bubbling up to the card
    event.stopPropagation();
    navigate(`/card-details/${encodeURIComponent(cardName)}`);
  };

  const handleAddCard = () => {
    // For now, just navigate to profile
    navigate('/profile');
  };

  if (isLoading) {
    return (
      <div className="card-info-page">
        <div className="loading-container">
          <div className="loading-spinner-wrapper">
            <div className="spinner-only"></div>
          </div>
          <div className="loading-text-wrapper">
            <p>Loading card information...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-info-page">
      <h1>Your Credit Card Rewards</h1>
      <p>View all your credit card reward details in one place</p>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="card-grid">
        {cardRewards.length > 0 ? (
          cardRewards.map((card, index) => (
            <div 
              key={card.card_type} 
              className="reward-card"
              onClick={() => handleCardClick(card.card_type)}
              style={{ borderTop: `5px solid ${getCardColor(index)}` }}
            >
              <h2>{card.extra_info.card_name}</h2>
              
              <div className="reward-card-section">
                <h3>Annual Fee</h3>
                <p>{card.extra_info.annual_fee}</p>
              </div>
              
              <div className="reward-card-section">
                <h3>Sign-up Bonus</h3>
                <p>{card.extra_info.signup_bonus}</p>
              </div>
              
              <div className="reward-card-section">
                <h3>Top Rewards</h3>
                <ul className="reward-list-preview">
                  {card.reward_categories.slice(0, 3).map((reward, i) => (
                    <li key={i}>{reward}</li>
                  ))}
                  {card.reward_categories.length > 3 && (
                    <li className="more-rewards">+{card.reward_categories.length - 3} more</li>
                  )}
                </ul>
              </div>
              
              <button 
                className="view-details-button"
                onClick={(e) => handleViewDetails(e, card.card_type)}
              >
                View Details
              </button>
            </div>
          ))
        ) : (
          <div className="no-cards-message">
            <p>You don't have any card reward details saved yet.</p>
            <p>Click on a card in your cashback summary to view and save its reward details.</p>
          </div>
        )}
        
        <div className="add-card-tile" onClick={handleAddCard}>
          <div className="add-icon">+</div>
          <p>Add a New Card</p>
        </div>
      </div>
    </div>
  );
};

export default CardInfo; 