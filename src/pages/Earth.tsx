import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import StarfieldOverlay from "@/components/StarfieldOverlay";

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
const FLY_DELAY = 5000;
const FADE_MAX_WAIT = 12000;

function createImgProvider(tk: string) {
    return new Cesium.WebMapTileServiceImageryProvider({
        url: `http://t0.tianditu.gov.cn/img_w/wmts?tk=${tk}`,
        layer: "img",
        style: "default",
        tileMatrixSetID: "w",
        format: "tiles",
        subdomains: ["t0","t1","t2","t3","t4","t5","t6","t7"],
        maximumLevel: 18,
    });
}

function flyToJinwu(viewer: Cesium.Viewer) {
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(jinWu.lon, jinWu.lat, jinWu.height),
        duration: 5,
        orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-30),
            roll: 0,
        },
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

export default function Earth() {

    const earthRef = useRef<Cesium.Viewer | null>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    const warpSpeedRef = useRef(1600);

    // 星速衰减动画
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
            // 兜底超时
            fadeTimer = setTimeout(() => {
                doFadeOverlay();
                v.scene.postRender.removeEventListener(onPostRender);
            }, FADE_MAX_WAIT);
        };

        const initialize = async () => {
            viewer = await initViewer("earth");
            if (isUnmount) return;
            earthRef.current = viewer;

            flyTimer = setTimeout(() => flyToJinwu(viewer!), FLY_DELAY);
            setupFadeLogic(viewer);
        }
        initialize();

        return () => {
            isUnmount = true;
            flyTimer && clearTimeout(flyTimer);
            fadeTimer && clearTimeout(fadeTimer);
            if (viewer) {
                viewer.destroy();
                viewer = null;
            }
            earthRef.current = null;
        };
    },[]);

    return (
        <>
            <div id="earth" className="w-full h-full"></div>
            {/* 从 Galaxy 切入时的星空过渡层（加载完成后淡出） */}
            <StarfieldOverlay
                ref={overlayRef}
                speedRef={warpSpeedRef}
            />
        </>
    )
}
