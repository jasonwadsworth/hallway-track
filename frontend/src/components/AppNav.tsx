import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import { getIncomingConnectionRequests } from '../graphql/queries';
import type { ConnectionRequest } from '../types';
import './AppNav.css';

interface AppNavProps {
    signOut?: () => void;
}

export function AppNav({ signOut }: AppNavProps) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
    const menuRef = useRef<HTMLDivElement>(null);
    const hamburgerRef = useRef<HTMLButtonElement>(null);
    const location = useLocation();

    const toggleMobileMenu = () => {
        setMobileMenuOpen(!mobileMenuOpen);
    };

    // Check if a path is currently active
    const isActivePath = (path: string): boolean => {
        return location.pathname === path;
    };

    const closeMobileMenu = () => {
        setMobileMenuOpen(false);
    };

    // Load pending requests count
    useEffect(() => {
        async function loadPendingRequestsCount() {
            try {
                const client = generateClient();
                const response = await client.graphql({
                    query: getIncomingConnectionRequests,
                });

                if ('data' in response && response.data) {
                    const requests = response.data.getIncomingConnectionRequests as ConnectionRequest[];
                    setPendingRequestsCount(requests.length);
                }
            } catch (err) {
                console.error('Error loading pending requests count:', err);
            }
        }

        loadPendingRequestsCount();

        // Listen for profile data changes to refresh count
        const handleProfileDataChanged = () => {
            loadPendingRequestsCount();
        };

        window.addEventListener('profileDataChanged', handleProfileDataChanged);

        return () => {
            window.removeEventListener('profileDataChanged', handleProfileDataChanged);
        };
    }, []);

    useEffect(() => {
        if (!mobileMenuOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            // Don't close if clicking on the menu itself or the hamburger button
            if ((menuRef.current && menuRef.current.contains(target)) || (hamburgerRef.current && hamburgerRef.current.contains(target))) {
                return;
            }
            setMobileMenuOpen(false);
        };

        // Add listener with slight delay to prevent immediate closure
        const timeoutId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [mobileMenuOpen]);

    return (
        <nav className="app-nav">
            <div className="nav-brand">
                <Link to="/">HallwayTrak</Link>
            </div>

            <button ref={hamburgerRef} className="hamburger-menu" onClick={toggleMobileMenu} aria-label="Toggle navigation menu" aria-expanded={mobileMenuOpen}>
                ☰
            </button>

            <div ref={menuRef} className={`nav-links ${mobileMenuOpen ? 'open' : ''}`}>
                <Link to="/" onClick={closeMobileMenu} className={isActivePath('/') ? 'active' : ''}>
                    🏠 Home
                </Link>
                <Link to="/profile" onClick={closeMobileMenu} className={isActivePath('/profile') ? 'active' : ''}>
                    👤 My Profile
                </Link>
                <Link to="/connections" onClick={closeMobileMenu} className={isActivePath('/connections') ? 'active' : ''}>
                    👥 Connections
                </Link>
                <Link to="/connection-requests" onClick={closeMobileMenu} className={`requests-link ${isActivePath('/connection-requests') ? 'active' : ''}`}>
                    📬 Requests
                    {pendingRequestsCount > 0 && <span className="notification-badge">{pendingRequestsCount}</span>}
                </Link>
                <Link to="/badges" onClick={closeMobileMenu} className={isActivePath('/badges') ? 'active' : ''}>
                    🏆 Badges
                </Link>
                <Link to="/leaderboard" onClick={closeMobileMenu} className={isActivePath('/leaderboard') ? 'active' : ''}>
                    📊 Leaderboard
                </Link>
                <Link to="/qr-code" onClick={closeMobileMenu} className={isActivePath('/qr-code') ? 'active' : ''}>
                    📱 My QR Code
                </Link>
                <Link to="/scan" onClick={closeMobileMenu} className={isActivePath('/scan') ? 'active' : ''}>
                    📷 Scan QR Code
                </Link>
                {signOut && (
                    <button
                        onClick={() => {
                            closeMobileMenu();
                            signOut();
                        }}
                        className="btn-signout"
                    >
                        🚪 Sign Out
                    </button>
                )}
            </div>
        </nav>
    );
}
