import { useState } from 'react';
import { ProfileView } from './ProfileView';
import { ProfileEdit } from './ProfileEdit';
import { ContactLinkManager } from './ContactLinkManager';
import { QRCodeDisplay } from './QRCodeDisplay';
import { ConnectionList } from './ConnectionList';
import { ConnectionDetail } from './ConnectionDetail';
import type { Connection } from '../types';
import './Profile.css';

type ProfileTab = 'view' | 'edit' | 'links' | 'qr' | 'connections';

export function Profile() {
  const [activeTab, setActiveTab] = useState<ProfileTab>('view');
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);

  function handleSelectConnection(connection: Connection) {
    setSelectedConnection(connection);
  }

  function handleBackToList() {
    setSelectedConnection(null);
  }

  function handleTagsUpdated(updatedConnection: Connection) {
    setSelectedConnection(updatedConnection);
  }

  return (
    <div className="profile-container">
      <div className="profile-tabs">
        <button
          className={`tab ${activeTab === 'view' ? 'active' : ''}`}
          onClick={() => setActiveTab('view')}
        >
          Profile
        </button>
        <button
          className={`tab ${activeTab === 'edit' ? 'active' : ''}`}
          onClick={() => setActiveTab('edit')}
        >
          Edit Profile
        </button>
        <button
          className={`tab ${activeTab === 'links' ? 'active' : ''}`}
          onClick={() => setActiveTab('links')}
        >
          Contact Links
        </button>
        <button
          className={`tab ${activeTab === 'qr' ? 'active' : ''}`}
          onClick={() => setActiveTab('qr')}
        >
          My QR Code
        </button>
        <button
          className={`tab ${activeTab === 'connections' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('connections');
            setSelectedConnection(null);
          }}
        >
          My Connections
        </button>
      </div>

      <div className="profile-content">
        {activeTab === 'view' && (
          <ProfileView onEdit={() => setActiveTab('edit')} />
        )}
        {activeTab === 'edit' && (
          <ProfileEdit
            onCancel={() => setActiveTab('view')}
            onSave={() => setActiveTab('view')}
          />
        )}
        {activeTab === 'links' && <ContactLinkManager />}
        {activeTab === 'qr' && <QRCodeDisplay />}
        {activeTab === 'connections' && !selectedConnection && (
          <ConnectionList onSelectConnection={handleSelectConnection} />
        )}
        {activeTab === 'connections' && selectedConnection && (
          <ConnectionDetail
            connection={selectedConnection}
            onBack={handleBackToList}
            onTagsUpdated={handleTagsUpdated}
          />
        )}
      </div>
    </div>
  );
}
