import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Class that manages the 3D scene and updates the entities and room meshes based on the current frame
export class SceneManager {
  constructor() {
    this.scene = new THREE.Scene(); // Main Three.js scene object
    this.camera = null; // Main perspective camera
    this.renderer = null; // WebGL renderer
    this.controls = null; // OrbitControls for camera manipulation
    this.meshGroup = null; // THREE.Group for room geometry meshes
    this.activeRoomMeshes = new Map(); // Tracks active room mesh objects by ID
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

  // Setup the lighting for the scene so entities are visible with shading
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

  // Load the room data from the JSON file
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

  // Update the frame shown in the scene
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

  // Update the meshes in the scene to the most recent mesh state version given the timestamp
  updateMesh(timestamp) {
    const latestMeshesById = new Map();

    // 1. Determine the latest version of each mesh that should be visible at the current timestamp
    if (this.roomData && this.roomData.meshUpdates) {
      for (const meshUpdate of this.roomData.meshUpdates) {
        if (meshUpdate.timestamp <= timestamp) {
          if (!latestMeshesById.has(meshUpdate.id) ||
              meshUpdate.timestamp >= latestMeshesById.get(meshUpdate.id).timestamp) {
            latestMeshesById.set(meshUpdate.id, meshUpdate);
          }
        }
      }
    }

    const currentMeshIds = new Set();

    // 2. Update existing meshes or add new ones
    latestMeshesById.forEach((meshData, meshId) => {
      currentMeshIds.add(meshId);
      const existingMeshObject = this.activeRoomMeshes.get(meshId);

      if (existingMeshObject) {
        // Mesh exists, check if its content needs updating
        if (existingMeshObject.userData.meshTimestamp !== meshData.timestamp) {
          // Timestamp changed, so geometry needs an update
          // Dispose old geometries
          if (existingMeshObject.geometry) existingMeshObject.geometry.dispose();
          if (existingMeshObject.material) existingMeshObject.material.dispose(); // Assuming EdgesGeometry uses a single material
          
          // Create new geometry and update the mesh
          const newBaseGeometry = new THREE.BufferGeometry();
          const vertices = new Float32Array(meshData.vertices.flat());
          const indices = new Uint32Array(meshData.faces.flat());
          newBaseGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
          newBaseGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
          newBaseGeometry.computeVertexNormals();
          
          const newEdgesGeometry = new THREE.EdgesGeometry(newBaseGeometry);
          // It's crucial to also dispose the newBaseGeometry as EdgesGeometry creates its own internal geometry
          newBaseGeometry.dispose();

          existingMeshObject.geometry = newEdgesGeometry;
          existingMeshObject.userData.meshTimestamp = meshData.timestamp;
          // Material can be reused if it's always the same, otherwise update here too
        }
      } else {
        // Mesh is new, create it and add it to the scene
        const newMeshObject = this.createRoom(meshData); // createRoom now returns the mesh object
        this.meshGroup.add(newMeshObject);
        this.activeRoomMeshes.set(meshId, newMeshObject);
      }
    });

    // 3. Remove meshes that are no longer in latestMeshesById
    const idsToRemove = [];
    this.activeRoomMeshes.forEach((meshObject, meshId) => {
      if (!currentMeshIds.has(meshId)) {
        idsToRemove.push(meshId);
      }
    });

    idsToRemove.forEach(meshId => {
      const meshObject = this.activeRoomMeshes.get(meshId);
      if (meshObject) {
        if (meshObject.geometry) meshObject.geometry.dispose();
        if (meshObject.material) {
          if (Array.isArray(meshObject.material)) {
            meshObject.material.forEach(material => material.dispose());
          } else {
            meshObject.material.dispose();
          }
        }
        this.meshGroup.remove(meshObject);
        this.activeRoomMeshes.delete(meshId);
      }
    });

    // 4. Update renderedMeshStates for compatibility or other uses if needed
    // This step can be simplified or removed if renderedMeshStates is no longer the primary driver for updates.
    this.renderedMeshStates.clear();
    this.activeRoomMeshes.forEach((meshObject, meshId) => {
      this.renderedMeshStates.set(meshId, meshObject.userData.meshTimestamp);
    });
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

  updateEntity(frameIndex) {
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

    // Simplified logic assuming entityFrames[frameIndex] is the correct data
    const entityFrameData = this.roomData.entityFrames[frameIndex];
    const entityDataForCurrentTimestamp = entityFrameData && Array.isArray(entityFrameData.entityStates) ? entityFrameData.entityStates : [];

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
          
          if (!trail) { 
              trail = { points: [], line: null };
              this.entityTrails.set(entityId, trail);
          }

          trail.points.push(currentPosition);
          // Ensure maxTrailLength is respected, even if it's 0
          if (this.maxTrailLength === 0) {
            trail.points = [];
          } else {
            while (trail.points.length > this.maxTrailLength) {
                trail.points.shift(); 
            }
          }

          if (trail.points.length >= 2) {
              if (trail.line) {
                  // Dispose old geometry before creating a new one
                  if (trail.line.geometry) trail.line.geometry.dispose();
                  trail.line.geometry = new THREE.BufferGeometry().setFromPoints(trail.points);
                  // Update color if it changed
                  if (trail.line.material.color.getHex() !== newColor) {
                    trail.line.material.color.setHex(newColor);
                  }
              } else {
                  const trailMaterial = new THREE.LineBasicMaterial({ color: newColor });
                  const trailGeometry = new THREE.BufferGeometry().setFromPoints(trail.points);
                  trail.line = new THREE.Line(trailGeometry, trailMaterial);
                  this.trailGroup.add(trail.line);
              }
          } else if (trail.line) { // Not enough points (or maxTrailLength is 0), remove line if it exists
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

  // Render the room mesh as a wireframe
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

    // Store id and timestamp for tracking updates
    roomLines.userData.meshId = meshData.id;
    roomLines.userData.meshTimestamp = meshData.timestamp;
    
    // The mesh will be added to this.meshGroup by the calling function (updateMesh)
    return roomLines;
  }

  // Get the color for an entity based on its type
  getEntityColors() {
    return {
      'yellowtang': 0x00ff00,
      'clownfish': 0xff0000,
      'sardine': 0x0000ff,
      'default': 0xff0000    
    };
  }

  // Create a cone mesh for an entity
  createEntityMesh(entityData) {
    const entityColors = this.getEntityColors();
    const entityType = entityData.type || 'default'; // Type might be optional, default is good
    const color = entityColors[entityType];
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

  // Update the hands in the scene to the most recent hand state given the timestamp
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

  // Clear all dynamic scene elements (entity and trails)
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

    // Clear room meshes
    this.clearMeshGroup(); // Disposes geometries/materials and clears children
    this.activeRoomMeshes.clear();
    this.renderedMeshStates.clear(); // Also clear this tracking map
  }
} 