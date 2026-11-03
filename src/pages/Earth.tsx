import { useEffect, useRef, useState, useCallback } from "react";
import * as Cesium from "cesium";
import StarfieldOverlay from "@/components/StarfieldOverlay";
import meUrl from "@/assets/sources/me.jpg";
import pdfUrl from "@/assets/sources/resume.pdf";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).href;

Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;

const TMAP_KEY = import.meta.env.VITE_TMAP_KEY;

const jinWu = { lon: 117.112431, lat: 39.029157, height: 3000 };

const skySources = {
  positiveX: "/textures/milky/px.png",
  negativeX: "/textures/milky/nx.png",
  positiveY: "/textures/milky/py.png",
  negativeY: "/textures/milky/ny.png",
  positiveZ: "/textures/milky/nz.png",
  negativeZ: "/textures/milky/pz.png",
};

const MIN_DISPLAY = 2500;
const FLY_DELAY = 10000;
const FADE_MAX_WAIT = 12000;

const SCREEN_CFG = {
  offsetHeight: 1000,
  width: 120,
  height: 90,
  depth: 2,
  headingDeg: 0,
  avatarImg: meUrl,
};

function createImgProvider(tk: string) {
  return new Cesium.WebMapTileServiceImageryProvider({
    url: `http://t0.tianditu.gov.cn/img_w/wmts?tk=${tk}`,
    layer: "img",
    style: "default",
    tileMatrixSetID: "w",
    format: "tiles",
    subdomains: ["t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7"],
    maximumLevel: 18,
  });
}

function flyToJinwu(viewer: Cesium.Viewer, onComplete?: () => void) {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(jinWu.lon, jinWu.lat, jinWu.height),
    duration: 5,
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-30),
      roll: 0,
    },
    complete: onComplete,
  });
}

