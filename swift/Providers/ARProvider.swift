// ARProvider.swift

import RealityKit
import ARKit
import Combine

@MainActor
class ARProvider: NSObject, ObservableObject { // Removed ARSessionDelegate as SceneReconstructionProvider handles anchor updates
    let session = ARKitSession()
    let sceneReconstruction = SceneReconstructionProvider(modes: [.classification, .mesh]) // Ensure .mesh is included
    
    private var meshAnchorsByID: [UUID: ARMeshAnchor] = [:]
    
    // Weak reference to the exporter to avoid retain cycles
    weak var exporter: FishRoomExporter?

    // This transform is crucial if your RealityView content root is not at AR world origin.
    // It should transform points from ARKit world space to your scene's root coordinate space.
    // If your scene root IS at world origin (0,0,0), this can be matrix_identity_float4x4.
    var worldToSceneRootTransform: simd_float4x4 = matrix_identity_float4x4

    override init() {
        super.init()
    }

    func start() async {
        do {
            if SceneReconstructionProvider.isSupported {
                print("ARProvider: SceneReconstruction is supported.")
                try await session.run([sceneReconstruction])
                // Start processing scene reconstruction updates
                Task {
                    for await update in sceneReconstruction.anchorUpdates {
                        await process(update: update)
                    }
                }
            } else {
                print("ARProvider: SceneReconstruction is NOT supported on this device.")
            }
        } catch {
            print("ARProvider: Error starting AR session: \(error)")
        }
    }
    
    func stop() {
        session.stop()
        meshAnchorsByID.removeAll()
        print("ARProvider: Session stopped.")
    }

    private func process(update: AnchorUpdate<ARMeshAnchor>) async {
        let meshAnchor = update.anchor
        
        // Depending on the update event type, you might add, update, or remove the mesh from your RealityKit scene.
        // This part is typically handled by your SceneProvider or similar logic for visualization.
        // For the exporter, we just care about the latest state of the mesh.

        if update.event == .removed {
            meshAnchorsByID.removeValue(forKey: meshAnchor.id)
        } else { // .added or .updated
            meshAnchorsByID[meshAnchor.id] = meshAnchor
        }
        
        // Periodically (or on significant change) send all current anchors to exporter
        // The exporter itself throttles based on its meshRecordInterval.
        let allCurrentMeshAnchors = Array(meshAnchorsByID.values)
        if !allCurrentMeshAnchors.isEmpty {
            exporter?.recordMeshAnchors(allCurrentMeshAnchors, referenceTransform: worldToSceneRootTransform)
        }
    }
    
    // Optional: A method to explicitly trigger sending anchors if needed
    func sendCurrentMeshesToExporter() {
        let allCurrentMeshAnchors = Array(meshAnchorsByID.values)
        if !allCurrentMeshAnchors.isEmpty {
            exporter?.recordMeshAnchors(allCurrentMeshAnchors, referenceTransform: worldToSceneRootTransform)
            print("ARProvider: Manually triggered sending \(allCurrentMeshAnchors.count) meshes to exporter.")
        }
    }
} 