out vec4 outColor;


void main() {
    float dist = distance(gl_PointCoord.st, vec2(0.5, 0.5)) * 2.0;
    dist = clamp(dist, 0.0, 1.0);
    if(dist < 0.5) {
        dist = 0.0;
    }
    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
    outColor = vec4(0.0, 0.651, 1.0, alpha);
}