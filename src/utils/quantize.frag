uniform sampler2D u_mesh_texture;

// Receive UVs from vertex shader
in vec2 vUv;
out vec4 fragColor;

const float colorNum = 6.;// number of values possible for each R, G, B.


float quantize(float inp, float period)
{
    return floor((inp+period/2.)/period)*period;
}
vec2 quantize(vec2 inp, vec2 period)
{
    return floor((inp+period/2.)/period)*period;
}

const float bayerMatrix8x8[64] = float[64](
    0.0/ 64.0, 48.0/ 64.0, 12.0/ 64.0, 60.0/ 64.0,  3.0/ 64.0, 51.0/ 64.0, 15.0/ 64.0, 63.0/ 64.0,
  32.0/ 64.0, 16.0/ 64.0, 44.0/ 64.0, 28.0/ 64.0, 35.0/ 64.0, 19.0/ 64.0, 47.0/ 64.0, 31.0/ 64.0,
    8.0/ 64.0, 56.0/ 64.0,  4.0/ 64.0, 52.0/ 64.0, 11.0/ 64.0, 59.0/ 64.0,  7.0/ 64.0, 55.0/ 64.0,
  40.0/ 64.0, 24.0/ 64.0, 36.0/ 64.0, 20.0/ 64.0, 43.0/ 64.0, 27.0/ 64.0, 39.0/ 64.0, 23.0/ 64.0,
    2.0/ 64.0, 50.0/ 64.0, 14.0/ 64.0, 62.0/ 64.0,  1.0/ 64.0, 49.0/ 64.0, 13.0/ 64.0, 61.0/ 64.0,
  34.0/ 64.0, 18.0/ 64.0, 46.0/ 64.0, 30.0/ 64.0, 33.0/ 64.0, 17.0/ 64.0, 45.0/ 64.0, 29.0/ 64.0,
  10.0/ 64.0, 58.0/ 64.0,  6.0/ 64.0, 54.0/ 64.0,  9.0/ 64.0, 57.0/ 64.0,  5.0/ 64.0, 53.0/ 64.0,
  42.0/ 64.0, 26.0/ 64.0, 38.0/ 64.0, 22.0/ 64.0, 41.0/ 64.0, 25.0/ 64.0, 37.0/ 64.0, 21.0 / 64.0
);

vec3 dither(vec2 fragCoord, vec3 color) {
  int x = int(fragCoord.x) % 8;
  int y = int(fragCoord.y) % 8;
  float threshold = bayerMatrix8x8[y * 8 + x];

  color.rgb = clamp(color.rgb + threshold * 0.125, 0.0, 1.0);

  return color;
}

vec3 getSceneColor(vec2 uv)
{
    return texture(u_mesh_texture, uv).rgb;
}

void main()
{
    // space between values of the dest palette
    vec3 quantizationPeriod = vec3(1./(colorNum-1.));

    // Apply dithering at true pixel resolution
    vec3 color = dither(gl_FragCoord.xy, texture(u_mesh_texture, vUv).rgb);

    // Quantise colour
    fragColor = vec4(
        quantize(color.r, quantizationPeriod.r),
        quantize(color.g, quantizationPeriod.g),
        quantize(color.b, quantizationPeriod.b),
        1.0
    );
}