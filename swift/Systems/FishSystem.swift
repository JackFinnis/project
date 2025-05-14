import RealityKit

struct FishSystem: System {
    // Query for all entities that have a BoidComponent
    private static let boidQuery = EntityQuery(where: .has(BoidComponent.self))

    // Weak reference to avoid retain cycles if exporter holds system or vice-versa
    weak var exporter: FishRoomExporter?

    // Initializer to accept the exporter instance
    init(scene: Scene, exporter: FishRoomExporter?) {
        self.exporter = exporter
        print("FishSystem initialized.")
        if exporter == nil {
            print("FishSystem: Exporter instance is nil during initialization.")
        }
    }

    func update(context: SceneUpdateContext) {
        // --- Your existing fish logic should go here ---
        // This typically involves:
        // - Iterating through entities with BoidComponent
        // - Updating their velocity, position, and orientation based on boid rules (flocking, avoidance, etc.)
        // - Updating their animations via the animationController in BoidComponent
        //
        // Example placeholder for iteration (replace with your actual logic):
        // context.scene.performQuery(Self.boidQuery).forEach { entity in
        //     guard var boid = entity.components[BoidComponent.self] else { return }
        //     // Your boid update logic, e.g.:
        //     // boid.velocity += calculateSteeringForce() 
        //     // entity.position += boid.velocity * Float(context.deltaTime)
        //     // entity.orientation = lookAt(targetPosition) 
        //     entity.components.set(boid) // Write back the updated component
        // }
        // --- End of your existing fish logic placeholder ---

        // After all fish states for this frame are finalized, record them if exporting:
        if exporter?.isRecording == true {
            let fishEntities = context.scene.performQuery(Self.boidQuery).map { $0 }
            if !fishEntities.isEmpty {
                exporter?.recordFishStates(fishEntities)
            }
        }
    }
} 