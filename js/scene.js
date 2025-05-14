import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SceneManager {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.meshGroup = null;
    this.fishGroup = null;
    this.roomData = null;
    this.currentFrameIndex = 0;
    this.currentMeshIndex = 0;
    this.setupScene();
  }

  setupScene() {
    // Scene setup
    this.scene.background = new THREE.Color(0x111111);
    
    // Camera setup
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(2, 2, 2);
    
    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(this.renderer.domElement);
    
    // Controls setup
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.25;
    
    // Create groups for organization
    this.meshGroup = new THREE.Group();
    this.fishGroup = new THREE.Group();
    this.scene.add(this.meshGroup);
    this.scene.add(this.fishGroup);
    
    this.setupLighting();
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0x404040);
    this.scene.add(ambientLight);
    
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 2, 3);
    this.scene.add(light);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  update() {
    this.controls.update();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  async loadRoomData() {
    try {
      console.log('SceneManager: Starting to fetch data.json');
      // Add cache-busting query parameter with current timestamp
      const cacheBuster = `?t=${new Date().getTime()}`;
      const response = await fetch('data.json' + cacheBuster, {
        cache: 'no-store' // Force bypass of cache
      });
      if (!response.ok) {
        console.error(`HTTP error loading room data: ${response.status} ${response.statusText}`);
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      console.log('SceneManager: Successfully fetched data.json, parsing...');
      this.roomData = await response.json();
      console.log('SceneManager: data.json parsed successfully');
      console.log('Room data loaded:', this.roomData.metadata.roomName);
      
      // Set up frames for player
      this.setupFrames();
      
      return this.roomData;
    } catch (error) {
      console.error('Error loading room data:', error);
      throw error;
    }
  }

  // Create frames array for playback
  setupFrames() {
    // Make sure required data exists
    if (!this.roomData) {
      console.error('No room data available for setupFrames');
      this.roomData.frames = []; // Ensure frames is an empty array if no data
      return;
    }
    
    if (!this.roomData.fishFrames || this.roomData.fishFrames.length === 0) {
      console.warn('No fishFrames data available, playback may not work as expected.');
      this.roomData.frames = []; // Ensure frames is an empty array
      return;
    }
    
    // New format is the only format - we create frame references from fishFrames
    console.log('Creating frames array from fishFrames, count:', this.roomData.fishFrames.length);
    this.roomData.frames = this.roomData.fishFrames.map((frame, index) => {
      return {
        index: index,
        timestamp: frame.timestamp
      };
    });
    
    console.log('Created', this.roomData.frames.length, 'frames for playback based on fishFrames.');
  }

  updateFrame(frameIndex) {
    if (!this.roomData) {
      console.error('No room data available');
      return;
    }
    
    // Make sure frameIndex is valid
    const frameCount = this.roomData.frames ? this.roomData.frames.length : 0;
    if (frameCount === 0 || frameIndex < 0 || frameIndex >= frameCount) {
      console.error('Invalid frame index:', frameIndex, 'max:', frameCount - 1);
      return;
    }
    
    // Get current frame timestamp
    const frame = this.roomData.frames[frameIndex];
    const timestamp = frame.timestamp;
    
    // Only log for major frame changes (every second)
    if (frameIndex % 30 === 0) {
      console.log(`Updating to frame ${frameIndex} at timestamp ${timestamp}`);
    }
    
    // Update mesh based on timestamp
    this.updateMesh(timestamp);
    
    // Update fish based on frame index or timestamp
    this.updateFish(frameIndex, timestamp);
    
    this.currentFrameIndex = frameIndex;
  }

  updateMesh(timestamp) {
    if (!this.roomData || !this.roomData.meshes || this.roomData.meshes.length === 0) {
      // No mesh data available, or it's handled differently.
      // console.warn('No explicit mesh data found in roomData.meshes. Ensure scene is set up if meshes are static or handled elsewhere.');
      // If meshes are expected, this might indicate an issue with data or loading.
      // If no dynamic meshes, meshGroup might be populated once at setup.
      return;
    }
    
    // Find the appropriate mesh for this timestamp
    let meshIndex = 0;
    for (let i = 0; i < this.roomData.meshes.length; i++) {
      if (this.roomData.meshes[i].timestamp <= timestamp) {
        meshIndex = i;
      } else {
        break;
      }
    }
    
    // If mesh index hasn't changed, don't update the mesh
    if (this.currentMeshIndex === meshIndex && this.meshGroup.children.length > 0) {
      return;
    }
    
    // Create new mesh
    this.clearMeshGroup();
    const meshData = this.roomData.meshes[meshIndex];
    this.createRoom(meshData);
    this.currentMeshIndex = meshIndex;
  }

  clearMeshGroup() {
    // Dispose of geometries and materials to free GPU memory
    this.meshGroup.traverse(object => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
    this.meshGroup.clear();
  }

  updateFish(frameIndex, timestamp) {
    if (!this.roomData) return;

    // Clear previous fish - more robust clearing
    this.fishGroup.traverse(object => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
    this.fishGroup.clear();
    
    let fishDataToRender = null;
    
    // Only use fishFrames for fish data
    if (this.roomData.fishFrames && this.roomData.fishFrames.length > 0) {
      if (timestamp !== undefined) {
        // Binary search logic for closestFrame (as implemented before)
        let low = 0;
        let high = this.roomData.fishFrames.length - 1;
        let closestFrame = this.roomData.fishFrames[0];
        let minDiff = Number.MAX_VALUE;

        // First, quickly find a candidate using binary search logic (exact match or closest)
        // This loop finds an exact match or the insertion point
        let bestMatchIndex = 0;
        while(low <= high) {
            const mid = Math.floor((low + high) / 2);
            const frameTimestamp = this.roomData.fishFrames[mid].timestamp;
            const diff = Math.abs(frameTimestamp - timestamp);

            if (diff < minDiff) {
                minDiff = diff;
                closestFrame = this.roomData.fishFrames[mid];
                bestMatchIndex = mid;
            }

            if (frameTimestamp < timestamp) {
                low = mid + 1;
            } else if (frameTimestamp > timestamp) {
                high = mid - 1;
            } else {
                // Exact match found
                break;
            }
        }
        
        // Check neighbors of the bestMatchIndex from binary search, as it might not be the absolute closest
        // if an exact match wasn't found. The binary search gets us in the vicinity.
        for (let i = Math.max(0, bestMatchIndex - 1); i <= Math.min(this.roomData.fishFrames.length - 1, bestMatchIndex + 1); i++) {
            const frame = this.roomData.fishFrames[i];
            const diff = Math.abs(frame.timestamp - timestamp);
            if (diff < minDiff) {
                minDiff = diff;
                closestFrame = frame;
            }
        }
        fishDataToRender = closestFrame.fish;
      } else if (frameIndex !== undefined && frameIndex < this.roomData.fishFrames.length) {
        // Fallback to direct index if timestamp is not available (should not happen in current flow)
        fishDataToRender = this.roomData.fishFrames[frameIndex].fish;
      }
    } 
    // Removed old format logic for fish in this.roomData.frames
    
    // If we have fish data, render it
    if (fishDataToRender && fishDataToRender.length > 0) {
      // Only log periodically to reduce console spam
      if (frameIndex % 90 === 0) {
        console.log(`Rendering ${fishDataToRender.length} fish for frame ${frameIndex} at timestamp ${timestamp}`);
      }
      this.addFish(fishDataToRender);
    } else {
      // Reduced console spam for missing fish data, could be normal
      if (frameIndex % 90 === 0) {
        console.warn('No fish data found for frame', frameIndex, 'at timestamp', timestamp);
      }
    }
  }

  createRoom(meshData) {
    if (!meshData || !meshData.vertices || !meshData.triangles) {
      console.error('Invalid mesh data structure', meshData);
      return;
    }
    
    // Create geometry from vertices and triangles
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array(meshData.vertices.flat());
    const indices = new Uint32Array(meshData.triangles.flat());
    
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    // Create wireframe for the room
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const roomLines = new THREE.LineSegments(edges, lineMaterial);
    this.meshGroup.add(roomLines);
    
    // Add corner points
    const pointsGeometry = new THREE.BufferGeometry();
    pointsGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    const pointsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.05,
      sizeAttenuation: true
    });
    const cornerPoints = new THREE.Points(pointsGeometry, pointsMaterial);
    this.meshGroup.add(cornerPoints);
  }

  addFish(fishDataArray) {
    if (!fishDataArray || !Array.isArray(fishDataArray) || fishDataArray.length === 0) {
      return;
    }
    
    // Predefined colors for fish types
    const fishColors = {
      'goldfish': 0xffa500, // Orange
      'clownfish': 0xff5500, // Reddish-orange
      'default': 0x808080    // Grey for any other type
    };
    
    fishDataArray.forEach((fish) => {
      if (!fish || !fish.position || !fish.rotation) {
        console.warn('Invalid fish data entry:', fish);
        return; // Skip this fish
      }
      
      const fishType = fish.type || 'default';
      const color = fishColors[fishType] || fishColors['default'];
      const scale = 0.3; // Uniform scale for all cone fish

      // Create a cone for the fish
      const fishGeometry = new THREE.ConeGeometry(0.3 * scale, 0.8 * scale, 8); // Simple cone
      const fishMaterial = new THREE.MeshPhongMaterial({ color });
      const fishMesh = new THREE.Mesh(fishGeometry, fishMaterial);
      
      fishMesh.position.set(...fish.position);
      
      const rotationRadians = fish.rotation.map(deg => THREE.MathUtils.degToRad(deg));
      fishMesh.rotation.set(rotationRadians[0], rotationRadians[1], rotationRadians[2]);
      
      // Orient cone to point along its +Z axis if data implies forward is Z
      // The cone by default points up along the Y-axis.
      // If your fish rotation data assumes Z is forward, rotate X by 90 degrees.
      fishMesh.rotateX(Math.PI / 2); 
      
      fishMesh.scale.set(scale, scale, scale);
      
      this.fishGroup.add(fishMesh);
    });
  }
} 