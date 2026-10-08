#!/usr/bin/env python3
"""Generate a local research preview with Apple's SHARP, outside the web runtime.

Requires the separate https://github.com/apple/ml-sharp checkout and checkpoint.
The SPZ v2 exporter follows https://github.com/nianticlabs/spz (RUB coordinates).
No model weights or Python dependencies are shipped to website visitors.
"""

import argparse
import gc
import gzip
import hashlib
import json
import math
import struct
import sys
import time
from pathlib import Path
from unittest.mock import patch


def export_spz(positions, scales, rotations, colors, opacities, output):
    import numpy as np

    # SHARP uses OpenCV RDF; SPZ uses Three.js RUB. Rotate the entire scene 180° about X.
    positions = positions * np.array([1, -1, -1], dtype=np.float32)
    w, x, y, z = rotations.T
    rotations = np.stack([w, -z, y, -x], axis=1)  # xyzw after rotation
    rotations /= np.linalg.norm(rotations, axis=1, keepdims=True)
    rotations *= np.where(rotations[:, 3:4] < 0, -1, 1)
    fixed = np.round(positions * 4096).astype(np.int32)
    if np.any(fixed < -(1 << 23)) or np.any(fixed >= (1 << 23)):
        raise ValueError('Scene is outside the SPZ v2 coordinate range')
    packed_positions = np.stack([fixed & 255, (fixed >> 8) & 255, (fixed >> 16) & 255], axis=-1).astype(np.uint8)
    byte = lambda values: np.clip(np.floor(values + 0.5), 0, 255).astype(np.uint8).tobytes()
    sh0 = (colors - 0.5) / 0.28209479177387814
    payload = b''.join([
        struct.pack('<IIIBBBB', 0x5053474E, 2, len(positions), 0, 12, 0, 0),
        packed_positions.tobytes(),
        byte(opacities * 255),
        byte(sh0 * (0.15 * 255) + 127.5),
        byte((np.log(np.maximum(scales, 1e-12)) + 10) * 16),
        byte(rotations[:, :3] * 127.5 + 127.5),
    ])
    compressed = gzip.compress(payload, compresslevel=9, mtime=0)
    filename = f'cover-{hashlib.sha256(compressed).hexdigest()[:12]}.spz'
    (output / filename).write_bytes(compressed)
    return filename, len(compressed)


