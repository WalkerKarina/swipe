import React, { useEffect, useState } from 'react';
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

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [cashbackSummary, setCashbackSummary] = useState<CashBackSummary | null>(null);
  const [transactionSummary, setTransactionSummary] = useState<TransactionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      
      setLoading(true);
      try {
        // Fetch cashback and transaction summary in parallel
        const [cashbackResponse, summaryData] = await Promise.all([
          plaidService.getCashBackSummary(user.id).catch(() => null),
          transactionService.getTransactionSummary(user.id).catch(() => ({
            spending_by_card: {},
            cashback_by_card: {}
          }))
        ]);
        
        // Parse cashback data correctly, matching the API response structure
        if (cashbackResponse && cashbackResponse.status === 'success' && cashbackResponse.data) {
          const cashbackData: CashBackSummary = {
            total_cash_back: cashbackResponse.data.total_cashback || 0,
            monthly_cash_back: cashbackResponse.data.total_cashback || 0, // Using total as monthly for now
            rewards_by_category: cashbackResponse.data.cashback_by_card || {}
          };
          setCashbackSummary(cashbackData);
        } else {
          setCashbackSummary({
            total_cash_back: 0,
            monthly_cash_back: 0,
            rewards_by_category: {}
          });
        }
        
        setTransactionSummary(summaryData || {
          spending_by_card: {},
          cashback_by_card: {}
        });
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
      }
    };
    
    fetchData();
  }, [user?.id]);
  
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
  
  const topCategory = getTopCategory();
  const topCard = getTopCard();
  
  if (loading) {
    return <div className="dashboard-loading">Loading dashboard data...</div>;
  }
  
  return (
    <div className="dashboard-container">
      
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Dashboard</h1>
          <p>Track your rewards and optimize your spending</p>
        </div>
      </div>
      
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
            <svg width="100%" height="300" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid meet">
              {/* X-axis (months) */}
              <line x1="50" y1="250" x2="1150" y2="250" stroke="#ddd" strokeWidth="1" />
              
              {/* Chase line */}
              <path d="M50,200 Q200,150 350,180 T650,100 T950,180 T1150,150" 
                    fill="none" stroke="#ACE5DE" strokeWidth="3" />
              
              {/* AMEX line */}
              <path d="M50,220 Q200,250 350,200 T650,250 T950,150 T1150,200" 
                    fill="none" stroke="#2777E7" strokeWidth="3" />
              
              {/* Bank of America line */}
              <path d="M50,150 Q200,100 350,180 T650,150 T950,100 T1150,180" 
                    fill="none" stroke="#9DE88C" strokeWidth="3" />
              
              {/* Discover line */}
              <path d="M50,180 Q200,150 350,100 T650,200 T950,100 T1150,120" 
                    fill="none" stroke="#388E3C" strokeWidth="3" />
            </svg>
            
            {/* X-axis labels */}
            <div className="chart-x-labels">
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
          
          {/* Chart legend */}
          <div className="chart-legend">
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 