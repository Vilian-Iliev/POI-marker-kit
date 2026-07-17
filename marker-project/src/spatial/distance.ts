import * as THREE from 'three';

export function calculateDistance(pointA: THREE.Vector3, pointB: THREE.Vector3): number {
    return pointA.distanceTo(pointB);
}

