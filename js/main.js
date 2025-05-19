import { SceneManager } from './scene.js';
import { ControlsManager } from './controls.js';

class ARPlayback {
  constructor() {
    this.sceneManager = new SceneManager();
    this.controlsManager = new ControlsManager(
      this.sceneManager,
      (frameIndex) => this.sceneManager.updateFrame(frameIndex),
      (filename) => this.loadNewDataset(filename)
    );
    this.defaultFileName = 'data/fish.json';
    this.init();
  }

  _setupSceneData(sceneData) {
    this.controlsManager.setFrames(sceneData.frames);
    this.sceneManager.updateFrame(0);
    this.sceneManager.render();
  }

  async init() {
    try {
      const sceneData = await this.sceneManager.loadRoomData(this.defaultFileName);
      this._setupSceneData(sceneData);
      this.startRenderLoop();
    } catch (error) {
      console.error('Failed to initialize ARPlayback:', error);
    }
  }

  async loadNewDataset(filename) {
    // Explicitly stop playback and update UI before any async operations or scene resets.
    // This helps prevent the animation loop from advancing based on old data while new data loads.
    this.controlsManager.isPlaying = false;
    this.controlsManager.updateUI(); // Reflect immediate stop in UI (e.g., Play button shows)

    this.sceneManager.resetSceneState();

    try {
      const sceneData = await this.sceneManager.loadRoomData(filename);
      this._setupSceneData(sceneData);
    } catch (error) {
      console.error(`Failed to load new dataset ${filename}:`, error);
      // In case of error, set up with empty/default data
      this._setupSceneData({ frames: [] }); 
    }
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

new ARPlayback(); 