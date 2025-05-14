// AppTypes.swift

import RealityKit

// --- YOUR FISH ENUM --- 
// This MUST match how you define your fish.
// It needs a String rawValue and to be CaseIterable for the exporter.
enum Fish: String, CaseIterable, Codable {
    case goldfish = "goldfish"
    case clownfish = "clownfish"
    // Add all your other fish types here, for example:
    // case angelfish = "angelfish"
    // case pufferfish = "pufferfish"
    // Make sure rawValues match what the web viewer expects for colors if using that logic.
}

struct BoidComponent: Component, Codable { // Codable if you ever need to serialize it directly
    var velocity: SIMD3<Float>
    var animationController: AnimationPlaybackController? // Made optional if not all fish animate or controller not always needed
    var fish: Fish // Use your Fish enum

    // Initializer might be useful
    init(velocity: SIMD3<Float> = .zero, animationController: AnimationPlaybackController? = nil, fish: Fish) {
        self.velocity = velocity
        self.animationController = animationController
        self.fish = fish
    }
}

// Add ObstacleComponent if not defined elsewhere, or ensure it's accessible
struct ObstacleComponent: Component, Codable {} 