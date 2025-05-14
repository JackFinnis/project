export class MetadataManager {
  constructor() {
    this.metadataEl = document.getElementById('metadata');
  }

  displayMetadata(metadata) {
    if (!metadata) {
      console.error('displayMetadata called with no metadata');
      return;
    }
    
    // Debug the metadata being received
    console.log('Displaying metadata:', metadata);
    console.log('Room name from metadata:', metadata.roomName);
        
    let html = '<h3>Recording Info</h3>';
    html += `<p>Room: ${metadata.roomName || 'Unknown'}</p>`;
    html += `<p>Date: ${metadata.captureDate ? new Date(metadata.captureDate).toLocaleString() : 'Unknown'}</p>`;
    html += `<p>Duration: ${metadata.duration || 'Unknown'} seconds</p>`;
    html += `<p>Frame Count: ${metadata.frameCount || 'Unknown'}</p>`;
    html += `<p>Device: ${metadata.device || 'Unknown'}</p>`;
    html += `<p>Version: ${metadata.version || '1.0'}</p>`;
        
    this.metadataEl.innerHTML = html;
  }
} 