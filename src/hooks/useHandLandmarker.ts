import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FilesetResolver,
  HandLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

type CameraPermissionState = 'unknown' | 'granted' | 'denied' | 'error';

export type GestureName =
  | 'none'
  | 'point'
  | 'openPalm'
  | 'fist'
  | 'leftSwipe'
  | 'rightSwipe'
  | 'upwardSwipe';

export type LandmarkPoint = {
  x: number;
  y: number;
  z: number;
} | null;

export type HandLandmarkerDebugState = {
  cameraPermission: CameraPermissionState;
  cameraActive: boolean;
  modelLoaded: boolean;
  handDetected: boolean;
  numberOfHands: number;
  indexFingerTip: LandmarkPoint;
  wrist: LandmarkPoint;
  thumbTip: LandmarkPoint;
  pinkyTip: LandmarkPoint;
  currentGesture: GestureName;
  gestureConfidence: number;
  cooldownRemaining: number;
  errorMessage: string | null;
};

type GestureHistorySample = {
  timestamp: number;
  wrist: Exclude<LandmarkPoint, null>;
  indexFingerTip: Exclude<LandmarkPoint, null>;
};

type GestureClassification = {
  gesture: GestureName;
  confidence: number;
  startsCooldown: boolean;
};

const TASKS_VISION_WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const HAND_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
export const enableAdvancedGestures = false;
const GESTURE_HISTORY_WINDOW_MS = 620;
const GESTURE_COOLDOWN_MS = 1000;
const MIN_HISTORY_SAMPLES_FOR_SWIPE = 5;
const SWIPE_X_THRESHOLD = 0.16;
const SWIPE_Y_THRESHOLD = 0.17;
const MIN_HORIZONTAL_SWIPE_SPEED = 0.38;
const MIN_UPWARD_SWIPE_SPEED = 0.46;
const UPWARD_VERTICAL_DOMINANCE = 1.35;
const UPWARD_MIN_DIRECTIONAL_STEPS = 3;
const UPWARD_STEP_EPSILON = 0.004;

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

