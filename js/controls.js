export class ControlsManager {
  constructor(sceneManager, onFrameUpdate) {
    this.sceneManager = sceneManager;
    this.onFrameUpdate = onFrameUpdate;
    this.isPlaying = true;
    this.frameIndex = 0;
    this.frameRate = 10;
    this.playbackSpeed = 1.0;
    this.frameInterval = 1000 / this.frameRate;
    this.lastTime = 0;
    this.frames = [];
    
    this.setupControls();
    this.setupEventListeners();
  }

  setupControls() {
    this.playPauseBtn = document.getElementById('playPauseBtn');
    this.timeline = document.getElementById('timeline');
    this.speedControl = document.getElementById('speedControl');
    this.speedValue = document.getElementById('speedValue');
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.sceneManager.onWindowResize());
    this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
    this.timeline.addEventListener('input', (e) => this.onTimelineChange(e));
    this.speedControl.addEventListener('input', (e) => this.onSpeedChange(e));
  }

  togglePlayPause() {
    this.isPlaying = !this.isPlaying;
    this.playPauseBtn.textContent = this.isPlaying ? 'Pause' : 'Play';
    
    if (this.isPlaying) {
      this.play();
    }
  }

  play() {
    // This prepares the playback timing
    this.lastTime = performance.now();
  }

  onTimelineChange(event) {
    this.frameIndex = parseInt(event.target.value);
    this.updateUI();
    if (!this.isPlaying) {
      this.onFrameUpdate(this.frameIndex);
      this.sceneManager.render();
    }
  }

  onSpeedChange(event) {
    this.playbackSpeed = parseFloat(event.target.value);
    this.speedValue.textContent = this.playbackSpeed.toFixed(1) + 'x';
    // Recalculate frame interval based on speed
    this.updateFrameInterval();
  }

  updateFrameInterval() {
    this.frameInterval = 1000 / (this.frameRate * this.playbackSpeed);
  }

  updateUI() {
    this.timeline.value = this.frameIndex;
    this.playPauseBtn.textContent = this.isPlaying ? 'Pause' : 'Play';
  }

  setFrames(frames, metadata) {
    this.frames = Array.isArray(frames) ? frames : [];
    
    if (metadata && typeof metadata.frameRate === 'number' && metadata.frameRate > 0) {
      this.frameRate = metadata.frameRate;
    } else {
      this.frameRate = 30;
    }
    this.updateFrameInterval();

    const hasFrames = this.frames.length > 0;
    this.timeline.max = hasFrames ? this.frames.length - 1 : 0;
    this.timeline.value = 0;
    this.frameIndex = 0;
    
    this.playPauseBtn.disabled = !hasFrames;
    this.timeline.disabled = !hasFrames;
    this.speedControl.disabled = !hasFrames;

    if (!hasFrames) {
        this.isPlaying = false;
    }

    this.updateUI();
  }

  update(time) {
    if (!this.isPlaying || this.frames.length === 0) return;

    if (!this.lastTime) {
      this.lastTime = time;
      return;
    }
    
    const elapsed = time - this.lastTime;
    if (elapsed > this.frameInterval) {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      this.onFrameUpdate(this.frameIndex);
      this.updateUI();
      this.lastTime = time - (elapsed % this.frameInterval); // Adjust for timing accuracy
    }
  }
} 