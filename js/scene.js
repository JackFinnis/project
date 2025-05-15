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
    this.handsGroup = new THREE.Group();
    this.activeFishMeshes = new Map(); // Added to track active fish by ID
    this.roomData = null;
    this.currentFrameIndex = 0;
    this.renderedMeshStates = new Map(); // Stores { id: timestamp } of currently rendered meshes
    this.handUpdates = [];
    this.handVisuals = { left: null, right: null };
    this.setupScene();
    this.setupHandVisuals();
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
    this.scene.add(this.handsGroup);
    
    this.setupLighting();
  }

  setupHandVisuals() {
    const sphereRadius = 0.05;
    const sphereSegments = 16; // Width and height segments for the sphere

    const handGeometry = new THREE.SphereGeometry(sphereRadius, sphereSegments, sphereSegments);

    // Left Hand (blue)
    const leftHandMaterial = new THREE.MeshPhongMaterial({ color: 0x0000ff });
    this.handVisuals.left = new THREE.Mesh(handGeometry, leftHandMaterial);
    this.handVisuals.left.visible = false; 
    this.handsGroup.add(this.handVisuals.left);

    // Right Hand (red)
    const rightHandMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    this.handVisuals.right = new THREE.Mesh(handGeometry, rightHandMaterial); 
    this.handVisuals.right.visible = false; 
    this.handsGroup.add(this.handVisuals.right);
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
      // Add cache-busting query parameter with current timestamp
      const cacheBuster = `?t=${new Date().getTime()}`;
      const response = await fetch('export.json' + cacheBuster, {
        cache: 'no-store' // Force bypass of cache
      });
      
      if (!response.ok) {
        console.error(`HTTP error loading room data: ${response.status} ${response.statusText}`);
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      this.roomData = await response.json();
      
      // Assuming this.roomData.handUpdates is always an array and pre-sorted by timestamp as per user guidance
      this.handUpdates = this.roomData.handUpdates;
      
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
    // Assuming this.roomData and this.roomData.fishFrames are always available and fishFrames is an array
    this.roomData.frames = this.roomData.fishFrames.map((frame, index) => {
      return {
        index: index,
        timestamp: frame.timestamp
      };
    });
  }

  updateFrame(frameIndex) {
    // Assuming this.roomData.frames is always an array
    const frameCount = this.roomData.frames.length;
    if (frameCount === 0 || frameIndex < 0 || frameIndex >= frameCount) {
      // It's still good to keep this check for frameIndex bounds
      console.error('Invalid frame index:', frameIndex, 'max:', frameCount - 1);
      return;
    }
    
    const frame = this.roomData.frames[frameIndex];
    const timestamp = frame.timestamp;
    
    this.updateMesh(timestamp);
    this.updateFish(frameIndex, timestamp);
    this.updateHands(timestamp);
    
    this.currentFrameIndex = frameIndex;
  }

  updateMesh(timestamp) {
    // renderedMeshStates is initialized in the constructor
    const latestMeshesById = new Map();

    // Assuming this.roomData.meshUpdates is always an array
    if (this.roomData.meshUpdates.length === 0) {
        if (this.renderedMeshStates.size > 0) {
            this.clearMeshGroup();
            this.renderedMeshStates = new Map(); 
        }
        return;
    }

    // Populate latestMeshesById from roomData.meshUpdates
    // Assuming meshUpdate objects always have id and timestamp
    for (const meshUpdate of this.roomData.meshUpdates) {
        if (meshUpdate.timestamp <= timestamp) {
            if (!latestMeshesById.has(meshUpdate.id) ||
                meshUpdate.timestamp >= latestMeshesById.get(meshUpdate.id).timestamp) {
                latestMeshesById.set(meshUpdate.id, meshUpdate);
            }
        }
    }

    let hasChanged = false;
    if (this.renderedMeshStates.size !== latestMeshesById.size) {
        hasChanged = true;
    } else {
        for (const [id, meshData] of latestMeshesById) {
            if (!this.renderedMeshStates.has(id) ||
                this.renderedMeshStates.get(id) !== meshData.timestamp) {
                hasChanged = true;
                break;
            }
        }
    }
    
    if (latestMeshesById.size === 0 && this.renderedMeshStates.size > 0) {
        hasChanged = true; 
    }

    if (!hasChanged) {
        return; 
    }

    this.clearMeshGroup(); 
    const newRenderedStates = new Map();

    // Assuming meshData always has vertices and faces when createRoom is called
    if (latestMeshesById.size > 0) {
        latestMeshesById.forEach(meshData => {
            this.createRoom(meshData); 
            newRenderedStates.set(meshData.id, meshData.timestamp);
        });
    }
    
    this.renderedMeshStates = newRenderedStates;
  }

  clearMeshGroup() {
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
    // Assuming this.roomData.fishFrames is always an array
    if (this.roomData.fishFrames.length === 0) {
      if (this.activeFishMeshes.size > 0) {
        this.activeFishMeshes.forEach(fishMesh => {
          if (fishMesh.geometry) fishMesh.geometry.dispose();
          if (fishMesh.material) {
            if (Array.isArray(fishMesh.material)) {
              fishMesh.material.forEach(material => material.dispose());
            } else {
              fishMesh.material.dispose();
            }
          }
          this.fishGroup.remove(fishMesh);
        });
        this.activeFishMeshes.clear();
      }
      return;
    }

    let fishDataForCurrentTimestamp = null;
    let low = 0;
    let high = this.roomData.fishFrames.length - 1;
    let closestFrameData = this.roomData.fishFrames[0]; 
    let minDiff = Number.MAX_VALUE;
    let bestMatchIndex = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const frameTimestamp = this.roomData.fishFrames[mid].timestamp;
      const diff = Math.abs(frameTimestamp - timestamp);

      if (diff < minDiff) {
        minDiff = diff;
        closestFrameData = this.roomData.fishFrames[mid];
        bestMatchIndex = mid;
      }

      if (frameTimestamp < timestamp) {
        low = mid + 1;
      } else if (frameTimestamp > timestamp) {
        high = mid - 1;
      } else {
        break; 
      }
    }

    for (let i = Math.max(0, bestMatchIndex - 1); i <= Math.min(this.roomData.fishFrames.length - 1, bestMatchIndex + 1); i++) {
      const frame = this.roomData.fishFrames[i];
      const diff = Math.abs(frame.timestamp - timestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closestFrameData = frame;
      }
    }
    
    fishDataForCurrentTimestamp = closestFrameData.fishStates || [];

    const currentFrameFishIds = new Set();
    // Assuming fishData in fishDataForCurrentTimestamp always has an ID
    if (fishDataForCurrentTimestamp) {
      fishDataForCurrentTimestamp.forEach(fishData => {
        currentFrameFishIds.add(fishData.id);
      });
    }

    this.activeFishMeshes.forEach((fishMesh, fishId) => {
      if (!currentFrameFishIds.has(fishId)) {
        if (fishMesh.geometry) fishMesh.geometry.dispose();
        if (fishMesh.material) {
          if (Array.isArray(fishMesh.material)) {
            fishMesh.material.forEach(m => m.dispose());
          } else {
            fishMesh.material.dispose();
          }
        }
        this.fishGroup.remove(fishMesh);
        this.activeFishMeshes.delete(fishId);
      }
    });

    // Assuming fishData always has id, position, and forward
    if (fishDataForCurrentTimestamp) {
      fishDataForCurrentTimestamp.forEach(fishData => {
        if (this.activeFishMeshes.has(fishData.id)) {
          const fishMesh = this.activeFishMeshes.get(fishData.id);
          fishMesh.position.set(...fishData.position);

          if (Array.isArray(fishData.forward) && fishData.forward.length === 3) {
            const forwardVector = new THREE.Vector3(...fishData.forward).normalize();
            const defaultConeTipDirection = new THREE.Vector3(0, 1, 0); 
            if (forwardVector.lengthSq() > 0.0001) {
              if (defaultConeTipDirection.dot(forwardVector) < -0.9999) {
                fishMesh.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
              } else {
                fishMesh.quaternion.setFromUnitVectors(defaultConeTipDirection, forwardVector);
              }
            }
          }
           const fishType = fishData.type || 'default';
           const fishColors = this._getFishColors(); 
           const newColor = fishColors[fishType] || fishColors['default'];
           if (fishMesh.material.color.getHex() !== newColor) {
             fishMesh.material.color.setHex(newColor);
           }
        } else {
          const fishMesh = this._createFishMesh(fishData);
          if (fishMesh) { // _createFishMesh could return null if data was truly bad, but we assume it won't.
            this.fishGroup.add(fishMesh);
            this.activeFishMeshes.set(fishData.id, fishMesh);
          }
        }
      });
    }
  }

  createRoom(meshData) {
    // Assuming meshData always has vertices and faces
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array(meshData.vertices.flat());
    const indices = new Uint32Array(meshData.faces.flat());
    
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const roomLines = new THREE.LineSegments(edges, lineMaterial);
    this.meshGroup.add(roomLines);
  }

  _getFishColors() {
    return {
      'yellowtang': 0x00ff00,
      'clownfish': 0xff0000,
      'sardine': 0x0000ff,
      'default': 0x808080    
    };
  }

  _createFishMesh(fishData) {
    // Assuming fishData always has id, position, and forward
    const fishColors = this._getFishColors();
    const fishType = fishData.type || 'default'; // Type might be optional, default is good
    const color = fishColors[fishType] || fishColors['default'];
    const scale = 0.3; 

    const fishGeometry = new THREE.ConeGeometry(0.3 * scale, 0.8 * scale, 8);
    const fishMaterial = new THREE.MeshPhongMaterial({ color });
    const fishMesh = new THREE.Mesh(fishGeometry, fishMaterial);
    
    fishMesh.userData.fishId = fishData.id; 
    fishMesh.position.set(...fishData.position);
    
    if (Array.isArray(fishData.forward) && fishData.forward.length === 3) {
      const forwardVector = new THREE.Vector3(...fishData.forward).normalize();
      const defaultConeTipDirection = new THREE.Vector3(0, 1, 0); 
      
      if (forwardVector.lengthSq() > 0.0001) {
        if (defaultConeTipDirection.dot(forwardVector) < -0.9999) {
          fishMesh.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
        } else {
          fishMesh.quaternion.setFromUnitVectors(defaultConeTipDirection, forwardVector);
        }
      }
    }
    
    fishMesh.scale.set(scale, scale, scale);
    return fishMesh;
  }

  updateHands(timestamp) {
    // handVisuals are initialized in the constructor
    // Assuming this.handUpdates is always an array (and pre-sorted)

    let latestLeftHandUpdate = null;
    let latestRightHandUpdate = null;

    // Iterate backwards since handUpdates is sorted by timestamp and we want the latest one <= current timestamp
    if (this.handUpdates.length > 0) {
      for (let i = this.handUpdates.length - 1; i >= 0; i--) {
        const update = this.handUpdates[i];
        if (update.timestamp <= timestamp) { 
          if (update.chirality === 'left' && !latestLeftHandUpdate) {
            latestLeftHandUpdate = update;
          } else if (update.chirality === 'right' && !latestRightHandUpdate) {
            latestRightHandUpdate = update;
          }
          // If both are found, we can break early since the array is sorted
          if (latestLeftHandUpdate && latestRightHandUpdate) {
             break;
          }
        }
      }
    }
    
    // Assuming latestLeftHandUpdate.position is always a valid 3-element number array if latestLeftHandUpdate exists
    if (latestLeftHandUpdate) {
      this.handVisuals.left.position.set(
        latestLeftHandUpdate.position[0], 
        latestLeftHandUpdate.position[1], 
        latestLeftHandUpdate.position[2]
      );
      this.handVisuals.left.visible = true;
    } else {
      this.handVisuals.left.visible = false;
    }

    // Assuming latestRightHandUpdate.position is always a valid 3-element number array if latestRightHandUpdate exists
    if (latestRightHandUpdate) {
      this.handVisuals.right.position.set(
        latestRightHandUpdate.position[0], 
        latestRightHandUpdate.position[1], 
        latestRightHandUpdate.position[2]
      );
      this.handVisuals.right.visible = true;
    } else {
      this.handVisuals.right.visible = false;
    }
  }
} 