async function initViewer(containerId: string): Promise<Cesium.Viewer> {
  const terrainProvider = await Cesium.createWorldTerrainAsync({
    requestVertexNormals: true,
    requestWaterMask: true,
  });

  const viewer = new Cesium.Viewer(containerId, {
    baseLayer: false,
    infoBox: false,
    homeButton: false,
    geocoder: false,
    navigationHelpButton: false,
    sceneModePicker: false,
    baseLayerPicker: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    skyBox: new Cesium.SkyBox({ sources: skySources }),
    skyAtmosphere: false,
    terrainProvider,
  });

  (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = "none";
  viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
  viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  const imgProvider = createImgProvider(TMAP_KEY);
  viewer.imageryLayers.addImageryProvider(imgProvider);
  return viewer;
}

const createResumeScreen = (v: Cesium.Viewer): Cesium.Entity => {
  const { lon, lat } = jinWu;
  const centerH = SCREEN_CFG.offsetHeight + SCREEN_CFG.height / 2;
  const centerCart = Cesium.Cartesian3.fromDegrees(lon, lat, centerH);

  const boxEnt = v.entities.add({
    position: centerCart,
    box: {
      dimensions: new Cesium.Cartesian3(SCREEN_CFG.width, SCREEN_CFG.height, SCREEN_CFG.depth),
      material: new Cesium.ImageMaterialProperty({
        image: SCREEN_CFG.avatarImg,
        repeat: new Cesium.Cartesian2(1, 1),
      }),
    },
  });
  return boxEnt;
};

export default function Earth() {
  const earthRef = useRef<Cesium.Viewer | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const warpSpeedRef = useRef(1600);
  const [modalOpen, setModalOpen] = useState(false);
  const [pdfPage, setPdfPage] = useState<pdfjsLib.PDFPageProxy | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  const loadPdf = useCallback(async () => {
    if (loadingPdf) return;
    setLoadingPdf(true);
    try {
      const doc = await pdfjsLib.getDocument(pdfUrl).promise;
      const page = await doc.getPage(1);
      setPdfPage(page);
    } catch (e) {
      console.error("pdf load err", e);
    } finally {
      setLoadingPdf(false);
    }
  }, [loadingPdf]);

  useEffect(() => {
    if (!pdfPage || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const viewport = pdfPage.getViewport({ scale: 1.5 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const renderTask = pdfPage.render({ canvas, canvasContext: ctx, viewport });
    return () => renderTask.cancel();
  }, [pdfPage]);

  // 星速衰减
  useEffect(() => {
    let rafId = 0;
    const decel = () => {
      if (warpSpeedRef.current > 50) {
        warpSpeedRef.current = Math.max(50, warpSpeedRef.current * 0.97);
      }
      rafId = requestAnimationFrame(decel);
    };
    decel();
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    let viewer: Cesium.Viewer | null = null;
    let isUnmount = false;
    let flyTimer: ReturnType<typeof setTimeout> | null = null;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    let clickHandler: Cesium.ScreenSpaceEventHandler | null = null;
    let screenEnt: Cesium.Entity | null = null;
    let faded = false;

    const doFadeOverlay = () => {
      if (faded || !overlayRef.current) return;
      faded = true;
      overlayRef.current.style.transition = "opacity 1.8s ease-out";
      overlayRef.current.style.opacity = "0";
    };

    const setupFadeLogic = (v: Cesium.Viewer) => {
      const overlayShownAt = performance.now();
      const onPostRender = () => {
        if (!v.scene.globe.tilesLoaded) return;
        const cost = performance.now() - overlayShownAt;
        const wait = Math.max(0, MIN_DISPLAY - cost);
        fadeTimer = setTimeout(doFadeOverlay, wait);
        v.scene.postRender.removeEventListener(onPostRender);
      };
      v.scene.postRender.addEventListener(onPostRender);
      fadeTimer = setTimeout(() => {
        doFadeOverlay();
        v.scene.postRender.removeEventListener(onPostRender);
      }, FADE_MAX_WAIT);
    };

    const initialize = async () => {
      viewer = await initViewer("earth");
      if (isUnmount) return;
      earthRef.current = viewer;

      flyTimer = setTimeout(() => {
        flyToJinwu(viewer!, () => {
          screenEnt = createResumeScreen(viewer!);

          viewer!.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(jinWu.lon, jinWu.lat, 7000),
            orientation: {
              heading: 0,
              pitch: Cesium.Math.toRadians(-80),
              roll: 0,
            },
            duration: 1.8,
          });

          // 拾取点击
          clickHandler = new Cesium.ScreenSpaceEventHandler(viewer!.scene.canvas);
          clickHandler.setInputAction((e: Cesium.ScreenSpaceEvent) => {
            const pick = viewer!.scene.pick(e.position);
            if (!Cesium.defined(pick)) return;
            if (pick.id === screenEnt) {
              setModalOpen(true);
              loadPdf();
            }
          }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        });
      }, FLY_DELAY);
      setupFadeLogic(viewer);
    };
    initialize();

    return () => {
      isUnmount = true;
      flyTimer && clearTimeout(flyTimer);
      fadeTimer && clearTimeout(fadeTimer);
      clickHandler?.destroy();
      if (viewer) {
        viewer.destroy();
        viewer = null;
      }
      earthRef.current = null;
    };
  }, [loadPdf]);

  return (
    <>
      <div id="earth" className="w-full h-full"></div>
      <StarfieldOverlay ref={overlayRef} speedRef={warpSpeedRef} />
      {modalOpen && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              width: "620px",
              maxHeight: "80vh",
              background: "#fff",
              padding: "20px",
              borderRadius: "12px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
              zIndex: 999,
              overflow: "hidden", // 外层禁止滚动
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexShrink: 0 }}>
              <span style={{ fontWeight: 600 }}>简历预览</span>
              <button
                onClick={() => setModalOpen(false)}
                style={{ border: "none", background: "#eee", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
              >
                关闭
              </button>
            </div>
            {/* 只有这一层滚动 */}
            <div style={{ flex: 1, overflow: "auto", textAlign: "center" }}>
              {loadingPdf ? <p>加载PDF...</p> : <canvas ref={canvasRef} />}
            </div>
          </div>
        )}

    </>
  );
}
