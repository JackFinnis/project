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
      const sceneData = await this.sceneManager.loadRoomData();

      // Check if we have valid data - simplified to check if frames array is populated
      // Assumes loadRoomData throws on actual load errors, and setupFrames ensures sceneData.frames exists.
      if (sceneData.frames.length === 0) {
        console.error("No frame data available after loading."); 
        this.displayError("No Frame Data"); 
        return;
      }
      
      this.controlsManager.setFrames(sceneData.frames);
      this.sceneManager.updateFrame(0);
      this.sceneManager.render();
      this.startRenderLoop();
      
    } catch (error) {
      console.error('Failed to initialize FishRoomPlayback:', error);
      this.displayError("Data Loading Error: " + error.message);
    }
  }

  displayError(errorType) {
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

new FishRoomPlayback(); 