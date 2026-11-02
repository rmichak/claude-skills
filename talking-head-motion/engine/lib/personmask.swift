// A person mask for every frame of a video, with macOS Vision (no green screen, no installs). Called by
// engine/background.mjs.
//   swift engine/lib/personmask.swift <in.mp4> <out-mask.mp4>
// The mask is a grayscale video (white = person) at the input's size and timing, H.264.
import AVFoundation
import CoreImage
import Foundation
import Vision

let inURL = URL(fileURLWithPath: CommandLine.arguments[1]), outURL = URL(fileURLWithPath: CommandLine.arguments[2])
try? FileManager.default.removeItem(at: outURL)
let asset = AVURLAsset(url: inURL)
let track = asset.tracks(withMediaType: .video)[0]
let size = track.naturalSize, w = Int(size.width), h = Int(size.height)
let reader = try AVAssetReader(asset: asset)
let readOut = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
reader.add(readOut)
reader.startReading()
let writer = try AVAssetWriter(outputURL: outURL, fileType: .mp4)
let writeIn = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: w, AVVideoHeightKey: h,
    AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 12_000_000],
])
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: writeIn, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferWidthKey as String: w, kCVPixelBufferHeightKey as String: h,
])
writer.add(writeIn)
writer.startWriting()
writer.startSession(atSourceTime: .zero)
// no colour management: the mask's values must come through as they are
let ctx = CIContext(options: [.workingColorSpace: NSNull(), .outputColorSpace: NSNull()])
let req = VNGeneratePersonSegmentationRequest()
req.qualityLevel = .accurate
req.outputPixelFormat = kCVPixelFormatType_OneComponent8
let toGray = CIFilter(name: "CIColorMatrix")!
for k in ["inputRVector", "inputGVector", "inputBVector"] { toGray.setValue(CIVector(x: 1, y: 0, z: 0, w: 0), forKey: k) }
toGray.setValue(CIVector(x: 0, y: 0, z: 0, w: 0), forKey: "inputAVector")
toGray.setValue(CIVector(x: 0, y: 0, z: 0, w: 1), forKey: "inputBiasVector")
var n = 0
let start = Date()
while let sample = readOut.copyNextSampleBuffer() {
    guard let px = CMSampleBufferGetImageBuffer(sample) else { continue }
    let t = CMSampleBufferGetPresentationTimeStamp(sample)
    try VNImageRequestHandler(cvPixelBuffer: px, options: [:]).perform([req])
    guard let mask = req.results?.first?.pixelBuffer else { fatalError("no mask at frame \(n)") }
    var img = CIImage(cvPixelBuffer: mask)
    img = img.transformed(by: CGAffineTransform(scaleX: size.width / img.extent.width, y: size.height / img.extent.height))
    toGray.setValue(img, forKey: kCIInputImageKey)
    while !writeIn.isReadyForMoreMediaData { usleep(2000) }
    var out: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &out)
    ctx.render(toGray.outputImage!.cropped(to: CGRect(x: 0, y: 0, width: w, height: h)), to: out!)
    adaptor.append(out!, withPresentationTime: t)
    n += 1
    if n % 600 == 0 { print("  \(n) frames (\(String(format: "%.1f", Double(n) / Date().timeIntervalSince(start))) fps)"); fflush(stdout) }
}
if reader.status == .failed { fatalError("read failed: \(String(describing: reader.error))") }
writeIn.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
print("mask: \(n) frames")
