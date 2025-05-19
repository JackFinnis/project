import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SceneManager {
  constructor() {
    this.scene = new THREE.Scene(); // Main Three.js scene object
    this.camera = null; // Main perspective camera
    this.renderer = null; // WebGL renderer
    this.controls = null; // OrbitControls for camera manipulation
    this.meshGroup = null; // THREE.Group for room geometry meshes
    this.entityGroup = null; // THREE.Group for dynamic entities
    this.handsGroup = new THREE.Group(); // THREE.Group for hand visualization spheres
    this.activeEntityMeshes = new Map(); // Tracks active entity meshes by ID: { entityId: THREE.Mesh }
    this.trailGroup = new THREE.Group(); // THREE.Group for entity trails
    this.entityTrails = new Map(); // Stores trail data for each entity: { entityId: { line: THREE.Line, points: THREE.Vector3[] } }
    this.maxTrailLength = 200; // Maximum number of points to store for an entity's trail (formerly initialTrailLength)
    this.roomData = null; // Stores the loaded room data from export.json
    this.currentFrameIndex = 0; // Index of the currently displayed frame
    this.renderedMeshStates = new Map(); // Stores { id: timestamp } of currently rendered room meshes
    this.handUpdates = []; // Array of hand update data, sorted by timestamp
    this.handVisuals = { left: null, right: null }; // Holds the THREE.Mesh objects for left and right hand visuals
    this.setupScene();
    this.setupHandVisuals();
  }

  setupScene() {
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
    this.entityGroup = new THREE.Group();
    this.scene.add(this.meshGroup);
    this.scene.add(this.entityGroup);
    this.scene.add(this.handsGroup);
    this.scene.add(this.trailGroup); // Add trailGroup to the scene
    
    this.setupLighting();
  }

  setupHandVisuals() {
    const sphereRadius = 0.05;
    const sphereSegments = 16; // Width and height segments for the sphere

    const handGeometry = new THREE.SphereGeometry(sphereRadius, sphereSegments, sphereSegments);

    // Left Hand (yellow)
    const leftHandMaterial = new THREE.MeshPhongMaterial({ color: 0xffff00 });
    this.handVisuals.left = new THREE.Mesh(handGeometry, leftHandMaterial);
    this.handVisuals.left.visible = false; 
    this.handsGroup.add(this.handVisuals.left);

    // Right Hand (yellow)
    const rightHandMaterial = new THREE.MeshPhongMaterial({ color: 0xffff00 });
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

  async loadRoomData(filename = "data/fish.json") {
    try {
      // Add cache-busting query parameter with current timestamp
      const cacheBuster = `?t=${new Date().getTime()}`;
      const response = await fetch(filename + cacheBuster, {
        cache: 'no-store' // Force bypass of cache
      });
      
      if (!response.ok) {
        console.error(`HTTP error loading room data from ${filename}: ${response.status} ${response.statusText}`);
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      this.roomData = await response.json();
      
      this.handUpdates = this.roomData.handUpdates || []; // Ensure handUpdates exists
      
      // Set up frames for player
      this.setupFrames();
      
      return this.roomData;
    } catch (error) {
      console.error(`Error loading room data from ${filename}:`, error);
      throw error;
    }
  }

  // Create frames array for playback
  setupFrames() {
    this.roomData.frames = this.roomData.entityFrames.map((frame, index) => {
      return {
        index: index,
        timestamp: frame.timestamp
      };
    });
  }

  updateFrame(frameIndex) {
    const frameCount = this.roomData.frames.length;
    if (frameCount === 0 || frameIndex < 0 || frameIndex >= frameCount) {
      console.error('Invalid frame index:', frameIndex, 'max:', frameCount - 1);
      return;
    }
    
    const frame = this.roomData.frames[frameIndex];
    const timestamp = frame.timestamp;
    
    this.updateMesh(timestamp);
    this.updateEntity(frameIndex, timestamp);
    this.updateHands(timestamp);
    
    this.currentFrameIndex = frameIndex;
  }

  updateMesh(timestamp) {
    // renderedMeshStates is initialized in the constructor
    const latestMeshesById = new Map();

    if (this.roomData.meshUpdates.length === 0) {
        if (this.renderedMeshStates.size > 0) {
            this.clearMeshGroup();
            this.renderedMeshStates = new Map(); 
        }
        return;
    }

    // Populate latestMeshesById from roomData.meshUpdates
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

  updateEntity(frameIndex, timestamp) {
    if (this.roomData.entityFrames.length === 0) {
      if (this.activeEntityMeshes.size > 0) {
        this.activeEntityMeshes.forEach(entityMesh => {
          if (entityMesh.geometry) entityMesh.geometry.dispose();
          if (entityMesh.material) {
            if (Array.isArray(entityMesh.material)) {
              entityMesh.material.forEach(material => material.dispose());
            } else {
              entityMesh.material.dispose();
            }
          }
          this.entityGroup.remove(entityMesh);
        });
        this.activeEntityMeshes.clear();
      }
      // Also clear all trails if there are no entity frames
      this.entityTrails.forEach(trail => {
        if (trail.line) {
          if (trail.line.geometry) trail.line.geometry.dispose();
          if (trail.line.material) trail.line.material.dispose();
          this.trailGroup.remove(trail.line);
        }
      });
      this.entityTrails.clear();
      return;
    }

    let entityDataForCurrentTimestamp = null;
    let low = 0;
    let high = this.roomData.entityFrames.length - 1;
    let closestFrameData = this.roomData.entityFrames[0]; 
    let minDiff = Number.MAX_VALUE;
    let bestMatchIndex = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const frameTimestamp = this.roomData.entityFrames[mid].timestamp;
      const diff = Math.abs(frameTimestamp - timestamp);

      if (diff < minDiff) {
        minDiff = diff;
        closestFrameData = this.roomData.entityFrames[mid];
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

    for (let i = Math.max(0, bestMatchIndex - 1); i <= Math.min(this.roomData.entityFrames.length - 1, bestMatchIndex + 1); i++) {
      const frame = this.roomData.entityFrames[i];
      const diff = Math.abs(frame.timestamp - timestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closestFrameData = frame;
      }
    }
    
    entityDataForCurrentTimestamp = closestFrameData && Array.isArray(closestFrameData.entityStates) ? closestFrameData.entityStates : [];

    const currentFrameEntityIds = new Set();
    if (entityDataForCurrentTimestamp) {
      entityDataForCurrentTimestamp.forEach(entityData => {
        currentFrameEntityIds.add(entityData.id);
      });
    }

    if (entityDataForCurrentTimestamp) {
      entityDataForCurrentTimestamp.forEach(entityData => {
        const entityId = entityData.id; // Get entityId here for easier access
        let existingEntityMesh = this.activeEntityMeshes.get(entityId);

        if (existingEntityMesh) {
          existingEntityMesh.position.set(...entityData.position);

          if (Array.isArray(entityData.forward) && entityData.forward.length === 3) {
            const forwardVector = new THREE.Vector3(...entityData.forward).normalize();
            const defaultConeTipDirection = new THREE.Vector3(0, 1, 0); 
            if (forwardVector.lengthSq() > 0.0001) {
              if (defaultConeTipDirection.dot(forwardVector) < -0.9999) {
                existingEntityMesh.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
              } else {
                existingEntityMesh.quaternion.setFromUnitVectors(defaultConeTipDirection, forwardVector);
              }
            }
          }
           const entityType = entityData.type || 'default';
           const entityColors = this.getEntityColors(); 
           const newColor = entityColors[entityType] || entityColors['default'];
           if (existingEntityMesh.material.color.getHex() !== newColor) {
             existingEntityMesh.material.color.setHex(newColor);
           }

          // Update trail for existing entity
          const currentPosition = existingEntityMesh.position.clone();
          let trail = this.entityTrails.get(entityId);
          
          // This check might be redundant if new entity are always initialized, but good for safety
          if (!trail) { 
              trail = { points: [], line: null };
              this.entityTrails.set(entityId, trail);
          }

          trail.points.push(currentPosition);
          while (trail.points.length > this.maxTrailLength) {
              trail.points.shift(); 
          }

          if (trail.points.length >= 2) {
              if (trail.line) {
                  if (trail.line.geometry) trail.line.geometry.dispose();
                  trail.line.geometry = new THREE.BufferGeometry().setFromPoints(trail.points);
              } else {
                  const trailMaterial = new THREE.LineBasicMaterial({ color: newColor }); // Use entity's color
                  const trailGeometry = new THREE.BufferGeometry().setFromPoints(trail.points);
                  trail.line = new THREE.Line(trailGeometry, trailMaterial);
                  this.trailGroup.add(trail.line);
              }
          } else if (trail.line) { // Not enough points, remove line if it exists
              if (trail.line.geometry) trail.line.geometry.dispose();
              if (trail.line.material) trail.line.material.dispose();
              this.trailGroup.remove(trail.line);
              trail.line = null;
          }

        } else {
          const newEntityMesh = this.createEntityMesh(entityData);
          if (newEntityMesh) { 
            this.entityGroup.add(newEntityMesh);
            this.activeEntityMeshes.set(entityId, newEntityMesh); // Use entityId directly

            // Initialize trail for new entity
            this.entityTrails.set(entityId, { points: [newEntityMesh.position.clone()], line: null });
          }
        }
      });
    }
  }

  createRoom(meshData) {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array(meshData.vertices.flat());
    const indices = new Uint32Array(meshData.faces.flat());
    
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x999999 });
    const roomLines = new THREE.LineSegments(edges, lineMaterial);
    this.meshGroup.add(roomLines);
  }

  getEntityColors() {
    return {
      'yellowtang': 0x00ff00,
      'clownfish': 0xff0000,
      'sardine': 0x0000ff,
      'default': 0xff0000    
    };
  }

  createEntityMesh(entityData) {
    const entityColors = this.getEntityColors();
    const entityType = entityData.type || 'default'; // Type might be optional, default is good
    const color = entityColors[entityType] || entityColors['default'];
    const scale = 0.3; 

    const entityGeometry = new THREE.ConeGeometry(0.3 * scale, 0.8 * scale, 8);
    const entityMaterial = new THREE.MeshPhongMaterial({ color });
    const entityMesh = new THREE.Mesh(entityGeometry, entityMaterial);
    
    entityMesh.userData.entityId = entityData.id; 
    entityMesh.position.set(...entityData.position);
    
    if (Array.isArray(entityData.forward) && entityData.forward.length === 3) {
      const forwardVector = new THREE.Vector3(...entityData.forward).normalize();
      const defaultConeTipDirection = new THREE.Vector3(0, 1, 0); 
      
      if (forwardVector.lengthSq() > 0.0001) {
        if (defaultConeTipDirection.dot(forwardVector) < -0.9999) {
          entityMesh.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
        } else {
          entityMesh.quaternion.setFromUnitVectors(defaultConeTipDirection, forwardVector);
        }
      }
    }
    
    entityMesh.scale.set(scale, scale, scale);
    return entityMesh;
  }

  updateHands(timestamp) {
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

  // Method to clear all dynamic scene elements (entity and trails)
  resetSceneState() {
    // Clear active entity meshes
    this.activeEntityMeshes.forEach((entityMesh, entityId) => {
      if (entityMesh.geometry) entityMesh.geometry.dispose();
      if (entityMesh.material) {
        if (Array.isArray(entityMesh.material)) {
          entityMesh.material.forEach(m => m.dispose());
        } else {
          entityMesh.material.dispose();
        }
      }
    });
    this.activeEntityMeshes.clear();
    this.entityGroup.clear(); // Clear children from the group

    // Clear entity trails
    this.entityTrails.forEach((trail, entityId) => {
      if (trail.line) {
        if (trail.line.geometry) trail.line.geometry.dispose();
        if (trail.line.material) trail.line.material.dispose();
      }
    });
    this.entityTrails.clear();
    this.trailGroup.clear(); // Clear children from the group
  }
} 