const EMPTY_DEBUG_STATE: HandLandmarkerDebugState = {
  cameraPermission: 'unknown',
  cameraActive: false,
  modelLoaded: false,
  handDetected: false,
  numberOfHands: 0,
  indexFingerTip: null,
  wrist: null,
  thumbTip: null,
  pinkyTip: null,
  currentGesture: 'none',
  gestureConfidence: 0,
  cooldownRemaining: 0,
  errorMessage: null,
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function distance(from: NormalizedLandmark, to: NormalizedLandmark) {
  return Math.hypot(from.x - to.x, from.y - to.y);
}

function averagePoint(points: NormalizedLandmark[]): NormalizedLandmark {
  const pointCount = Math.max(points.length, 1);
  const total = points.reduce(
    (currentTotal, point) => ({
      x: currentTotal.x + point.x,
      y: currentTotal.y + point.y,
      z: currentTotal.z + point.z,
      visibility: currentTotal.visibility + point.visibility,
    }),
    { x: 0, y: 0, z: 0, visibility: 0 },
  );

  return {
    x: total.x / pointCount,
    y: total.y / pointCount,
    z: total.z / pointCount,
    visibility: total.visibility / pointCount,
  };
}

function getPalmScale(landmarks: NormalizedLandmark[]) {
  const wrist = landmarks[0];
  const indexBase = landmarks[5];
  const middleBase = landmarks[9];
  const pinkyBase = landmarks[17];

  if (!wrist || !indexBase || !middleBase || !pinkyBase) {
    return 0.1;
  }

  return Math.max(distance(wrist, middleBase), distance(indexBase, pinkyBase), 0.08);
}

function isFingerExtended(
  landmarks: NormalizedLandmark[],
  tipIndex: number,
  pipIndex: number,
  mcpIndex: number,
  palmScale: number,
) {
  const wrist = landmarks[0];
  const tip = landmarks[tipIndex];
  const pip = landmarks[pipIndex];
  const mcp = landmarks[mcpIndex];

  if (!wrist || !tip || !pip || !mcp) {
    return false;
  }

  const tipDistance = distance(tip, wrist);
  const pipDistance = distance(pip, wrist);
  const mcpDistance = distance(mcp, wrist);

  return (
    tipDistance > pipDistance + palmScale * 0.16 &&
    pipDistance > mcpDistance + palmScale * 0.04
  );
}

function getPoseGesture(landmarks: NormalizedLandmark[]): GestureClassification {
  if (landmarks.length < 21) {
    return {
      gesture: 'none',
      confidence: 0,
      startsCooldown: false,
    };
  }

  const palmScale = getPalmScale(landmarks);
  const wrist = landmarks[0];
  const palmBases = [landmarks[0], landmarks[5], landmarks[9], landmarks[13], landmarks[17]].filter(
    Boolean,
  );
  const palmCenter = averagePoint(palmBases);
  const fingerTips = [landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
  const closeTipCount = fingerTips.filter(
    (tip) => tip && distance(tip, palmCenter) < palmScale * 1.22,
  ).length;
  const averageTipDistance =
    fingerTips.reduce((totalDistance, tip) => {
      if (!tip) {
        return totalDistance;
      }

      return totalDistance + distance(tip, palmCenter);
    }, 0) / fingerTips.length;
  const fistConfidence = clamp(
    closeTipCount / 4 - Math.max(0, averageTipDistance - palmScale * 1.02) / palmScale,
  );

  if (wrist && closeTipCount >= 3 && fistConfidence > 0.46) {
    return {
      gesture: 'fist',
      confidence: fistConfidence,
      startsCooldown: false,
    };
  }

  const indexExtended = isFingerExtended(landmarks, 8, 6, 5, palmScale);
  const middleExtended = isFingerExtended(landmarks, 12, 10, 9, palmScale);
  const ringExtended = isFingerExtended(landmarks, 16, 14, 13, palmScale);
  const pinkyExtended = isFingerExtended(landmarks, 20, 18, 17, palmScale);
  const extendedFingerCount = [
    indexExtended,
    middleExtended,
    ringExtended,
    pinkyExtended,
  ].filter(Boolean).length;

  if (extendedFingerCount >= 3) {
    return {
      gesture: 'openPalm',
      confidence: clamp(extendedFingerCount / 4),
      startsCooldown: false,
    };
  }

  const foldedNonIndexCount = [middleExtended, ringExtended, pinkyExtended].filter(
    (isExtended) => !isExtended,
  ).length;

  if (indexExtended && foldedNonIndexCount >= 2) {
    return {
      gesture: 'point',
      confidence: clamp(0.48 + foldedNonIndexCount * 0.14),
      startsCooldown: false,
    };
  }

  return {
    gesture: 'none',
    confidence: 0,
    startsCooldown: false,
  };
}

function getSwipeGesture(history: GestureHistorySample[]): GestureClassification {
  if (history.length < MIN_HISTORY_SAMPLES_FOR_SWIPE) {
    return {
      gesture: 'none',
      confidence: 0,
      startsCooldown: false,
    };
  }

  const firstSample = history[0];
  const latestSample = history[history.length - 1];
  const elapsedSeconds = Math.max((latestSample.timestamp - firstSample.timestamp) / 1000, 0.001);
  const wristDeltaX = latestSample.wrist.x - firstSample.wrist.x;
  const indexDeltaX = latestSample.indexFingerTip.x - firstSample.indexFingerTip.x;
  const indexDeltaY = latestSample.indexFingerTip.y - firstSample.indexFingerTip.y;
  const horizontalDelta =
    Math.abs(indexDeltaX) > Math.abs(wristDeltaX) ? indexDeltaX : wristDeltaX;
  const horizontalSpeed = Math.abs(horizontalDelta) / elapsedSeconds;
  const upwardSpeed = Math.abs(indexDeltaY) / elapsedSeconds;
  const upwardStepCount = history.slice(1).reduce((stepCount, sample, index) => {
    const previousSample = history[index];
    const stepDeltaY = sample.indexFingerTip.y - previousSample.indexFingerTip.y;

    return stepDeltaY < -UPWARD_STEP_EPSILON ? stepCount + 1 : stepCount;
  }, 0);
  const downwardStepCount = history.slice(1).reduce((stepCount, sample, index) => {
    const previousSample = history[index];
    const stepDeltaY = sample.indexFingerTip.y - previousSample.indexFingerTip.y;

    return stepDeltaY > UPWARD_STEP_EPSILON ? stepCount + 1 : stepCount;
  }, 0);
  const directionalStepCount = upwardStepCount + downwardStepCount;
  const upwardStepRatio =
    directionalStepCount > 0 ? upwardStepCount / directionalStepCount : 0;
  const verticalDominance =
    Math.abs(indexDeltaY) / Math.max(Math.abs(horizontalDelta), 0.001);

  if (
    Math.abs(horizontalDelta) > SWIPE_X_THRESHOLD &&
    horizontalSpeed > MIN_HORIZONTAL_SWIPE_SPEED &&
    Math.abs(horizontalDelta) > Math.abs(indexDeltaY) * 0.72
  ) {
    return {
      gesture: horizontalDelta < 0 ? 'leftSwipe' : 'rightSwipe',
      confidence: clamp(Math.abs(horizontalDelta) / 0.32),
      startsCooldown: true,
    };
  }

  if (
    indexDeltaY < -SWIPE_Y_THRESHOLD &&
    upwardSpeed > MIN_UPWARD_SWIPE_SPEED &&
    verticalDominance >= UPWARD_VERTICAL_DOMINANCE &&
    upwardStepCount >= UPWARD_MIN_DIRECTIONAL_STEPS &&
    upwardStepRatio >= 0.6 &&
    downwardStepCount <= Math.max(1, Math.floor(upwardStepCount * 0.55))
  ) {
    return {
      gesture: 'upwardSwipe',
      confidence: clamp(
        Math.abs(indexDeltaY) / 0.34 * 0.48 +
          Math.min(verticalDominance / 2.4, 1) * 0.34 +
          upwardStepRatio * 0.18,
      ),
      startsCooldown: true,
    };
  }

  return {
    gesture: 'none',
    confidence: 0,
    startsCooldown: false,
  };
}

function classifyGesture(
  landmarks: NormalizedLandmark[] | undefined,
  history: GestureHistorySample[],
): GestureClassification {
  const swipeGesture = getSwipeGesture(history);

  if (swipeGesture.gesture !== 'none') {
    return swipeGesture;
  }

  if (!landmarks) {
    return {
      gesture: 'none',
      confidence: 0,
      startsCooldown: false,
    };
  }

  return getPoseGesture(landmarks);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

function getCameraPermissionState(error: unknown): CameraPermissionState {
  if (
    error instanceof DOMException &&
    ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(error.name)
  ) {
    return 'denied';
  }

  return 'error';
}

function copyLandmark(landmark: NormalizedLandmark | undefined): LandmarkPoint {
  if (!landmark) {
    return null;
  }

  return cloneLandmark(landmark);
}

function cloneLandmark(landmark: NormalizedLandmark): Exclude<LandmarkPoint, null> {
  return {
    x: landmark.x,
    y: landmark.y,
    z: landmark.z,
  };
}

function clearCanvas(canvas: HTMLCanvasElement | null) {
  const context = canvas?.getContext('2d');

  if (!canvas || !context) {
    return;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
}

function syncCanvasSize(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    return false;
  }

  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  return true;
}

function drawHandLandmarks(
  canvas: HTMLCanvasElement | null,
  video: HTMLVideoElement | null,
  hands: NormalizedLandmark[][],
) {
  if (!canvas || !video || !syncCanvasSize(video, canvas)) {
    return;
  }

  const context = canvas.getContext('2d');

  if (!context) {
    return;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);

  hands.forEach((landmarks) => {
    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = 'rgba(255, 224, 162, 0.86)';
    context.lineWidth = Math.max(2, canvas.width / 260);

    HAND_CONNECTIONS.forEach(([fromIndex, toIndex]) => {
      const from = landmarks[fromIndex];
      const to = landmarks[toIndex];

      if (!from || !to) {
        return;
      }

      context.beginPath();
      context.moveTo(from.x * canvas.width, from.y * canvas.height);
      context.lineTo(to.x * canvas.width, to.y * canvas.height);
      context.stroke();
    });

    landmarks.forEach((landmark, index) => {
      const radius = index === 8 ? 6 : 4;

      context.beginPath();
      context.fillStyle = index === 8 ? '#fff4c9' : 'rgba(255, 245, 210, 0.92)';
      context.shadowBlur = index === 8 ? 16 : 10;
      context.shadowColor = 'rgba(255, 204, 128, 0.78)';
      context.arc(landmark.x * canvas.width, landmark.y * canvas.height, radius, 0, Math.PI * 2);
      context.fill();
    });

    context.restore();
  });
}

export function useHandLandmarker() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const frameRef = useRef<number | null>(null);
  const gestureHistoryRef = useRef<GestureHistorySample[]>([]);
  const gestureCooldownUntilRef = useRef(0);
  const [debugState, setDebugState] = useState<HandLandmarkerDebugState>(EMPTY_DEBUG_STATE);

  const stopDetectionLoop = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const loadModel = useCallback(async () => {
    if (handLandmarkerRef.current) {
      return handLandmarkerRef.current;
    }

    const visionTasks = await FilesetResolver.forVisionTasks(TASKS_VISION_WASM_URL);
    const handLandmarker = await HandLandmarker.createFromOptions(visionTasks, {
      baseOptions: {
        modelAssetPath: HAND_LANDMARKER_MODEL_URL,
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numHands: 2,
    });

    handLandmarkerRef.current = handLandmarker;
    setDebugState((currentState) => ({
      ...currentState,
      modelLoaded: true,
      errorMessage: null,
    }));

    return handLandmarker;
  }, []);

  const runDetectionLoop = useCallback(() => {
    stopDetectionLoop();

    const detectFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const handLandmarker = handLandmarkerRef.current;

      if (
        video &&
        canvas &&
        handLandmarker &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0
      ) {
        try {
          const timestamp = performance.now();
          const result = handLandmarker.detectForVideo(video, timestamp);
          const hands = result.landmarks ?? [];
          const firstHand = hands[0];
          const wrist = firstHand?.[0];
          const indexFingerTip = firstHand?.[8];
          let currentGesture: GestureName = 'none';
          let gestureConfidence = 0;
          let cooldownRemaining = Math.max(gestureCooldownUntilRef.current - timestamp, 0);

          if (wrist && indexFingerTip) {
            if (enableAdvancedGestures) {
              gestureHistoryRef.current = [
                ...gestureHistoryRef.current,
                {
                  timestamp,
                  wrist: cloneLandmark(wrist),
                  indexFingerTip: cloneLandmark(indexFingerTip),
                },
              ].filter(
                (sample) => timestamp - sample.timestamp <= GESTURE_HISTORY_WINDOW_MS,
              );

              const gestureClassification = classifyGesture(firstHand, gestureHistoryRef.current);
              currentGesture = gestureClassification.gesture;
              gestureConfidence = gestureClassification.confidence;

              if (gestureClassification.startsCooldown && cooldownRemaining <= 0) {
                gestureCooldownUntilRef.current = timestamp + GESTURE_COOLDOWN_MS;
                cooldownRemaining = GESTURE_COOLDOWN_MS;
              }
            } else {
              gestureHistoryRef.current = [];
              gestureCooldownUntilRef.current = 0;
              currentGesture = 'none';
              gestureConfidence = 0;
              cooldownRemaining = 0;
            }
          } else {
            gestureHistoryRef.current = [];
            currentGesture = 'none';
            gestureConfidence = 0;
            cooldownRemaining = Math.max(gestureCooldownUntilRef.current - timestamp, 0);
          }

          drawHandLandmarks(canvas, video, hands);
          setDebugState((currentState) => ({
            ...currentState,
            cameraActive: Boolean(streamRef.current?.active),
            modelLoaded: true,
            handDetected: hands.length > 0,
            numberOfHands: hands.length,
            wrist: copyLandmark(firstHand?.[0]),
            thumbTip: copyLandmark(firstHand?.[4]),
            indexFingerTip: copyLandmark(firstHand?.[8]),
            pinkyTip: copyLandmark(firstHand?.[20]),
            currentGesture,
            gestureConfidence,
            cooldownRemaining: Math.ceil(cooldownRemaining),
            errorMessage: null,
          }));
        } catch (error) {
          clearCanvas(canvas);
          setDebugState((currentState) => ({
            ...currentState,
            errorMessage: getErrorMessage(error),
          }));
        }
      }

      frameRef.current = window.requestAnimationFrame(detectFrame);
    };

    frameRef.current = window.requestAnimationFrame(detectFrame);
  }, [stopDetectionLoop]);

  const stop = useCallback(() => {
    stopDetectionLoop();

    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    clearCanvas(canvasRef.current);
    gestureHistoryRef.current = [];
    gestureCooldownUntilRef.current = 0;
    setDebugState((currentState) => ({
      ...currentState,
      cameraActive: false,
      handDetected: false,
      numberOfHands: 0,
      wrist: null,
      thumbTip: null,
      indexFingerTip: null,
      pinkyTip: null,
      currentGesture: 'none',
      gestureConfidence: 0,
      cooldownRemaining: 0,
    }));
  }, [stopDetectionLoop]);

  const start = useCallback(async () => {
    stopDetectionLoop();
    clearCanvas(canvasRef.current);
    gestureHistoryRef.current = [];
    gestureCooldownUntilRef.current = 0;
    setDebugState((currentState) => ({
      ...currentState,
      errorMessage: null,
      handDetected: false,
      numberOfHands: 0,
      currentGesture: 'none',
      gestureConfidence: 0,
      cooldownRemaining: 0,
    }));

    if (!navigator.mediaDevices?.getUserMedia) {
      setDebugState((currentState) => ({
        ...currentState,
        cameraPermission: 'error',
        cameraActive: false,
        errorMessage: 'MediaDevices.getUserMedia is not available in this browser.',
      }));
      return;
    }

    let stream: MediaStream;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (error) {
      setDebugState((currentState) => ({
        ...currentState,
        cameraPermission: getCameraPermissionState(error),
        cameraActive: false,
        errorMessage: getErrorMessage(error),
      }));
      return;
    }

    streamRef.current = stream;
    setDebugState((currentState) => ({
      ...currentState,
      cameraPermission: 'granted',
      cameraActive: true,
      errorMessage: null,
    }));

    try {
      if (!videoRef.current) {
        throw new Error('Video element is not ready.');
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      await loadModel();
      runDetectionLoop();
    } catch (error) {
      setDebugState((currentState) => ({
        ...currentState,
        cameraActive: Boolean(streamRef.current?.active),
        modelLoaded: Boolean(handLandmarkerRef.current),
        errorMessage: getErrorMessage(error),
      }));
    }
  }, [loadModel, runDetectionLoop, stopDetectionLoop]);

  useEffect(() => {
    return () => {
      stopDetectionLoop();

      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
      gestureHistoryRef.current = [];
      gestureCooldownUntilRef.current = 0;

      handLandmarkerRef.current?.close();
      handLandmarkerRef.current = null;
    };
  }, [stopDetectionLoop]);

  return {
    videoRef,
    canvasRef,
    debugState,
    start,
    stop,
  };
}
