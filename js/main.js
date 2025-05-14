import { SceneManager } from './scene.js';
import { ControlsManager } from './controls.js';
import { MetadataManager } from './metadata.js';

class FishRoomPlayback {
  constructor() {
    this.sceneManager = new SceneManager();
    this.controlsManager = new ControlsManager(
      this.sceneManager,
      (frameIndex) => this.sceneManager.updateFrame(frameIndex)
    );
    this.metadataManager = new MetadataManager();
    
    this.init();
  }

  async init() {
    try {
      // Wait for both scene data and metadata to load
      const [sceneData] = await Promise.all([
        this.sceneManager.loadRoomData(),
      ]);

      if (!sceneData || !sceneData.frames || sceneData.frames.length === 0) {
        console.error("FishRoomPlayback Init: No valid frames data found after loading.");
        // Display metadata if available, otherwise a generic error message
        this.metadataManager.displayMetadata(sceneData ? sceneData.metadata : { 
          roomName: "Error: No Frames", captureDate: "N/A", duration: 0, frameCount: 0, device: "N/A", version: "N/A" 
        });
        // Ensure controls are set with empty frames and disabled
        this.controlsManager.setFrames([], sceneData ? sceneData.metadata : {});
        this.startRenderLoop(); // Still start render loop for an empty scene/error message
        return;
      }
      
      // Data is valid, proceed with setup
      this.metadataManager.displayMetadata(sceneData.metadata); // Use metadata from sceneData
      this.controlsManager.setFrames(sceneData.frames, sceneData.metadata);
      
      // Display the first frame
      this.sceneManager.updateFrame(0);
      this.sceneManager.render(); // Render first frame immediately

      // Start the continuous render loop for OrbitControls and animation
      this.startRenderLoop();
      
      // Reset player state if needed (controlsManager.play just sets lastTime)
      if (this.controlsManager.isPlaying) {
        this.controlsManager.lastTime = 0; // Will be set on first update
      }

    } catch (error) {
      console.error('Failed to initialize FishRoomPlayback:', error);
      this.metadataManager.displayMetadata({ 
        roomName: "Initialization Error", captureDate: "N/A", duration: 0, frameCount: 0, device: "N/A", version: "N/A" 
      });
      this.controlsManager.setFrames([], {}); // Attempt to set controls to a safe state
      this.controlsManager.isPlaying = false; // Ensure we're not trying to play
      this.sceneManager.render(); // Render empty scene
      this.startRenderLoop(); // Start render loop even on error to show basic scene if possible
    }
  }

  startRenderLoop() {
    const animateFn = (timestamp) => {
      requestAnimationFrame(animateFn);
      if (this.sceneManager) {
        this.sceneManager.update(); // For OrbitControls updating and rendering
      }
      if (this.controlsManager) {
        this.controlsManager.update(timestamp); // Call update with timestamp for frame advancement
      }
      if (this.sceneManager) {
        this.sceneManager.render(); // Ensure the scene is rendered each frame
      }
    };
    animateFn(performance.now());
  }
}

// Start the application
new FishRoomPlayback(); 