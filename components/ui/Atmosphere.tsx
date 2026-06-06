"use client";
import { useEffect, useRef } from "react";

/**
 * Atmosphere — a live electric-blue plume rendered on a single shader plane.
 * Domain-warped fbm rising from the lower centre, deep blue into cyan over ink.
 * ~30fps cap, paused when hidden or off-screen. Raw Three.js, dynamically
 * imported so it never touches SSR.
 */
export function Atmosphere({ className = "", opacity = 0.85 }: { className?: string; opacity?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = ref.current;
    if (!mount) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let renderer: import("three").WebGLRenderer | null = null;
    let disposed = false;
    let visible = true;

    import("three").then((THREE) => {
      if (disposed) return;
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const uniforms = {
        u_time: { value: 0 },
        u_res: { value: new THREE.Vector2(1, 1) },
      };

      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: `void main(){ gl_Position = vec4(position,1.0); }`,
        fragmentShader: `
          precision highp float;
          uniform float u_time; uniform vec2 u_res;
          float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
          float noise(vec2 p){
            vec2 i=floor(p), f=fract(p);
            float a=hash(i), b=hash(i+vec2(1.,0.)), c=hash(i+vec2(0.,1.)), d=hash(i+vec2(1.,1.));
            vec2 u=f*f*(3.-2.*f);
            return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
          }
          float fbm(vec2 p){ float v=0.,a=0.5; for(int i=0;i<6;i++){ v+=a*noise(p); p*=2.02; a*=0.5; } return v; }
          void main(){
            vec2 uv = gl_FragCoord.xy / u_res.xy;
            float asp = u_res.x / u_res.y;
            float t = u_time * 0.16;
            vec2 p = vec2((uv.x-0.5)*asp*2.2, uv.y*2.6);
            vec2 q = vec2(fbm(p + vec2(0.0,-t*1.5)), fbm(p + vec2(5.2,1.3) - vec2(0.0,t)));
            float n = fbm(p + q*1.5 + vec2(0.0,-t*1.3));
            float grad = pow(clamp(1.0-uv.y,0.0,1.0), 1.5);
            float center = 1.0 - smoothstep(0.0, 0.95, abs(uv.x-0.5)*1.25);
            float flame = smoothstep(0.12, 1.0, n) * grad * mix(0.5,1.0,center);
            vec3 ink  = vec3(0.020,0.027,0.046);
            vec3 deep = vec3(0.10,0.40,1.0);
            vec3 cyan = vec3(0.45,0.80,1.0);
            vec3 col = mix(ink, deep, clamp(flame*1.4,0.0,1.0));
            col += cyan * pow(flame, 2.3) * 1.1;
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      });

      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
      scene.add(quad);

      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      mount.appendChild(renderer.domElement);

      const resize = () => {
        const w = mount.clientWidth || window.innerWidth;
        const h = mount.clientHeight || window.innerHeight;
        renderer!.setSize(w, h, false);
        uniforms.u_res.value.set(w * renderer!.getPixelRatio(), h * renderer!.getPixelRatio());
      };
      resize();
      window.addEventListener("resize", resize);

      const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0 });
      io.observe(mount);

      const start = performance.now();
      let last = 0;
      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        if (!visible || document.hidden) return;
        if (now - last < 33) return;
        last = now;
        uniforms.u_time.value = (now - start) / 1000;
        renderer!.render(scene, camera);
      };
      raf = requestAnimationFrame(loop);

      return () => {
        window.removeEventListener("resize", resize);
        io.disconnect();
      };
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (renderer) { renderer.dispose(); renderer.domElement.remove(); }
    };
  }, []);

  return <div ref={ref} aria-hidden className={`absolute inset-0 ${className}`} style={{ opacity }} />;
}
