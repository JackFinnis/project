import SwiftUI
import RealityKit

struct FishSpace: View {
    // Providers
    @State var handProvider = HandProvider() // Assuming HandProvider is defined elsewhere
    @State var deviceProvider = DeviceProvider() // Assuming DeviceProvider is defined elsewhere
    // @State var cardProvider = CardProvider() // Assuming CardProvider is defined elsewhere, if used
    @State var sceneProvider = SceneProvider() // Assuming this sets up basic scene elements, lights, etc.
    
    @StateObject var arProvider = ARProvider() 
    @StateObject var exporter = FishRoomExporter(roomName: "MyVisionOSAquarium")

    // Root entity for the whole RealityView content
    let realityViewRoot = Entity()
    
    // Obstacles
    let rightHandObstacle = Self.createObstacleEntity()
    let leftHandObstacle = Self.createObstacleEntity()
    let deviceObstacle = Self.createObstacleEntity()
    
    var body: some View {
        // Using a ZStack to overlay controls on top of the RealityView
        ZStack(alignment: .bottom) {
            RealityView {
                content, attachments in // Add attachments parameter
                // Register FishSystem with the exporter instance
                FishSystem.registerSystem {
                    // This closure is called to initialize the system.
                    // Make sure FishSystem has an init that can accept the exporter.
                    FishSystem(scene: content.scene, exporter: exporter)
                }
                
                content.add(realityViewRoot) 
                realityViewRoot.addChild(sceneProvider.root) // Add sceneProvider's content to our main root
                
                realityViewRoot.addChild(deviceObstacle)
                realityViewRoot.addChild(leftHandObstacle)
                realityViewRoot.addChild(rightHandObstacle)
                
                // Link ARProvider to Exporter
                arProvider.exporter = exporter
                
                // CRUCIAL: Set the worldToSceneRootTransform for ARProvider.
                // This transform converts ARKit world coordinates to the coordinate system of `sceneProvider.root`,
                // assuming `sceneProvider.root` is where your main visual content (like fish) resides.
                // If sceneProvider.root is at the origin of realityViewRoot, and realityViewRoot is at AR world origin:
                // arProvider.worldToSceneRootTransform = matrix_identity_float4x4
                // If sceneProvider.root is transformed relative to realityViewRoot, or realityViewRoot is transformed:
                // arProvider.worldToSceneRootTransform = sceneProvider.root.transformMatrix(relativeTo: nil).inverse
                // For robust setup, calculate it based on the actual parent of your fish and meshes.
                // Let's assume for now that sceneProvider.root IS the reference for exported coordinates.
                // We may need to wait for sceneProvider.root to be fully set up if its transform is dynamic.
                // This might be better done in .onAppear or after sceneProvider.start() if transform is not identity.
                arProvider.worldToSceneRootTransform = sceneProvider.root.transformMatrix(relativeTo: nil).inverse

            } update: { content, attachments in // Add attachments parameter
                // Update obstacle positions
                if let deviceTransform = deviceProvider.getTransform() { // Assuming getTransform returns a Transform
                    deviceObstacle.transform = deviceTransform // Apply the whole transform
                }
                if let leftHandTransform = handProvider.getTransform(.left) {
                    leftHandObstacle.transform = leftHandTransform
                }
                if let rightHandTransform = handProvider.getTransform(.right) {
                    rightHandObstacle.transform = rightHandTransform
                }
            }
            .gesture(
                SpatialTapGesture()
                    .targetedToAnyEntity()
                    .onEnded { tapEvent in
                        Task {
                            // Convert tap location to the scene's coordinate system
                            // The target for adding boids should be sceneProvider.root or similar
                            if let targetEntity = tapEvent.entity.scene { // scene as a common root
                                let locationInScene = tapEvent.convert(tapEvent.location3D, from: .local, to: targetEntity)
                                try? await addBoid(position: locationInScene, parentEntity: sceneProvider.root)
                            }
                        }
                    }
            )
            .onAppear {
                Task {
                    await arProvider.start()
                    try? await sceneProvider.start() // Ensure this sets up sceneProvider.root
                    try? await handProvider.start()
                    try? await deviceProvider.start()
                    // try? await cardProvider.start() // If you have it
                    // try? await playWaterSoundIfNeeded() // Your sound function
                }
            }
            .onDisappear {
                arProvider.stop()
                // stop other providers if necessary
            }
            
            // --- EXPORTER CONTROLS ---
            ExporterControlsView(exporter: exporter)
        }
    }
    
