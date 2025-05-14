export class ControlsManager {
  constructor(sceneManager, onFrameUpdate) {
    this.sceneManager = sceneManager;
    this.onFrameUpdate = onFrameUpdate;
    this.isPlaying = true;
    this.frameIndex = 0;
    this.frameRate = 30; // Default frame rate 
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
    // Reset playback timing
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
    // Ensure frames is an array
    this.frames = Array.isArray(frames) ? frames : [];
    console.log(`Setting up controls with ${this.frames.length} frames`);
    
    // Determine frame rate based on available metadata
    this.frameRate = 30; // Default frame rate
    if (metadata) {
      if (typeof metadata.fishFrameRate === 'number' && metadata.fishFrameRate > 0) {
        this.frameRate = metadata.fishFrameRate;
        console.log(`Using fishFrameRate from metadata: ${this.frameRate}`);
      } else {
        // If fishFrameRate is not available, try to calculate from timestamps
        console.log('fishFrameRate not found in metadata, attempting to calculate from frame timestamps.');
        this.determineFrameRateFromFrames(); // determineFrameRateFromFrames will set this.frameRate if successful
      }
    } else {
      console.log('No metadata provided, attempting to calculate frame rate from frame timestamps.');
      this.determineFrameRateFromFrames();
    }
    
    this.updateFrameInterval();

    const hasFrames = this.frames.length > 0;
    
    // Configure timeline
    this.timeline.max = hasFrames ? this.frames.length - 1 : 0;
    this.timeline.value = 0;
    this.frameIndex = 0;
    
    // Enable/disable controls based on data availability
    this.playPauseBtn.disabled = !hasFrames;
    this.timeline.disabled = !hasFrames;
    this.speedControl.disabled = !hasFrames;

    if (!hasFrames) {
      this.isPlaying = false;
    }

    this.updateUI();
  }
  
  determineFrameRateFromFrames() {
    // If we have timestamps, try to calculate frame rate
    if (this.frames.length >= 2 && 
        this.frames[0].timestamp !== undefined && 
        this.frames[1].timestamp !== undefined) {
      const samples = Math.min(10, this.frames.length - 1);
      let totalInterval = 0;
      for (let i = 0; i < samples; i++) {
        const interval = this.frames[i+1].timestamp - this.frames[i].timestamp;
        if (interval > 0) { // Only consider positive intervals
            totalInterval += interval;
        } else {
            // If interval is zero or negative, it might skew calculation or indicate bad data.
            // Depending on strictness, could reduce sample count or log warning.
            console.warn(`Invalid frame interval detected between frame ${i} and ${i+1}: ${interval}`);
        }
      }
      // Only calculate if we had valid samples contributing to totalInterval
      if (samples > 0 && totalInterval > 0) {
        const avgInterval = totalInterval / samples;
        this.frameRate = Math.round(1 / avgInterval);
        console.log(`Calculated frame rate from timestamps: ${this.frameRate} (avgInterval: ${avgInterval.toFixed(4)}s)`);
      } else {
        console.warn('Could not calculate frame rate from timestamps, using default:', this.frameRate);
      }
    } else {
      console.warn('Not enough frame data with timestamps to calculate frame rate, using default:', this.frameRate);
    }
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