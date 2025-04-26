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
  const fetchAccounts = useCallback(async () => {
    if (!userId) return;
    
    try {
      setIsLoading(true);
      const data = await plaidService.getAccounts(userId);
      setAccounts(data.accounts);
      return data.accounts;
    } catch (error) {
      console.error('Error fetching accounts:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

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
  const openPlaidLink = useCallback((onSuccess?: () => void) => {
    if (!linkToken || !userId) return;
    
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
            await plaidService.exchangeToken(public_token, userId);
            // Refresh accounts list
            await fetchAccounts();
            // Call success callback if provided
            if (onSuccess) {
              onSuccess();
            }
          } catch (error) {
            console.error('Error exchanging token:', error);
          }
        },
        onExit: (err: any) => {
          if (err) console.error('Plaid Link error:', err);
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
  }, [linkToken, userId, fetchAccounts]);

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
      getLinkToken();
      fetchAccounts();
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