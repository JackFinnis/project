import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SceneManager {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.mesh = null;
    this.roomData = null;
    this.currentFrameIndex = 0;
    this.lastFrameTime = 0;
    this.isAnimating = false;
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
      console.log('SceneManager: Full loaded roomData:', this.roomData);
      console.log('Room data loaded:', this.roomData.metadata.roomName);
      
      return this.roomData;
    } catch (error) {
      console.error('Error loading room data:', error);
      throw error;
    }
  }

  updateFrame(frameIndex) {
    if (!this.roomData || !this.roomData.frames[frameIndex]) {
      console.error('No room data available for frame', frameIndex);
      return;
    }

    // Clear previous frame
    if (this.mesh) this.scene.remove(this.mesh);
    this.mesh = new THREE.Group();
    
    const frame = this.roomData.frames[frameIndex];
    this.createRoom(frame.mesh);
    this.addFish(frame.fish);
    
    this.scene.add(this.mesh);
    this.currentFrameIndex = frameIndex;
  }

  createRoom(meshData) {
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
    this.mesh.add(roomLines);
    
    // Add corner points
    const pointsGeometry = new THREE.BufferGeometry();
    pointsGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    const pointsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.05,
      sizeAttenuation: true
    });
    const cornerPoints = new THREE.Points(pointsGeometry, pointsMaterial);
    this.mesh.add(cornerPoints);
  }

  addFish(fishData) {
    fishData.forEach((fish, index) => {
      const fishGeometry = new THREE.ConeGeometry(0.05, 0.15, 8);
      const fishMaterial = new THREE.MeshPhongMaterial({ 
        color: fish.type === 'goldfish' ? 0xffa500 : 0xff0000 
      });
      
      const fishMesh = new THREE.Mesh(fishGeometry, fishMaterial);
      fishMesh.position.set(...fish.position);
      
      // Set rotation from the data file
      const rotationRadians = fish.rotation.map(deg => THREE.MathUtils.degToRad(deg));
      fishMesh.rotation.set(
        rotationRadians[0],
        rotationRadians[1], 
        rotationRadians[2]
      );
      
      // The cone by default points up along the Y-axis, 
      // so we need to rotate it to point along its forward direction
      fishMesh.rotateX(Math.PI / 2);
      
      this.mesh.add(fishMesh);
    });
  }
} 