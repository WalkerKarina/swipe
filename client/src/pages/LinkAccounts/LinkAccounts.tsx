import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import usePlaidLink from '../../hooks/usePlaidLink';
import './LinkAccounts.css';
import logo from '../../assets/swipe_card_black.png';

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

const LinkAccounts: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { 
    accounts, 
    linkToken, 
    isLoading, 
    isRemoving, 
    openPlaidLink, 
    removeAccount,
    fetchAccounts 
  } = usePlaidLink(user?.id);

  // Navigate based on accounts status:
  // - If accounts are linked, go to pitch page
  // - If no accounts linked, go to virtual card details
  const handleContinue = () => {
    if (accounts.length > 0) {
      navigate('/pitch');
    } else {
      navigate('/card-details');
    }
  };

  // Handle link success - refresh accounts but don't navigate automatically
  const handleLinkSuccess = async (isRefreshing: boolean) => {
    // Set the refreshing state based on the parameter
    setIsRefreshing(isRefreshing);
    console.log(`Link success: ${isRefreshing ? "Starting refresh" : "Refresh completed"}`);
  };
  
  // Handle cancellation of the Plaid Link flow
  const handleLinkCancel = () => {
    setIsRefreshing(false);
    console.log("Link cancelled");
  };

  // Handle opening Plaid Link with success callback
  const handleOpenPlaidLink = () => {
    // Only set refreshing state on success, not on open
    openPlaidLink(handleLinkSuccess, handleLinkCancel);
  };

  return (
    <div className="link-accounts-page">
      <div className="logo-area">
        <Link to="/">
          <img src={logo} alt="SmartSwipe Logo" className="logo" />
        </Link>
      </div>
      
      <div className="link-accounts-container">
        <div className="link-accounts-card">
          {accounts.length === 0 ? (
            <>
              <h1>Link Your First Bank Account</h1>
              
              <button 
                onClick={handleOpenPlaidLink} 
                className="link-new-account-button"
                disabled={!linkToken || isRemoving || isRefreshing}
              >
                Link New Account
              </button>
              
              <div className="empty-state-message">
                <p>You haven't linked any bank accounts yet.</p>
                <p>Link your first account to get started.</p>
              </div>
              
              <button 
                onClick={handleContinue}
                className="continue-anyway-button"
              >
                Continue Anyway
              </button>
            </>
          ) : (
            <>
              <h1>Link Bank Accounts</h1>
              
              <button 
                onClick={handleOpenPlaidLink} 
                className="link-new-account-button"
                disabled={!linkToken || isRemoving || isRefreshing}
              >
                Link New Account
              </button>
              
              {isLoading || isRefreshing ? (
                <div className="loading">
                  {isRefreshing ? "Adding new account..." : "Loading accounts..."}
                </div>
              ) : (
                <div className="accounts-list">
                  {accounts.map(account => (
                    <div key={account.id} className="account-item">
                      <div className="account-details">
                        <h3>{account.institutionName}</h3>
                        <p>{account.name} •••{account.mask}</p>
                      </div>
                      <button 
                        onClick={() => removeAccount(account.id)}
                        className="remove-button"
                        disabled={isRemoving}
                      >
                        X
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <button 
                onClick={handleContinue}
                className="continue-button"
                disabled={isRefreshing}
              >
                Continue
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LinkAccounts; 