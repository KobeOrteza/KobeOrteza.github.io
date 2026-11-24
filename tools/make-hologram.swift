// make-hologram.swift
// Turns a portrait photo into the brightness + person-mask grid that powers
// the binary hologram in the hero.
//   • Vision face detection crops in to a head-and-shoulders portrait
//   • Vision person segmentation cuts the person out of the background
//   • Equalisation + sharpening keep facial features readable as 1s and 0s
// macOS 12+ only.
//
// Usage:  swift tools/make-hologram.swift assets/kobe.jpg js/hologram-data.js [cols=180] [zoom=2.9] [ghost.png] [depth.png]
// The optional ghost.png is a high-res, cut-out, cyan duotone portrait drawn under the bits.

import Foundation
import Vision
import CoreGraphics
import ImageIO

let args = CommandLine.arguments
guard args.count >= 3 else {
    print("usage: swift make-hologram.swift <input.jpg> <output.js> [cols=180] [zoom=2.9]")
    exit(1)
}
let inputURL = URL(fileURLWithPath: args[1])
let outputURL = URL(fileURLWithPath: args[2])
let cols = args.count > 3 ? Int(args[3]) ?? 180 : 180
// crop width as a multiple of the detected face width (smaller = closer to the face)
let zoom = args.count > 4 ? Double(args[4]) ?? 2.9 : 2.9

guard let src = CGImageSourceCreateWithURL(inputURL as CFURL, nil),
      let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
    print("could not read image"); exit(1)
}
let W = cg.width, H = cg.height

// ---- Vision: person mask + face box ----------------------------------------
let seg = VNGeneratePersonSegmentationRequest()
seg.qualityLevel = .accurate
seg.outputPixelFormat = kCVPixelFormatType_OneComponent8
let faceReq = VNDetectFaceRectanglesRequest()
let landmarkReq = VNDetectFaceLandmarksRequest()
try VNImageRequestHandler(cgImage: cg, options: [:]).perform([seg, faceReq, landmarkReq])
guard let maskBuf = seg.results?.first?.pixelBuffer else { print("no person mask"); exit(1) }

// ---- Crop rectangle (pixels, top-left origin) --------------------------------
var crop = CGRect(x: 0, y: 0, width: W, height: H)
if let face = faceReq.results?.max(by: { $0.boundingBox.width < $1.boundingBox.width })?.boundingBox {
    let fw = face.width * Double(W), fh = face.height * Double(H)
    let fx = face.midX * Double(W)
    let fTop = (1 - face.maxY) * Double(H)
    var cw = fw * zoom
    var ch = cw * 1.25                       // 4:5 portrait
    cw = min(cw, Double(W)); ch = min(ch, Double(H))
    var x = fx - cw / 2
    var y = fTop - fh * 0.75                 // room for hair above the face box
    x = max(0, min(Double(W) - cw, x))
    y = max(0, min(Double(H) - ch, y))
    crop = CGRect(x: x, y: y, width: cw, height: ch)
    print("face at \(Int(fx)),\(Int(fTop)) \(Int(fw))x\(Int(fh)) → crop \(crop.integral)")
} else {
    print("no face found, using full image")
}
let rows = Int((Double(cols) * crop.height / crop.width).rounded())

CVPixelBufferLockBaseAddress(maskBuf, .readOnly)
let mW = CVPixelBufferGetWidth(maskBuf), mH = CVPixelBufferGetHeight(maskBuf)
let mStride = CVPixelBufferGetBytesPerRow(maskBuf)
let mPtr = CVPixelBufferGetBaseAddress(maskBuf)!.assumingMemoryBound(to: UInt8.self)

