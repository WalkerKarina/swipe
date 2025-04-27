import React, { useState, useEffect, useCallback } from 'react';
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

interface CashbackData {
  total_cashback: number;
  cashback_by_card: Record<string, number>;
  spending_by_card: Record<string, number>;
}

const CardInfo: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cardRewards, setCardRewards] = useState<CardRewardDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
  
  // Function to fetch cashback data directly from API
  const fetchCashbackData = useCallback(async (): Promise<string[]> => {
    if (!user?.id) return [];
    
    try {
      console.log('Fetching cashback data from API');
      const response = await plaidService.getCashBackSummary(user.id);
      
      if (response && response.status === 'success' && response.data) {
        const cashbackData: CashbackData = {
          total_cashback: response.data.total_cashback || 0,
          cashback_by_card: response.data.cashback_by_card || {},
          spending_by_card: response.data.spending_by_card || {}
        };
        
        // Cache the result
        localStorage.setItem('cashback_data', JSON.stringify(cashbackData));
        
        // Return the card names
        return Object.keys(cashbackData.cashback_by_card);
      }
    } catch (error) {
      console.error('Error fetching cashback data:', error);
    }
    
    return [];
  }, [user?.id]);
  
  // Function to get card names from cached or fresh cashback data
  const getCardNames = useCallback(async (forceRefresh: boolean): Promise<string[]> => {
    // If forcing refresh, get directly from API
    if (forceRefresh) {
      return await fetchCashbackData();
    }
    
    // Otherwise try to get from localStorage first
    const cashbackDataString = localStorage.getItem('cashback_data');
    if (cashbackDataString) {
      try {
        const cashbackData = JSON.parse(cashbackDataString);
        if (cashbackData && cashbackData.cashback_by_card) {
          const cardNames = Object.keys(cashbackData.cashback_by_card);
          if (cardNames.length > 0) {
            return cardNames;
          }
        }
      } catch (e) {
        console.error('Error parsing cashback data:', e);
      }
    }
    
    // If no card names from cache, fetch from API
    return await fetchCashbackData();
  }, [fetchCashbackData]);

  // Load all card rewards 
  const loadCardRewards = useCallback(async (forceRefresh: boolean = false) => {
    setIsLoading(true);
    
    try {
      // Get card names (either from cache or API)
      let cardNames = await getCardNames(forceRefresh);
      
      // If no cards from API either, use defaults
      if (cardNames.length === 0) {
        cardNames = [
          'Chase Sapphire Preferred',
          'Citi Double Cash',
          'American Express Gold',
          'Capital One Venture'
        ];
      }
      
      console.log('Cards to load:', cardNames);
      
      const rewards: CardRewardDetails[] = [];
      
      // Fetch details for each card
      const fetchPromises = cardNames.map(async (cardName) => {
        // If refreshing or not in cache, fetch from API
        if (forceRefresh || !localStorage.getItem(`card_details_${cardName}`)) {
          try {
            console.log(`Fetching card details for ${cardName} from API`);
            const cardDetails = await plaidService.getCardDetails(cardName);
            if (cardDetails) {
              rewards.push(cardDetails);
              // Cache the result
              localStorage.setItem(`card_details_${cardName}`, JSON.stringify(cardDetails));
            }
          } catch (e) {
            console.error(`Error fetching details for ${cardName} from API:`, e);
            
            // If error fetching and we have cached data, use that as fallback
            if (!forceRefresh) {
              const cachedData = localStorage.getItem(`card_details_${cardName}`);
              if (cachedData) {
                try {
                  rewards.push(JSON.parse(cachedData));
                } catch (parseError) {
                  console.error(`Error parsing cached data for ${cardName}:`, parseError);
                }
              }
            }
          }
        } else {
          // Try to get from localStorage when not refreshing
          const cardDetailsString = localStorage.getItem(`card_details_${cardName}`);
          if (cardDetailsString) {
            try {
              const cardDetails = JSON.parse(cardDetailsString);
              rewards.push(cardDetails);
            } catch (e) {
              console.error(`Error parsing card details for ${cardName}:`, e);
            }
          }
        }
      });
      
      // Wait for all fetch operations to complete
      await Promise.all(fetchPromises);
      
      console.log(`Loaded ${rewards.length} card reward details`);
      setCardRewards(rewards);
      setError(null);
    } catch (e) {
      console.error('Error loading card rewards:', e);
      setError('Failed to load reward details.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [getCardNames]);
  
  // Initial load on component mount
  useEffect(() => {
    loadCardRewards(false);
  }, [loadCardRewards]);

  // Effect to handle the refreshing state
  useEffect(() => {
    if (isRefreshing) {
      loadCardRewards(true);
    }
  }, [isRefreshing, loadCardRewards]);

  const handleRefreshAll = () => {
    setIsRefreshing(true);
    
    // Clear card details from localStorage
    for (const key in localStorage) {
      if (key.startsWith('card_details_')) {
        localStorage.removeItem(key);
      }
    }
    
    // Clear cashback data to force a refresh
    localStorage.removeItem('cashback_data');
    
    // Also remove dashboard cache to ensure it refreshes with new data
    if (user?.id) {
      localStorage.removeItem(`dashboard_${user.id}`);
    }
    
    // Dispatch custom event for other components to detect
    const event = new Event('cardsRefreshed');
    window.dispatchEvent(event);
  };

  const handleCardClick = (cardName: string) => {
    navigate(`/card-details/${encodeURIComponent(cardName)}`, {
      state: { from: 'card-info' }
    });
  };

  const handleViewDetails = (event: React.MouseEvent, cardName: string) => {
    // Prevent the click from bubbling up to the card
    event.stopPropagation();
    navigate(`/card-details/${encodeURIComponent(cardName)}`, {
      state: { from: 'card-info' }
    });
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
      <div className="card-header-wrapper">
        <div className="card-title">
          <h1>Your Credit Card Rewards</h1>
          <p>View all your credit card reward details in one place</p>
        </div>
        
        <div className="refresh-button-container">
          <button 
            className="refresh-all-button" 
            onClick={handleRefreshAll}
            disabled={isRefreshing}
          >
            <i className="fas fa-sync-alt refresh-icon"></i>
            {isRefreshing ? 'Refreshing...' : 'Refresh All Cards'}
          </button>
        </div>
      </div>
      
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