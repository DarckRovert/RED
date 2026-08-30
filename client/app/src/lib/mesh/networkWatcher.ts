/**
 * RED NetworkWatcher — Unified Network & Connectivity State Lifecycle Manager
 * 
 * Monitors network interface transitions (WiFi <-> Cellular 4G/5G <-> Offline),
 * evaluates real internet reachability via active health checks, and triggers
 * proactive WebRTC ICE restarts, signaling reconnection, and DTN queue flushes.
 */

export type NetworkType = 'wifi' | 'cellular' | 'ethernet' | 'bluetooth' | 'none' | 'unknown';

export interface NetworkState {
  connected: boolean;
  connectionType: NetworkType;
  hasInternetAccess: boolean;
  lastChecked: number;
}

export type NetworkChangeCallback = (state: NetworkState) => void;

class NetworkWatcher {
  private currentState: NetworkState = {
    connected: typeof navigator !== 'undefined' ? navigator.onLine : true,
    connectionType: 'unknown',
    hasInternetAccess: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastChecked: Date.now(),
  };

  private listeners: Set<NetworkChangeCallback> = new Set();
  private checkTimer: any = null;
  private isInitialized = false;
  private isProbing = false;

  private handleOnline = () => this.handleNetworkEvent(true);
  private handleOffline = () => this.handleNetworkEvent(false);
  private handleConnectionChange = () => {
    this.updateConnectionType();
    this.probeInternetReachability();
  };

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // 1. Standard Browser Lifecycle Events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // 2. Network Information API (if available)
    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      if (conn) {
        conn.addEventListener('change', this.handleConnectionChange);
        this.updateConnectionType();
      }
    }

    // 3. Capacitor Native App State & Network Listeners (if running inside mobile app)
    import('@capacitor/core').then(({ Capacitor }) => {
      if (Capacitor.isNativePlatform()) {
        import('@capacitor/app').then(({ App }) => {
          App.addListener('appStateChange', (state) => {
            if (state.isActive) {
              console.log('[NetworkWatcher] App resumed to foreground — verifying connectivity');
              this.probeInternetReachability();
            }
          }).catch(() => {});
        }).catch(() => {});
      }
    }).catch(() => {});

    // 4. Initial probe and periodic heartbeat probe (every 15s)
    this.probeInternetReachability();
    if (this.checkTimer) clearInterval(this.checkTimer);
    this.checkTimer = setInterval(() => this.probeInternetReachability(), 15000);

    console.log('[NetworkWatcher] Initialized — monitoring WiFi, Cellular and Mesh connectivity');
  }

  public destroy() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
      if ('connection' in navigator) {
        const conn = (navigator as any).connection;
        if (conn) {
          conn.removeEventListener('change', this.handleConnectionChange);
        }
      }
    }
    this.isInitialized = false;
    this.listeners.clear();
  }

  private updateConnectionType() {
    if (typeof navigator === 'undefined') return;
    const conn = (navigator as any).connection;
    if (conn && conn.type) {
      const t = String(conn.type).toLowerCase();
      if (t.includes('wifi')) this.currentState.connectionType = 'wifi';
      else if (t.includes('cell') || t.includes('4g') || t.includes('5g') || t.includes('3g')) this.currentState.connectionType = 'cellular';
      else if (t.includes('ethernet')) this.currentState.connectionType = 'ethernet';
      else if (t.includes('bluetooth')) this.currentState.connectionType = 'bluetooth';
      else if (t.includes('none')) this.currentState.connectionType = 'none';
      else this.currentState.connectionType = 'unknown';
    } else if (navigator.onLine) {
      this.currentState.connectionType = 'unknown';
    } else {
      this.currentState.connectionType = 'none';
    }
  }

  private async handleNetworkEvent(online: boolean) {
    this.currentState.connected = online;
    this.updateConnectionType();
    console.log(`[NetworkWatcher] Network event: ${online ? 'ONLINE' : 'OFFLINE'} (${this.currentState.connectionType})`);

    if (online) {
      await this.probeInternetReachability();
    } else {
      this.currentState.hasInternetAccess = false;
      this.notifyListeners();
    }
  }

  /**
   * Actively probes WAN internet reachability by testing DNS/HTTP ping with a fast timeout.
   */
  public async probeInternetReachability(): Promise<boolean> {
    if (this.isProbing || typeof window === 'undefined') return this.currentState.hasInternetAccess;
    this.isProbing = true;

    let reach = false;

    // Fast check: if browser explicitly says offline, avoid making HTTP requests
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.currentState.connected = false;
      this.currentState.hasInternetAccess = false;
      this.currentState.lastChecked = Date.now();
      this.isProbing = false;
      this.notifyListeners();
      return false;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      // Probe public lightweight endpoint (Cloudflare / Google generate_204 / local health)
      const endpoints = [
        'https://cloudflare-dns.com/dns-query?name=cloudflare.com&type=A',
        'https://www.google.com/generate_204',
        'https://httpbin.org/status/204'
      ];
      
      const target = endpoints[Math.floor(Math.random() * endpoints.length)];

      const resp = await fetch(target, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal,
      }).catch(() => null);

      clearTimeout(timeout);
      reach = resp !== null;
    } catch {
      reach = false;
    }

    const previousInternet = this.currentState.hasInternetAccess;
    const previousType = this.currentState.connectionType;

    this.currentState.connected = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.currentState.hasInternetAccess = reach;
    this.currentState.lastChecked = Date.now();
    this.updateConnectionType();
    this.isProbing = false;

    // Notify listeners if state changed or if verified reachable
    if (previousInternet !== reach || previousType !== this.currentState.connectionType) {
      console.log(`[NetworkWatcher] Internet reachability changed: ${reach ? 'YES (Gateway Ready)' : 'NO (Mesh-Only)'}`);
      this.notifyListeners();

      // Trigger immediate ICE restart on active WebRTC DataChannels to avoid 30s latency timeout
      if (this.currentState.connected) {
        import('./meshRouter').then(({ meshRouter }) => {
          if (meshRouter && meshRouter.wifi) {
            meshRouter.wifi.restartAllIce();
          }
        }).catch(() => {});
      }
    }

    return reach;
  }

  public getState(): NetworkState {
    return { ...this.currentState };
  }

  public get hasInternet(): boolean {
    return this.currentState.hasInternetAccess;
  }

  public get isConnected(): boolean {
    return this.currentState.connected;
  }

  public onChange(callback: NetworkChangeCallback): () => void {
    this.listeners.add(callback);
    // Immediately emit current state
    try {
      callback(this.getState());
    } catch {}
    return () => this.listeners.delete(callback);
  }

  private notifyListeners() {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('[NetworkWatcher] Error in listener callback:', err);
      }
    }
  }
}

export const networkWatcher = new NetworkWatcher();
