import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { plaidService, transactionService } from '../../services/api';
import './Dashboard.css';
import logo from '../../assets/smartswipe-logo.png';

// Type definitions
interface CashBackSummary {
  total_cash_back: number;
  monthly_cash_back: number;
  rewards_by_category: Record<string, number>;
}

interface TransactionSummary {
  spending_by_card: Record<string, number>;
  cashback_by_card: Record<string, number>;
}

// Define card color mapping
const cardColors: Record<string, string> = {
  'Chase': '#ACE5DE',
  'AMEX': '#2777E7',
  'American Express': '#2777E7',
  'Bank of America': '#9DE88C',
  'Discover': '#388E3C',
  'Capital One': '#FF5733',
  'Citi': '#6A0DAD',
  'Wells Fargo': '#FFC300',
  'US Bank': '#FF5733',
  'TD Bank': '#4CAF50',
  'USAA': '#2196F3',
  'Barclays': '#607D8B',
  'PNC': '#FF9800',
  // Add more cards as needed
};

// Default colors for cards not in the mapping
const defaultColors = ['#ACE5DE', '#2777E7', '#9DE88C', '#388E3C', '#FF5733', '#6A0DAD', '#FFC300'];

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [cashbackSummary, setCashbackSummary] = useState<CashBackSummary | null>(null);
  const [transactionSummary, setTransactionSummary] = useState<TransactionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Function to fetch dashboard data - made into a callback so it can be reused for refresh
  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      // Try to get cached data if not forcing a refresh
      if (!forceRefresh) {
        const cachedDashboardData = localStorage.getItem(`dashboard_${user.id}`);
        if (cachedDashboardData) {
          const { data, timestamp } = JSON.parse(cachedDashboardData);
          const cacheAge = Date.now() - timestamp;
          // Use cache if it's less than 15 minutes old
          if (cacheAge < 15 * 60 * 1000) {
            console.log('Using cached dashboard data');
            setCashbackSummary(data.cashbackSummary);
            setTransactionSummary(data.transactionSummary);
            setLoading(false);
            setIsRefreshing(false);
            return;
          }
        }
      } else {
        // If forcing refresh, clear the existing cache
        localStorage.removeItem(`dashboard_${user.id}`);
      }
      
      console.log('Fetching fresh dashboard data');
      
      // Fetch cashback and transaction summary in parallel
      const [cashbackResponse, summaryData] = await Promise.all([
        plaidService.getCashBackSummary(user.id).catch(() => null),
        transactionService.getTransactionSummary(user.id).catch(() => ({
          spending_by_card: {},
          cashback_by_card: {}
        }))
      ]);
      
      // Parse cashback data correctly, matching the API response structure
      let cashbackData: CashBackSummary;
      if (cashbackResponse && cashbackResponse.status === 'success' && cashbackResponse.data) {
        cashbackData = {
          total_cash_back: cashbackResponse.data.total_cashback || 0,
          monthly_cash_back: cashbackResponse.data.total_cashback || 0, // Using total as monthly for now
          rewards_by_category: cashbackResponse.data.cashback_by_card || {}
        };
      } else {
        cashbackData = {
          total_cash_back: 0,
          monthly_cash_back: 0,
          rewards_by_category: {}
        };
      }
      
      setCashbackSummary(cashbackData);
      setTransactionSummary(summaryData || {
        spending_by_card: {},
        cashback_by_card: {}
      });
      
      // Cache the new data
      localStorage.setItem(`dashboard_${user.id}`, JSON.stringify({
        data: {
          cashbackSummary: cashbackData,
          transactionSummary: summaryData
        },
        timestamp: Date.now()
      }));
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Set default values on error
      setCashbackSummary({
        total_cash_back: 0,
        monthly_cash_back: 0,
        rewards_by_category: {}
      });
      
      setTransactionSummary({
        spending_by_card: {},
        cashback_by_card: {}
      });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);
  
  // Fetch data on component mount
  useEffect(() => {
    fetchData();
    
    // Listen for the custom event from Card Rewards page
    const handleCardsRefreshed = () => {
      console.log('Detected cards refreshed event, updating dashboard');
      fetchData(true);
    };
    
    // Add event listener for card refresh events
    window.addEventListener('cardsRefreshed', handleCardsRefreshed);
    
    // Clean up
    return () => {
      window.removeEventListener('cardsRefreshed', handleCardsRefreshed);
    };
  }, [fetchData]);
  
  // Handle refresh button click
  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData(true);
  };
  
  // Calculate top category
  const getTopCategory = () => {
    if (!cashbackSummary || !cashbackSummary.rewards_by_category) {
      return { category: 'N/A', amount: 0, percentage: 0 };
    }
    
    const categories = Object.entries(cashbackSummary.rewards_by_category || {});
    if (categories.length === 0) {
      return { category: 'N/A', amount: 0, percentage: 0 };
    }
    
    // Sort categories by reward amount (descending)
    categories.sort((a, b) => b[1] - a[1]);
    
    const [topCategory, amount] = categories[0];
    const total = cashbackSummary.total_cash_back || 1; // Avoid division by zero
    const percentage = Math.round((amount / total) * 100);
    
    return {
      category: topCategory ? topCategory.charAt(0).toUpperCase() + topCategory.slice(1) : 'N/A',
      amount: amount || 0,
      percentage: percentage || 0
    };
  };
  
  // Find top card (by cashback)
  const getTopCard = () => {
    if (!cashbackSummary || !cashbackSummary.rewards_by_category) {
      return { card: 'N/A', amount: 0 };
    }
    
    const cards = Object.entries(cashbackSummary.rewards_by_category || {});
    if (cards.length === 0) {
      return { card: 'N/A', amount: 0 };
    }
    
    // Sort cards by cashback amount (descending)
    cards.sort((a, b) => b[1] - a[1]);
    
    const [topCard, amount] = cards[0];
    
    return { 
      card: topCard || 'N/A', 
      amount: amount || 0 
    };
  };
  
  // Get linked cards from cashback summary
  const getLinkedCards = () => {
    if (!cashbackSummary || !cashbackSummary.rewards_by_category) {
      return [];
    }
    
    // Extract card names from rewards_by_category
    return Object.keys(cashbackSummary.rewards_by_category);
  };
  
  // Get color for a card
  const getCardColor = (cardName: string, index: number) => {
    // First try to match directly
    if (cardColors[cardName]) {
      return cardColors[cardName];
    }
    
    // Then try to find partial matches (e.g., if "Chase Freedom" contains "Chase")
    const partialMatch = Object.keys(cardColors).find(key => 
      cardName.toLowerCase().includes(key.toLowerCase())
    );
    
    if (partialMatch) {
      return cardColors[partialMatch];
    }
    
    // Use default colors with rotation if no match
    return defaultColors[index % defaultColors.length];
  };
  
  const linkedCards = getLinkedCards();
  const topCategory = getTopCategory();
  const topCard = getTopCard();
  
  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Dashboard</h1>
          <p>Track your rewards and optimize your spending</p>
        </div>
        <div className="dashboard-refresh-container">
          <button 
            onClick={handleRefresh} 
            className="refresh-button"
            disabled={isRefreshing}
          >
            <i className={`refresh-icon fa-solid ${isRefreshing ? 'fa-spinner fa-spin' : 'fa-rotate'}`}></i>
            {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner-wrapper">
            <div className="spinner-only"></div>
          </div>
          <div className="loading-text-wrapper">
            <p>Loading dashboard data...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="dashboard-grid">
            {/* Total Rewards Card */}
            <div className="dashboard-card total-rewards">
              <div className="card-header">
                <h2>TOTAL REWARDS</h2>
                <p className="period">THIS MONTH</p>
                <div className="gift-icon">
                  <i className="fas fa-gift"></i>
                </div>
              </div>
              <div className="card-content">
                <h3 className="amount">${(cashbackSummary?.monthly_cash_back || 0).toFixed(2)}</h3>
              </div>
            </div>
            
            {/* Top Card */}
            <div className="dashboard-card top-card">
              <div className="card-header">
                <h2>BEST PERFORMING CARD</h2>
                <p className="period">THIS MONTH</p>
                <div className="card-icon">
                  <i className="fas fa-credit-card"></i>
                </div>
              </div>
              <div className="card-content">
                <h3 className="card-name">{topCard.card || 'No Card Data'}</h3>
                <p className="card-rewards">${(topCard.amount || 0).toFixed(2)} in rewards</p>
              </div>
            </div>
          </div>
          
          {/* Rewards Trend Chart */}
          <div className="rewards-chart-container">
            <h2>Rewards by Card Over Time</h2>
            <div className="rewards-chart">
              <div className="chart-area">
                {/* Simplified chart visualization */}
                <svg width="100%" height="350" viewBox="0 0 1200 350" preserveAspectRatio="xMidYMid meet">
                  {/* Chart border for better visual structure */}
                  <rect x="50" y="50" width="1100" height="250" fill="none" stroke="#eee" strokeWidth="1" />
                  
                  {/* Y-axis */}
                  <line x1="50" y1="50" x2="50" y2="300" stroke="#666" strokeWidth="1.5" />
                  
                  {/* Y-axis labels */}
                  <text x="45" y="60" textAnchor="end" fontSize="12" fill="#666">$80</text>
                  <text x="45" y="120" textAnchor="end" fontSize="12" fill="#666">$60</text>
                  <text x="45" y="180" textAnchor="end" fontSize="12" fill="#666">$40</text>
                  <text x="45" y="240" textAnchor="end" fontSize="12" fill="#666">$20</text>
                  <text x="45" y="300" textAnchor="end" fontSize="12" fill="#666">$0</text>
                  
                  {/* Y-axis ticks */}
                  <line x1="45" y1="50" x2="50" y2="50" stroke="#666" strokeWidth="1" />
                  <line x1="45" y1="120" x2="50" y2="120" stroke="#666" strokeWidth="1" />
                  <line x1="45" y1="180" x2="50" y2="180" stroke="#666" strokeWidth="1" />
                  <line x1="45" y1="240" x2="50" y2="240" stroke="#666" strokeWidth="1" />
                  <line x1="45" y1="300" x2="50" y2="300" stroke="#666" strokeWidth="1" />
                  
                  {/* Y-axis title */}
                  <text x="10" y="175" textAnchor="middle" fontSize="12" fill="#666" transform="rotate(-90, 10, 175)">Rewards ($)</text>

                  {/* X-axis with improved styling */}
                  <line x1="50" y1="300" x2="1150" y2="300" stroke="#666" strokeWidth="1.5" />
                  
                  {/* X-axis ticks and month labels */}
                  <line x1="142" y1="300" x2="142" y2="305" stroke="#666" strokeWidth="1" />
                  <text x="142" y="320" textAnchor="middle" fontSize="10" fill="#666">Jan</text>
                  
                  <line x1="233" y1="300" x2="233" y2="305" stroke="#666" strokeWidth="1" />
                  <text x="233" y="320" textAnchor="middle" fontSize="10" fill="#666">Feb</text>
                  
                  <line x1="325" y1="300" x2="325" y2="305" stroke="#666" strokeWidth="1" />
                  <text x="325" y="320" textAnchor="middle" fontSize="10" fill="#666">Mar</text>
                  
                  <line x1="417" y1="300" x2="417" y2="305" stroke="#666" strokeWidth="1" />
                  <text x="417" y="320" textAnchor="middle" fontSize="10" fill="#666">Apr</text>
                  
                  <line x1="508" y1="300" x2="508" y2="305" stroke="#666" strokeWidth="1" />
                  <text x="508" y="320" textAnchor="middle" fontSize="10" fill="#666">May</text>
                  
                  <line x1="600" y1="300" x2="600" y2="305" stroke="#666" strokeWidth="1" />
                  <text x="600" y="320" textAnchor="middle" fontSize="10" fill="#666">Jun</text>
                  
                  <line x1="692" y1="300" x2="692" y2="305" stroke="#666" strokeWidth="1" />
                  <text x="692" y="320" textAnchor="middle" fontSize="10" fill="#666">Jul</text>
                  
                  <line x1="783" y1="300" x2="783" y2="305" stroke="#666" strokeWidth="1" />
                  <text x="783" y="320" textAnchor="middle" fontSize="10" fill="#666">Aug</text>
                  
                  <line x1="875" y1="300" x2="875" y2="305" stroke="#666" strokeWidth="1" />
                  <text x="875" y="320" textAnchor="middle" fontSize="10" fill="#666">Sep</text>
                  
                  <line x1="967" y1="300" x2="967" y2="305" stroke="#666" strokeWidth="1" />
                  <text x="967" y="320" textAnchor="middle" fontSize="10" fill="#666">Oct</text>
                  
                  <line x1="1058" y1="300" x2="1058" y2="305" stroke="#666" strokeWidth="1" />
                  <text x="1058" y="320" textAnchor="middle" fontSize="10" fill="#666">Nov</text>
                  
                  <line x1="1150" y1="300" x2="1150" y2="305" stroke="#666" strokeWidth="1" />
                  <text x="1150" y="320" textAnchor="middle" fontSize="10" fill="#666">Dec</text>
                  
                  {/* X-axis title */}
                  <text x="600" y="340" textAnchor="middle" fontSize="12" fill="#666" fontWeight="bold">Month</text>
                  
                  {/* Grid lines for better readability */}
                  <line x1="50" y1="120" x2="1150" y2="120" stroke="#eee" strokeWidth="1" strokeDasharray="5,5" />
                  <line x1="50" y1="180" x2="1150" y2="180" stroke="#eee" strokeWidth="1" strokeDasharray="5,5" />
                  <line x1="50" y1="240" x2="1150" y2="240" stroke="#eee" strokeWidth="1" strokeDasharray="5,5" />
                  
                  {/* Render SVG paths only for linked cards */}
                  {linkedCards.length > 0 ? (
                    linkedCards.map((card, index) => {
                      // More distinct paths with clearer trends up to $80 (y=50)
                      const paths = [
                        // Path 1: Clear upward trend - Cash back increases steadily throughout the year
                        "M50,270 L142,260 L233,250 L325,240 L417,230 L508,220 L600,210 L692,200 L783,180 L875,160 L967,120 L1058,80 L1150,60",
                        
                        // Path 2: End-of-quarter peaks - Cash back spikes at the end of each quarter
                        "M50,260 L142,250 L233,240 L325,200 L417,230 L508,220 L600,180 L692,210 L783,200 L875,160 L967,190 L1058,170 L1150,70",
                        
                        // Path 3: Summer spending - Cash back increases during summer months and holidays
                        "M50,280 L142,270 L233,260 L325,250 L417,230 L508,160 L600,130 L692,120 L783,140 L875,180 L967,150 L1058,100 L1150,90",
                        
                        // Path 4: Gradual growth - Cash back increases steadily but at a more conservative rate
                        "M50,290 L142,285 L233,280 L325,275 L417,270 L508,260 L600,250 L692,240 L783,220 L875,200 L967,180 L1058,160 L1150,140"
                      ];
                      
                      const pathIndex = index % paths.length;
                      return (
                        <path 
                          key={card}
                          d={paths[pathIndex]} 
                          fill="none" 
                          stroke={getCardColor(card, index)} 
                          strokeWidth="4" 
                        />
                      );
                    })
                  ) : (
                    // Fallback to static paths if no linked cards
                    <>
                      {/* Clear trend static paths with distinct patterns */}
                      <path d="M50,270 L142,260 L233,250 L325,240 L417,230 L508,220 L600,210 L692,200 L783,180 L875,160 L967,120 L1058,80 L1150,60" 
                            fill="none" stroke="#ACE5DE" strokeWidth="4" />
                      <path d="M50,260 L142,250 L233,240 L325,200 L417,230 L508,220 L600,180 L692,210 L783,200 L875,160 L967,190 L1058,170 L1150,70" 
                            fill="none" stroke="#2777E7" strokeWidth="4" />
                      <path d="M50,280 L142,270 L233,260 L325,250 L417,230 L508,160 L600,130 L692,120 L783,140 L875,180 L967,150 L1058,100 L1150,90" 
                            fill="none" stroke="#9DE88C" strokeWidth="4" />
                      <path d="M50,290 L142,285 L233,280 L325,275 L417,270 L508,260 L600,250 L692,240 L783,220 L875,200 L967,180 L1058,160 L1150,140" 
                            fill="none" stroke="#388E3C" strokeWidth="4" />
                    </>
                  )}
                </svg>
                
                {/* Remove the redundant X-axis labels since we added them to the SVG */}
                <div className="chart-x-labels" style={{ display: 'none' }}>
                  <span>January</span>
                  <span>February</span>
                  <span>March</span>
                  <span>April</span>
                  <span>May</span>
                  <span>June</span>
                  <span>July</span>
                  <span>August</span>
                  <span>September</span>
                  <span>October</span>
                  <span>November</span>
                  <span>December</span>
                </div>
              </div>
              
              {/* Dynamic Chart legend */}
              <div className="chart-legend">
                {linkedCards.length > 0 ? (
                  linkedCards.map((card, index) => (
                    <div className="legend-item" key={card}>
                      <span 
                        className="legend-color" 
                        style={{ backgroundColor: getCardColor(card, index) }}
                      ></span>
                      <span>{card}</span>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#ACE5DE' }}></span>
                      <span>Chase</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#2777E7' }}></span>
                      <span>AMEX</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#9DE88C' }}></span>
                      <span>Bank of America</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#388E3C' }}></span>
                      <span>Discover</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard; 