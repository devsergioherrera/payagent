"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { MascotState } from "./mascot";

// Everything the brand may want to change lives here.
const CONFIG = {
  body: { color: "#7a5cf0", width: 1.5, height: 1.4, depth: 1.3, radius: 0.55, roughness: 0.42 },
  eye: { color: "#1b1433", glint: "#ffffff", spacing: 0.34, y: 0.1, width: 0.15, height: 0.24, z: 0.62 },
  tint: { paid: "#35b36b", escalated: "#e3a02b", held: "#e5484d", mix: 0.75 },
  light: { key: 2.4, fill: 0.9, ambient: 1.1 },
  camera: { fov: 30, distance: 5.4 },
};

type Tint = keyof typeof CONFIG.tint;
const TINTED: Partial<Record<MascotState, Tint>> = { paid: "paid", escalated: "escalated", held: "held" };

interface Props { state: MascotState; size: number; onReady: () => void }

export default function MascotCanvas({ state, size, onReady }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const started = useRef(0);

  useEffect(() => {
    stateRef.current = state;
    started.current = performance.now();
  }, [state]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.1, 50);
    camera.position.set(0, 0.1, CONFIG.camera.distance);
    scene.add(new THREE.AmbientLight("#ffffff", CONFIG.light.ambient));
    const key = new THREE.DirectionalLight("#ffffff", CONFIG.light.key);
    key.position.set(2, 3, 4);
    const fill = new THREE.DirectionalLight("#b8a8ff", CONFIG.light.fill);
    fill.position.set(-3, -1, 2);
    scene.add(key, fill);

    const b = CONFIG.body;
    const bodyMat = new THREE.MeshStandardMaterial({ color: b.color, roughness: b.roughness });
    const body = new THREE.Mesh(new RoundedBoxGeometry(b.width, b.height, b.depth, 6, b.radius), bodyMat);
    const rig = new THREE.Group(); // moves as one: body plus face
    rig.add(body);

    const e = CONFIG.eye;
    const eyeMat = new THREE.MeshStandardMaterial({ color: e.color, roughness: 0.3 });
    const glintMat = new THREE.MeshBasicMaterial({ color: e.glint });
    const eyes = [-1, 1].map((side) => {
      const g = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), eyeMat);
      ball.scale.set(e.width, e.height, 0.08);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), glintMat);
      glint.position.set(0.03, 0.07, 0.08);
      g.add(ball, glint);
      g.position.set(side * e.spacing, e.y, e.z);
      rig.add(g);
      return g;
    });
    scene.add(rig);

    const base = new THREE.Color(b.color);
    const tmp = new THREE.Color();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let ticking = false;

    const frame = (now: number) => {
      const t = now / 1000;
      const s = stateRef.current;
      const since = (now - started.current) / 1000;
      let y = 0, ry = 0, rz = 0, ex = 0, ey = 0, tint = 0;
      const tintKey = TINTED[s];

      if (!reduced) {
        if (s === "idle") {
          y = Math.sin(t * 1.1) * 0.06;
        } else if (s === "thinking") {
          y = Math.sin(t * 2.2) * 0.04;
          ry = Math.sin(t * 1.3) * 0.12;
          ex = Math.sin(t * 1.7) * 0.07;
          ey = Math.sin(t * 2.3 + 1) * 0.04;
        } else if (s === "paid") {
          y = Math.abs(Math.sin(Math.min(since, 1.2) * 5)) * 0.22 * (since < 1.2 ? 1 : 0);
          tint = 0.5 + 0.5 * Math.sin(t * 4);
        } else if (s === "escalated") {
          rz = -0.16;
          tint = 1;
        } else if (s === "held") {
          ry = since < 1 ? Math.sin(since * 40) * 0.1 * (1 - since) : 0;
          tint = 1;
        }
      } else {
        tint = tintKey ? 1 : 0;
        if (s === "escalated") rz = -0.16;
      }

      rig.position.y = y;
      rig.rotation.set(0, ry, rz);

      // Blink about every 3.6 s, except while thinking.
      const phase = (t % 3.6);
      const blink = !reduced && phase < 0.14 ? 1 - Math.sin((phase / 0.14) * Math.PI) : 1;
      eyes.forEach((g) => {
        g.scale.y = Math.max(0.12, s === "thinking" ? 1 : blink);
        g.position.x = (g.position.x < 0 ? -e.spacing : e.spacing) + ex;
        g.position.y = e.y + ey;
      });

      if (tintKey) tmp.copy(base).lerp(new THREE.Color(CONFIG.tint[tintKey]), CONFIG.tint.mix * (0.5 + 0.5 * tint));
      else tmp.copy(base);
      bodyMat.color.copy(tmp);
      renderer.render(scene, camera);
    };

    const loop = (now: number) => {
      frame(now);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (ticking) return;
      ticking = true;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      ticking = false;
      cancelAnimationFrame(raf);
    };

    frame(performance.now());
    onReady();

    // Reduced motion: static pose, redrawn only when the state changes.
    let lastState = stateRef.current;
    let poll = 0;
    if (reduced) {
      poll = window.setInterval(() => {
        if (stateRef.current !== lastState) {
          lastState = stateRef.current;
          frame(performance.now());
        }
      }, 300);
    } else {
      const onVis = () => (document.visibilityState === "visible" ? start() : stop());
      document.addEventListener("visibilitychange", onVis);
      start();
      return () => {
        document.removeEventListener("visibilitychange", onVis);
        stop();
        dispose();
      };
    }
    return () => {
      clearInterval(poll);
      dispose();
    };

    function dispose() {
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      [bodyMat, eyeMat, glintMat].forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  return <div ref={host} className="size-full [&>canvas]:size-full" />;
}
