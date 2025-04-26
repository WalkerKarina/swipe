import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { plaidService } from '../../services/api';
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

  // Custom removeAccount that retains function signature for compatibility
  const removeAccount = useCallback(async (accountId: string) => {
    await removePlaidAccount(accountId);
  }, [removePlaidAccount]);

  // Enhance the openPlaidLink to retain its existing behavior
  const handleOpenPlaidLink = useCallback(() => {
    // Use the enhanced Plaid Link with a success callback
    const cleanup = openPlaidLink();
    return cleanup;
  }, [openPlaidLink]);

  return (
    <div className="profile">
      <h1>Profile</h1>
      <p>{user?.name}'s Banking Profile</p>
      
      <div className="profile-content">
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
