const urlsToCache = [
    "./",
    "./index.html",
    "./stylesheet.css",
    "./script.js",
    "./marked.min.js",
    "./icon.svg",
    "./icon-192x192.png",
    "./icon-512x512.png",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open("pwa-cache-v1").then((cache) => {
            return cache.addAll(urlsToCache);
        }),
    );
});

/*
self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        }),
    );
});
*/
