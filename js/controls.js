export class ControlsManager {
  constructor(sceneManager, onFrameUpdate, onFileSelectedCallback) {
    this.sceneManager = sceneManager; // Instance of SceneManager to interact with the 3D scene
    this.onFrameUpdate = onFrameUpdate; // Callback function to notify when the current frame needs to be updated
    this.onFileSelected = onFileSelectedCallback; // Callback to notify when a new file is selected for loading
    this.isPlaying = true; // Boolean state indicating if playback is currently active
    this.frameIndex = 0; // Current frame index in the playback sequence
    this.playbackSpeed = 1.0; // Multiplier for playback speed (1.0 is normal speed)
    this.skipAmountFrames = 100; // Number of frames to jump forward/backward with arrow keys
    
    this.lastRealWorldTime = 0; // Timestamp of the last `performance.now()` call, used for calculating delta time
    this.elapsedMovieTime = 0;  // Accumulated time within the movie's own timelineSlider, scaled by speed
    this.currentFrameTimestamp = 0; // The actual timestamp of the current frame being displayed, from the data
    this.firstFrameTimestamp = 0; // Timestamp of the very first frame in the data, used as a reference for elapsedMovieTime

    this.frames = []; // Array of frame objects, typically { index: number, timestamp: number }
    this.totalMovieDurationSeconds = 0; // Total duration of the movie/playback in seconds
    this.timelineValue = null; // DOM element to display the current playback time and total duration
    
    // UI Element References - these are assigned in setupControls
    this.playPauseButton = null; // DOM element for the play/pause button
    this.resetButton = null; // DOM element for the reset button
    this.timelineSlider = null; // DOM element for the timeline range slider
    this.speedSlider = null; // DOM element for the playback speed range slider
    this.speedValue = null; // DOM element to display the current playback speed value
    this.trailLengthSlider = null; // DOM element for the trail length range slider
    this.trailLengthValue = null; // DOM element to display the current trail length value
    this.filePicker = null; // DOM element for the dataset file picker select

    this.setupControls();
    this.setupEventListeners();
  }

  setupControls() {
    this.playPauseButton = document.getElementById('playPauseButton');
    this.resetButton = document.getElementById('resetButton');
    this.timelineSlider = document.getElementById('timelineSlider');
    this.speedSlider = document.getElementById('speedSlider');
    this.speedValue = document.getElementById('speedValue');
    this.timelineValue = document.getElementById('timelineValue');

    // Trail Length Slider - Get from HTML
    this.trailLengthSlider = document.getElementById('trailLengthSlider');
    this.trailLengthValue = document.getElementById('trailLengthValue');

    // File Picker - Get from HTML
    this.filePicker = document.getElementById('filePicker');
    this.filePicker.value = 'data/fish.json';

    let initialTrailLength = parseInt(this.trailLengthSlider.value, 10);
    this.sceneManager.maxTrailLength = initialTrailLength; // Sync SceneManager to what the slider HTML shows
    this.trailLengthValue.textContent = `${String(initialTrailLength).padStart(3, '0')} points`;
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.sceneManager.onWindowResize());
    this.playPauseButton.addEventListener('click', () => this.togglePlayPause());
    this.resetButton.addEventListener('click', () => this.resetPlayback());
    this.timelineSlider.addEventListener('input', (e) => this.onTimelineSliderChange(e));
    this.speedSlider.addEventListener('input', (e) => this.onSpeedChange(e));
    this.trailLengthSlider.addEventListener('input', (e) => this.onTrailLengthChange(e));
    this.filePicker.addEventListener('change', (e) => this.onFilePickerChange(e));
    window.addEventListener('keydown', (e) => this.handleKeydown(e));
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

  onTimelineSliderChange(event) {
    const newFrameIndex = parseInt(event.target.value);
    if (newFrameIndex >= 0 && newFrameIndex < this.frames.length) {
        // Removing resetSceneState() to allow incremental updates during scrubbing,
        // potentially making scrubbing smoother.
        // this.sceneManager.resetSceneState(); 
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
  }

  onTrailLengthChange(event) {
    const newLength = parseInt(event.target.value, 10);
    this.sceneManager.maxTrailLength = newLength;
    this.trailLengthValue.textContent = `${String(newLength).padStart(3, '0')} points`;
  }

  onFilePickerChange(event) {
    const newFilename = event.target.value;
    this.onFileSelected(newFilename);
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0.0s";
    return seconds.toFixed(1) + "s";
  }

  updateUI() {
    this.timelineSlider.value = this.frameIndex;
    this.playPauseButton.textContent = this.isPlaying ? 'Pause' : 'Play';

    if (this.timelineValue && this.frames.length > 0) {
      const currentTimeSeconds = this.elapsedMovieTime;
      this.timelineValue.textContent = `${this.formatTime(currentTimeSeconds)} / ${this.formatTime(this.totalMovieDurationSeconds)}`;
    } else if (this.timelineValue) {
      this.timelineValue.textContent = `${this.formatTime(0)} / ${this.formatTime(this.totalMovieDurationSeconds)}`;
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

  _updateControlsAvailability(hasFrames) {
    this.playPauseButton.disabled = !hasFrames;
    if (this.resetButton) {
      this.resetButton.disabled = !hasFrames;
    }
    this.timelineSlider.disabled = !hasFrames;
    this.speedSlider.disabled = !hasFrames;
  }

  _resetPlaybackSpeed() {
    this.playbackSpeed = 1.0;
    if (this.speedSlider) {
        this.speedSlider.value = this.playbackSpeed;
    }
    if (this.speedValue) {
        this.speedValue.textContent = this.playbackSpeed.toFixed(1) + 'x';
    }
  }

  setFrames(frames) {
    this.frames = Array.isArray(frames) ? frames : [];
    
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
    
    this._updateControlsAvailability(hasFrames);
    this._resetPlaybackSpeed();
    
    this.isPlaying = hasFrames; // Always attempt to play if frames exist
    this.lastRealWorldTime = 0; // Will be set by play() if playing

    if (this.isPlaying) {
        this.play(); // Initialize lastRealWorldTime if playing
    }

    this.updateUI(); // updateUI will set playPauseButton text and timeline value
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

    this.sceneManager.resetSceneState(); // Reset full scene state on skip
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