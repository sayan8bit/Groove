const CACHE_NAME = "groove-music-player-v1.0.0";
const STATIC_CACHE = "groove-static-v1.0.0";
const DYNAMIC_CACHE = "groove-dynamic-v1.0.0";

// Files to cache immediately
const STATIC_FILES = [
  "/",
  "/index.html",
  "/css/styles.css",
  "/js/app.js",
  "/songs.json",
  "/manifest.json",
  // External dependencies (cached when first loaded)
  "https://cdn.tailwindcss.com",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap",
];

// Install event - cache static files
self.addEventListener("install", (event) => {
  console.log("Service Worker installing...");
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log("Caching static files...");
        return cache.addAll(STATIC_FILES);
      })
      .catch((error) => {
        console.error("Error caching static files:", error);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("Service Worker activating...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log("Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle audio files specially - don't cache them as they can be large
  if (
    request.url.includes(".mp3") ||
    request.url.includes(".wav") ||
    request.url.includes(".ogg") ||
    request.url.includes(".m4a") ||
    request.url.includes(".flac")
  ) {
    event.respondWith(
      fetch(request).catch(() => {
        // If audio fails to load, return a placeholder or error response
        return new Response("Audio file unavailable", { status: 404 });
      })
    );
    return;
  }

  // For other requests, use cache-first strategy
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      // Not in cache, fetch from network
      return fetch(request)
        .then((networkResponse) => {
          // Only cache successful responses
          if (networkResponse.status === 200) {
            // Cache external resources and app files
            if (
              url.origin !== location.origin ||
              STATIC_FILES.includes(url.pathname)
            ) {
              const responseClone = networkResponse.clone();
              caches.open(DYNAMIC_CACHE).then((cache) => {
                cache.put(request, responseClone);
              });
            }
          }
          return networkResponse;
        })
        .catch(() => {
          // Network failed, try to serve a fallback
          if (request.destination === "document") {
            return caches.match("/index.html");
          }
          return new Response("Offline", { status: 503 });
        });
    })
  );
});

// Background sync for offline functionality
self.addEventListener("sync", (event) => {
  console.log("Background sync triggered:", event.tag);

  if (event.tag === "sync-playlists") {
    event.waitUntil(syncPlaylists());
  }
});

// Background fetch for downloading music (if supported)
self.addEventListener("backgroundfetch", (event) => {
  console.log("Background fetch triggered:", event.tag);

  if (event.tag === "download-playlist") {
    event.waitUntil(downloadPlaylist(event));
  }
});

// Message handling for communication with main app
self.addEventListener("message", (event) => {
  console.log("Service Worker received message:", event.data);

  const { type, data } = event.data;

  switch (type) {
    case "SKIP_WAITING":
      self.skipWaiting();
      break;
    case "UPDATE_CACHE":
      updateCache(data);
      break;
    case "CLEAR_CACHE":
      clearCache();
      break;
    default:
      console.log("Unknown message type:", type);
  }
});

// Notification click handling
self.addEventListener("notificationclick", (event) => {
  console.log("Notification clicked:", event.notification.tag);

  event.notification.close();

  // Focus or open the app
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === "/" && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("/");
      }
    })
  );
});

// Push notification handling (for future use)
self.addEventListener("push", (event) => {
  console.log("Push notification received:", event);

  const options = {
    body: event.data ? event.data.text() : "New music available!",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    tag: "groove-notification",
    requireInteraction: false,
    actions: [
      {
        action: "play",
        title: "Play",
        icon: "/icons/icon-192x192.png",
      },
      {
        action: "dismiss",
        title: "Dismiss",
      },
    ],
  };

  event.waitUntil(self.registration.showNotification("Groove Music", options));
});

// Helper functions
async function syncPlaylists() {
  try {
    // Sync playlist data with server (if you have a backend)
    console.log("Syncing playlists...");
    // Implementation would depend on your backend API
  } catch (error) {
    console.error("Playlist sync failed:", error);
  }
}

async function downloadPlaylist(event) {
  try {
    // Download playlist for offline use
    console.log("Downloading playlist for offline use...");
    // Implementation for downloading music files
  } catch (error) {
    console.error("Playlist download failed:", error);
  }
}

async function updateCache(data) {
  try {
    const cache = await caches.open(STATIC_CACHE);
    if (data && data.urls) {
      await cache.addAll(data.urls);
    }
    console.log("Cache updated successfully");
  } catch (error) {
    console.error("Cache update failed:", error);
  }
}

async function clearCache() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    console.log("All caches cleared");
  } catch (error) {
    console.error("Cache clear failed:", error);
  }
}

// Periodic background sync (Chrome only)
self.addEventListener("periodicsync", (event) => {
  console.log("Periodic sync triggered:", event.tag);

  if (event.tag === "update-music-library") {
    event.waitUntil(updateMusicLibrary());
  }
});

async function updateMusicLibrary() {
  try {
    // Check for new music or updates
    console.log("Updating music library...");
    // Implementation for updating music library in background
  } catch (error) {
    console.error("Music library update failed:", error);
  }
}

// Handle app shortcuts
self.addEventListener("appinstalled", (event) => {
  console.log("PWA installed successfully");

  // Send message to main app about installation
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: "PWA_INSTALLED" });
    });
  });
});

// Error handling
self.addEventListener("error", (event) => {
  console.error("Service Worker error:", event.error);
});

self.addEventListener("unhandledrejection", (event) => {
  console.error("Service Worker unhandled rejection:", event.reason);
});
