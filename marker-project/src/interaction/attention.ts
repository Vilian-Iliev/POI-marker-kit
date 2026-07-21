import * as THREE from "three";
import { config } from "../config";
import { calculateDistance } from "../spatial/distance";

/**
 * Check if a target object is in focus.
 * An object is in focus when it satisfies both conditions from config:
 * 1. Within focusDistance (proximity)
 * 2. Within focusAngle (angular view)
 *
 * @param pov - Camera position (point of view)
 * @param target - Target object position to check
 * @param fovAngleDegrees - Field of view angle in degrees (from config.focusAngle)
 * @returns true if target is in focus, false otherwise
 */
export function objectIsInView(
  pov: THREE.Vector3,
  target: THREE.Vector3,
  fovAngleDegrees: number,
): boolean {
  // Check proximity: must be within focusDistance
  const distance = calculateDistance(pov, target);
  if (distance > config.focusDistance) {
    return false;
  }

  // Check angular view: must be within focusAngle
  // Vector from camera to target
  const toTarget = new THREE.Vector3().subVectors(target, pov);

  // If distance is 0, not in focus
  if (toTarget.length() === 0) {
    return false;
  }

  // Normalize direction to target
  toTarget.normalize();

  // Camera looks along negative Z axis in Three.js
  const cameraForward = new THREE.Vector3(0, 0, -1);

  // Calculate the angle between camera forward direction and direction to target
  // Using dot product: dot = |a||b|cos(angle), and both are normalized so |a|=|b|=1
  const dotProduct = cameraForward.dot(toTarget);

  // Clamp to avoid numerical errors with acos
  const clampedDot = Math.max(-1, Math.min(1, dotProduct));
  const angleRadians = Math.acos(clampedDot);
  const angleDegrees = THREE.MathUtils.radToDeg(angleRadians);

  // Target is in focus if angle is within the focusAngle
  return angleDegrees <= fovAngleDegrees;
}
