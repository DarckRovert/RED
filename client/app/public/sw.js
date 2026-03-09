// RED Service Worker v3.1
// Handles: push notifications, notification clicks, background sync,
//          and scheduled message persistence via IndexedDB

const DB_NAME = 'red-sw-db';
const STORE_SCHEDULED = 'scheduled-messages';
const STORE_NOTIF_PREFS = 'notif-prefs';

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

// ── Lifecycle ────────────────────────────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

// ── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', event => {
    const data = event.data?.json() || {};
    event.waitUntil(
        self.registration.showNotification(data.title || 'RED — Mensaje nuevo', {
            body: data.body || '🔒 Mensaje cifrado recibido',
            icon: '/icons/icon-192.png',
            badge: '/icons/badge-96.png',
            vibrate: [100, 50, 200],
            tag: data.conversationId || 'red-msg',
            data: { url: data.url || '/chat', conversationId: data.conversationId },
            actions: [
                { action: 'reply', title: 'Responder' },
                { action: 'dismiss', title: 'Descartar' },
            ],
        })
    );
});

// ── Notification click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const url = event.notification.data?.url || '/chat';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
            const match = clients.find(c => c.url.includes('/chat'));
            if (match) return match.focus();
            return self.clients.openWindow(url);
        })
    );
});

// ── Background Sync — Scheduled Messages ────────────────────────────────────
self.addEventListener('sync', event => {
    if (event.tag === 'red-scheduled-messages') {
        event.waitUntil(processScheduledMessages());
    }
});

async function processScheduledMessages() {
    const scheduled = await getScheduled();
    const now = Date.now();
    for (const msg of scheduled) {
        if (msg.sendAt <= now) {
            // Notify all open RED clients to dispatch the message
            const clients = await self.clients.matchAll({ type: 'window' });
            clients.forEach(client => {
                client.postMessage({ type: 'SEND_SCHEDULED', payload: msg });
            });
            await removeScheduled(msg.id);
        }
    }
}

// ── Message from app — persist scheduled messages in IndexedDB ───────────────
self.addEventListener('message', async event => {
    if (event.data?.type === 'PERSIST_SCHEDULED') {
        const msg = event.data.payload;
        const db = await openDB();
        const tx = db.transaction(STORE_SCHEDULED, 'readwrite');
        tx.objectStore(STORE_SCHEDULED).put(msg);
        // Register a sync event for the scheduled time
        if ('sync' in self.registration) {
            const delay = Math.max(0, msg.sendAt - Date.now());
            setTimeout(() => {
                self.registration.sync.register('red-scheduled-messages').catch(() => { });
            }, delay);
        }
    }

    if (event.data?.type === 'CANCEL_SCHEDULED') {
        await removeScheduled(event.data.id);
    }
});

// ── Periodic Background Sync (where available) ───────────────────────────────
self.addEventListener('periodicsync', event => {
    if (event.tag === 'red-scheduled-check') {
        event.waitUntil(processScheduledMessages());
    }
});
