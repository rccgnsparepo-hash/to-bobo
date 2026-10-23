import { useEffect, useRef } from "react";

/**
 * Full-bleed animated liquid gradient background using a single WebGL2 fragment shader.
 * - Mouse-reactive distortion
 * - Auto-disables on prefers-reduced-motion or when WebGL2 is unavailable
 * - Pauses when off-screen (IntersectionObserver)
 */
export function GradientMesh({
  className = "",
  colorA = [0.77, 0.91, 0.39], // lime (snap)
  colorB = [0.05, 0.05, 0.06], // near-black
  colorC = [0.42, 0.85, 0.55], // acid green
  intensity = 1,
}: {
  className?: string;
  colorA?: [number, number, number];
  colorB?: [number, number, number];
  colorC?: [number, number, number];
  intensity?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gl = canvas.getContext("webgl2", { antialias: false, premultipliedAlpha: true, alpha: true });
    if (!gl) return; // graceful CSS fallback

    const vs = `#version 300 es
      in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
    const fs = `#version 300 es
      precision highp float;
      out vec4 o;
      uniform vec2 uRes; uniform float uT; uniform vec2 uM;
      uniform vec3 cA; uniform vec3 cB; uniform vec3 cC; uniform float uI;

      // hash / noise
      float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
      float noise(vec2 p){ vec2 i=floor(p),f=fract(p); float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
        vec2 u=f*f*(3.-2.*f); return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y; }
      float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.02; a*=.5; } return v; }

      void main(){
        vec2 uv = (gl_FragCoord.xy - .5*uRes)/min(uRes.x,uRes.y);
        vec2 m  = (uM - .5*uRes)/min(uRes.x,uRes.y);
        float t = uT*0.15;

        // liquid distortion field
        vec2 q = uv + 0.35*vec2(fbm(uv*1.4 + t), fbm(uv*1.4 - t + 3.1));
        // mouse ripple
        float md = length(uv - m);
        q += 0.12*uI*vec2(cos(md*8. - uT*1.6), sin(md*8. - uT*1.6))*exp(-md*2.2);

        float n = fbm(q*1.8 + t*.6);
        float g = smoothstep(.2,.85, n);

        vec3 col = mix(cB, cC, g);
        col = mix(col, cA, smoothstep(.55,.95, n + .15*sin(uT*.4 + uv.x*2.)));

        // vignette
        float vg = smoothstep(1.2, .2, length(uv));
        col *= vg;

        // subtle grain
        col += (hash(gl_FragCoord.xy + uT)-.5)*0.03;

        o = vec4(col, 1.0);
      }`;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uT = gl.getUniformLocation(prog, "uT");
    const uM = gl.getUniformLocation(prog, "uM");
    const cA = gl.getUniformLocation(prog, "cA");
    const cB = gl.getUniformLocation(prog, "cB");
    const cC = gl.getUniformLocation(prog, "cC");
    const uI = gl.getUniformLocation(prog, "uI");
    gl.uniform3f(cA, colorA[0], colorA[1], colorA[2]);
    gl.uniform3f(cB, colorB[0], colorB[1], colorB[2]);
    gl.uniform3f(cC, colorC[0], colorC[1], colorC[2]);
    gl.uniform1f(uI, intensity);

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.tx = (e.clientX - r.left) * devicePixelRatio;
      mouse.ty = (r.height - (e.clientY - r.top)) * devicePixelRatio;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const resize = () => {
      const dpr = Math.min(devicePixelRatio, 1.75);
      const w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
        gl.uniform2f(uRes, w, h);
        mouse.x = w * 0.5; mouse.y = h * 0.6; mouse.tx = mouse.x; mouse.ty = mouse.y;
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.01 });
    io.observe(canvas);

    let raf = 0;
    const start = performance.now();
    const loop = () => {
      if (!visible || reduce) { raf = requestAnimationFrame(loop); return; }
      mouse.x += (mouse.tx - mouse.x) * 0.08;
      mouse.y += (mouse.ty - mouse.y) * 0.08;
      gl.uniform2f(uM, mouse.x, mouse.y);
      gl.uniform1f(uT, (performance.now() - start) * 0.001);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      ro.disconnect(); io.disconnect();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [colorA, colorB, colorC, intensity]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`absolute inset-0 w-full h-full block ${className}`}
      style={{ background: "radial-gradient(120% 80% at 30% 20%, #1a1f14 0%, #050506 60%, #000 100%)" }}
    />
  );
}