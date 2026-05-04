import * as THREE from 'three';
import { GLTF } from 'three-stdlib';
import { ZipWriter, BlobWriter, BlobReader } from '@zip.js/zip.js';

export interface ExtractedTextures {
  albedo?: Blob;
  normal?: Blob;
  roughness?: Blob;
  metallic?: Blob;
  ao?: Blob;
}

export interface TextureExtractionResult {
  hasTextures: boolean;
  extractedTextures: ExtractedTextures;
  textureInfo: {
    albedo: boolean;
    normal: boolean;
    roughness: boolean;
    metallic: boolean;
    ao: boolean;
  };
}

/**
 * Extract a THREE.js texture to a Blob in optimized format
 * Uses performance optimizations for large textures
 */
async function textureToBlob(
  texture: THREE.Texture,
  textureName: string,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      // Create a canvas to render the texture
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error(`[${textureName}] Could not get canvas context`));
        return;
      }

      // Determine canvas size - handle various image sources
      let width = 512;
      let height = 512;

      if (texture.image) {
        if (texture.image.width && texture.image.height) {
          width = texture.image.width;
          height = texture.image.height;
        } else if (texture.image.naturalWidth && texture.image.naturalHeight) {
          width = texture.image.naturalWidth;
          height = texture.image.naturalHeight;
        }
      }

      // Performance optimization: Limit maximum texture size to prevent slowdowns
      const MAX_TEXTURE_SIZE = 2048;
      if (width > MAX_TEXTURE_SIZE || height > MAX_TEXTURE_SIZE) {
        const scale = Math.min(
          MAX_TEXTURE_SIZE / width,
          MAX_TEXTURE_SIZE / height,
        );
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);
      }

      canvas.width = width;
      canvas.height = height;

      // Determine optimal format and quality based on texture type
      const isAlbedo = textureName.toLowerCase().includes('albedo');
      const format = isAlbedo ? 'image/jpeg' : 'image/png'; // JPEG for color maps, PNG for others
      const quality = isAlbedo ? 0.85 : 0.8; // Good quality but faster than 1.0

      // Method 1: Try direct image drawing (most common case)
      if (texture.image instanceof HTMLImageElement) {
        if (texture.image.complete && texture.image.naturalWidth > 0) {
          ctx.drawImage(texture.image, 0, 0, width, height);

          // Convert canvas to blob with optimized settings
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(
                  new Error(
                    `[${textureName}] Failed to convert canvas to blob`,
                  ),
                );
              }
            },
            format,
            quality,
          );
          return;
        } else {
          texture.image.onload = () => {
            ctx.drawImage(texture.image, 0, 0, width, height);
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  resolve(blob);
                } else {
                  reject(
                    new Error(
                      `[${textureName}] Failed to convert canvas to blob after image load`,
                    ),
                  );
                }
              },
              format,
              quality,
            );
          };
          texture.image.onerror = () => {
            reject(new Error(`[${textureName}] Image failed to load`));
          };
          return;
        }
      }

      // Method 2: Canvas source
      if (texture.image instanceof HTMLCanvasElement) {
        ctx.drawImage(texture.image, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(
                new Error(`[${textureName}] Failed to convert canvas to blob`),
              );
            }
          },
          format,
          quality,
        );
        return;
      }

      // Method 3: ImageData source
      if (texture.image instanceof ImageData) {
        ctx.putImageData(texture.image, 0, 0);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(
                new Error(`[${textureName}] Failed to convert canvas to blob`),
              );
            }
          },
          format,
          quality,
        );
        return;
      }

      // Method 4: WebGL rendering fallback (for complex texture sources)

      try {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;

        const renderer = new THREE.WebGLRenderer({
          canvas: tempCanvas,
          preserveDrawingBuffer: true,
          alpha: true,
          antialias: false,
          powerPreference: 'high-performance', // Optimize for speed
        });

        renderer.setSize(width, height);

        // Create a simple quad to render the texture
        const geometry = new THREE.PlaneGeometry(2, 2);
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geometry, material);

        const scene = new THREE.Scene();
        scene.add(mesh);

        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;

        try {
          // Render the texture
          renderer.render(scene, camera);

          // Copy from WebGL canvas to our output canvas
          ctx.drawImage(tempCanvas, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(
                  new Error(
                    `[${textureName}] Failed to convert WebGL canvas to blob`,
                  ),
                );
              }
            },
            format,
            quality,
          );
        } finally {
          // Clean up WebGL resources in finally block to ensure disposal even if errors occur
          renderer.dispose();
          geometry.dispose();
          material.dispose();
        }
      } catch (webglError) {
        console.error(
          `[TextureExtraction] ${textureName} WebGL fallback failed:`,
          webglError,
        );
        const errorMessage =
          webglError instanceof Error ? webglError.message : String(webglError);
        reject(
          new Error(`[${textureName}] WebGL fallback failed: ${errorMessage}`),
        );
      }
    } catch (error) {
      console.error(
        `[TextureExtraction] ${textureName} unexpected error:`,
        error,
      );
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      reject(new Error(`[${textureName}] Unexpected error: ${errorMessage}`));
    }
  });
}

/**
 * Extract PBR textures from a GLTF model
 * Optimized for performance with size limits and early detection
 */
