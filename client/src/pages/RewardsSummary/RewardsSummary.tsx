import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { plaidService } from '../../services/api';
import './RewardsSummary.css';
import logo from '../../assets/swipe_card_black.png';

interface RewardsSummaryData {
  actualCashback: number;
  optimalCashback: number;
  percentageIncrease: number;
  isLoading: boolean;
  error: string | null;
}

const RewardsSummary: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rewardsData, setRewardsData] = useState<RewardsSummaryData>({
    actualCashback: 0,
    optimalCashback: 0,
    percentageIncrease: 0,
    isLoading: true,
    error: null
  });
  const [dataFetched, setDataFetched] = useState(false);

  useEffect(() => {
    // Prevent multiple fetches
    if (dataFetched) return;

    const fetchRewardsData = async () => {
      try {
        setRewardsData(prev => ({ ...prev, isLoading: true, error: null }));
        console.log("Fetching rewards data...");

        // Create an array of promises to fetch both data sources simultaneously
        const [cashbackResponse, optimalResponse] = await Promise.all([
          plaidService.getCashBackSummary(user?.id),
          plaidService.getOptimalCashBack(user?.id)
        ]);

        console.log("Cashback response:", cashbackResponse);
        console.log("Optimal response:", optimalResponse);

        // Validate both responses
        if (!cashbackResponse || cashbackResponse.status !== 'success') {
          throw new Error('Failed to fetch current cashback data');
        }

        if (!optimalResponse || optimalResponse.status !== 'success') {
          throw new Error('Failed to fetch optimal cashback data');
        }

        // Calculate percentage increase
        const actual = cashbackResponse.data.total_cashback || 0;
        const optimal = optimalResponse.data.optimal_total_cashback || 0;
        const percentageIncrease = actual > 0 
          ? ((optimal / actual) - 1) * 100 
          : 0;

        console.log("Setting final rewards data:", {
          actual,
          optimal,
          percentageIncrease: Math.round(percentageIncrease)
        });

        // Update state only once with final data
        setRewardsData({
          actualCashback: actual,
          optimalCashback: optimal,
          percentageIncrease: Math.round(percentageIncrease),
          isLoading: false,
          error: null
        });

        // Mark data as fetched
        setDataFetched(true);
      } catch (error) {
        console.error('Error fetching rewards data:', error);
        setRewardsData(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: error instanceof Error ? error.message : 'An error occurred'
        }));
        setDataFetched(true);
      }
    };

    if (user?.id) {
      fetchRewardsData();
    }
  }, [user?.id, dataFetched]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const getPreviousMonthName = () => {
    const now = new Date();
    // Get previous month (0-11)
    const previousMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    // Convert to month name
    return new Date(0, previousMonth).toLocaleString('default', { month: 'long' });
  };

  const handleContinue = () => {
    navigate('/card-details');
  };

  return (
    <div className="rewards-summary-page">
      <div className="logo-area">
        <Link to="/">
          <img src={logo} alt="SmartSwipe Logo" className="logo" />
        </Link>
      </div>

      <div className="rewards-summary-container">
        <div className="rewards-summary-content">
          <h1>You're Ready to Start Maximizing Rewards with <span className="text-highlight">Swipe</span>!</h1>
          
          {rewardsData.isLoading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Calculating your potential rewards...</p>
            </div>
          ) : rewardsData.error ? (
            <div className="error-state">
              <p>We couldn't calculate your rewards at this time.</p>
              <p className="error-message">{rewardsData.error}</p>
              <button onClick={handleContinue} className="continue-button">
                Continue to Card Details
              </button>
            </div>
          ) : (
            <>
              <div className="rewards-comparison">
                <div className="time-period-label">
                  Based on your spending data from {getPreviousMonthName()}
                </div>

                <div className="rewards-card current">
                  <h2>Current Rewards</h2>
                  <div className="rewards-amount">
                    {formatCurrency(rewardsData.actualCashback)}
                  </div>
                </div>

                <div className="rewards-arrow">
                  <div className="percentage-increase">+{rewardsData.percentageIncrease}%</div>
                  <div className="arrow">→</div>
                </div>

                <div className="rewards-card potential">
                  <h2>Potential Rewards</h2>
                  <div className="rewards-amount highlight">
                    {formatCurrency(rewardsData.optimalCashback)}
                  </div>
                </div>
              </div>

              <button onClick={handleContinue} className="continue-button">
                Continue to Card Details
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RewardsSummary; 