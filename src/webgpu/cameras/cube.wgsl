struct GroupUniforms {
  modelViewProjectionMatrix : mat4x4f,
  modelMatrix : mat4x4f,
  baseColor : vec4f,
  materialParams : vec4f,
}

struct Spotlight {
  posEnabled : vec4f,
  dirIntensity : vec4f,
  colorOuter : vec4f,
  rangeInner : vec4f,
}

struct LightingUniforms {
  ambient : vec4f,
  directional : vec4f,
  directionalColor : vec4f,
  spotlightMeta : vec4f,
  spotlights : array<Spotlight, 4>,
}

@group(0) @binding(0) var<uniform> uniforms : GroupUniforms;
@group(0) @binding(1) var mySampler: sampler;
@group(0) @binding(2) var myTexture: texture_2d<f32>;
@group(1) @binding(0) var<uniform> lighting : LightingUniforms;

struct VertexOutput {
  @builtin(position) Position : vec4f,
  @location(0) fragUV : vec2f,
  @location(1) worldPos : vec3f,
  @location(2) worldNormal : vec3f,
}

@vertex
fn vertex_main(
  @location(0) position : vec4f,
  @location(1) normal : vec4f,
  @location(2) uv : vec2f
) -> VertexOutput {
  let worldPos = (uniforms.modelMatrix * position).xyz;
  let worldNormal = normalize((uniforms.modelMatrix * vec4f(normal.xyz, 0.0)).xyz);
  return VertexOutput(
    uniforms.modelViewProjectionMatrix * position,
    uv,
    worldPos,
    worldNormal,
  );
}

fn spotlightFactor(worldPos: vec3f, spot: Spotlight) -> f32 {
  if (spot.posEnabled.w < 0.5) {
    return 0.0;
  }

  let toFragment = worldPos - spot.posEnabled.xyz;
  let dist = length(toFragment);
  let range = spot.rangeInner.x;
  if (dist > range || dist < 0.0001) {
    return 0.0;
  }

  let lightDir = normalize(toFragment);
  let cosAngle = dot(normalize(spot.dirIntensity.xyz), lightDir);
  let outerCos = spot.colorOuter.w;
  if (cosAngle < outerCos) {
    return 0.0;
  }

  var cone = 1.0;
  let innerCos = spot.rangeInner.y;
  if (cosAngle < innerCos) {
    cone = (cosAngle - outerCos) / max(innerCos - outerCos, 0.0001);
  }

  let attenuation = (1.0 - dist / range) * (1.0 - dist / range);
  return cone * attenuation;
}

fn applyLighting(worldPos: vec3f, worldNormal: vec3f, albedo: vec3f) -> vec3f {
  let N = normalize(worldNormal);
  var lit = lighting.ambient.xyz * lighting.ambient.w * albedo;

  if (lighting.directional.w > 0.5) {
    let L = normalize(-lighting.directional.xyz);
    let diff = max(dot(N, L), 0.0);
    lit += lighting.directionalColor.xyz
      * lighting.directionalColor.w
      * diff
      * albedo;
  }

  let count = i32(clamp(lighting.spotlightMeta.x, 0.0, 4.0));
  for (var i = 0; i < count; i++) {
    let spot = lighting.spotlights[i];
    let factor = spotlightFactor(worldPos, spot);
    if (factor > 0.0) {
      let L = normalize(spot.posEnabled.xyz - worldPos);
      let diff = max(dot(N, L), 0.0);
      lit += spot.colorOuter.xyz
        * spot.dirIntensity.w
        * diff
        * albedo
        * factor;
    }
  }

  return lit;
}

@fragment
fn fragment_main(
  @location(0) fragUV: vec2f,
  @location(1) worldPos: vec3f,
  @location(2) worldNormal: vec3f,
) -> @location(0) vec4f {
  var color = uniforms.baseColor;

  if (uniforms.materialParams.x > 0.5) {
    let sampled = textureSample(myTexture, mySampler, fragUV);
    color = vec4f(sampled.rgb * uniforms.baseColor.rgb, sampled.a * uniforms.baseColor.a);
  }

  if (uniforms.materialParams.y > 0.0 && color.a < uniforms.materialParams.y) {
    discard;
  }

  var litRgb = applyLighting(worldPos, worldNormal, color.rgb);

  if (uniforms.materialParams.z > 0.5) {
    litRgb = color.rgb * uniforms.materialParams.w;
  }

  return vec4f(litRgb, color.a);
}
