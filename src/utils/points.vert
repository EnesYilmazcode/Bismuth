attribute float size;
uniform float u_progress;

// Improved hash-based pseudo-random number generator for better distribution
float random(in vec2 st, in float seed) {
  // Offset the coordinates with the seed to generate distinct values per axis
  return fract(sin(dot(st + vec2(seed), vec2(12.9898, 78.233))) * 43758.5453123);
}

vec3 getRandomPosition(in vec2 uv) {
  return vec3(
    random(uv, 1.0) * 2.0 - 1.0,
    random(uv, 2.0) * 2.0 - 1.0,
    random(uv, 3.0) * 2.0 - 1.0
  );
}

// Approximate 3-D Gaussian (normal) distribution using the Central Limit Theorem
// Returns a vector with mean 0 and configurable spread (stdMultiplier).
vec3 gaussianRandom(in vec2 uv, float stdMultiplier) {
  // Sum of 6 uniform samples per axis → approx N(0, 0.5^2)
  float x = random(uv, 10.0) + random(uv, 11.0) + random(uv, 12.0) +
            random(uv, 13.0) + random(uv, 14.0) + random(uv, 15.0) - 3.0;
  float y = random(uv, 20.0) + random(uv, 21.0) + random(uv, 22.0) +
            random(uv, 23.0) + random(uv, 24.0) + random(uv, 25.0) - 3.0;
  float z = random(uv, 30.0) + random(uv, 31.0) + random(uv, 32.0) +
            random(uv, 33.0) + random(uv, 34.0) + random(uv, 35.0) - 3.0;

  // Multiply to increase standard deviation and keep points reasonably bounded
  return vec3(x, y, z) * stdMultiplier;
}

// Smooth easing function for more natural transitions
float easeInOutCubic(float t) {
  return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
}

void main() {
  float clampedProgress = clamp(u_progress, 0.0, 1.0);
  float easedProgress = easeInOutCubic(clampedProgress);

  // Generate a 3-D Gaussian cloud with high standard deviation (stdMultiplier ~ 1.8)
  vec3 cloudPos = gaussianRandom(vec2(u_progress) + position.xy, 1.0);

  // Soft cutoff: dampen points beyond radius 3.0 to avoid an abrupt edge
  float dist = length(cloudPos);
  if (dist > 3.0) {
    cloudPos *= 3.0 / dist; // clamp to radius 3
  }

  // Interpolate between the cloud and the original mesh
  vec3 finalPosition = mix(cloudPos, position.xyz, easedProgress);
  vec4 mvPosition = modelViewMatrix * vec4(finalPosition, 1.0);

  gl_PointSize = size * ( 300.0 / -mvPosition.z );

  vec4 actualPosition = projectionMatrix * mvPosition;
  gl_Position = actualPosition;
}