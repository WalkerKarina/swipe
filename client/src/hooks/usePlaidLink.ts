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

// Cache expiration time (in milliseconds) - 5 minutes
const CACHE_EXPIRATION = 5 * 60 * 1000;

export const usePlaidLink = (userId?: string) => {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRemoving, setIsRemoving] = useState(false);

  // Load accounts from cache
  const loadFromCache = useCallback(() => {
    if (!userId) return null;
    
    const cachedData = localStorage.getItem(`accounts_${userId}`);
    if (!cachedData) return null;
    
    try {
      const { data, timestamp } = JSON.parse(cachedData);
      // Check if cache is still valid
      if (Date.now() - timestamp < CACHE_EXPIRATION) {
        return data;
      }
    } catch (error) {
      console.error('Error parsing cached accounts:', error);
    }
    
    return null;
  }, [userId]);

  // Save accounts to cache
  const saveToCache = useCallback((data: LinkedAccount[]) => {
    if (!userId) return;
    
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(`accounts_${userId}`, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error saving accounts to cache:', error);
    }
  }, [userId]);

  // Fetch existing linked accounts
  const fetchAccounts = useCallback(async (skipLoadingState = false, bypassCache = false) => {
    if (!userId) return;
    
    try {
      if (!skipLoadingState) {
        setIsLoading(true);
      }
      
      // Try to load from cache first if not bypassing cache
      if (!bypassCache) {
        const cachedAccounts = loadFromCache();
        if (cachedAccounts) {
          setAccounts(cachedAccounts);
          if (!skipLoadingState) {
            setIsLoading(false);
          }
          return cachedAccounts;
        }
      }
      
      // If no cache or bypassing cache, fetch from API
      const data = await plaidService.getAccounts(userId);
      
      // Update the accounts state
      if (!skipLoadingState || accounts.length === 0) {
        setAccounts(data.accounts);
      }
      
      // Cache the fetched accounts
      saveToCache(data.accounts);
      
      return data.accounts;
    } catch (error) {
      console.error('Error fetching accounts:', error);
      return [];
    } finally {
      if (!skipLoadingState) {
        setIsLoading(false);
      }
    }
  }, [userId, accounts.length, loadFromCache, saveToCache]);

  // Force refresh accounts (bypass cache)
  const refreshAccounts = useCallback(async () => {
    return fetchAccounts(false, true);
  }, [fetchAccounts]);

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
            
            // Fetch the updated accounts with cache bypass
            const updatedAccounts = await fetchAccounts(false, true);
            
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
      const updatedAccounts = accounts.filter(account => account.id !== accountId);
      setAccounts(updatedAccounts);
      
      // Update the cache with the new account list
      saveToCache(updatedAccounts);
    } catch (error) {
      console.error('Error removing account:', error);
      alert('An error occurred while removing the account');
    } finally {
      setIsRemoving(false);
    }
  }, [userId, accounts, saveToCache]);

  // Initialize on mount
  useEffect(() => {
    if (userId) {
      // First set loading state
      setIsLoading(true);
      
      // Try loading from cache first
      const cachedAccounts = loadFromCache();
      if (cachedAccounts) {
        setAccounts(cachedAccounts);
        setIsLoading(false);
        
        // Still fetch in the background to update the cache
        getLinkToken();
        fetchAccounts(true, false).catch(console.error);
      } else {
        // If no cache, get link token and fetch accounts in parallel
        Promise.all([
          getLinkToken(),
          fetchAccounts(true, false) // Allow using cache, but skip additional loading state change
        ]).finally(() => {
          setIsLoading(false);
        });
      }
    }
  }, [userId, getLinkToken, fetchAccounts, loadFromCache]);

  return {
    accounts,
    linkToken,
    isLoading,
    isRemoving,
    fetchAccounts,
    refreshAccounts,
    openPlaidLink,
    removeAccount
  };
};

export default usePlaidLink; 