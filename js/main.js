import { SceneManager } from './scene.js';
import { ControlsManager } from './controls.js';

class FishRoomPlayback {
  constructor() {
    this.sceneManager = new SceneManager();
    this.controlsManager = new ControlsManager(
      this.sceneManager,
      (frameIndex) => this.sceneManager.updateFrame(frameIndex)
    );
    
    this.init();
  }

  async init() {
    try {
      // Load room data
      const sceneData = await this.sceneManager.loadRoomData();

      // Check if we have valid data - need at least frames with fish
      const hasValidData = sceneData && 
        ((sceneData.frames && sceneData.frames.length > 0) || 
         (sceneData.fishFrames && sceneData.fishFrames.length > 0));
      
      if (!hasValidData) {
        console.error("No valid frame data found");
        this.displayError("Missing Frame Data");
        return;
      }
      
      // Set up UI controls with frame data
      this.controlsManager.setFrames(sceneData.frames);
      
      // Display the first frame
      this.sceneManager.updateFrame(0);
      this.sceneManager.render();

      // Start the animation loop
      this.startRenderLoop();
      
      // ControlsManager handles its own timing initialization internally.

    } catch (error) {
      console.error('Failed to initialize FishRoomPlayback:', error);
      this.displayError("Data Loading Error: " + error.message);
    }
  }

  displayError(errorType) {
    // Error handling currently logs to console. UI display could be added here if needed.
    console.error(errorType);
    this.controlsManager.setFrames([]);
    this.controlsManager.isPlaying = false;
    this.sceneManager.render();
    this.startRenderLoop();
  }

  startRenderLoop() {
    const animateFn = (timestamp) => {
      requestAnimationFrame(animateFn);
      this.sceneManager.update();
      this.controlsManager.update(timestamp);
      this.sceneManager.render();
    };
    animateFn(performance.now());
  }
}

// Start the application
new FishRoomPlayback(); 