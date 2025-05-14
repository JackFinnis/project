// ExportableDataModels.swift

import Foundation

struct ExportableMetadata: Codable {
    let version: String
    var duration: Double
    var captureDate: String // ISO 8601 format
    let roomName: String
    let device: String
    var meshFrameRate: Double
    var fishFrameRate: Double
}

struct ExportableMesh: Codable {
    let timestamp: Double
    let vertices: [[Float]] // Array of [x, y, z]
    let triangles: [[Int]]  // Array of [i, j, k]
}

struct ExportableFish: Codable {
    let position: [Float] // [x, y, z]
    let rotation: [Float] // [pitch, yaw, roll] in degrees
    let type: String
}

struct ExportableFishFrame: Codable {
    let timestamp: Double
    let fish: [ExportableFish]
}

struct ExportableFishTypeInfo: Codable {
    // These are not strictly used by the current web viewer for cones,
    // but including them maintains structure and allows for future enhancements.
    let modelRef: String?
    let scale: Float?
    // Color is determined by 'type' in the web viewer currently
}

struct FullExportData: Codable {
    var metadata: ExportableMetadata
    var meshes: [ExportableMesh]
    var fishFrames: [ExportableFishFrame]
    var fishTypes: [String: ExportableFishTypeInfo]?
} 