import { mat4, vec3 } from 'wgpu-matrix';
import { GUI } from 'dat.gui';
import { loadObj } from '../meshes/loadObj';
import type { ObjMaterialGroup } from '../meshes/loadObj';
import { createWhiteTexture, loadTextureFromUrl } from '../meshes/loadTexture';
import {
  normalOffset,
  positionOffset,
  uvOffset,
  vertexSize,
} from '../meshes/vertexLayout';
import cubeWGSL from './cube.wgsl?raw';
import { createDebugCameraController } from './debugCamera';
import { createDebugLightingController } from './debugLighting';
import {
  LIGHTING_UNIFORM_SIZE,
  packLightingUniform,
} from './lighting';
import { serializedToOrientation } from './cameraOrientation';
import { HARDCODED_SCENE_CONFIG } from '../../cameraOrientations';
import { DEFAULT_MENU_LAYOUT, SCENE_CLEAR_COLOR } from '../../cameraConstants';
import { publicAssetUrl } from '../../publicAssetUrl';
import { quitIfWebGPUNotAvailableOrMissingFeatures } from '../util';

const DEFAULT_MODEL_URL = publicAssetUrl('assets/models/roomyff.obj');
const GROUP_UNIFORM_SIZE = 160;
const FAN_ROTATION_SPEED = 1.5;
const ALPHA_CUTOFF = 0.5;
const LAMP_EMISSION_STRENGTH = 3.0;
const LAMP_HOUSING_EMISSION_STRENGTH = 0.35;

function isLampMaterial(materialName: string): boolean {
  return materialName.toLowerCase().includes('lamp');
}

function lampEmissionStrength(materialName: string): number {
  const name = materialName.toLowerCase();
  if (name.includes('light')) {
    return LAMP_EMISSION_STRENGTH;
  }
  return LAMP_HOUSING_EMISSION_STRENGTH;
}

export interface CamerasOptions {
  modelUrl?: string;
  onActiveSlotChange?: (slotIndex: number) => void;
  onOrbitActiveChange?: (active: boolean) => void;
  onMenuLayoutChange?: (layout: {
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  }) => void;
}

