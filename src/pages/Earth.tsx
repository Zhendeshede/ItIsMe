import { useEffect, useRef } from "react";
import * as Cesium from "cesium";

Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;

const TMAP_KEY = import.meta.env.VITE_TMAP_KEY;

const jinWu = { lon: 117.06, lat: 39.04, height: 3000 };

const skySources = {
  positiveX: "/textures/milky/px.png",
  negativeX: "/textures/milky/nx.png",
  positiveY: "/textures/milky/py.png",
  negativeY: "/textures/milky/ny.png",
  positiveZ: "/textures/milky/nz.png",
  negativeZ: "/textures/milky/pz.png",
};

export default function Earth() {

    const earthRef = useRef<Cesium.Viewer | null>(null);

    function flyToJinwu() {
        if (!earthRef.current) return;
        earthRef.current.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(jinWu.lon, jinWu.lat, jinWu.height),
            duration: 5,
            orientation: {
                heading: Cesium.Math.toRadians(0),
                pitch: Cesium.Math.toRadians(-30),
                roll: 0.0
            }
        });
    }

    useEffect(() => {
        let viewer: Cesium.Viewer | null = null;
        let isUnmount = false;
        let flyTimer: ReturnType<typeof setTimeout> | null = null;
        const initialize = async () => {
            const terrainProvider = await Cesium.createWorldTerrainAsync({
                requestVertexNormals: true,
                requestWaterMask: true
            });
          
            if(isUnmount) return;
            viewer = new Cesium.Viewer("earth", {
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
                terrainProvider
            });
            viewer.cesiumWidget.creditContainer.style.display = "none";
            viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
            viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
            const imgProvider = new Cesium.WebMapTileServiceImageryProvider({
              url: `http://t0.tianditu.gov.cn/img_w/wmts?tk=${TMAP_KEY}`,
              layer: "img",
              style: "default",
              tileMatrixSetID: "w",
              format: "tiles",
              subdomains: ["t0","t1","t2","t3","t4","t5","t6","t7"],
              maximumLevel: 18,
            })
            viewer.imageryLayers.addImageryProvider(imgProvider);
            
            earthRef.current = viewer;
            flyTimer = setTimeout(() => {
              flyToJinwu();
            }, 5000);
        }
        initialize();

        return () => {
            isUnmount = true;
            flyTimer && clearTimeout(flyTimer);
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
        </>
    )
}