    func addBoid(position: SIMD3<Float>, parentEntity: Entity) async throws {
        let fishType = Fish.allCases.randomElement() ?? .goldfish // Default to goldfish if random fails
        
        // This assumes your Fish enum has a way to get an entity (e.g., a computed property or static func)
        // For example, if Fish has a method: static func createEntity(type: Fish) async -> Entity
        let fishEntity = await Fish.createEntity(type: fishType) 
        
        fishEntity.position = position
        
        var animationController: AnimationPlaybackController? = nil
        if let firstAnimation = fishEntity.availableAnimations.first {
            animationController = fishEntity.playAnimation(firstAnimation.repeat())
        }
        
        fishEntity.components.set(BoidComponent(velocity: .zero, animationController: animationController, fish: fishType))
        parentEntity.addChild(fishEntity)
    }
    
    static func createObstacleEntity() -> Entity {
        let entity = Entity()
        entity.components.set(InputTargetComponent())
        entity.components.set(CollisionComponent(shapes: [.generateSphere(radius: 0.3)], mode: .trigger, filter: .sensor))
        entity.components.set(ObstacleComponent())
        return entity
    }

    // func playWaterSoundIfNeeded() async throws { /* ... your sound logic ... */ }
}

// Simple UI for exporter controls
struct ExporterControlsView: View {
    @ObservedObject var exporter: FishRoomExporter
    // @State private var showShareSheet = false // ShareLink handles its own presentation

    var body: some View {
        VStack(spacing: 5) {
            Text(exporter.statusMessage)
                .font(.caption)
                .padding(.top, 5)
            HStack {
                Button {
                    if exporter.isRecording {
                        exporter.stopRecording()
                    } else {
                        exporter.startRecording()
                    }
                } label: {
                    Text(exporter.isRecording ? "Stop Recording" : "Start Recording")
                        .padding(8)
                        .frame(minWidth: 150)
                        .background(exporter.isRecording ? .red : .green)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                }

                Button {
                    exporter.saveToDocuments()
                } label: {
                    Text("Save Export")
                        .padding(8)
                        .frame(minWidth: 120)
                        .background(.blue)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                }
                .disabled(exporter.isRecording || exporter.exportData == nil) // Check exportData directly from exporter
                
                if let url = exporter.lastExportURL {
                    ShareLink(item: url) {
                        Label("Share", systemImage: "square.and.arrow.up")
                    }
                    .padding(8)
                    .background(.orange)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 10)
        }
        .background(.thinMaterial)
    }
}

// Placeholder for how Fish enum might provide entities
// You need to implement this based on how you load/create your fish models
extension Fish {
    static func createEntity(type: Fish) async -> Entity {
        // Example: Load a differently named model for each fish type
        // You would replace "goldfish_model_placeholder.usdz" with your actual model names
        let modelName: String
        switch type {
        case .goldfish:
            modelName = "goldfish_model_placeholder.usdz" // Replace with actual model name
        case .clownfish:
            modelName = "clownfish_model_placeholder.usdz" // Replace with actual model name
        // Add other cases for your fish types
        // default:
        //     modelName = "default_fish_model.usdz"
        }
        
        do {
            // Assuming your models are in the app bundle
            let entity = try await Entity(named: modelName) 
            return entity
        } catch {
            print("Error loading model for fish type \(type.rawValue): \(error)")
            // Return a fallback placeholder entity if loading fails
            let placeholder = ModelEntity(mesh: .generateSphere(radius: 0.05), 
                                          materials: [SimpleMaterial(color: .gray, isMetallic: false)])
            placeholder.name = "\(type.rawValue)_fallback"
            return placeholder
        }
    }
}

// Define your HandProvider, DeviceProvider, SceneProvider as they currently exist.
// For example:
// class HandProvider: ObservableObject { func start() async throws {} func getTransform(_ hand: HandAnchor.Chirality) -> Transform? { return nil } }
// class DeviceProvider: ObservableObject { func start() async throws {} func getTransform() -> Transform? { return nil } }
// class SceneProvider: ObservableObject { let root = Entity(); func start() async throws {} } 