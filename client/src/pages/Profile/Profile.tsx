import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { plaidService, CashBackSummary, OptimalCashBack } from '../../services/api';
import usePlaidLink from '../../hooks/usePlaidLink';
import './Profile.css';

// Add Plaid type definition
declare global {
  interface Window {
    Plaid: {
      create: (config: any) => {
        open: () => void;
      };
    };
  }
}

const Profile: React.FC = () => {
  const { user } = useAuth();
  const { 
    accounts, 
    linkToken, 
    isLoading, 
    isRemoving, 
    openPlaidLink, 
    removeAccount: removePlaidAccount 
  } = usePlaidLink(user?.id);
  
  const [cashBackSummary, setCashBackSummary] = useState<CashBackSummary | null>(null);
  const [isCashBackLoading, setIsCashBackLoading] = useState(true);
  const [optimalCashBack, setOptimalCashBack] = useState<OptimalCashBack | null>(null);
  const [isOptimalLoading, setIsOptimalLoading] = useState(true);

  // Fetch cash back summary
  const fetchCashBackSummary = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setIsCashBackLoading(true);
      const response = await plaidService.getCashBackSummary(user.id);
      
      if (response && response.status === 'success' && response.data) {
        // Map the backend response to match our frontend CashBackSummary interface
        const summaryData: CashBackSummary = {
          total_cash_back: response.data.total_cashback || 0,
          monthly_cash_back: 0, // We'll need to calculate this if the backend doesn't provide it
          rewards_by_category: response.data.cashback_by_card || {}
        };
        
        setCashBackSummary(summaryData);
        console.log("Fetched cash back summary:", summaryData);
      } else {
        console.error('Invalid response format from cash back summary endpoint', response);
        setCashBackSummary(null);
      }
    } catch (error) {
      console.error('Error fetching cash back summary:', error);
      setCashBackSummary(null);
    } finally {
      setIsCashBackLoading(false);
    }
  }, [user?.id]);

  // Fetch optimal cash back
  const fetchOptimalCashBack = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setIsOptimalLoading(true);
      const response = await plaidService.getOptimalCashBack(user.id);
      
      if (response && response.status === 'success' && response.data) {
        setOptimalCashBack(response.data);
        console.log("Fetched optimal cash back:", response.data);
      } else {
        console.error('Invalid response format from optimal cash back endpoint', response);
        setOptimalCashBack(null);
      }
    } catch (error) {
      console.error('Error fetching optimal cash back:', error);
      setOptimalCashBack(null);
    } finally {
      setIsOptimalLoading(false);
    }
  }, [user?.id]);

  // Custom removeAccount that also refreshes cashback data
  const removeAccount = useCallback(async (accountId: string) => {
    await removePlaidAccount(accountId);
    // Refresh cashback summary after removing account
    fetchCashBackSummary();
    // Refresh optimal cashback
    fetchOptimalCashBack();
  }, [removePlaidAccount, fetchCashBackSummary, fetchOptimalCashBack]);

  // Enhance the openPlaidLink to also refresh cashback data
  const handleOpenPlaidLink = useCallback(() => {
    // Use the enhanced Plaid Link with a success callback
    const cleanup = openPlaidLink();
    // After linking, refresh the cashback data
    setTimeout(() => {
      fetchCashBackSummary();
      fetchOptimalCashBack();
    }, 2000); // Give a bit of time for the server to process the new account
    
    return cleanup;
  }, [openPlaidLink, fetchCashBackSummary, fetchOptimalCashBack]);

  // Fetch cashback data on mount
  useEffect(() => {
    fetchCashBackSummary();
    fetchOptimalCashBack();
  }, [fetchCashBackSummary, fetchOptimalCashBack]);

  // Format currency amount
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Format percentage
  const formatPercentage = (percentage: number) => {
    return `${percentage.toFixed(1)}%`;
  };

  return (
    <div className="profile">
      <h1>Profile</h1>
      <p>{user?.name}'s Banking Profile</p>
      
      <div className="profile-content">
        {/* Cash Back Summary Section */}
        <div className="cash-back-section">
          <h2>Cash Back Rewards</h2>
          
          {isCashBackLoading ? (
            <div className="loading">Loading cash back information...</div>
          ) : cashBackSummary && cashBackSummary.total_cash_back > 0 ? (
            <div className="cash-back-summary">
              <div className="cash-back-card total">
                <h3>Total Cash Back</h3>
                <p className="amount">{formatCurrency(cashBackSummary.total_cash_back)}</p>
              </div>
              
              {cashBackSummary.monthly_cash_back > 0 && (
                <div className="cash-back-card monthly">
                  <h3>This Month</h3>
                  <p className="amount">{formatCurrency(cashBackSummary.monthly_cash_back)}</p>
                </div>
              )}
              
              {Object.entries(cashBackSummary.rewards_by_category).length > 0 && (
                <div className="cash-back-categories">
                  <h3>Rewards by Card</h3>
                  <div className="category-list">
                    {Object.entries(cashBackSummary.rewards_by_category).map(([category, amount]) => (
                      <div key={category} className="category-item">
                        <span className="category-name">{category}</span>
                        <span className="category-amount">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="no-cash-back">
              <p>No cash back rewards found.</p>
              <p>Link your accounts to start earning rewards.</p>
            </div>
          )}
        </div>

        {/* Optimal Cash Back Section */}
        <div className="optimal-cash-back-section">
          <h2>Maximize Your Rewards</h2>
          
          {isOptimalLoading ? (
            <div className="loading">Calculating optimal rewards...</div>
          ) : optimalCashBack && optimalCashBack.optimal_total_cashback > 0 ? (
            <div className="optimal-cash-back-content">
              <div className="optimal-cash-back-summary">
                <div className="cash-back-card optimal-total">
                  <h3>Potential Cash Back</h3>
                  <p className="amount">{formatCurrency(optimalCashBack.optimal_total_cashback)}</p>
                </div>
                
                <div className="cash-back-card increase">
                  <h3>Potential Increase</h3>
                  <p className="amount">
                    {formatCurrency(optimalCashBack.potential_increase)}
                    <span className="percentage">({formatPercentage(optimalCashBack.improvement_percentage)})</span>
                  </p>
                </div>
              </div>
              
              {optimalCashBack.top_improvement_opportunities.length > 0 && (
                <div className="improvement-opportunities">
                  <h3>Top Opportunities to Earn More</h3>
                  <div className="opportunities-list">
                    {optimalCashBack.top_improvement_opportunities.slice(0, 5).map((opportunity, index) => (
                      <div key={index} className="opportunity-item">
                        <div className="opportunity-header">
                          <span className="merchant">{opportunity.merchant}</span>
                          <span className="date">{new Date(opportunity.date).toLocaleDateString()}</span>
                        </div>
                        <div className="opportunity-details">
                          <div className="opportunity-amount">
                            <span className="label">Purchase:</span>
                            <span className="value">{formatCurrency(opportunity.amount)}</span>
                          </div>
                          <div className="opportunity-cards">
                            <div className="actual-card">
                              <span className="label">Used:</span>
                              <span className="card-name">{opportunity.actual_card}</span>
                              <span className="card-reward">{formatCurrency(opportunity.actual_cashback)}</span>
                            </div>
                            <div className="optimal-card">
                              <span className="label">Best option:</span>
                              <span className="card-name">{opportunity.optimal_card}</span>
                              <span className="card-reward">{formatCurrency(opportunity.optimal_cashback)}</span>
                            </div>
                          </div>
                          <div className="savings">
                            <span className="label">Missed rewards:</span>
                            <span className="value highlight">{formatCurrency(opportunity.improvement)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {Object.entries(optimalCashBack.optimal_cashback_by_card).length > 0 && (
                <div className="optimal-cards">
                  <h3>Best Cards for Your Spending</h3>
                  <div className="category-list">
                    {Object.entries(optimalCashBack.optimal_cashback_by_card).map(([card, amount]) => (
                      <div key={card} className="category-item">
                        <span className="category-name">{card}</span>
                        <span className="category-amount">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="no-cash-back">
              <p>No optimization data available.</p>
              <p>Link more accounts to get personalized recommendations.</p>
            </div>
          )}
        </div>

        <div className="bank-accounts-section">
          <div className="section-header">
            <h2>Linked Bank Accounts</h2>
            <button 
              onClick={handleOpenPlaidLink} 
              className="link-account-button"
              disabled={!linkToken || isRemoving}
            >
              Link New Account
            </button>
          </div>
          
          {isLoading ? (
            <div className="loading">Loading accounts...</div>
          ) : accounts.length > 0 ? (
            <div className="accounts-list">
              {accounts.map(account => (
                <div key={account.id} className="account-card">
                  <div className="account-info">
                    <h3>{account.institutionName}</h3>
                    <p>{account.name} •••• {account.mask}</p>
                  </div>
                  <button 
                    onClick={() => removeAccount(account.id)}
                    className="remove-account-button"
                    disabled={isRemoving}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-accounts">
              <p>You haven't linked any bank accounts yet.</p>
              <p>Link your first account to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile; 
