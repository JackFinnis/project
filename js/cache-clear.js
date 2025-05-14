// Simple utility to clear browser cache for our app

// Function to clear browser caches
async function clearAppCache() {
  console.log("Attempting to clear application cache...");
  
  try {
    // Clear localStorage
    console.log("Clearing localStorage...");
    localStorage.clear();
    
    // Clear sessionStorage
    console.log("Clearing sessionStorage...");
    sessionStorage.clear();
    
    // Try to clear caches via Cache API if available
    if ('caches' in window) {
      console.log("Clearing Cache API caches...");
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    
    console.log("Cache clearing complete!");
    
    // Force a hard reload of the page
    console.log("Reloading page...");
    window.location.reload(true);
  } catch (err) {
    console.error("Error clearing cache:", err);
  }
}

// Check if this is being imported as a module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { clearAppCache };
} else {
  // Add to window object if in browser context
  window.clearAppCache = clearAppCache;
}

// Add a cache-busting function that can be called from the console
window.clearCacheAndReload = function() {
  console.log("Manual cache clear triggered");
  clearAppCache();
} 