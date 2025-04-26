import { useState, useCallback, useEffect } from 'react';
import { plaidService, LinkedAccount } from '../services/api';

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

export const usePlaidLink = (userId?: string) => {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRemoving, setIsRemoving] = useState(false);

  // Fetch existing linked accounts
  const fetchAccounts = useCallback(async (skipLoadingState = false) => {
    if (!userId) return;
    
    try {
      if (!skipLoadingState) {
        setIsLoading(true);
      }
      const data = await plaidService.getAccounts(userId);
      
      // Only update the accounts state if we're not skipping the loading state
      // or if the accounts list is currently empty
      if (!skipLoadingState || accounts.length === 0) {
        setAccounts(data.accounts);
      }
      
      return data.accounts;
    } catch (error) {
      console.error('Error fetching accounts:', error);
      return [];
    } finally {
      if (!skipLoadingState) {
        setIsLoading(false);
      }
    }
  }, [userId, accounts.length]);

  // Get a link token from the server
  const getLinkToken = useCallback(async () => {
    if (!userId) return;
    
    try {
      const data = await plaidService.createLinkToken(userId);
      setLinkToken(data.link_token);
    } catch (error) {
      console.error('Error creating link token:', error);
    }
  }, [userId]);

  // Handle opening Plaid Link
  const openPlaidLink = useCallback((onSuccess?: (isRefreshing: boolean) => void, onCancel?: () => void) => {
    if (!linkToken || !userId) return;
    
    // Remove any existing Plaid Link scripts to ensure fresh instance
    const existingScripts = document.querySelectorAll('script[src*="plaid.com/link"]');
    existingScripts.forEach(script => {
      document.body.removeChild(script);
    });
    
    // Load Plaid Link script dynamically
    const script = document.createElement('script');
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
    script.async = true;
    script.onload = () => {
      // Initialize Plaid Link
      const handler = window.Plaid.create({
        token: linkToken,
        onSuccess: async (public_token: string) => {
          // Exchange public token for access token on the server
          try {
            // Signal refreshing start
            if (onSuccess) {
              onSuccess(true);
            }
            
            // First exchange the token
            await plaidService.exchangeToken(public_token, userId);
            
            // Then get a fresh link token
            await getLinkToken();
            
            // Fetch the updated accounts but don't update state yet
            const updatedAccounts = await plaidService.getAccounts(userId);
            
            // Now update the accounts state all at once after all operations
            setAccounts(updatedAccounts.accounts);
            
            // Signal refresh complete
            if (onSuccess) {
              onSuccess(false);
            }
          } catch (error) {
            console.error('Error exchanging token:', error);
            if (onSuccess) {
              onSuccess(false);
            }
          }
        },
        onExit: (err: any) => {
          if (err) console.error('Plaid Link error:', err);
          // Remove the script after exit to ensure clean state for next time
          if (document.body.contains(script)) {
            document.body.removeChild(script);
          }
          
          // Call cancel callback if provided and there was no success
          // (onExit is called even after successful linking)
          if (onCancel && !err?.success) {
            onCancel();
          }
        },
      });
      
      handler.open();
    };
    
    document.body.appendChild(script);
    
    // Clean up function
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [linkToken, userId, fetchAccounts, getLinkToken]);

  // Function to remove an account
  const removeAccount = useCallback(async (accountId: string) => {
    if (!userId) return;
    
    if (!window.confirm('Are you sure you want to remove this account?')) {
      return;
    }
    
    try {
      setIsRemoving(true);
      await plaidService.removeAccount(accountId, userId);
      // Remove account from state if successfully deleted
      setAccounts(prevAccounts => prevAccounts.filter(account => account.id !== accountId));
    } catch (error) {
      console.error('Error removing account:', error);
      alert('An error occurred while removing the account');
    } finally {
      setIsRemoving(false);
    }
  }, [userId]);

  // Initialize on mount
  useEffect(() => {
    if (userId) {
      // First set loading state
      setIsLoading(true);
      
      // Get link token and fetch accounts in parallel
      Promise.all([
        getLinkToken(),
        fetchAccounts(true) // Skip additional loading state change
      ]).finally(() => {
        setIsLoading(false);
      });
    }
  }, [userId, getLinkToken, fetchAccounts]);

  return {
    accounts,
    linkToken,
    isLoading,
    isRemoving,
    fetchAccounts,
    openPlaidLink,
    removeAccount
  };
};

export default usePlaidLink; 