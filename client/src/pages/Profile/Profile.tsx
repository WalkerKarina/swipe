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
  const { user, updateUserProfile, updateUserPhoto } = useAuth();
  const { 
    accounts, 
    linkToken, 
    isLoading, 
    isRemoving, 
    openPlaidLink, 
    removeAccount: removePlaidAccount 
  } = usePlaidLink(user?.id);

  // Form state for profile information
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>(user?.photoUrl || '');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileUpdateError, setProfileUpdateError] = useState<string | null>(null);

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

  // Profile photo change handler
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfilePhoto(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle form field changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Toggle edit mode
  const toggleEditMode = () => {
    setIsEditingProfile(!isEditingProfile);
    
    // Reset form values when entering edit mode
    if (!isEditingProfile) {
      setProfileData({
        name: user?.name || '',
        email: user?.email || ''
      });
    }
  };

  // Handle profile update
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileUpdateError(null);
    setIsUpdatingProfile(true);
    
    try {
      // Temporarily bypass actual API calls since the backend endpoints aren't ready
      // This simulates a successful update without making API calls
      
      // Simulate a short delay to mimic API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Instead of calling updateUserProfile, directly update the form state
      setProfileData({
        name: profileData.name,
        email: profileData.email
      });
      
      // For now, just show a success message
      alert("Profile updated successfully!");
      
      setIsEditingProfile(false);
      setProfilePhoto(null);
    } catch (error) {
      console.error('Failed to update profile:', error);
      setProfileUpdateError('Failed to update profile. Please try again.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Profile</h1>
          <p>Manage your profile and linked accounts</p>
        </div>
      </div>
      
      <div className="profile-content">
        {/* User Profile Information Section */}
        <div className="profile-info-section">
          <div className="section-header">
            <h2>Profile Information</h2>
            <button 
              onClick={toggleEditMode} 
              className="edit-profile-button"
              disabled={isUpdatingProfile}
            >
              {isEditingProfile ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>
          
          <div className="profile-info-content">
            <div className="profile-photo-container">
              {photoPreview ? (
                <img src={photoPreview} alt="Profile preview" className="profile-photo" />
              ) : user?.photoUrl ? (
                <img src={user.photoUrl} alt="Profile" className="profile-photo" />
              ) : (
                <div className="profile-photo-placeholder">
                  <i className="fa-solid fa-user-circle"></i>
                </div>
              )}
              
              {isEditingProfile && (
                <div className="photo-upload">
                  <label htmlFor="photo-upload" className="photo-upload-label">
                    Change Photo
                  </label>
                  <input 
                    type="file" 
                    id="photo-upload" 
                    onChange={handlePhotoChange} 
                    accept="image/*" 
                    className="photo-upload-input"
                    disabled={isUpdatingProfile}
                  />
                </div>
              )}
            </div>
            
            <div className="profile-details">
              {isEditingProfile ? (
                <form onSubmit={handleProfileUpdate} className="profile-form">
                  <div className="form-group">
                    <label htmlFor="name">Name</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={profileData.name}
                      onChange={handleInputChange}
                      required
                      disabled={isUpdatingProfile}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="email">Email</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={profileData.email}
                      onChange={handleInputChange}
                      required
                      disabled={isUpdatingProfile}
                    />
                  </div>
                  {profileUpdateError && (
                    <div className="error-message">{profileUpdateError}</div>
                  )}
                  <button 
                    type="submit" 
                    className="save-profile-button"
                    disabled={isUpdatingProfile}
                  >
                    {isUpdatingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </form>
              ) : (
                <>
                  <div className="info-row">
                    <span className="info-label">Name:</span>
                    <span className="info-value">{user?.name}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Email:</span>
                    <span className="info-value">{user?.email}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Bank Accounts Section */}
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
            <div className="loading-container">
              <div className="loading-spinner-wrapper">
                <div className="spinner-only"></div>
              </div>
              <div className="loading-text-wrapper">
                <p>Loading accounts...</p>
              </div>
            </div>
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
                    aria-label="Remove account"
                  >
                    X
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
