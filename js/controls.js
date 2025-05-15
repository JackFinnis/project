export class ControlsManager {
  constructor(sceneManager, onFrameUpdate) {
    this.sceneManager = sceneManager;
    this.onFrameUpdate = onFrameUpdate;
    this.isPlaying = true;
    this.frameIndex = 0;
    this.playbackSpeed = 1.0;
    
    this.lastRealWorldTime = 0; // Tracks performance.now()
    this.elapsedMovieTime = 0;  // Time elapsed within the movie's own timeline, scaled by speed
    this.currentFrameTimestamp = 0; // The actual timestamp of the current frame from data
    this.firstFrameTimestamp = 0; // Timestamp of the very first frame, for reference

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
    // When resuming play, reset the real-world timer to prevent a large jump
    this.lastRealWorldTime = performance.now();
    // Ensure currentFrameTimestamp is up-to-date if playback was paused
    if (this.frames.length > 0 && this.frames[this.frameIndex]) {
        this.currentFrameTimestamp = this.frames[this.frameIndex].timestamp;
    }
  }

  onTimelineChange(event) {
    const newFrameIndex = parseInt(event.target.value);
    if (newFrameIndex >= 0 && newFrameIndex < this.frames.length) {
        this.frameIndex = newFrameIndex;
        this.currentFrameTimestamp = this.frames[this.frameIndex].timestamp;
        // When scrubbing, reset elapsedMovieTime relative to the new frame's timestamp
        this.elapsedMovieTime = this.currentFrameTimestamp - this.firstFrameTimestamp;
        this.updateUI();
        this.onFrameUpdate(this.frameIndex); // Update immediately on scrub
        if (!this.isPlaying) {
             this.sceneManager.render(); // Re-render if paused
        }
    }
  }

  onSpeedChange(event) {
    this.playbackSpeed = parseFloat(event.target.value);
    this.speedValue.textContent = this.playbackSpeed.toFixed(1) + 'x';
    // No frameInterval to update anymore
  }

  updateUI() {
    this.timeline.value = this.frameIndex;
    this.playPauseBtn.textContent = this.isPlaying ? 'Pause' : 'Play';
  }

  setFrames(frames) {
    this.frames = Array.isArray(frames) ? frames : [];
    console.log(`ControlsManager: Setting up with ${this.frames.length} frames`);
    
    const hasFrames = this.frames.length > 0;
    
    if (hasFrames) {
        this.firstFrameTimestamp = this.frames[0].timestamp;
        this.currentFrameTimestamp = this.frames[0].timestamp;
        this.elapsedMovieTime = 0; // Start at the beginning of the movie timeline
        this.frameIndex = 0;
    } else {
        this.firstFrameTimestamp = 0;
        this.currentFrameTimestamp = 0;
        this.elapsedMovieTime = 0;
        this.frameIndex = 0;
    }
    
    this.timeline.max = hasFrames ? this.frames.length - 1 : 0;
    this.timeline.value = 0;
    
    this.playPauseBtn.disabled = !hasFrames;
    this.timeline.disabled = !hasFrames;
    this.speedControl.disabled = !hasFrames;

    if (!hasFrames) {
      this.isPlaying = false;
    } else {
      // If we just got frames, and were set to play, ensure lastRealWorldTime is set
      if (this.isPlaying) {
          this.lastRealWorldTime = performance.now(); 
      }
    }
    this.updateUI();
  }

  update(currentRealWorldTime) {
    if (!this.isPlaying || this.frames.length === 0) {
      // If not playing, but an explicit scrub happened, the render is handled by onTimelineChange
      // If playing and no frames, do nothing.
      return;
    }

    if (!this.lastRealWorldTime) { // First update call after play starts
      this.lastRealWorldTime = currentRealWorldTime;
      // Ensure currentFrameTimestamp and elapsedMovieTime are correctly initialized
      if (this.frames[this.frameIndex]) {
          this.currentFrameTimestamp = this.frames[this.frameIndex].timestamp;
          this.elapsedMovieTime = this.currentFrameTimestamp - this.firstFrameTimestamp;
      }
      return;
    }
    
    const realWorldElapsed = (currentRealWorldTime - this.lastRealWorldTime) / 1000.0; // in seconds
    this.lastRealWorldTime = currentRealWorldTime;

    this.elapsedMovieTime += realWorldElapsed * this.playbackSpeed;

    // Target timestamp in the movie's own timeline
    const targetMovieTimestamp = this.firstFrameTimestamp + this.elapsedMovieTime;

    // Find the frame that best matches the targetMovieTimestamp
    // We're looking for the frame with timestamp <= targetMovieTimestamp
    // If all are > targetMovieTimestamp (e.g. playing backwards past the start), pick frame 0.
    // If all are < targetMovieTimestamp (e.g. playing forwards past the end), pick last frame.

    let newFrameIndex = this.frameIndex;

    if (this.frames[this.frameIndex].timestamp < targetMovieTimestamp) {
        // Playing forward, look for next frame
        for (let i = this.frameIndex; i < this.frames.length; i++) {
            if (this.frames[i].timestamp <= targetMovieTimestamp) {
                newFrameIndex = i;
            } else {
                // We've gone past the target, newFrameIndex is the last one that was <=
                break; 
            }
        }
    } else {
        // Playing backward or current frame is ahead of target
        for (let i = this.frameIndex; i >= 0; i--) {
            if (this.frames[i].timestamp <= targetMovieTimestamp) {
                newFrameIndex = i;
                break;
            }
            // If loop finishes, means target is before first frame, newFrameIndex will be 0.
            newFrameIndex = 0; 
        }
    }
    
    // Ensure newFrameIndex is within bounds
    newFrameIndex = Math.max(0, Math.min(this.frames.length - 1, newFrameIndex));

    if (newFrameIndex !== this.frameIndex || !this.sceneManager.currentFrameIndexUpdated) { // also update if scene hasn't caught up
      this.frameIndex = newFrameIndex;
      this.currentFrameTimestamp = this.frames[this.frameIndex].timestamp;
      // No need to adjust elapsedMovieTime here, it's the master clock.
      
      this.onFrameUpdate(this.frameIndex);
      this.updateUI();
      // sceneManager.currentFrameIndexUpdated can be a flag set by SceneManager after it renders this frame
      // For now, we assume onFrameUpdate leads to an eventual render.
    }
  }
} 