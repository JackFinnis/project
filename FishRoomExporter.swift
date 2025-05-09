import Foundation
import RealityKit
import ARKit
import UIKit

/// Class responsible for exporting VisionOS room mesh and fish entities to JSON
class FishRoomExporter {
    
    // MARK: - Properties
    
    private var arView: ARView
    private var fishEntities: [FishEntity] = []
    private var exportURL: URL
    private var frameRate: TimeInterval = 10 // frames per second
    private var exportTimer: Timer?
    private var startTime: TimeInterval = 0
    private var roomName: String
    
    // Data model for JSON export
    private var frames: [FrameData] = []
    
    private struct ExportData: Codable {
        let metadata: Metadata
        let frames: [FrameData]
    }
    
    private struct Metadata: Codable {
        let version: String
        let frameCount: Int
        let frameRate: Double
        let duration: Double
        let roomName: String
        let captureDate: String
        let device: String
    }
    
    private struct FrameData: Codable {
        let timestamp: TimeInterval
        let mesh: MeshData
        let fish: [FishData]
    }
    
    private struct MeshData: Codable {
        let vertices: [[Float]]
        let triangles: [[Int]]
    }
    
    private struct FishData: Codable {
        let position: [Float]
        let rotation: [Float]
        let type: String
    }
    
    // MARK: - Initialization
    
    init(arView: ARView, fishEntities: [FishEntity], exportDirectory: URL, roomName: String = "My Room") {
        self.arView = arView
        self.fishEntities = fishEntities
        self.exportURL = exportDirectory.appendingPathComponent("data.json")
        self.roomName = roomName
    }
    
    // MARK: - Public Methods
    
    /// Start recording frames at the specified frame rate
    func startRecording(frameRate: TimeInterval = 10) {
        self.frameRate = frameRate
        frames = []
        startTime = CACurrentMediaTime()
        
        exportTimer = Timer.scheduledTimer(withTimeInterval: 1.0/frameRate, repeats: true) { [weak self] _ in
            self?.captureFrame()
        }
    }
    
    /// Stop recording and export the data
    func stopRecordingAndExport(completion: @escaping (Result<URL, Error>) -> Void) {
        exportTimer?.invalidate()
        exportTimer = nil
        
        let duration = CACurrentMediaTime() - startTime
        
        do {
            // Create metadata
            let dateFormatter = ISO8601DateFormatter()
            let metadata = Metadata(
                version: "1.0",
                frameCount: frames.count,
                frameRate: frameRate,
                duration: duration,
                roomName: roomName,
                captureDate: dateFormatter.string(from: Date()),
                device: "Apple Vision Pro"
            )
            
            let exportData = ExportData(metadata: metadata, frames: frames)
            let encoder = JSONEncoder()
            encoder.outputFormatting = .prettyPrinted
            let jsonData = try encoder.encode(exportData)
            
            try jsonData.write(to: exportURL)
            completion(.success(exportURL))
        } catch {
            completion(.failure(error))
        }
    }
    
    // MARK: - Private Methods
    
    private func captureFrame() {
        guard let meshAnchor = arView.session.currentFrame?.anchors.compactMap({ $0 as? ARMeshAnchor }).first else {
            return
        }
        
        // Get current timestamp relative to start time
        let timestamp = CACurrentMediaTime() - startTime
        
        // Extract room mesh data
        let meshData = extractMeshData(from: meshAnchor)
        
        // Extract fish positions and types
        let fishData = fishEntities.map { entity -> FishData in
            let worldPosition = entity.convert(position: .zero, to: nil)
            
            // Get rotation in degrees
            let rotation = entity.transform.rotation
            let eulerAngles = rotation.eulerAngles
            let rotationDegrees = [
                Float(eulerAngles.x * 180 / .pi),
                Float(eulerAngles.y * 180 / .pi),
                Float(eulerAngles.z * 180 / .pi)
            ]
            
            return FishData(
                position: [Float(worldPosition.x), Float(worldPosition.y), Float(worldPosition.z)],
                rotation: rotationDegrees,
                type: entity.fishType
            )
        }
        
        // Create frame data
        let frameData = FrameData(
            timestamp: timestamp,
            mesh: meshData,
            fish: fishData
        )
        
        frames.append(frameData)
    }
    
    private func extractMeshData(from meshAnchor: ARMeshAnchor) -> MeshData {
        let geometry = meshAnchor.geometry
        
        // Extract vertices
        var vertices: [[Float]] = []
        for i in 0..<geometry.vertices.count {
            let vertex = geometry.vertices[i]
            vertices.append([vertex.x, vertex.y, vertex.z])
        }
        
        // Extract face indices (triangles)
        var triangles: [[Int]] = []
        for i in stride(from: 0, to: geometry.faces.count, by: 3) {
            if i + 2 < geometry.faces.count {
                triangles.append([Int(geometry.faces[i]), Int(geometry.faces[i+1]), Int(geometry.faces[i+2])])
            }
        }
        
        return MeshData(vertices: vertices, triangles: triangles)
    }
}

// MARK: - Fish Entity
class FishEntity: ModelEntity {
    var fishType: String
    
    init(type: String, geometry: ModelComponent.Geometry? = nil, materials: [Material] = []) {
        self.fishType = type
        super.init()
        
        if let geometry = geometry {
            self.model?.mesh = geometry
        }
        
        self.model?.materials = materials
    }
    
    required init() {
        self.fishType = "default"
        super.init()
    }
}

// MARK: - Usage Example
/*
// Example usage in your VisionOS app:

// Set up your ARView
let arView = ARView(frame: .zero)

// Create fish entities with types
let goldfish = FishEntity(type: "goldfish")
goldfish.position = [0.2, 0.2, 0.1]

let clownfish = FishEntity(type: "clownfish")
clownfish.position = [0.4, 0.4, 0.3]

// Add fish to your scene
arView.scene.addAnchor(goldfish)
arView.scene.addAnchor(clownfish)

// Create export directory
let documentsDirectory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
let exportDirectory = documentsDirectory.appendingPathComponent("FishExport")
try? FileManager.default.createDirectory(at: exportDirectory, withIntermediateDirectories: true)

// Create and use the exporter
let exporter = FishRoomExporter(
    arView: arView, 
    fishEntities: [goldfish, clownfish], 
    exportDirectory: exportDirectory,
    roomName: "Living Room"
)

// Start recording when ready
exporter.startRecording(frameRate: 10)

// Stop recording and export when done (after some time)
DispatchQueue.main.asyncAfter(deadline: .now() + 10) {
    exporter.stopRecordingAndExport { result in
        switch result {
        case .success(let url):
            print("Export successful: \(url.path)")
            
            // Share the file
            let activityVC = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            // Present the activity view controller
            
        case .failure(let error):
            print("Export failed: \(error.localizedDescription)")
        }
    }
}
*/ 