def mobile_gaussians(arrays, focal, width, height):
    """Merge nearby learned Gaussians, preserving their 3D covariance and color mass."""
    import numpy as np
    from scipy.spatial.transform import Rotation

    positions = arrays['positions'].astype(np.float64)
    rotations = Rotation.from_quat(arrays['rotations'][:, [1, 2, 3, 0]]).as_matrix()
    covariances = (rotations * arrays['scales'][:, None, :] ** 2) @ rotations.transpose(0, 2, 1)
    def projected_area(means, covariance):
        jacobian = np.zeros((len(means), 2, 3))
        jacobian[:, 0, 0] = jacobian[:, 1, 1] = 1 / means[:, 2]
        jacobian[:, :, 2] = -means[:, :2] / means[:, 2:3] ** 2
        projected = jacobian @ covariance @ jacobian.transpose(0, 2, 1)
        return np.sqrt(np.maximum(np.linalg.det(projected), 1e-24))
    columns = 320
    rows = round(columns * height / width)
    uv = positions[:, :2] / positions[:, 2:3] * focal / [width, height] + 0.5
    # Depth bins prevent joining the subject with a more distant background.
    keys = np.column_stack([np.floor(uv * [columns, rows]), np.floor(np.log(positions[:, 2]) / 0.04)]).astype(np.int64)
    _, groups = np.unique(keys, axis=0, return_inverse=True)
    weights = arrays['opacities'] * projected_area(positions, covariances)
    mass = np.bincount(groups, weights=weights)
    def average(values):
        return np.column_stack([np.bincount(groups, weights=weights * column) / mass for column in values.T])
    centers = average(positions)
    moments = covariances + positions[:, :, None] * positions[:, None, :]
    covariance = average(moments.reshape(-1, 9)).reshape(-1, 3, 3) - centers[:, :, None] * centers[:, None, :]
    eigenvalues, axes = np.linalg.eigh(covariance)
    eigenvalues = np.maximum(eigenvalues, 1e-12)
    axes[np.linalg.det(axes) < 0, :, -1] *= -1
    quaternions = Rotation.from_matrix(axes).as_quat()[:, [3, 0, 1, 2]]
    return {
        'positions': centers.astype(np.float32),
        'scales': np.sqrt(eigenvalues).astype(np.float32),
        'rotations': quaternions.astype(np.float32),
        'colors': average(arrays['colors']).astype(np.float32),
        'opacities': np.clip(mass / projected_area(centers, covariance), 0, 0.999).astype(np.float32),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--checkpoint', type=Path, required=True)
    parser.add_argument('--sharp-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--device', choices=['cpu', 'mps', 'cuda'], default='cpu')
    parser.add_argument('--debug-output', type=Path)
    args = parser.parse_args()
    sys.path.insert(0, str(args.sharp_root / 'src'))
    import numpy as np
    import torch
    import torch.nn.functional as functional
    from sharp.models import PredictorParams, create_predictor
    from sharp.utils import io
    from sharp.utils.color_space import linearRGB2sRGB
    from sharp.utils.gaussians import Gaussians3D, unproject_gaussians

    started = time.monotonic()
    def report(message):
        print(f'[{time.monotonic() - started:.1f}s] {message}', flush=True)

    torch.set_num_threads(6)
    report('Loading SHARP checkpoint')
    weights = torch.load(str(args.checkpoint), map_location='cpu', weights_only=True, mmap=True)
    # timm's stochastic-depth schedule needs actual CPU scalars during meta initialization.
    linspace = torch.linspace
    with patch('torch.linspace', lambda *a, **kw: linspace(*a, **{**kw, 'device': 'cpu'})), torch.device('meta'):
        predictor = create_predictor(PredictorParams())
    predictor.load_state_dict(weights, assign=True)
    del weights
    gc.collect()
    predictor.eval()
    dtype = torch.float16 if args.device == 'mps' else torch.float32
    predictor.to(device=args.device, dtype=dtype)
    if args.device == 'mps':
        # Process independent image patches in small batches to fit a 4 GB AMD GPU.
        encoder = predictor.monodepth_model.monodepth_predictor.encoder.patch_encoder
        encode = encoder.forward
        def encode_patches(patches):
            results = []
            for start in range(0, len(patches), 4):
                results.append(encode(patches[start:start + 4]))
                report(f'Encoded patches {min(start + 4, len(patches))}/{len(patches)}')
            features = torch.cat([result[0] for result in results])
            intermediate = {key: torch.cat([result[1][key] for result in results]) for key in results[0][1]}
            return features, intermediate
        encoder.forward = encode_patches
    image, _, focal = io.load_rgb(args.input)
    height, width = image.shape[:2]
    pixels = torch.from_numpy(image.copy()).to(device=args.device, dtype=dtype).permute(2, 0, 1) / 255
    pixels = functional.interpolate(pixels[None], size=(1536, 1536), mode='bilinear', align_corners=True)
    disparity = torch.tensor([focal / width], device=args.device, dtype=dtype)
    for name in ['monodepth_model', 'feature_model', 'prediction_head', 'gaussian_composer']:
        getattr(predictor, name).register_forward_hook(lambda _m, _a, _o, stage=name: report(f'Finished {stage}'))
    report(f'Inferring scene on {args.device}')
    previous_dtype = torch.get_default_dtype()
    try:
        torch.set_default_dtype(dtype)
        with torch.inference_mode():
            prediction = predictor(pixels, disparity)
    finally:
        torch.set_default_dtype(previous_dtype)
    prediction = Gaussians3D(*(value.float().cpu() for value in prediction))
    if args.device == 'mps':
        del encoder, encode
    del predictor, pixels
    gc.collect()
    if args.device == 'mps':
        torch.mps.empty_cache()
    intrinsics = torch.tensor([[focal * 1536 / width, 0, 768, 0],
                               [0, focal * 1536 / height, 768, 0],
                               [0, 0, 1, 0], [0, 0, 0, 1]], dtype=torch.float32)
    report('Unprojecting learned Gaussians into 3D')
    with torch.inference_mode():
        gaussians = unproject_gaussians(prediction, torch.eye(4), intrinsics, (1536, 1536))
        arrays = {
            'positions': gaussians.mean_vectors.reshape(-1, 3).numpy(),
            'scales': gaussians.singular_values.reshape(-1, 3).numpy(),
            'rotations': gaussians.quaternions.reshape(-1, 4).numpy(),
            'colors': linearRGB2sRGB(gaussians.colors.reshape(-1, 3)).clamp(0, 1).numpy(),
            'opacities': gaussians.opacities.reshape(-1).numpy(),
        }
    keep = (arrays['opacities'] >= 1 / 255) & (arrays['positions'][:, 2] > 0)
    for array in arrays.values():
        keep &= np.isfinite(array).all(axis=1) if array.ndim > 1 else np.isfinite(array)
    arrays = {name: array[keep] for name, array in arrays.items()}
    if not len(arrays['positions']):
        raise ValueError('SHARP generated no valid Gaussians')
    args.output.mkdir(parents=True, exist_ok=True)
    if args.debug_output:
        np.savez(args.debug_output, **arrays, focal=focal, width=width, height=height)
    report(f"Compressing {len(arrays['positions']):,} Gaussians")
    filename, size = export_spz(**arrays, output=args.output)
    mobile = mobile_gaussians(arrays, focal, width, height)
    mobile_filename, mobile_size = export_spz(**mobile, output=args.output)
    metadata = {
        'src': filename,
        'width': width,
        'height': height,
        'fov': math.degrees(2 * math.atan(height / (2 * focal))),
        'focusDepth': float(np.median(arrays['positions'][:, 2])),
        'pointCount': len(arrays['positions']),
        'bytes': size,
        'mobile': {'src': mobile_filename, 'pointCount': len(mobile['positions']), 'bytes': mobile_size},
        'generator': 'Apple SHARP (single-image research preview)',
        'sourceSha256': hashlib.sha256(args.input.read_bytes()).hexdigest(),
    }
    (args.output / 'scene.json').write_text(json.dumps(metadata, indent=2) + '\n')
    report(f'Wrote {filename}: {size / 1024**2:.2f} MiB')


if __name__ == '__main__':
    main()
