import { atom } from 'nanostores';
import type { NetlifyConnection, NetlifyUser } from '~/types/netlify';
import { logStore } from './logs';
import { toast } from 'react-toastify';
import Cookies from 'js-cookie';

// Initialize with stored connection or environment variable
const storedConnection = typeof window !== 'undefined' ? localStorage.getItem('netlify_connection') : null;
const envToken = import.meta.env.VITE_NETLIFY_ACCESS_TOKEN;

// If we have an environment token but no stored connection, initialize with the env token
let initialConnection: NetlifyConnection = {
  user: null,
  token: envToken || '',
  stats: undefined,
};

if (storedConnection) {
  try {
    initialConnection = JSON.parse(storedConnection) as NetlifyConnection;
  } catch {
    localStorage.removeItem('netlify_connection');
  }
}

export const netlifyConnection = atom<NetlifyConnection>(initialConnection);
export const isConnecting = atom<boolean>(false);
export const isFetchingStats = atom<boolean>(false);

export function clearNetlifyConnection(reason = 'Your Netlify connection expired. Please reconnect.') {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('netlify_connection');
    Cookies.remove('VITE_NETLIFY_ACCESS_TOKEN');
    Cookies.remove('netlifyToken');
  }

  netlifyConnection.set({ user: null, token: '', stats: undefined });
  toast.warning(reason);
}

// Function to initialize Netlify connection with environment token
export async function initializeNetlifyConnection() {
  const currentState = netlifyConnection.get();

  // If we already have a connection or no token, don't try to connect
  if (currentState.user || !envToken) {
    console.log('Netlify: Skipping auto-connect - user exists or no env token');
    return;
  }

  console.log('Netlify: Attempting auto-connection with env token');

  try {
    isConnecting.set(true);

    const response = await fetch('https://api.netlify.com/api/v1/user', {
      headers: {
        Authorization: `Bearer ${envToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        clearNetlifyConnection();
      }
      throw new Error(`Netlify connection failed (${response.status})`);
    }

    const userData = await response.json();

    // Update the connection state
    const connectionData: Partial<NetlifyConnection> = {
      user: userData as NetlifyUser,
      token: envToken,
    };

    // Store in localStorage for persistence
    localStorage.setItem('netlify_connection', JSON.stringify(connectionData));

    // Update the store
    updateNetlifyConnection(connectionData);

    // Fetch initial stats
    await fetchNetlifyStats(envToken);
  } catch (error) {
    console.error('Error initializing Netlify connection:', error);
    logStore.logError('Failed to initialize Netlify connection', { error });
  } finally {
    isConnecting.set(false);
  }
}

export const updateNetlifyConnection = (updates: Partial<NetlifyConnection>) => {
  const currentState = netlifyConnection.get();
  const newState = { ...currentState, ...updates };
  netlifyConnection.set(newState);

  // Persist to localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('netlify_connection', JSON.stringify(newState));
  }
};

export async function fetchNetlifyStats(token: string) {
  try {
    isFetchingStats.set(true);

    const sitesResponse = await fetch('https://api.netlify.com/api/v1/sites', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!sitesResponse.ok) {
      if (sitesResponse.status === 401 || sitesResponse.status === 403) {
        clearNetlifyConnection();
      }
      throw new Error(`Netlify statistics request failed (${sitesResponse.status})`);
    }

    const sites = (await sitesResponse.json()) as any;

    const currentState = netlifyConnection.get();
    updateNetlifyConnection({
      ...currentState,
      stats: {
        sites,
        totalSites: sites.length,
      },
    });
  } catch (error) {
    console.error('Netlify API Error:', error instanceof Error ? error.name : 'unknown');
    logStore.logError('Failed to fetch Netlify stats');
    if (!(error instanceof Error && error.message.startsWith('Netlify statistics request failed'))) {
      toast.error('Failed to fetch Netlify statistics');
    }
  } finally {
    isFetchingStats.set(false);
  }
}
