import { useRef, useEffect } from "react";
import ThreeObject from "@/components/ThreeObject";
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

const textureLoader = new THREE.TextureLoader();

function addPlanets(obj: PlanetItem, parent: THREE.Object3D) {
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
            addPlanets(subObj, sphere);
        });
    }
}

export default function Galaxy() {
    const rafRef = useRef<number>(0);

    useEffect(() => {
        const canvas = document.querySelector("canvas.galaxy");
        const three = new ThreeObject(canvas);
        const group = new THREE.Group();
        three.add(group);

        addPlanets(planetData[0], group);

        // 点光源
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

        // 加旋转动画
        const animate = () => {
            group.traverse((mesh: THREE.Object3D) => {
                if (!mesh.isMesh) return;
                const ud = mesh.userData;
               if (!ud) return;
                const { distance, rotationSpeed, orbitalSpeed, orbitAngle = 0 } = ud;
                mesh.rotation.y = mesh.rotation.y + rotationSpeed * Math.PI / 180;
                let newAngle = orbitAngle + orbitalSpeed * Math.PI / 180;
                newAngle %= Math.PI * 2;
                mesh.userData.orbitAngle = newAngle;
                mesh.position.x = distance * Math.cos(newAngle);
                mesh.position.z = distance * Math.sin(newAngle);
            });
            rafRef.current = requestAnimationFrame(animate);
        }
        animate();
        return () => {
            cancelAnimationFrame(rafRef.current);
            three.destroy();
        };
    }, []);
  
    return <canvas className="galaxy"></canvas>
}
