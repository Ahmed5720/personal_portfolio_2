/** Shows an error dialog if getting an adapter wasn't successful. */
export function quitIfAdapterNotAvailable(
  adapter: GPUAdapter | null
): asserts adapter {
  if (!('gpu' in navigator)) {
    fail('navigator.gpu is not defined - WebGPU not available in this browser');
  }

  if (!adapter) {
    fail("requestAdapter returned null - this sample can't run on this system");
  }
}

function supportsDirectBufferBinding(device: GPUDevice): boolean {
  const buffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM,
  });
  const layout = device.createBindGroupLayout({
    entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: {} }],
  });

  try {
    device.createBindGroup({
      layout,
      entries: [{ binding: 0, resource: buffer }],
    });
    return true;
  } catch {
    return false;
  } finally {
    buffer.destroy();
  }
}

function supportsDirectTextureBinding(device: GPUDevice): boolean {
  const texture = device.createTexture({
    size: [1],
    usage: GPUTextureUsage.TEXTURE_BINDING,
    format: 'rgba8unorm',
  });
  const layout = device.createBindGroupLayout({
    entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} }],
  });

  try {
    device.createBindGroup({
      layout,
      entries: [{ binding: 0, resource: texture }],
    });
    return true;
  } catch {
    return false;
  } finally {
    texture.destroy();
  }
}

function supportsDirectTextureAttachments(device: GPUDevice): boolean {
  const texture = device.createTexture({
    size: [1],
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
    format: 'rgba8unorm',
    sampleCount: 4,
  });
  const resolveTarget = device.createTexture({
    size: [1],
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
    format: 'rgba8unorm',
  });
  const depthTexture = device.createTexture({
    size: [1],
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
    format: 'depth16unorm',
    sampleCount: 4,
  });
  const encoder = device.createCommandEncoder();
  try {
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        { view: texture, resolveTarget, loadOp: 'load', storeOp: 'store' },
      ],
      depthStencilAttachment: {
        view: depthTexture,
        depthLoadOp: 'load',
        depthStoreOp: 'store',
      },
    });
    pass.end();
    return true;
  } catch {
    return false;
  } finally {
    encoder.finish();
    texture.destroy();
    resolveTarget.destroy();
  }
}

/**
 * Shows an error dialog if getting an adapter or device wasn't successful,
 * or if core WebGPU binding features are unavailable.
 */
export function quitIfWebGPUNotAvailableOrMissingFeatures(
  adapter: GPUAdapter | null,
  device: GPUDevice | null
): asserts device is GPUDevice {
  if (!device) {
    quitIfAdapterNotAvailable(adapter);
    fail('Unable to get a device for an unknown reason');
    return;
  }

  if (
    !supportsDirectBufferBinding(device) ||
    !supportsDirectTextureBinding(device) ||
    !supportsDirectTextureAttachments(device)
  ) {
    fail(
      'Core features of WebGPU are unavailable. Please update your browser to a newer version.'
    );
  }
}

/** Fail by showing a console error, and dialog box if possible. */
const fail = (() => {
  type ErrorOutput = { show(msg: string): void };

  function createErrorOutput() {
    if (typeof document === 'undefined') {
      return {
        show(msg: string) {
          console.error(msg);
        },
      };
    }

    const dialogBox = document.createElement('dialog');
    dialogBox.close();
    document.body.append(dialogBox);

    const dialogText = document.createElement('pre');
    dialogText.style.whiteSpace = 'pre-wrap';
    dialogBox.append(dialogText);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'OK';
    closeBtn.onclick = () => dialogBox.close();
    dialogBox.append(closeBtn);

    return {
      show(msg: string) {
        if (!dialogBox.open) {
          dialogText.textContent = msg;
          dialogBox.showModal();
        }
      },
    };
  }

  let output: ErrorOutput | undefined;

  return (message: string) => {
    if (!output) output = createErrorOutput();

    output.show(message);
    throw new Error(message);
  };
})();
