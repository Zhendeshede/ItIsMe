import { useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ThreeObject from "@/components/ThreeObject";
import StarfieldOverlay from "@/components/StarfieldOverlay";
import * as THREE from "three";

type PlanetItem = {
  name: string;
  radius: number;
  rotationSpeed: number;
  orbitalSpeed: number;
  texture: string;
  metalness: number;
  roughness: number;
  distance: number;
  children?: PlanetItem[];
};

// 行星数据
const planetData:PlanetItem[] = [
    {
        name: "sun",
        radius: 10,
        rotationSpeed: 0.08,
        orbitalSpeed: 0,
        texture: "sun",
        metalness: 0,
        roughness: 0.9,
        distance: 0,
        children: [
            {
                name: "mercury",
                radius: 0.8,
                rotationSpeed: 0.02,
                orbitalSpeed: 0.4,
                texture: "mercury",
                metalness: 0.1,
                roughness: 0.85,
                distance: 14,
            },
            {
                name: "venus",
                radius: 1.6,
                rotationSpeed: 0.015,
                orbitalSpeed: 0.3,
                texture: "venus",
                metalness: 0,
                roughness: 0.9,
                distance: 20,
            },
            {
                name: "earth",
                radius: 1.5,
                rotationSpeed: 0.2,
                orbitalSpeed: 0.2,
                texture: "earth",
                metalness: 0,
                roughness: 0.7,
                distance: 28,
                children: [
                    {
                        name: "moon",
                        radius: 0.4,
                        rotationSpeed: 0.05,
                        orbitalSpeed: 0.25,
                        texture: "moon",
                        metalness: 0,
                        roughness: 0.82,
                        distance: 4,
                    },
                ],
            },
            {
                name: "mars",
                radius: 1.1,
                rotationSpeed: 0.18,
                orbitalSpeed: 0.16,
                texture: "mars",
                metalness: 0,
                roughness: 0.85,
                distance: 38,
            },
            {
                name: "jupiter",
                radius: 5,
                rotationSpeed: 0.4,
                orbitalSpeed: 0.08,
                texture: "jupiter",
                metalness: 0,
                roughness: 0.6,
                distance: 55,
            },
            {
                name: "saturn",
                radius: 4.2,
                rotationSpeed: 0.38,
                orbitalSpeed: 0.06,
                texture: "saturn",
                metalness: 0,
                roughness: 0.65,
                distance: 72,
            },
            {
                name: "uranus",
                radius: 2.2,
                rotationSpeed: 0.3,
                orbitalSpeed: 0.04,
                texture: "uranus",
                metalness: 0,
                roughness: 0.7,
                distance: 90,
            },
            {
                name: "neptune",
                radius: 2.1,
                rotationSpeed: 0.32,
                orbitalSpeed: 0.03,
                texture: "neptune",
                metalness: 0,
                roughness: 0.7,
                distance: 105,
            },
        ],
    }
];

// 递归添加行星及其卫星
function addPlanets(obj: PlanetItem, parent: THREE.Object3D, textureLoader: THREE.TextureLoader) {
    const { name, radius, rotationSpeed, orbitalSpeed, texture, children,
        distance, metalness, roughness } = obj;
    const material = name === "sun"
        ? new THREE.MeshStandardMaterial({
            color: 0x000000,
            emissive: 0xffddbb,
            emissiveIntensity: 2.2
        })
        : new THREE.MeshStandardMaterial();
    material.metalness = metalness;
    material.roughness = roughness;
    textureLoader.load(`/textures/${texture}.jpg`, (map: THREE.Texture) => {
        map.colorSpace = THREE.SRGBColorSpace;
        if (name === "sun") {
            material.emissiveMap = map;
        } else {
            material.map = map;
        }
        material.needsUpdate = true;
    });
    const geo = new THREE.SphereGeometry(radius, 64, 64);
    const sphere = new THREE.Mesh(geo, material);
    sphere.name = name;
    sphere.userData = { distance, rotationSpeed, orbitalSpeed, orbitAngle: 0 };
    sphere.castShadow = name !== "sun";
    sphere.receiveShadow = name !== "sun";
    sphere.position.x = distance;
    if (parent) parent.add(sphere);
    if (children) {
        children.forEach((subObj) => {
            addPlanets(subObj, sphere, textureLoader);
        });
    }
}

function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// 摄像机阶段
type Phase = "idle" | "follow" | "zoom" | "done";

// 各阶段时长（秒）
const IDLE_DURATION = 15;        // 正常展示太阳系
const FOLLOW_DURATION = 4;       // 相机跟随地球
const ZOOM_DURATION = 3;         // 推进切入地球 + 星空跃迁过渡

export default function Galaxy() {
    const threeRef = useRef<ThreeObject | null>(null);

    const overlayRef = useRef<HTMLDivElement>(null);
    const warpSpeedRef = useRef(900);

    const navigate = useNavigate();


    function cameraFollow(three: ThreeObject, navigate: ReturnType<typeof useNavigate>) {
        const camera = three.camera;
        const earth = three.scene.getObjectByName("earth");

        // 初始相机位置和注视点
        const initialCamPos = new THREE.Vector3(0, 0, 100);
        const initialLookAt = new THREE.Vector3(0, 0, 0);
        camera.position.copy(initialCamPos);
        camera.lookAt(initialLookAt);

        if (!earth) return;

        let phase: Phase = "idle";
        let phaseTimer = 0;
        let navigated = false;

        const followOffset = new THREE.Vector3(0, 4, 10);
        const zoomFinalDist = 1.9;

        const tmpEarthPos = new THREE.Vector3();
        const tmpTarget = new THREE.Vector3();
        const tmpDir = new THREE.Vector3();

        three.onTick((dt: number) => {
            if (phase === "done") return;
            phaseTimer += dt;

            earth.getWorldPosition(tmpEarthPos);

            switch (phase) {
                case "idle":
                    if (phaseTimer >= IDLE_DURATION) {
                        phase = "follow";
                        phaseTimer = 0;
                        three.controls.enabled = false;
                    }
                    break;
                case "follow":
                    {
                        tmpTarget.copy(tmpEarthPos).add(followOffset);
                        camera.position.lerp(tmpTarget, 0.04);
                        camera.lookAt(tmpEarthPos);
                        if (phaseTimer >= FOLLOW_DURATION) {
                            phase = "zoom";
                            phaseTimer = 0;
                        }
                    }
                    break;
                case "zoom": 
                    {
                        const t = Math.min(phaseTimer/ ZOOM_DURATION, 1);
                        // 偏移距离从 followOffset.length() 平滑过渡到 zoomFinalDist
                        const startDist = followOffset.length();
                        const dist = startDist + (zoomFinalDist - startDist) * easeInOutCubic(t);
                        // 相机 -> 地球 的方向（归一化），沿该方向靠近地球
                        tmpDir.subVectors(camera.position, tmpEarthPos);
                        if (tmpDir.lengthSq() > 1e-6) tmpDir.normalize();
                        else tmpDir.set(0, 0, 1);

                        tmpTarget.copy(tmpEarthPos).add(tmpDir.multiplyScalar(dist));
                        camera.position.lerp(tmpTarget, 0.12);
                        camera.lookAt(tmpEarthPos);

                        // 星空跃迁淡入 + 星点加速（推进约 1/3 处开始）
                        if (overlayRef.current) {
                            const fadeT = Math.max(0, (t - 0.35) / 0.65); // 0 -> 1
                            overlayRef.current.style.opacity = String(easeInOutCubic(fadeT));
                            warpSpeedRef.current = 40 + easeInOutCubic(t) * 1600;
                        }

                        // 推进结束 -> 跳转 Earth 页
                        if (t >= 1 && !navigated) {
                            navigated = true;
                            navigate("/earth");
                            return;
                        }
                    }
                    break;
            }
        });  
    }
    
    function initializeThree(canvas:HTMLCanvasElement): ThreeObject {
        const three = new ThreeObject(canvas);
        const group = new THREE.Group();
        three.add(group);

        const textureLoader = new THREE.TextureLoader();
        addPlanets(planetData[0], group, textureLoader);

        // 太阳光
        const pointLight = new THREE.PointLight(0xffffff, 12, 250, 1);
        pointLight.castShadow = true;
        pointLight.shadow.bias = -0.001;
        pointLight.shadow.radius = 4;
        pointLight.shadow.mapSize.set(1024, 1024);
        pointLight.shadow.camera.near = 0.1;
        pointLight.shadow.camera.far = 250;
        pointLight.position.set(0, 0, 0);
        three.add(pointLight);

        // 星空
        const milkyUrls = ["px.png", "nx.png", "py.png", "ny.png", "pz.png", "nz.png"];
        const milkyLoader = new THREE.CubeTextureLoader();
        milkyLoader.setPath("/textures/milky/");
        milkyLoader.load(milkyUrls, (envMap: THREE.CubeTexture) => {
            envMap.colorSpace = THREE.SRGBColorSpace;
            three.scene.background = envMap;
        });

        three.onTick((dt: number) => {
            // 行星公转与自转
            group.traverse((mesh: THREE.Object3D) => {
                if (!mesh.isMesh) return;
                const ud = mesh.userData;
                if (!ud) return;
                const { distance, rotationSpeed, orbitalSpeed, orbitAngle = 0 } = ud;
                mesh.rotation.y += rotationSpeed * Math.PI / 180 * dt * 60;
                let newAngle = orbitAngle + orbitalSpeed * Math.PI / 180 * dt * 60;
                newAngle %= Math.PI * 2;
                mesh.userData.orbitAngle = newAngle;
                mesh.position.x = distance * Math.cos(newAngle);
                mesh.position.z = distance * Math.sin(newAngle);
            });
        });
        return three;    
    }     

    useEffect(() => {
        const canvas = document.querySelector("canvas.galaxy");
        const three = initializeThree(canvas as HTMLCanvasElement);
        cameraFollow(three, navigate);
        threeRef.current = three;
        return () => three.destroy();
    }, [navigate]);

    return (
        <>
            <canvas className="galaxy"></canvas>
            {/* 星空跃迁过渡层 */}
            <StarfieldOverlay
                ref={overlayRef}
                speedRef={warpSpeedRef}
                style={{ opacity: 0 }}
            />
        </>
    );
}


