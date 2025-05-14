// FishRoomExporter.swift

import RealityKit
import ARKit // For ARMeshAnchor

class FishRoomExporter: ObservableObject {
    @Published private(set) var isRecording: Bool = false
    @Published private(set) var lastExportURL: URL?
    @Published private(set) var statusMessage: String = "Exporter Ready"

    private var exportData: FullExportData?
    private var startTime: Date?
    private var lastMeshRecordTime: Date?
    private let meshRecordInterval: TimeInterval // e.g., 1.0 for 1 sec

    private let dateFormatter: ISO8601DateFormatter
    private let roomName: String

    init(roomName: String = "VisionOS_Scene", 
         meshRecordInterval: TimeInterval = 1.0) {
        self.roomName = roomName
        self.meshRecordInterval = meshRecordInterval
        
        self.dateFormatter = ISO8601DateFormatter()
        self.dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    }

    private func initializeExportData() {
        self.exportData = FullExportData(
            metadata: ExportableMetadata(
                version: "1.4_visionOS",
                duration: 0.0,
                captureDate: dateFormatter.string(from: Date()), // Placeholder, set on start
                roomName: self.roomName,
                device: "Apple Vision Pro",
                meshFrameRate: 0 // Will be calculated
            ),
            meshes: [],
            fishFrames: [],
            fishTypes: populateFishTypes()
        )
    }

    private func populateFishTypes() -> [String: ExportableFishTypeInfo] {
        var types = [String: ExportableFishTypeInfo]()
        // This relies on your Fish enum being defined and CaseIterable
        // For example: enum Fish: String, CaseIterable { case goldfish, clownfish ... }
        // Replace 'Fish.allCases' with your actual Fish enum if its name is different
        for fishType in Fish.allCases { 
            types[fishType.rawValue] = ExportableFishTypeInfo(modelRef: nil, scale: nil)
        }
        return types
    }

    // MARK: - Recording Control
    func startRecording() {
        initializeExportData()
        startTime = Date()
        lastMeshRecordTime = Date() // Allow immediate first mesh capture
        
        guard exportData != nil else {
            statusMessage = "Error: Could not initialize data."
            return
        }
        exportData!.metadata.captureDate = dateFormatter.string(from: startTime!)
        
        isRecording = true
        statusMessage = "Recording..."
        print("Exporter: Recording started at \(exportData!.metadata.captureDate)")
    }

    func stopRecording() {
        guard let startTime = startTime, var currentData = exportData else {
            statusMessage = "Not recording."
            isRecording = false
            return
        }
        
        let duration = Date().timeIntervalSince(startTime)
        currentData.metadata.duration = duration
        
        if duration > 0 {
            currentData.metadata.meshFrameRate = Double(currentData.meshes.count) / duration
        } else {
            currentData.metadata.meshFrameRate = 0
        }
        self.exportData = currentData
        self.startTime = nil
        isRecording = false
        statusMessage = "Recording stopped. Duration: \(duration.formatted("%.2f"))s. Meshes: \(currentData.meshes.count). FishFrames: \(currentData.fishFrames.count)."
        print(statusMessage)
    }

    // MARK: - Data Recording Methods
    
    func recordMeshAnchors(_ anchors: [ARMeshAnchor], referenceTransform: simd_float4x4 = matrix_identity_float4x4) {
        guard isRecording, let startTime = startTime, var currentData = exportData, let lastMeshRecordTime = lastMeshRecordTime else { return }

        if !currentData.meshes.isEmpty && Date().timeIntervalSince(lastMeshRecordTime) < meshRecordInterval {
            return // Throttle mesh recording
        }

        let currentTimestamp = Date().timeIntervalSince(startTime)
        var meshesRecordedThisCall = 0
        
        for anchor in anchors {
            let verticesRaw = anchor.geometry.vertices.positions() // These are SIMD3<Float> in anchor's local space
            
            let vertices = verticesRaw.map { localVertex -> [Float] in
                let anchorSpaceVertex = SIMD4<Float>(localVertex.x, localVertex.y, localVertex.z, 1.0)
                let worldSpaceVertex = anchor.transform * anchorSpaceVertex // anchor.transform is modelToWorld for the anchor
                let finalVertex = referenceTransform * worldSpaceVertex // If referenceTransform is worldToOurSceneRoot
                return [finalVertex.x, finalVertex.y, finalVertex.z]
            }
            
            guard let facesElement = anchor.geometry.faces.elements.first(where: { $0.primitive == .triangle }),
                  !vertices.isEmpty else {
                continue
            }
            let triangles = facesElement.faces() // [[Int]]

            if !triangles.isEmpty {
                let mesh = ExportableMesh(timestamp: currentTimestamp, vertices: vertices, triangles: triangles)
                currentData.meshes.append(mesh)
                meshesRecordedThisCall += 1
            }
        }
        
        if meshesRecordedThisCall > 0 {
            self.lastMeshRecordTime = Date()
            self.exportData = currentData
            // print("Exporter: Recorded \(meshesRecordedThisCall) meshes at timestamp \(currentTimestamp.formatted("%.2f"))s")
        }
    }
    
    func recordFishStates(_ fishEntities: [Entity]) {
        guard isRecording, let startTime = startTime, var currentData = exportData else { return }
        let currentTimestamp = Date().timeIntervalSince(startTime)

        var currentFrameFishes: [ExportableFish] = []
        for entity in fishEntities {
            guard let boidComponent = entity.components[BoidComponent.self] else {
                continue
            }

            let position = entity.position(relativeTo: nil) // World position relative to RealityKit scene origin
            let orientation = entity.orientation(relativeTo: nil) 
            
            let euler = orientation.eulerAngles(order: .yxz) // Radians
            
            let rotationDegrees = [
                euler.x.radiansToDegrees, // Pitch
                euler.y.radiansToDegrees, // Yaw
                euler.z.radiansToDegrees  // Roll
            ]

            let fish = ExportableFish(
                position: [position.x, position.y, position.z],
                rotation: rotationDegrees,
                type: boidComponent.fish.rawValue // Assumes Fish enum has String rawValue
            )
            currentFrameFishes.append(fish)
        }

        if !currentFrameFishes.isEmpty {
            let fishFrame = ExportableFishFrame(timestamp: currentTimestamp, fish: currentFrameFishes)
            currentData.fishFrames.append(fishFrame)
            self.exportData = currentData
        }
    }

    // MARK: - JSON Output & Saving
    func getJSONData() -> Data? {
        guard let currentData = exportData else {
            statusMessage = "No data to export."
            return nil
        }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys] // .compact for smaller file
        do {
            let jsonData = try encoder.encode(currentData)
            statusMessage = "JSON data prepared."
            return jsonData
        } catch {
            statusMessage = "Error encoding JSON: \(error.localizedDescription)"
            print("Exporter: Error encoding JSON data: \(error)")
            return nil
        }
    }

    func saveToDocuments(fileName: String = "FishRoomExport.json") {
        guard let data = getJSONData() else {
            print("Exporter: No JSON data to save.")
            return
        }
        
        let fileManager = FileManager.default
        do {
            let documentsDirectory = try fileManager.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            let fileURL = documentsDirectory.appendingPathComponent(fileName)
            try data.write(to: fileURL, options: .atomic)
            lastExportURL = fileURL // Store for potential sharing
            statusMessage = "Export saved to \(fileName)"
            print("Exporter: Successfully saved data to \(fileURL.path)")
        } catch {
            statusMessage = "Error saving file: \(error.localizedDescription)"
            print("Exporter: Error saving file: \(error)")
        }
    }
} 