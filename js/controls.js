export class ControlsManager {
  constructor(sceneManager, onFrameUpdate) {
    this.sceneManager = sceneManager;
    this.onFrameUpdate = onFrameUpdate;
    this.isPlaying = true;
    this.frameIndex = 0;
    this.playbackSpeed = 1.0;
    this.skipAmountFrames = 30; // Number of frames to skip with arrow keys
    
    this.lastRealWorldTime = 0; // Tracks performance.now()
    this.elapsedMovieTime = 0;  // Time elapsed within the movie's own timelineSlider, scaled by speed
    this.currentFrameTimestamp = 0; // The actual timestamp of the current frame from data
    this.firstFrameTimestamp = 0; // Timestamp of the very first frame, for reference

    this.frames = [];
    this.totalMovieDurationSeconds = 0; // Added for time display
    this.timelineValueElement = null; // Added for time display
    
    this.setupControls();
    this.setupEventListeners();
  }

  setupControls() {
    this.playPauseButton = document.getElementById('playPauseButton');
    this.resetButton = document.getElementById('resetButton');
    this.timelineSlider = document.getElementById('timelineSlider');
    this.speedSlider = document.getElementById('speedSlider');
    this.speedValue = document.getElementById('speedValue');
    this.timelineValueElement = document.getElementById('timelineValue'); // Added

    // Trail Length Slider - Get from HTML
    this.trailLengthSlider = document.getElementById('trailLengthSlider');
    this.trailLengthValue = document.getElementById('trailLengthValue');

    // Ensure sceneManager.maxTrailPoints is the source of truth for the initial value
    // or that the HTML value is respected if sceneManager.maxTrailPoints is not yet set.
    // For now, we'll keep the logic to set it from sceneManager if available,
    // otherwise, it will use the HTML's default value.
    const initialTrailLength = this.sceneManager.maxTrailPoints !== undefined ? this.sceneManager.maxTrailPoints : parseInt(this.trailLengthSlider.value, 10);
    this.trailLengthSlider.value = initialTrailLength;
    this.sceneManager.setTrailLength(initialTrailLength); // Ensure SceneManager is updated
    this.trailLengthValue.textContent = `${String(this.trailLengthSlider.value).padStart(3, '0')} points`;
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.sceneManager.onWindowResize());
    this.playPauseButton.addEventListener('click', () => this.togglePlayPause());
    this.resetButton.addEventListener('click', () => this.resetPlayback());
    this.timelineSlider.addEventListener('input', (e) => this.ontimelineSliderChange(e));
    this.speedSlider.addEventListener('input', (e) => this.onSpeedChange(e));
    this.trailLengthSlider.addEventListener('input', (e) => this.onTrailLengthChange(e));
    window.addEventListener('keydown', (e) => this.handleKeydown(e)); // Added for spacebar
  }

  handleKeydown(event) {
    if (event.code === 'Space') {
      event.preventDefault(); // Prevent default spacebar action (e.g., scrolling, button click if focused)
      this.togglePlayPause();
    } else if (event.code === 'ArrowLeft') {
      event.preventDefault();
      this.skipFrames(-this.skipAmountFrames);
    } else if (event.code === 'ArrowRight') {
      event.preventDefault();
      this.skipFrames(this.skipAmountFrames);
    }
  }

  togglePlayPause() {
    // Case: At the end of playback and currently paused, user wants to play again
    if (!this.isPlaying && this.frames.length > 0 && this.frameIndex === this.frames.length - 1) {
      this.sceneManager.resetSceneState();
      this.frameIndex = 0;
      this.elapsedMovieTime = 0; // Reset elapsed time to the beginning
      this.currentFrameTimestamp = this.firstFrameTimestamp; // Reset current timestamp to the first frame's
      this.onFrameUpdate(this.frameIndex); // Update scene to frame 0

      this.isPlaying = true; // Set to play
      // play() will be called below if this.isPlaying is true
    } else {
      // Standard toggle for play/pause
      this.isPlaying = !this.isPlaying;
    }

    if (this.isPlaying) {
      this.play(); // Prepare for playback (e.g., sets lastRealWorldTime)
    }
    
    this.updateUI(); // Update button text and other UI elements
  }

  play() {
    this.lastRealWorldTime = performance.now();
    // Ensure currentFrameTimestamp is correctly set, especially if starting from frame 0
    if (this.frameIndex === 0) {
        this.currentFrameTimestamp = this.firstFrameTimestamp;
        // elapsedMovieTime should be 0 if we are truly at frame 0 start
    } else if (this.frames[this.frameIndex]) { // Simplified: if frame at index exists
      this.currentFrameTimestamp = this.frames[this.frameIndex].timestamp;
    }
    // elapsedMovieTime is managed by ontimelineSliderChange, resetPlayback, or the new logic in togglePlayPause for play-at-end.
    // The main update loop advances elapsedMovieTime based on realWorldElapsed * playbackSpeed.
  }

  ontimelineSliderChange(event) {
    const newFrameIndex = parseInt(event.target.value);
    if (newFrameIndex >= 0 && newFrameIndex < this.frames.length) {
        this.sceneManager.clearAllTrails(); // Clear trails on scrub
        this.frameIndex = newFrameIndex;
        this.currentFrameTimestamp = this.frames[this.frameIndex].timestamp;
        this.elapsedMovieTime = this.currentFrameTimestamp - this.firstFrameTimestamp;
        this.updateUI(); // This will now update timelineValue
        this.onFrameUpdate(this.frameIndex); 
        if (!this.isPlaying) {
             this.sceneManager.render(); 
        }
    }
  }

  onSpeedChange(event) {
    this.playbackSpeed = parseFloat(event.target.value);
    this.speedValue.textContent = this.playbackSpeed.toFixed(1) + 'x';
    // No frameInterval to update anymore
  }

  onTrailLengthChange(event) {
    const newLength = parseInt(event.target.value, 10);
    this.sceneManager.setTrailLength(newLength);
    this.trailLengthValue.textContent = `${String(newLength).padStart(3, '0')} points`;
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0.0s";
    return seconds.toFixed(1) + "s";
  }

  updateUI() {
    this.timelineSlider.value = this.frameIndex;
    this.playPauseButton.textContent = this.isPlaying ? 'Pause' : 'Play';

    if (this.timelineValueElement && this.frames.length > 0) {
      const currentTimeSeconds = this.elapsedMovieTime;
      this.timelineValueElement.textContent = `${this.formatTime(currentTimeSeconds)} / ${this.formatTime(this.totalMovieDurationSeconds)}`;
    } else if (this.timelineValueElement) {
      this.timelineValueElement.textContent = `${this.formatTime(0)} / ${this.formatTime(this.totalMovieDurationSeconds)}`;
    }
  }

  resetPlayback() {
    if (this.frames.length === 0) return;

    this.sceneManager.resetSceneState(); // Call new reset method in SceneManager

    this.frameIndex = 0;
    // currentFrameTimestamp will be the timestamp of the first frame, or 0 if no frames (handled by firstFrameTimestamp)
    this.currentFrameTimestamp = this.firstFrameTimestamp; 
    this.elapsedMovieTime = 0; 

    this.isPlaying = false; 
    
    this.playbackSpeed = 1.0;
    this.speedSlider.value = this.playbackSpeed;
    this.speedValue.textContent = this.playbackSpeed.toFixed(1) + 'x';

    this.updateUI(); // This will update timelineValue to 0.0s / Total_s
    this.onFrameUpdate(this.frameIndex);

    if (!this.isPlaying) { 
         this.sceneManager.render(); 
    }
  }

  setFrames(frames) {
    this.frames = Array.isArray(frames) ? frames : [];
    // console.log(`ControlsManager: Setting up with ${this.frames.length} frames`);
    
    const hasFrames = this.frames.length > 0;
    
    if (hasFrames) {
        this.firstFrameTimestamp = this.frames[0].timestamp !== undefined ? this.frames[0].timestamp : 0;
        if (this.frames.length > 1) {
            const lastFrameTimestamp = this.frames[this.frames.length - 1].timestamp !== undefined ? this.frames[this.frames.length - 1].timestamp : this.firstFrameTimestamp;
            this.totalMovieDurationSeconds = (lastFrameTimestamp - this.firstFrameTimestamp);
        } else {
            this.totalMovieDurationSeconds = 0.0; // Single frame movie has zero duration
        }
        this.currentFrameTimestamp = this.firstFrameTimestamp;
        this.elapsedMovieTime = 0; 
        this.frameIndex = 0;
    } else {
        this.firstFrameTimestamp = 0;
        this.currentFrameTimestamp = 0;
        this.elapsedMovieTime = 0;
        this.frameIndex = 0;
        this.totalMovieDurationSeconds = 0.0;
    }
    
    this.timelineSlider.max = hasFrames ? this.frames.length - 1 : 0;
    this.timelineSlider.value = 0;
    
    this.playPauseButton.disabled = !hasFrames;
    if (this.resetButton) {
      this.resetButton.disabled = !hasFrames;
    }
    this.timelineSlider.disabled = !hasFrames;
    this.speedSlider.disabled = !hasFrames;
    if (this.timelineValueElement) {
        this.timelineValueElement.textContent = `${this.formatTime(0)} / ${this.formatTime(this.totalMovieDurationSeconds)}`;
    }

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
      return;
    }

    if (!this.lastRealWorldTime) { 
      this.lastRealWorldTime = currentRealWorldTime;
      if (this.frames[this.frameIndex]) {
          this.currentFrameTimestamp = this.frames[this.frameIndex].timestamp;
          this.elapsedMovieTime = this.currentFrameTimestamp - this.firstFrameTimestamp;
      }
      // Update UI on first play to show correct initial time if starting from non-zero frame via scrubbing then play
      this.updateUI(); 
      return;
    }
    
    const realWorldElapsed = (currentRealWorldTime - this.lastRealWorldTime) / 1000.0; 
    this.lastRealWorldTime = currentRealWorldTime;

    this.elapsedMovieTime += realWorldElapsed * this.playbackSpeed;

    // Check for end of playback *before* finding the new frame index based on potentially overshot elapsedMovieTime
    if (this.frameIndex === this.frames.length - 1 && this.elapsedMovieTime >= this.totalMovieDurationSeconds) {
        this.elapsedMovieTime = this.totalMovieDurationSeconds; // Clamp elapsed time
        this.currentFrameTimestamp = this.frames[this.frames.length - 1].timestamp; // Ensure current timestamp is last frame's
        this.isPlaying = false; // Pause playback
        // frameIndex is already correct (last frame)
        this.updateUI(); // Update button to 'Play', timelineSlider, and final time display
        this.sceneManager.render(); // Ensure the very final state is rendered
        return; // Stop further processing in this update cycle
    }

    const targetMovieTimestamp = this.firstFrameTimestamp + this.elapsedMovieTime;
    let newFrameIndex = this.frameIndex;

    if (this.frames[this.frameIndex].timestamp < targetMovieTimestamp) {
        for (let i = this.frameIndex; i < this.frames.length; i++) {
            if (this.frames[i].timestamp <= targetMovieTimestamp) {
                newFrameIndex = i;
            } else {
                break; 
            }
        }
    } else {
        for (let i = this.frameIndex; i >= 0; i--) {
            if (this.frames[i].timestamp <= targetMovieTimestamp) {
                newFrameIndex = i;
                break;
            }
            newFrameIndex = 0; 
        }
    }
    
    newFrameIndex = Math.max(0, Math.min(this.frames.length - 1, newFrameIndex));

    if (newFrameIndex !== this.frameIndex) {
      this.frameIndex = newFrameIndex;
      this.currentFrameTimestamp = this.frames[this.frameIndex].timestamp;
      this.onFrameUpdate(this.frameIndex);
      this.updateUI();
    } else if (this.isPlaying) {
      // If playing and frameIndex hasn't changed (e.g. low speed), still update UI for time display
      this.updateUI();
    }
  }

  skipFrames(framesToSkip) {
    if (this.frames.length === 0) return; // Do nothing if no frames

    this.sceneManager.clearAllTrails(); // Clear trails on skip
    let newFrameIndex = this.frameIndex + framesToSkip;
    
    // Clamp newFrameIndex to be within bounds
    newFrameIndex = Math.max(0, Math.min(newFrameIndex, this.frames.length - 1));

    if (newFrameIndex !== this.frameIndex) {
      this.frameIndex = newFrameIndex;
      if (this.frames[this.frameIndex] && this.frames[this.frameIndex].timestamp !== undefined) {
        this.currentFrameTimestamp = this.frames[this.frameIndex].timestamp;
      } else {
        // Fallback if timestamp is missing, though unlikely if frames are well-formed
        this.currentFrameTimestamp = this.firstFrameTimestamp + (this.frameIndex * (this.totalMovieDurationSeconds / this.frames.length)); 
      }
      this.elapsedMovieTime = this.currentFrameTimestamp - this.firstFrameTimestamp;
      
      this.onFrameUpdate(this.frameIndex);
      this.updateUI();

      if (!this.isPlaying) {
        this.sceneManager.render(); // Re-render if paused and frame changed
      }
    }
  }
} 