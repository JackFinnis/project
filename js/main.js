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

  async init() {
    try {
      const sceneData = await this.sceneManager.loadRoomData(this.defaultFileName);

      if (sceneData.frames.length === 0) {
        console.error("No frame data available after loading."); 
        return;
      }
      
      this.controlsManager.setFrames(sceneData.frames);
      this.sceneManager.updateFrame(0);
      this.sceneManager.render();
      this.startRenderLoop();
      
    } catch (error) {
      console.error('Failed to initialize ARPlayback:', error);
    }
  }

  async loadNewDataset(filename) {
    console.log(`ARPlayback: Attempting to load new dataset - ${filename}`);
    this.sceneManager.resetSceneState();

    try {
      const sceneData = await this.sceneManager.loadRoomData(filename);

      if (!sceneData || !sceneData.frames || sceneData.frames.length === 0) {
        console.error(`No frame data available after loading ${filename}.`);
        this.controlsManager.setFrames([]);
        return;
      }

      this.controlsManager.setFrames(sceneData.frames);
      this.sceneManager.updateFrame(0);
      if (this.controlsManager.isPlaying) {
        this.controlsManager.play();
      }
      this.sceneManager.render();

    } catch (error) {
      console.error(`Failed to load new dataset ${filename}:`, error);
      this.controlsManager.setFrames([]);
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