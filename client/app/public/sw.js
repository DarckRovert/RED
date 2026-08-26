// RED Service Worker v64.0.0
// Sovereign Mesh OS — PWA & Full Offline Cache Engine
// Handles: Push Notifications, Offline Cache Storage, Stale-While-Revalidate,
//          Background Sync, and Scheduled Messages via IndexedDB

const CACHE_NAME = 'red-vault-cache-v64';
const DB_NAME = 'red-sw-db';
const STORE_SCHEDULED = 'scheduled-messages';
const STORE_NOTIF_PREFS = 'notif-prefs';

const PRECACHE_URLS = [
    '/',
    '/manifest.json',
    '/red_icon.png',
    '/red_splash.png',
    '/ort-wasm/ort-wasm.wasm',
    '/ort-wasm/ort-wasm-simd.wasm'
];

// ── IndexedDB helpers ────────────────────────────────────────────────────────
function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 2);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_SCHEDULED)) {
                db.createObjectStore(STORE_SCHEDULED, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_NOTIF_PREFS)) {
                db.createObjectStore(STORE_NOTIF_PREFS, { keyPath: 'convId' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function getScheduled() {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_SCHEDULED, 'readonly');
        const store = tx.objectStore(STORE_SCHEDULED);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
    });
}

async function removeScheduled(id) {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_SCHEDULED, 'readwrite');
        tx.objectStore(STORE_SCHEDULED).delete(id);
        tx.oncomplete = resolve;
    });
}

// ── Lifecycle & Cache Storage ────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            try {
                await cache.addAll(PRECACHE_URLS);
            } catch (err) {
                console.warn('[SW] Precache partial error (offline mode ready):', err);
            }
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[SW] Purging outdated cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// ── Fetch Strategy (Offline-First for Assets, Network-First for SPA) ─────────
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Ignorar esquemas no soportados y peticiones externas de telemetría
    if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
        return;
    }

    // 1. Inferencia WASM y Assets Inmutables -> Cache First con Stale Fallback
    if (
        url.pathname.includes('/ort-wasm/') ||
        url.pathname.includes('/_next/static/') ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.woff2')
    ) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                return fetch(request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
                    }
                    return networkResponse;
                }).catch(() => caches.match('/red_icon.png'));
            })
        );
        return;
    }

    // 2. Navegación SPA y Documentos -> Network First con Cache Fallback
    if (request.mode === 'navigate' || request.destination === 'document') {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
                    }
                    return networkResponse;
                })
                .catch(async () => {
                    const cached = await caches.match(request);
                    if (cached) return cached;
                    const rootCached = await caches.match('/');
                    if (rootCached) return rootCached;
                    return new Response(
                        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>RED Offline</title></head><body style="background:#06070B;color:#FFF;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;"><h2>🛡️ NODO RED OFFLINE</h2><p>Bóveda lista en memoria local.</p></body></html>',
                        { headers: { 'Content-Type': 'text/html' } }
                    );
                })
        );
        return;
    }

    // 3. Estrategia por defecto: Cache Fallback
    event.respondWith(
        caches.match(request).then((cached) => {
            return cached || fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
                }
                return networkResponse;
            });
        }).catch(() => new Response('', { status: 408, statusText: 'Offline Request' }))
    );
});

// ── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
    const data = event.data?.json() || {};
    event.waitUntil(
        self.registration.showNotification(data.title || 'RED — Mensaje nuevo', {
            body: data.body || '🔒 Mensaje cifrado recibido',
            icon: '/red_icon.png',
            badge: '/red_icon.png',
            vibrate: [100, 50, 200],
            tag: data.conversationId || 'red-msg',
            data: { url: data.url || '/', conversationId: data.conversationId },
            actions: [
                { action: 'reply', title: 'Responder' },
                { action: 'dismiss', title: 'Descartar' },
            ],
        })
    );
});

// ── Notification click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            const match = clients.find((c) => c.url.includes(url));
            if (match) return match.focus();
            return self.clients.openWindow(url);
        })
    );
});

// ── Background Sync — Scheduled Messages ────────────────────────────────────
self.addEventListener('sync', (event) => {
    if (event.tag === 'red-scheduled-messages') {
        event.waitUntil(processScheduledMessages());
    }
});

async function processScheduledMessages() {
    const scheduled = await getScheduled();
    const now = Date.now();
    for (const msg of scheduled) {
        if (msg.sendAt <= now) {
            const clients = await self.clients.matchAll({ type: 'window' });
            clients.forEach((client) => {
                client.postMessage({ type: 'SEND_SCHEDULED', payload: msg });
            });
            await removeScheduled(msg.id);
        }
    }
}

// ── Message from app ─────────────────────────────────────────────────────────
self.addEventListener('message', async (event) => {
    if (event.data?.type === 'PERSIST_SCHEDULED') {
        const msg = event.data.payload;
        const db = await openDB();
        const tx = db.transaction(STORE_SCHEDULED, 'readwrite');
        tx.objectStore(STORE_SCHEDULED).put(msg);
        if ('sync' in self.registration) {
            const delay = Math.max(0, msg.sendAt - Date.now());
            setTimeout(() => {
                self.registration.sync.register('red-scheduled-messages').catch(() => {});
            }, delay);
        }
    }

    if (event.data?.type === 'CANCEL_SCHEDULED') {
        await removeScheduled(event.data.id);
    }
});

// ── Periodic Background Sync ─────────────────────────────────────────────────
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'red-scheduled-check') {
        event.waitUntil(processScheduledMessages());
    }
});