export async function initCameras(
  canvas: HTMLCanvasElement,
  options: CamerasOptions = {},
): Promise<() => void> {
  const modelUrl = options.modelUrl ?? DEFAULT_MODEL_URL;
  const mesh = await loadObj(modelUrl);

  const gui = new GUI();
  const initialOrientations = HARDCODED_SCENE_CONFIG.orientations.map(
    serializedToOrientation,
  );
  const initialMenuLayout = HARDCODED_SCENE_CONFIG.menu ?? DEFAULT_MENU_LAYOUT;
  const debugLighting = createDebugLightingController(
    gui,
    HARDCODED_SCENE_CONFIG.lights,
  );

  const debugCamera = createDebugCameraController(gui, {
    canvas,
    onActiveSlotChange: options.onActiveSlotChange,
    onOrbitActiveChange: options.onOrbitActiveChange,
    onMenuLayoutChange: options.onMenuLayoutChange,
    initialOrientations,
    initialMenuLayout,
    initialOrbit:
      HARDCODED_SCENE_CONFIG.orbit ?? HARDCODED_SCENE_CONFIG.orbitPivot,
    getLightingSettings: () => debugLighting.getSettings(),
  });

  const adapter =
    (await navigator.gpu?.requestAdapter({
      featureLevel: 'compatibility',
    })) ?? null;
  const device = (await adapter?.requestDevice()) ?? null;
  quitIfWebGPUNotAvailableOrMissingFeatures(adapter, device);
  const gpu = device;

  const context = canvas.getContext('webgpu') as GPUCanvasContext;

  const devicePixelRatio = window.devicePixelRatio;
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device: gpu,
    format: presentationFormat,
  });

  const pipeline = gpu.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: gpu.createShaderModule({
        code: cubeWGSL,
      }),
      buffers: [
        {
          arrayStride: vertexSize,
          attributes: [
            {
              shaderLocation: 0,
              offset: positionOffset,
              format: 'float32x4',
            },
            {
              shaderLocation: 1,
              offset: normalOffset,
              format: 'float32x4',
            },
            {
              shaderLocation: 2,
              offset: uvOffset,
              format: 'float32x2',
            },
          ],
        },
      ],
    },
    fragment: {
      module: gpu.createShaderModule({
        code: cubeWGSL,
      }),
      targets: [
        {
          format: presentationFormat,
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
          },
        },
      ],
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'back',
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus',
    },
  });

  let depthTexture = gpu.createTexture({
    size: [canvas.width, canvas.height],
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const sampler = gpu.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });

  interface DrawGroup {
    vertexCount: number;
    verticesBuffer: GPUBuffer;
    uniformBuffer: GPUBuffer;
    bindGroup: GPUBindGroup;
    texture: GPUTexture;
    baseColor: [number, number, number, number];
    useTexture: boolean;
    alphaCutoff: number;
    isEmissive: boolean;
    emissionStrength: number;
    rotateAroundY: boolean;
  }

  const textureCache = new Map<string, GPUTexture>();
  const ownedTextures = new Set<GPUTexture>();
  const drawGroups: DrawGroup[] = [];

  async function getTexture(url: string | null): Promise<GPUTexture> {
    if (!url) {
      const texture = createWhiteTexture(gpu);
      ownedTextures.add(texture);
      return texture;
    }

    const cached = textureCache.get(url);
    if (cached) return cached;

    try {
      const texture = await loadTextureFromUrl(gpu, url);
      textureCache.set(url, texture);
      ownedTextures.add(texture);
      return texture;
    } catch (error) {
      console.warn(`Failed to load texture: ${url}`, error);
      const fallback = createWhiteTexture(gpu);
      ownedTextures.add(fallback);
      return fallback;
    }
  }

  function materialSettings(group: ObjMaterialGroup) {
    const useTexture = group.diffuseTextureUrl !== null;
    const alphaCutoff = useTexture ? ALPHA_CUTOFF : 0;
    const isEmissive = isLampMaterial(group.materialName);
    return {
      baseColor: [
        group.diffuseColor[0],
        group.diffuseColor[1],
        group.diffuseColor[2],
        group.alpha,
      ] as [number, number, number, number],
      useTexture,
      alphaCutoff,
      isEmissive,
      emissionStrength: isEmissive
        ? lampEmissionStrength(group.materialName)
        : 0,
    };
  }

  for (const group of mesh.groups) {
    const verticesBuffer = gpu.createBuffer({
      size: group.vertexArray.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(verticesBuffer.getMappedRange()).set(group.vertexArray);
    verticesBuffer.unmap();

    const texture = await getTexture(group.diffuseTextureUrl);
    const uniformBuffer = gpu.createBuffer({
      size: GROUP_UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const {
      baseColor,
      useTexture,
      alphaCutoff,
      isEmissive,
      emissionStrength,
    } = materialSettings(group);
    const bindGroup = gpu.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: sampler },
        { binding: 2, resource: texture.createView() },
      ],
    });

    drawGroups.push({
      vertexCount: group.vertexCount,
      verticesBuffer,
      uniformBuffer,
      bindGroup,
      texture,
      baseColor,
      useTexture,
      alphaCutoff,
      isEmissive,
      emissionStrength,
      rotateAroundY: group.rotateAroundY,
    });
  }

  const colorAttachment = {
    view: undefined as unknown as GPUTextureView,
    clearValue: [...SCENE_CLEAR_COLOR] as GPUColor,
    loadOp: 'clear' as const,
    storeOp: 'store' as const,
  };

  const renderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [colorAttachment],
    depthStencilAttachment: {
      view: depthTexture.createView(),
      depthClearValue: 1.0,
      depthLoadOp: 'clear',
      depthStoreOp: 'store',
    },
  };

  const projectionMatrix = mat4.create();
  const viewModelMatrix = mat4.create();
  const modelMatrix = mat4.create();
  const modelViewProjectionMatrix = mat4.create();
  const lightingUniformBuffer = gpu.createBuffer({
    size: LIGHTING_UNIFORM_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const lightingBindGroup = gpu.createBindGroup({
    layout: pipeline.getBindGroupLayout(1),
    entries: [
      { binding: 0, resource: { buffer: lightingUniformBuffer } },
    ],
  });

  const groupUniformData = new Float32Array(GROUP_UNIFORM_SIZE / 4);
  const fanPivot = mesh.fanPivot;
  let fanAngle = 0;

  function writeGroupUniform(
    drawGroup: DrawGroup,
    mvp: Float32Array,
    model: Float32Array,
  ) {
    groupUniformData.set(mvp, 0);
    groupUniformData.set(model, 16);
    groupUniformData.set(drawGroup.baseColor, 32);
    groupUniformData[36] = drawGroup.useTexture ? 1 : 0;
    groupUniformData[37] = drawGroup.alphaCutoff;
    groupUniformData[38] = drawGroup.isEmissive ? 1 : 0;
    groupUniformData[39] = drawGroup.emissionStrength;
    gpu.queue.writeBuffer(drawGroup.uniformBuffer, 0, groupUniformData);
  }

  function updateProjection() {
    const aspect = canvas.width / canvas.height;
    mat4.perspective(
      debugCamera.getFovRadians(),
      aspect,
      0.01,
      100.0,
      projectionMatrix,
    );
  }

  function resizeCanvas() {
    const devicePixelRatio = window.devicePixelRatio;
    canvas.width = Math.max(1, Math.floor(canvas.clientWidth * devicePixelRatio));
    canvas.height = Math.max(1, Math.floor(canvas.clientHeight * devicePixelRatio));

    depthTexture.destroy();
    depthTexture = gpu.createTexture({
      size: [canvas.width, canvas.height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    renderPassDescriptor.depthStencilAttachment!.view = depthTexture.createView();
    updateProjection();
  }

  resizeCanvas();
  const resizeObserver = new ResizeObserver(() => resizeCanvas());
  resizeObserver.observe(canvas);

  let lastFrameMS = Date.now();
  let animationFrameId = 0;
  let running = true;

  function frame() {
    if (!running) return;

    const now = Date.now();
    const deltaTime = (now - lastFrameMS) / 1000;
    lastFrameMS = now;

    if (fanPivot) {
      fanAngle += deltaTime * FAN_ROTATION_SPEED;
    }

    const viewMatrix = debugCamera.update(deltaTime);
    updateProjection();

    const lightingData = packLightingUniform(debugLighting.getSettings());
    gpu.queue.writeBuffer(lightingUniformBuffer, 0, lightingData);

    for (const drawGroup of drawGroups) {
      if (drawGroup.rotateAroundY && fanPivot) {
        const pivot = vec3.create(fanPivot[0], fanPivot[1], fanPivot[2]);
        const negPivot = vec3.create(-fanPivot[0], -fanPivot[1], -fanPivot[2]);
        const toPivot = mat4.translation(pivot);
        const rotation = mat4.rotationY(fanAngle);
        const fromPivot = mat4.translation(negPivot);
        const rotated = mat4.multiply(toPivot, rotation);
        mat4.multiply(rotated, fromPivot, modelMatrix);
      } else {
        mat4.identity(modelMatrix);
      }

      mat4.multiply(viewMatrix, modelMatrix, viewModelMatrix);
      mat4.multiply(projectionMatrix, viewModelMatrix, modelViewProjectionMatrix);
      writeGroupUniform(drawGroup, modelViewProjectionMatrix, modelMatrix);
    }

    colorAttachment.view = context.getCurrentTexture().createView();

    const commandEncoder = gpu.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(1, lightingBindGroup);
    for (const drawGroup of drawGroups) {
      passEncoder.setBindGroup(0, drawGroup.bindGroup);
      passEncoder.setVertexBuffer(0, drawGroup.verticesBuffer);
      passEncoder.draw(drawGroup.vertexCount);
    }
    passEncoder.end();
    gpu.queue.submit([commandEncoder.finish()]);

    animationFrameId = requestAnimationFrame(frame);
  }

  animationFrameId = requestAnimationFrame(frame);

  return () => {
    running = false;
    resizeObserver.disconnect();
    cancelAnimationFrame(animationFrameId);
    debugCamera.dispose();
    debugLighting.dispose();
    gui.destroy();
    lightingUniformBuffer.destroy();
    depthTexture.destroy();
    for (const drawGroup of drawGroups) {
      drawGroup.verticesBuffer.destroy();
      drawGroup.uniformBuffer.destroy();
    }
    for (const texture of ownedTextures) {
      texture.destroy();
    }
    gpu.destroy();
  };
}