export async function extractPBRTextures(
  gltf: GLTF,
): Promise<TextureExtractionResult> {
  const extractedTextures: { [key: string]: THREE.Texture } = {};
  const textureInfo = {
    albedo: false,
    normal: false,
    roughness: false,
    metallic: false,
    ao: false,
  };

  try {
    let _materialCount = 0;
    let textureCount = 0;
    const MAX_INDIVIDUAL_TEXTURE_SIZE = 4096; // Skip textures larger than 4K

    // Traverse the scene to find materials with PBR textures
    gltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];

        materials.forEach((material, _materialIndex) => {
          _materialCount++;

          // Helper function to check texture size and add if reasonable
          const addTextureIfReasonableSize = (
            texture: THREE.Texture,
            key: string,
          ) => {
            if (!extractedTextures[key]) {
              // Check texture size to avoid processing extremely large textures
              const image = texture.image;
              if (
                image &&
                (image.width > MAX_INDIVIDUAL_TEXTURE_SIZE ||
                  image.height > MAX_INDIVIDUAL_TEXTURE_SIZE)
              ) {
                console.warn(
                  `[TextureExtraction] Skipping ${key} texture due to large size: ${image.width}x${image.height}`,
                );
                return false;
              }

              extractedTextures[key] = texture;
              textureInfo[key as keyof typeof textureInfo] = true;
              textureCount++;
              return true;
            }
            return false;
          };

          // Check for each PBR texture type with size validation
          if ('map' in material && material.map) {
            addTextureIfReasonableSize(material.map, 'albedo');
          }

          if ('normalMap' in material && material.normalMap) {
            addTextureIfReasonableSize(material.normalMap, 'normal');
          }

          if ('roughnessMap' in material && material.roughnessMap) {
            addTextureIfReasonableSize(material.roughnessMap, 'roughness');
          }

          if ('metalnessMap' in material && material.metalnessMap) {
            addTextureIfReasonableSize(material.metalnessMap, 'metallic');
          }

          if ('aoMap' in material && material.aoMap) {
            addTextureIfReasonableSize(material.aoMap, 'ao');
          }
        });
      }
    });

    if (textureCount === 0) {
      return {
        hasTextures: false,
        extractedTextures: {},
        textureInfo,
      };
    }

    // Convert textures to blobs with parallel processing
    const convertedTextures: ExtractedTextures = {};
    const conversionPromises: Promise<void>[] = [];

    // Process each texture type
    const textureTypes = [
      { key: 'albedo', name: 'Albedo' },
      { key: 'normal', name: 'Normal' },
      { key: 'roughness', name: 'Roughness' },
      { key: 'metallic', name: 'Metallic' },
      { key: 'ao', name: 'AO' },
    ] as const;

    for (const { key, name } of textureTypes) {
      if (extractedTextures[key]) {
        conversionPromises.push(
          textureToBlob(extractedTextures[key], name)
            .then((blob) => {
              convertedTextures[key] = blob;
            })
            .catch((error) => {
              console.error(
                `[TextureExtraction] Failed to convert ${name} texture:`,
                error,
              );
              // Don't reject the entire operation for one failed texture
              // Just log the error and continue
            }),
        );
      }
    }

    // Wait for all conversions to complete in parallel
    await Promise.all(conversionPromises);

    const hasAnyConvertedTextures = Object.keys(convertedTextures).length > 0;

    if (!hasAnyConvertedTextures) {
      throw new Error('Failed to convert any textures to blobs');
    }

    return {
      hasTextures: true,
      extractedTextures: convertedTextures,
      textureInfo,
    };
  } catch (error) {
    console.error('[TextureExtraction] Error extracting PBR textures:', error);
    return {
      hasTextures: false,
      extractedTextures: {},
      textureInfo,
    };
  }
}

/**
 * Create a ZIP file containing the model and extracted textures
 * Optimized for performance with faster compression settings
 */
export async function createModelWithTexturesZip(
  modelBlob: Blob,
  extractedTextures: ExtractedTextures,
  filename: string,
  modelFileExtension: string = 'glb',
): Promise<Blob> {
  const blobWriter = new BlobWriter();
  const zipWriter = new ZipWriter(blobWriter, {
    level: 6, // Balanced compression (0=none, 9=max) - 6 is good speed/size trade-off
    bufferedWrite: true, // Enable buffering for better performance
  });

  // Add the main model file
  await zipWriter.add(
    `${filename}.${modelFileExtension}`,
    new BlobReader(modelBlob),
  );

  // Add individual texture files with appropriate extensions
  if (extractedTextures.albedo) {
    await zipWriter.add(
      `${filename}_albedo.jpg`,
      new BlobReader(extractedTextures.albedo),
    );
  }
  if (extractedTextures.normal) {
    await zipWriter.add(
      `${filename}_normal.png`,
      new BlobReader(extractedTextures.normal),
    );
  }
  if (extractedTextures.roughness) {
    await zipWriter.add(
      `${filename}_roughness.png`,
      new BlobReader(extractedTextures.roughness),
    );
  }
  if (extractedTextures.metallic) {
    await zipWriter.add(
      `${filename}_metallic.png`,
      new BlobReader(extractedTextures.metallic),
    );
  }
  if (extractedTextures.ao) {
    await zipWriter.add(
      `${filename}_ao.png`,
      new BlobReader(extractedTextures.ao),
    );
  }

  // Close the zip writer and get the blob
  await zipWriter.close();
  return blobWriter.getData();
}

/**
 * Download a ZIP file containing model + textures
 */
export function downloadModelWithTextures(
  zipBlob: Blob,
  filename: string,
): void {
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_with_textures.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Convenience function to extract textures and create download
 */
export async function extractAndDownloadTextures(
  gltf: GLTF,
  modelBlob: Blob,
  filename: string,
  modelFileExtension?: string,
): Promise<boolean> {
  try {
    const result = await extractPBRTextures(gltf);

    if (!result.hasTextures) {
      return false;
    }

    const zipBlob = await createModelWithTexturesZip(
      modelBlob,
      result.extractedTextures,
      filename,
      modelFileExtension,
    );

    downloadModelWithTextures(zipBlob, filename);
    return true;
  } catch (error) {
    console.error('Failed to extract and download textures:', error);
    return false;
  }
}
