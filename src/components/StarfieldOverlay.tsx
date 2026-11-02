import { CSSProperties, MutableRefObject, ForwardedRef, forwardRef, useEffect, useRef } from "react";

type StarfieldOverlayProps = {
    style?: CSSProperties;
    /** 默认星点速度 */
    defaultSpeed?: number;
    /** 外部星点调速 */
    speedRef?: MutableRefObject<number>;
    starCount?: number;
    background?: string;
};

const DEPTH = 1000;
const SPREAD = 620;

type Star = { x: number; y: number; z: number; pz: number };

/** 星空跃迁过渡层：星点从中心向外拉出光线，速度越快穿越感越强 */
function StarfieldOverlay(props: StarfieldOverlayProps, ref: ForwardedRef<HTMLDivElement>) {
    const { style, defaultSpeed = 60, speedRef, starCount = 1200, background = "#000" } = props;
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener("resize", resize);

        const reset = (s?: Star): Star => {
            const star = s ?? ({ x: 0, y: 0, z: 0, pz: 0 } as Star);
            star.x = Math.random() * 2 - 1;
            star.y = Math.random() * 2 - 1;
            star.z = DEPTH * (0.3 + Math.random() * 0.7);
            star.pz = star.z;
            return star;
        };
        const stars: Star[] = [];
        for (let i = 0; i < starCount; i++) stars.push(reset());

        let raf = 0;
        let last = performance.now();
        const loop = (now: number) => {
            const dt = Math.min((now - last) / 1000, 0.1);
            last = now;
            const speed = speedRef ? speedRef.current : defaultSpeed;

            const w = canvas.width;
            const h = canvas.height;
            const cx = w / 2;
            const cy = h / 2;

            // 半透明填充形成拖尾（越低拖尾越长）
            ctx.fillStyle = "rgba(0, 0, 10, 0.32)";
            ctx.fillRect(0, 0, w, h);

            for (const s of stars) {
                s.pz = s.z;
                s.z -= speed * dt;
                if (s.z < 1) { reset(s); continue; }
                const x1 = cx + (s.x * SPREAD / s.z) * cx;
                const y1 = cy + (s.y * SPREAD / s.z) * cy;
                const x2 = cx + (s.x * SPREAD / s.pz) * cx;
                const y2 = cy + (s.y * SPREAD / s.pz) * cy;
                if (x1 < -50 || x1 > w + 50 || y1 < -50 || y1 > h + 50) { reset(s); continue; }
                const t = 1 - s.z / DEPTH;
                const r = Math.round(140 + t * 90);
                const g = Math.round(185 + t * 65);
                ctx.strokeStyle = `rgba(${r}, ${g}, 255, ${0.4 + t * 0.6})`;
                ctx.lineWidth = 0.8 + t * 3.2;
                ctx.beginPath();
                ctx.moveTo(x2, y2);
                ctx.lineTo(x1, y1);
                ctx.stroke();
            }
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", resize);
        };
    }, [defaultSpeed, speedRef, starCount]);

    return (
        <div
            ref={ref}
            style={{
                position: "fixed",
                inset: 0,
                background,
                pointerEvents: "none",
                zIndex: 9999,
                ...style,
            }}
        >
            <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
        </div>
    );
}

export default forwardRef(StarfieldOverlay);
