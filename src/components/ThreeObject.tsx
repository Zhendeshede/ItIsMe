import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

class ThreeObject {
    #scene: THREE.Scene;
    #camera: THREE.Camera;
    #renderer: THREE.WebGLRenderer;
    #ambient: THREE.AmbientLight;
    #axes: THREE.AxesHelper;
    #controls: OrbitControls;
    #rafId: number | null;
    #resizeHandler: (() => void) | null;
    #timer: THREE.Timer;
    #loops = new Set<(dt: number) => void>();
    
    constructor(domElement: HTMLCanvasElement) {
        this.#rafId = null;
        this.#resizeHandler = null;
        this.initialize(domElement);
    }
    initialize(domElement: HTMLCanvasElement) {
        this.#scene = new THREE.Scene();
        const ratio = window.innerWidth / window.innerHeight;
        this.#camera = new THREE.PerspectiveCamera(60, ratio, 1, 200);
        this.#camera.position.set(0, 0, 50);
        this.#renderer = new THREE.WebGLRenderer({ canvas: domElement });
        this.#renderer.shadowMap.enabled = true;
        this.#renderer.shadowMap.type = THREE.PCFShadowMap;
        this.#renderer.setSize(window.innerWidth, window.innerHeight);
        this.#renderer.setPixelRatio(Math.max(2, window.devicePixelRatio));
        // 灯光
        this.#ambient = new THREE.AmbientLight(0xffffff, 1);
        this.#scene.add(this.#ambient);
        // 轴
        this.#axes = new THREE.AxesHelper(100);
        this.#axes.visible = false;
        this.#scene.add(this.#axes);

        this.#controls = new OrbitControls(this.#camera, domElement);

        this.#renderer.render(this.#scene, this.#camera);

        this.#timer = new THREE.Timer();
        this.#timer.connect(document);

        const renderLoop = (timestamp: number = 0) => {
            this.#timer.update(timestamp);
            const dt = this.#timer.getDelta();  // 当前帧与上一帧之间的时间差（单位秒） 
            for (const cb of this.#loops) {
                cb(dt);
            }
            if (this.#controls.enabled) {
                this.#controls.update();
            }
            this.#renderer.render(this.#scene, this.#camera);
            this.#rafId = requestAnimationFrame(renderLoop);
        }
        renderLoop();

        this.#resizeHandler = () => {
            this.#camera.aspect = window.innerWidth / window.innerHeight;
            this.#camera.updateProjectionMatrix();
            this.#renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener("resize", this.#resizeHandler);
    }
    add(obj: THREE.Object3D) {
        this.#scene.add(obj);
    }
    get scene() {
        return this.#scene;
    }
    get camera() {
        return this.#camera;
    }
    set camera(val) {
        this.#camera = val;
        this.#controls.object = val;
        val.updateProjectionMatrix();
    }
    get ambient() {
        return this.#ambient;
    }
    set ambient(val) {
        if (this.#ambient) {
            this.#scene.remove(this.#ambient);
        }
        this.#ambient = val;
        this.#scene.add(this.#ambient);
    }
    set axesVisible(val: boolean) {
        this.#axes.visible = val;
    }
    set shadowEnabled(val: boolean) {
        this.#renderer.shadowMap.enabled = val;
    }
    get controls() {
        return this.#controls;
    }
    onTick(cb: (dt: number) => void) {
        this.#loops.add(cb);
        return () => this.#loops.delete(cb);
    }
    dispose() {
        if (this.#rafId) cancelAnimationFrame(this.#rafId);
        if (this.#resizeHandler) window.removeEventListener("resize", this.#resizeHandler);
        this.#controls.dispose();
        this.#renderer.dispose();
        this.#loops.clear();
    }
}

export default ThreeObject;
