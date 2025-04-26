import axios from 'axios';

const API_URL = 'http://127.0.0.1:5001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export interface SignupData {
  email: string;
  password: string;
  name: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface ProfileUpdateData {
  name?: string;
  email?: string;
}

export interface LinkedAccount {
  id: string;
  name: string;
  institutionName: string;
  mask: string;
}

export interface Transaction {
  id: string;
  date: string;
  name: string;
  amount: number;
  category: string;
  account_id: string;
  account_name?: string;
  institution_name?: string;
}

export interface CashBackSummary {
  total_cash_back: number;
  monthly_cash_back: number;
  rewards_by_category: Record<string, number>;
}

export interface OptimalCashBack {
  actual_total_cashback: number;
  optimal_total_cashback: number;
  potential_increase: number;
  improvement_percentage: number;
  optimal_cashback_by_card: Record<string, number>;
  optimal_spending_by_card: Record<string, number>;
  top_improvement_opportunities: Array<{
    date: string;
    merchant: string;
    amount: number;
    actual_card: string;
    actual_cashback: number;
    optimal_card: string;
    optimal_cashback: number;
    improvement: number;
  }>;
}

export const authService = {
  signup: async (data: SignupData) => {
    const response = await api.post('/auth/signup', data);
    return response.data;
  },

  login: async (data: LoginData) => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },

  updateProfile: async (userId: string, data: ProfileUpdateData) => {
    const response = await api.patch(`/auth/users/${userId}`, data);
    return response.data;
  },

  uploadProfilePhoto: async (userId: string, photoFile: File) => {
    const formData = new FormData();
    formData.append('photo', photoFile);
    
    const response = await api.post(`/auth/users/${userId}/photo`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

export const plaidService = {
  // Get accounts linked to a user
  getAccounts: async (userId?: string) => {
    const response = await api.get(`/plaid/accounts${userId ? `?user_id=${userId}` : ''}`);
    return response.data;
  },

  // Create a link token to initialize Plaid Link
  createLinkToken: async (userId?: string) => {
    const response = await api.post('/plaid/create-link-token', { userId });
    return response.data;
  },

  // Exchange a public token for an access token
  exchangeToken: async (publicToken: string, userId?: string) => {
    const response = await api.post('/plaid/exchange-token', { 
      public_token: publicToken,
      userId 
    });
    return response.data;
  },

  // Remove a linked account
  removeAccount: async (accountId: string, userId?: string) => {
    const response = await api.delete(`/plaid/accounts/${accountId}${userId ? `?user_id=${userId}` : ''}`);
    return response.data;
  },

  // Get cash back summary for a user
  getCashBackSummary: async (userId?: string) => {
    const response = await api.get(`/transactions/cashback${userId ? `?user_id=${userId}` : ''}`);
    return response.data;
  },

  // Get optimal cash back summary for a user
  getOptimalCashBack: async (userId?: string) => {
    const response = await api.get(`/transactions/optimal-cashback${userId ? `?user_id=${userId}` : ''}`);
    return response.data;
  },

  // Link a bank account manually
  linkAccount: async (accountData: {
    userId: string;
    institutionId: string;
    accountNumber: string;
    routingNumber: string;
    accountType: string;
    accountName: string;
  }) => {
    const response = await api.post('/plaid/link-account', accountData);
    return response.data;
  }
};

export const transactionService = {
  // Get transactions for a user
  getTransactions: async (userId?: string) => {
    const response = await api.get(`/transactions${userId ? `?user_id=${userId}` : ''}`);
    return response.data;
  },

  // Get transaction summary (aggregated stats)
  getTransactionSummary: async (userId?: string) => {
    const response = await api.get(`/transactions/summary${userId ? `?user_id=${userId}` : ''}`);
    return response.data;
  }
};

export default api; 
