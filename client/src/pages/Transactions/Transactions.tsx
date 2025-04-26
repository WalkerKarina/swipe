import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { transactionService, Transaction } from '../../services/api';
import './Transactions.css';

const Transactions: React.FC = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [hasLinkedAccounts, setHasLinkedAccounts] = useState(true);

  // Fetch transactions from the backend
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setIsLoading(true);
        const data = await transactionService.getTransactions(user?.id);
        console.log('API response data:', data);
        // Add temporary logging to see raw data
        if (data.data && data.data.length > 0) {
          const sample = data.data[0];
          if (sample.category) {
            console.log('Sample category:', sample.category, 'type:', typeof sample.category);
          }
        }
        
        setTransactions(data.data || []);
        setHasLinkedAccounts(true);
        setError(null);
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
      }
    };

    fetchTransactions();
  }, [user?.id]);

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

  // Filter transactions based on selected category
  const filteredTransactions = filter === 'all' 
    ? transactions 
    : transactions.filter(transaction => formatCategory(transaction.category) === filter);

  // Get unique categories from transactions
  const categories = ['all', ...Array.from(new Set(transactions.map(t => formatCategory(t.category))))];

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
      <h1>Your Transactions</h1>
      <p>View and analyze your recent financial activity</p>
      
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
            <label htmlFor="category-filter">Filter by category:</label>
            <select 
              id="category-filter" 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              className="category-filter"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All' : displayCategory(category)}
                </option>
              ))}
            </select>
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
              
              {filteredTransactions.map(transaction => (
                <div key={transaction.id} className="transaction-item">
                  <span className="date">{new Date(transaction.date).toLocaleDateString()}</span>
                  <span className="merchant">{transaction.name}</span>
                  <span className="category">
                    {displayCategory(transaction.category)}
                  </span>
                  <span className="account">
                    {transaction.account_name || 'Unknown'} 
                    {transaction.institution_name && <span className="institution">({transaction.institution_name})</span>}
                  </span>
                  <span className={`amount ${transaction.amount < 0 ? 'negative' : 'positive'}`}>
                    {formatCurrency(transaction.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Transactions; 