var pixels = [UInt8](repeating: 0, count: W * H * 4)
let ctx = CGContext(data: &pixels, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W * 4,
                    space: CGColorSpaceCreateDeviceRGB(),
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.draw(cg, in: CGRect(x: 0, y: 0, width: W, height: H))

// ---- Average each grid cell inside the crop ---------------------------------
var lum = [Double](repeating: 0, count: cols * rows)
var mask = [Double](repeating: 0, count: cols * rows)
for r in 0..<rows {
    for c in 0..<cols {
        let x0 = Int(crop.minX + Double(c) * crop.width / Double(cols))
        let x1 = max(x0 + 1, Int(crop.minX + Double(c + 1) * crop.width / Double(cols)))
        let y0 = Int(crop.minY + Double(r) * crop.height / Double(rows))
        let y1 = max(y0 + 1, Int(crop.minY + Double(r + 1) * crop.height / Double(rows)))
        var l = 0.0, m = 0.0, n = 0.0
        for y in y0..<min(y1, H) {
            for x in x0..<min(x1, W) {
                let i = (y * W + x) * 4
                l += (0.2126 * Double(pixels[i]) + 0.7152 * Double(pixels[i+1]) + 0.0722 * Double(pixels[i+2])) / 255.0
                let mx = min(mW - 1, x * mW / W), my = min(mH - 1, y * mH / H)
                m += Double(mPtr[my * mStride + mx]) / 255.0
                n += 1
            }
        }
        lum[r * cols + c] = n > 0 ? l / n : 0
        mask[r * cols + c] = n > 0 ? m / n : 0
    }
}
CVPixelBufferUnlockBaseAddress(maskBuf, .readOnly)

// ---- Sharpen (unsharp mask) so eyes, nose and mouth keep their edges -------
func at(_ a: [Double], _ c: Int, _ r: Int) -> Double { a[max(0, min(rows - 1, r)) * cols + max(0, min(cols - 1, c))] }
var sharp = lum
for r in 0..<rows {
    for c in 0..<cols {
        var b = 0.0
        for dy in -2...2 { for dx in -2...2 { b += at(lum, c + dx, r + dy) } }
        b /= 25
        sharp[r * cols + c] = lum[r * cols + c] + 0.9 * (lum[r * cols + c] - b)
    }
}

// ---- Equalise brightness inside the person ---------------------------------
let inside = (0..<sharp.count).filter { mask[$0] > 0.3 }.map { sharp[$0] }.sorted()
func rank(_ v: Double) -> Double {
    guard !inside.isEmpty else { return v }
    var lo = 0, hi = inside.count
    while lo < hi { let mid = (lo + hi) / 2; if inside[mid] < v { lo = mid + 1 } else { hi = mid } }
    return Double(lo) / Double(inside.count)
}
let alphabet = Array("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_")
var lumStr = "", maskStr = ""
for i in 0..<sharp.count {
    let v = min(1, max(0, 0.7 * rank(sharp[i]) + 0.3 * sharp[i]))
    lumStr.append(alphabet[Int((v * 63).rounded())])
    maskStr.append(alphabet[Int((min(1, max(0, mask[i])) * 63).rounded())])
}

let js = """
/* Generated by tools/make-hologram.swift from \(inputURL.lastPathComponent) (zoom \(zoom)). Do not edit by hand. */
window.HOLOGRAM_DATA = {
  cols: \(cols),
  rows: \(rows),
  alphabet: "\(String(alphabet))",
  lum: "\(lumStr)",
  mask: "\(maskStr)"
};

"""
try js.write(to: outputURL, atomically: true, encoding: .utf8)
print("wrote \(outputURL.lastPathComponent): \(cols)x\(rows) cells, \(inside.count) inside person")

// ---- Optional: high-res cut-out duotone ghost PNG --------------------------
if args.count > 5 {
    let ghostURL = URL(fileURLWithPath: args[5])
    let gw = Int(min(640, crop.width.rounded())), gh = Int((Double(gw) * crop.height / crop.width).rounded())
    // gather luminance + mask at ghost resolution
    var gl = [Double](repeating: 0, count: gw * gh)
    var gm = [Double](repeating: 0, count: gw * gh)
    CVPixelBufferLockBaseAddress(maskBuf, .readOnly)
    for y in 0..<gh {
        for x in 0..<gw {
            let sx = min(W - 1, Int(crop.minX + (Double(x) + 0.5) * crop.width / Double(gw)))
            let sy = min(H - 1, Int(crop.minY + (Double(y) + 0.5) * crop.height / Double(gh)))
            let i = (sy * W + sx) * 4
            gl[y * gw + x] = (0.2126 * Double(pixels[i]) + 0.7152 * Double(pixels[i+1]) + 0.0722 * Double(pixels[i+2])) / 255.0
            let mx = min(mW - 1, sx * mW / W), my = min(mH - 1, sy * mH / H)
            gm[y * gw + x] = Double(mPtr[my * mStride + mx]) / 255.0
        }
    }
    CVPixelBufferUnlockBaseAddress(maskBuf, .readOnly)
    // stretch contrast over the person's own range (2nd–98th percentile)
    let vals = (0..<gl.count).filter { gm[$0] > 0.5 }.map { gl[$0] }.sorted()
    let lo = vals.isEmpty ? 0 : vals[Int(Double(vals.count) * 0.02)]
    let hi = vals.isEmpty ? 1 : vals[Int(Double(vals.count) * 0.98)]
    var out = [UInt8](repeating: 0, count: gw * gh * 4)
    for p in 0..<(gw * gh) {
        let v = min(1, max(0, (gl[p] - lo) / max(0.01, hi - lo)))
        let t = pow(v, 0.9)
        // duotone: deep teal shadows → icy cyan-white highlights
        let r = 8 + 222 * pow(t, 1.4), g = 52 + 203 * t, b = 66 + 189 * t
        let a = min(1, max(0, (gm[p] - 0.15) * 1.5))
        // premultiplied alpha
        out[p * 4] = UInt8(r * a); out[p * 4 + 1] = UInt8(g * a); out[p * 4 + 2] = UInt8(b * a); out[p * 4 + 3] = UInt8(255 * a)
    }
    let octx = CGContext(data: &out, width: gw, height: gh, bitsPerComponent: 8, bytesPerRow: gw * 4,
                         space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    let img = octx.makeImage()!
    let dest = CGImageDestinationCreateWithURL(ghostURL as CFURL, "public.png" as CFString, 1, nil)!
    CGImageDestinationAddImage(dest, img, nil)
    CGImageDestinationFinalize(dest)
    print("wrote \(ghostURL.lastPathComponent): \(gw)x\(gh)")
}

// ---- Optional: depth map for the 3D hologram --------------------------------
// There is no depth sensor data in a normal photo, so the relief is sculpted:
//   body  → rounded profile from the silhouette's distance transform
//   head  → ellipsoid dome around the detected face, pushed in front of the body
//   face  → landmark bumps: nose forward, eye sockets back, lips slightly forward
if args.count > 6 {
    let depthURL = URL(fileURLWithPath: args[6])
    let gw = Int(min(640, crop.width.rounded())), gh = Int((Double(gw) * crop.height / crop.width).rounded())
    // map image pixel coords → depth-map coords
    func toD(_ px: Double, _ py: Double) -> (Double, Double) {
        ((px - crop.minX) * Double(gw) / crop.width, (py - crop.minY) * Double(gh) / crop.height)
    }
    // mask at depth resolution
    var m = [Double](repeating: 0, count: gw * gh)
    CVPixelBufferLockBaseAddress(maskBuf, .readOnly)
    for y in 0..<gh { for x in 0..<gw {
        let sx = min(W - 1, Int(crop.minX + (Double(x) + 0.5) * crop.width / Double(gw)))
        let sy = min(H - 1, Int(crop.minY + (Double(y) + 0.5) * crop.height / Double(gh)))
        let mx = min(mW - 1, sx * mW / W), my = min(mH - 1, sy * mH / H)
        m[y * gw + x] = Double(mPtr[my * mStride + mx]) / 255.0
    } }
    CVPixelBufferUnlockBaseAddress(maskBuf, .readOnly)

    // chamfer distance transform (distance to nearest background pixel)
    let INF = 1e9
    var d = (0..<(gw * gh)).map { m[$0] > 0.5 ? INF : 0.0 }
    for y in 0..<gh { for x in 0..<gw {
        let i = y * gw + x; if d[i] == 0 { continue }
        if x > 0 { d[i] = min(d[i], d[i - 1] + 1) }
        if y > 0 { d[i] = min(d[i], d[i - gw] + 1) }
        if x > 0 && y > 0 { d[i] = min(d[i], d[i - gw - 1] + 1.414) }
        if x < gw - 1 && y > 0 { d[i] = min(d[i], d[i - gw + 1] + 1.414) }
    } }
    for y in stride(from: gh - 1, through: 0, by: -1) { for x in stride(from: gw - 1, through: 0, by: -1) {
        let i = y * gw + x; if d[i] == 0 { continue }
        if x < gw - 1 { d[i] = min(d[i], d[i + 1] + 1) }
        if y < gh - 1 { d[i] = min(d[i], d[i + gw] + 1) }
        if x < gw - 1 && y < gh - 1 { d[i] = min(d[i], d[i + gw + 1] + 1.414) }
        if x > 0 && y < gh - 1 { d[i] = min(d[i], d[i + gw - 1] + 1.414) }
    } }
    // the body's roundness saturates at ~18% of the width (torso isn't a deep cylinder)
    let sat = Double(gw) * 0.18
    var depth = d.map { $0 >= INF ? 0 : sqrt(min(1, $0 / sat)) * 0.5 }

    if let obs = landmarkReq.results?.max(by: { $0.boundingBox.width < $1.boundingBox.width }) {
        let bb = obs.boundingBox
        // face box in depth coords (Vision is bottom-left normalised)
        let (fx0, fy1) = toD(bb.minX * Double(W), (1 - bb.minY) * Double(H))
        let (fx1, fy0) = toD(bb.maxX * Double(W), (1 - bb.maxY) * Double(H))
        let fw = fx1 - fx0, fh = fy1 - fy0
        let cx = (fx0 + fx1) / 2, cy = fy0 + fh * 0.38
        let rx = fw * 0.66, ry = fh * 1.05
        func lm(_ r: VNFaceLandmarkRegion2D?) -> (Double, Double)? {
            guard let r = r, r.pointCount > 0 else { return nil }
            let pts = r.normalizedPoints
            var sx = 0.0, sy = 0.0
            for p in pts { sx += Double(p.x); sy += Double(p.y) }
            let nx = sx / Double(pts.count), ny = sy / Double(pts.count)
            return toD((bb.minX + nx * bb.width) * Double(W), (1 - (bb.minY + ny * bb.height)) * Double(H))
        }
        let nose = lm(obs.landmarks?.nose)
        let le = lm(obs.landmarks?.leftEye), re = lm(obs.landmarks?.rightEye)
        let lips = lm(obs.landmarks?.outerLips)
        func gauss(_ x: Double, _ y: Double, _ c: (Double, Double)?, _ s: Double) -> Double {
            guard let c = c else { return 0 }
            let dx = x - c.0, dy = y - c.1
            return exp(-(dx * dx + dy * dy) / (2 * s * s))
        }
        for y in 0..<gh { for x in 0..<gw {
            let i = y * gw + x
            if m[i] < 0.3 { continue }
            let ex = (Double(x) - cx) / rx, ey = (Double(y) - cy) / ry
            let r2 = ex * ex + ey * ey
            if r2 < 1 {
                let dome = sqrt(1 - r2)
                let head = 0.42 + 0.48 * dome
                // smooth max so the neck blends into the head
                let k = 0.08
                let a = depth[i], b = head
                let h = max(0, min(1, 0.5 + 0.5 * (b - a) / k))
                depth[i] = a * (1 - h) + b * h + k * h * (1 - h)
            }
            let X = Double(x), Y = Double(y)
            depth[i] += 0.14 * gauss(X, Y, nose, fw * 0.09)
            depth[i] -= 0.05 * gauss(X, Y, le, fw * 0.07)
            depth[i] -= 0.05 * gauss(X, Y, re, fw * 0.07)
            depth[i] += 0.03 * gauss(X, Y, lips, fw * 0.08)
        } }
        print("landmarks: nose \(nose != nil), eyes \(le != nil && re != nil), lips \(lips != nil)")
    } else {
        print("no face landmarks; body-only depth")
    }

    // smooth (3 box-blur passes) to remove seams, then fade with the mask
    for _ in 0..<3 {
        var t = depth
        let r = 3
        for y in 0..<gh { for x in 0..<gw {
            var acc = 0.0, n = 0.0
            for dx in -r...r { let xx = x + dx; if xx >= 0 && xx < gw { acc += depth[y * gw + xx]; n += 1 } }
            t[y * gw + x] = acc / n
        } }
        for y in 0..<gh { for x in 0..<gw {
            var acc = 0.0, n = 0.0
            for dy in -r...r { let yy = y + dy; if yy >= 0 && yy < gh { acc += t[yy * gw + x]; n += 1 } }
            depth[y * gw + x] = acc / n
        } }
    }
    let dmax = max(0.001, depth.max() ?? 1)
    var out = [UInt8](repeating: 0, count: gw * gh)
    for i in 0..<(gw * gh) { out[i] = UInt8(max(0, min(255, depth[i] / dmax * 255 * min(1, m[i] * 1.4)))) }
    let dctx = CGContext(data: &out, width: gw, height: gh, bitsPerComponent: 8, bytesPerRow: gw,
                         space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)!
    let dimg = dctx.makeImage()!
    let ddest = CGImageDestinationCreateWithURL(depthURL as CFURL, "public.png" as CFString, 1, nil)!
    CGImageDestinationAddImage(ddest, dimg, nil)
    CGImageDestinationFinalize(ddest)
    print("wrote \(depthURL.lastPathComponent): \(gw)x\(gh)")
}
