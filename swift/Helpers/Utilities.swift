// Utilities.swift
import Foundation
import ARKit // For MeshAnchor, GeometrySource, GeometryElement
import RealityKit // For SIMD types if not covered by ARKit/Foundation, and Transform

extension Float {
    var degreesToRadians: Float { self * .pi / 180 }
    var radiansToDegrees: Float { self * 180 / .pi }
}

// Your existing Geometry and SIMD helpers, ensure they use SIMD3<Float> where Vector was used
// and are compatible with the exporter's expectations.

extension ARKit.GeometrySource {
    func positions() -> [SIMD3<Float>] { // Changed Vector to SIMD3<Float>
        (0..<count)
            .map { index in
                buffer
                    .contents()
                    .advanced(by: offset + stride * index)
                    .assumingMemoryBound(to: (Float, Float, Float).self)
                    .pointee
            }
            .map { SIMD3<Float>($0.0, $0.1, $0.2) } // Ensure SIMD3<Float> initialization
    }
    
    // Assuming normals are also SIMD3<Float> if you were to use them
    func normals() -> [SIMD3<Float>] { // Changed Vector to SIMD3<Float>
        (0..<count)
            .map { index in
                buffer
                    .contents()
                    .advanced(by: offset + stride * index)
                    .assumingMemoryBound(to: (Float, Float, Float).self)
                    .pointee
            }
            .map { SIMD3<Float>($0.0, $0.1, $0.2) } // Ensure SIMD3<Float> initialization
    }
}

extension ARKit.GeometryElement {
    func faces() -> [[Int]] {
        guard primitive == .triangle else {
            print("Warning: Attempting to get faces from a non-triangle primitive geometry element.")
            return []
        }
        return (0..<count)
            .map { index in
                buffer
                    .contents()
                    .advanced(by: index * primitive.indexCount * bytesPerIndex)
                    .assumingMemoryBound(to: (Int32, Int32, Int32).self)
                    .pointee
            }
            .map { [Int($0.0), Int($0.1), Int($0.2)] } // Ensure direct Int conversion
    }
}

// typealias Vector = SIMD3<Float> // This is good practice, ensure it's defined if used elsewhere explicitly.
// If you used `Vector` directly in your own code, this makes it clear.

extension ARKit.MeshAnchor {
    // This is one way to get vertices. The exporter has its own logic using anchor.transform.
    // If you use this specific helper, ensure originFromAnchorTransform is correctly defined and used.
    // For the exporter provided, it directly uses anchor.geometry.vertices.positions() and anchor.transform.
    // var verticesInWorld: [SIMD3<Float>] { // Example if you had a Vertex struct
    //     let vertexPositions = geometry.vertices.positions().map(transform.worldPositionFromLocal)
    //     return vertexPositions
    // }
}

// SIMD helpers from your prompt
extension simd_float4 {
    var xyz: SIMD3<Float> { // Renamed from vector to be more specific
        SIMD3<Float>(x: x, y: y, z: z)
    }
}

extension SIMD3<Float> {
    var homogeneousPoint: simd_float4 { // For transforming points
        simd_float4(x: x, y: y, z: z, w: 1.0)
    }
    var homogeneousDirection: simd_float4 { // For transforming directions (w=0)
        simd_float4(x: x, y: y, z: z, w: 0.0)
    }
}

extension simd_float4x4 {
    var position: SIMD3<Float> { // Extracts translation component
        columns.3.xyz
    }
    
    // This extracts the Z-axis of the transform, assuming it represents forward direction.
    // Normalization might be needed if the matrix has scaling.
    var zDirection: SIMD3<Float> { 
        normalize(columns.2.xyz) // columns.2 is the Z-axis (0-indexed)
    }

    // Applies matrix transform to a local position vector, returns world position
    func worldPosition(fromLocal localPosition: SIMD3<Float>) -> SIMD3<Float> {
        (self * localPosition.homogeneousPoint).xyz
    }

    // Applies matrix transform (typically rotation part) to a local direction vector
    // For pure rotation, the w component of the vector should be 0.
    func worldDirection(fromLocal localDirection: SIMD3<Float>) -> SIMD3<Float> {
        // For directions, we only care about the rotational part of the matrix.
        // We can zero out the translation component or construct a rotation matrix.
        // A simpler way for direction (if no non-uniform scaling) is to multiply by the upper 3x3.
        // Or, ensure w=0 for the vector.
        normalize((self * localDirection.homogeneousDirection).xyz)
    }
} 