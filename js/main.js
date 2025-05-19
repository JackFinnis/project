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
      
      this.controlsManager.setFrames(sceneData.frames);
      this.sceneManager.updateFrame(0);
      this.sceneManager.render();
      this.startRenderLoop();
      
    } catch (error) {
      console.error('Failed to initialize ARPlayback:', error);
    }
  }

  async loadNewDataset(filename) {
    this.controlsManager.isPlaying = false;
    this.controlsManager.updateUI();

    this.sceneManager.resetSceneState();

    try {
      const sceneData = await this.sceneManager.loadRoomData(filename);

      this.controlsManager.setFrames(sceneData.frames);
      this.sceneManager.updateFrame(0);

      this.controlsManager.isPlaying = false;
      this.controlsManager.playbackSpeed = 1.0;
      this.controlsManager.speedSlider.value = this.controlsManager.playbackSpeed;
      this.controlsManager.speedValue.textContent = this.controlsManager.playbackSpeed.toFixed(1) + 'x';
      this.controlsManager.updateUI();

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