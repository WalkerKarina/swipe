import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { transactionService, plaidService, Transaction } from '../../services/api';
import './Transactions.css';

interface CashbackData {
  total_cashback: number;
  cashback_by_card: Record<string, number>;
  spending_by_card: Record<string, number>;
}

// Shared color function to ensure consistency between components
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

// Cashback Summary Component
const CashbackSummary: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cashbackData, setCashbackData] = useState<CashbackData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCashbackData = async () => {
      if (!user?.id) return;
      
      try {
        setIsLoading(true);
        
        // Try to get cached cashback data
        const cachedData = localStorage.getItem(`cashback_${user.id}`);
        if (cachedData) {
          const { data, timestamp } = JSON.parse(cachedData);
          const cacheAge = Date.now() - timestamp;
          // Use cache if it's less than 15 minutes old
          if (cacheAge < 15 * 60 * 1000) {
            console.log('Using cached cashback data');
            setCashbackData(data);
            setIsLoading(false);
            return;
          }
        }
        
        // Fetch fresh data if no cache or cache expired
        const response = await plaidService.getCashBackSummary(user.id);
        if (response && response.status === 'success' && response.data) {
          setCashbackData(response.data);
          
          // Cache the new data
          localStorage.setItem(`cashback_${user.id}`, JSON.stringify({
            data: response.data,
            timestamp: Date.now()
          }));
        } else {
          setError('Could not load cashback data.');
        }
      } catch (err: any) {
        console.error('Error fetching cashback data:', err);
        setError('Could not load cashback data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCashbackData();
  }, [user?.id]);

  // Format currency amount
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const handleCardClick = (cardName: string) => {
    console.log("Navigating to card details for:", cardName);
    // Navigate to the card details page with the card name as a URL parameter
    // and pass state to indicate it came from the transactions page
    navigate(`/card-details/${encodeURIComponent(cardName)}`, { 
      state: { from: 'transactions' } 
    });
  };

  if (isLoading) {
    return (
      <div className="cashback-loading">
        <div className="spinner-small"></div>
      </div>
    );
  }

  if (error || !cashbackData) {
    return null; // Don't show any error message to keep the UI clean
  }

  return (
    <div className="cashback-summary">
      <div className="cashback-header">
        <h2>Cashback Summary</h2>
        <span className="cashback-total">
          Total: {formatCurrency(cashbackData.total_cashback)}
        </span>
      </div>
      <div className="cashback-cards">
        {Object.entries(cashbackData.cashback_by_card).map(([cardName, amount], index) => (
          <div 
            key={cardName} 
            className="cashback-card"
            style={{ backgroundColor: getCardColor(index), cursor: 'pointer' }}
            onClick={() => handleCardClick(cardName)}
          >
            <h3>{cardName}</h3>
            <div className="cashback-amount">{formatCurrency(amount)}</div>
            <div className="cashback-spending">
              Total Spent: {formatCurrency(cashbackData.spending_by_card[cardName] || 0)}
            </div>
            <div className="cashback-rate">
              {((amount / (cashbackData.spending_by_card[cardName] || 1)) * 100).toFixed(1)}% back
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Transactions: React.FC = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [hasLinkedAccounts, setHasLinkedAccounts] = useState(true);
  const [cashbackData, setCashbackData] = useState<CashbackData | null>(null);
  const [cardNameToIndexMap, setCardNameToIndexMap] = useState<Record<string, number>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch cashback data to build the institution-to-color mapping
  useEffect(() => {
    const fetchCashbackData = async () => {
      if (!user?.id) return;
      
      try {
        setIsLoading(true);
        
        // Try to get cached cashback data first
        const cachedData = localStorage.getItem(`cashback_${user.id}`);
        if (cachedData) {
          const { data, timestamp } = JSON.parse(cachedData);
          const cacheAge = Date.now() - timestamp;
          // Use cache if it's less than 15 minutes old
          if (cacheAge < 15 * 60 * 1000) {
            console.log('Using cached cashback data for color mapping');
            setCashbackData(data);
            
            // Create a mapping from card name to its index for color matching
            const mapping: Record<string, number> = {};
            Object.keys(data.cashback_by_card).forEach((cardName, index) => {
              mapping[cardName] = index;
            });
            setCardNameToIndexMap(mapping);
            return;
          }
        }
        
        // Fetch fresh data if no cache or cache expired
        const response = await plaidService.getCashBackSummary(user.id);
        if (response && response.status === 'success' && response.data) {
          setCashbackData(response.data);
          
          // Create a mapping from card name to its index for color matching
          const mapping: Record<string, number> = {};
          Object.keys(response.data.cashback_by_card).forEach((cardName, index) => {
            mapping[cardName] = index;
          });
          setCardNameToIndexMap(mapping);
          
          // Cache the new data
          localStorage.setItem(`cashback_${user.id}`, JSON.stringify({
            data: response.data,
            timestamp: Date.now()
          }));
        }
      } catch (err: any) {
        console.error('Error fetching cashback data for color mapping:', err);
      }
    };
    
    fetchCashbackData();
  }, [user?.id]);

  // Function to fetch transactions - made into a callback so it can be reused for refresh
  const fetchTransactions = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      
      // Try to get cached transactions if not forcing a refresh
      if (!forceRefresh) {
        const cachedData = localStorage.getItem(`transactions_${user.id}`);
        if (cachedData) {
          const { data, timestamp } = JSON.parse(cachedData);
          const cacheAge = Date.now() - timestamp;
          // Use cache if it's less than 15 minutes old
          if (cacheAge < 15 * 60 * 1000) {
            console.log('Using cached transactions data');
            setTransactions(data || []);
            setHasLinkedAccounts(true);
            setError(null);
            setIsLoading(false);
            return;
          }
        }
      }
      
      // Fetch fresh data if no cache or forcing refresh
      const data = await transactionService.getTransactions(user.id);
      console.log('API response data:', data);
      
      if (data.data && data.data.length > 0) {
        const sample = data.data[0];
        if (sample.category) {
          console.log('Sample category:', sample.category, 'type:', typeof sample.category);
        }
      }
      
      setTransactions(data.data || []);
      setHasLinkedAccounts(true);
      setError(null);
      
      // Cache the new data
      localStorage.setItem(`transactions_${user.id}`, JSON.stringify({
        data: data.data,
        timestamp: Date.now()
      }));
      
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
      // Handle the specific "no linked accounts" error case
      if (err.response && err.response.status === 404 && 
          err.response.data && err.response.data.error === 'no_linked_accounts') {
        setHasLinkedAccounts(false);
        setError(null);
      } else {
        setError('Could not load transactions. Please try again later.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  // Fetch transactions on component mount
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Add a function to refresh both cashback and transactions data
  const handleRefresh = () => {
    setIsRefreshing(true);
    
    // Clear cashback cache
    if (user?.id) {
      localStorage.removeItem(`cashback_${user.id}`);
    }
    
    // Force refresh transactions (which clears its own cache)
    fetchTransactions(true);
  };

  // Function to get color for an account/institution
  const getAccountColor = (institution_name?: string, account_name?: string): string | undefined => {
    if (!institution_name || !cashbackData) return undefined;
    
    // First try to match by institution name directly
    const index = cardNameToIndexMap[institution_name];
    if (index !== undefined) {
      return getCardColor(index);
    }
    
    // Try matching by partial name
    for (const [cardName, idx] of Object.entries(cardNameToIndexMap)) {
      if (institution_name.includes(cardName) || (cardName.includes(institution_name))) {
        return getCardColor(idx);
      }
    }
    
    // No match found
    return undefined;
  };

  // Function to format categories consistently
  const formatCategory = (category: any): string => {
    if (!category) return 'Other';
    
    // If it's an array, take the first item
    if (Array.isArray(category)) {
      // Return the first element of the array, not the stringified array
      return category.length > 0 ? category[0] : 'Other';
    }
    
    // If it's a string, return it
    if (typeof category === 'string') {
      return category;
    }
    
    // For any other type, convert to string
    return String(category);
  };

  // Format category for display with capitalization
  const displayCategory = (category: any): string => {
    const formattedCategory = formatCategory(category);
    return formattedCategory.charAt(0).toUpperCase() + formattedCategory.slice(1);
  };

  // Filter transactions based on selected filters
  const filteredTransactions = transactions.filter(transaction => {
    // Filter by category
    const passesCategory = categoryFilter === 'all' || 
      formatCategory(transaction.category) === categoryFilter;
    
    // Filter by account
    const passesAccount = accountFilter === 'all' || 
      (transaction.account_name && 
       (transaction.account_name === accountFilter || 
        (transaction.institution_name && 
         `${transaction.account_name} (${transaction.institution_name})` === accountFilter)));
    
    // Transaction must pass both filters
    return passesCategory && passesAccount;
  });

  // Get unique categories from transactions
  const categories = ['all', ...Array.from(new Set(transactions.map(t => formatCategory(t.category))))];
  
  // Get unique accounts from transactions
  const accounts = ['all', ...Array.from(new Set(transactions
    .filter(t => t.account_name)
    .map(t => t.institution_name 
      ? `${t.account_name} (${t.institution_name})` 
      : t.account_name || ''
    )))];

  // Format currency amount
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="transactions-page">
      <div className="card-header-wrapper">
        <div className="card-title">
          <h1>Your Transactions</h1>
          <p>View and analyze your recent financial activity</p>
        </div>
      </div>
      
      {/* Add cashback summary at the top */}
      {hasLinkedAccounts && !isLoading && !error && <CashbackSummary />}
      
      {isLoading ? (
        <div className="loading-container">
          <div className="loading-spinner-wrapper">
            <div className="spinner-only"></div>
          </div>
          <div className="loading-text-wrapper">
            <p>Loading transactions...</p>
          </div>
        </div>
      ) : !hasLinkedAccounts ? (
        <div className="no-accounts-message">
          <p>You don't have any linked bank accounts yet.</p>
          <p>Please <Link to="/profile" className="profile-link">go to your profile</Link> to connect your first bank account.</p>
        </div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <>
          <div className="filters">
            <div className="filter-group">
              <label htmlFor="category-filter">Filter by category:</label>
              <select 
                id="category-filter" 
                value={categoryFilter} 
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="filter-select"
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All' : displayCategory(category)}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label htmlFor="account-filter">Filter by account:</label>
              <select 
                id="account-filter" 
                value={accountFilter} 
                onChange={(e) => setAccountFilter(e.target.value)}
                className="filter-select"
              >
                {accounts.map(account => (
                  <option key={account} value={account}>
                    {account === 'all' ? 'All' : account}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {filteredTransactions.length === 0 ? (
            <div className="no-transactions">
              <p>No transactions found.</p>
            </div>
          ) : (
            <div className="transactions-list">
              <div className="transaction-header">
                <span className="date">Date</span>
                <span className="merchant">Merchant</span>
                <span className="category">Category</span>
                <span className="account">Account</span>
                <span className="amount">Amount</span>
              </div>
              
              {filteredTransactions.map(transaction => {
                const accountColor = getAccountColor(
                  transaction.institution_name,
                  transaction.account_name
                );
                
                return (
                  <div key={transaction.id} className="transaction-item">
                    <span className="date">{new Date(transaction.date).toLocaleDateString()}</span>
                    <span className="merchant">{transaction.name}</span>
                    <span className="category">
                      {displayCategory(transaction.category)}
                    </span>
                    <span className="account">
                      <span 
                        className="account-name"
                        style={accountColor ? { 
                          backgroundColor: accountColor, 
                          color: 'white',
                          padding: '3px 10px',
                          borderRadius: '10px',
                          fontSize: '0.85rem'
                        } : undefined}
                      >
                        &nbsp;&nbsp;&nbsp;&nbsp;{transaction.account_name || 'Unknown'}
                      </span>
                      {transaction.institution_name && (
                        <span className="institution">
                          ({transaction.institution_name})
                        </span>
                      )}
                    </span>
                    <span className={`amount ${transaction.amount < 0 ? 'negative' : 'positive'}`}>
                      {formatCurrency(transaction.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Transactions; 