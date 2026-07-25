import { useEffect, useRef } from "react";
import type { PlayerAnimation, SkinViewer } from "skinview3d";
import type { MinecraftSkinModel } from "../core/skin";

export type MinecraftSkinAnimation = "none" | "idle" | "walk" | "run";

type Skinview3dModule = typeof import("skinview3d");

function createAnimation(
  skinview3d: Skinview3dModule,
  animation: MinecraftSkinAnimation,
): PlayerAnimation | null {
  switch (animation) {
    case "idle":
      return new skinview3d.IdleAnimation();
    case "walk":
      return new skinview3d.WalkingAnimation();
    case "run":
      return new skinview3d.RunningAnimation();
    default:
      return null;
  }
}

export default function MinecraftSkinViewer(props: {
  animation: MinecraftSkinAnimation;
  autoRotate: boolean;
  capeUrl?: string;
  model: MinecraftSkinModel;
  onCapeError: (message: string) => void;
  onError: (message: string) => void;
  resetVersion: number;
  showCape: boolean;
  skinUrl: string;
  zoom: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const moduleRef = useRef<Skinview3dModule | null>(null);
  const settingsRef = useRef({
    animation: props.animation,
    autoRotate: props.autoRotate,
    showCape: props.showCape,
    zoom: props.zoom,
  });
  const viewerRef = useRef<SkinViewer | null>(null);
  settingsRef.current = {
    animation: props.animation,
    autoRotate: props.autoRotate,
    showCape: props.showCape,
    zoom: props.zoom,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let viewer: SkinViewer | null = null;

    const setupViewer = async () => {
      try {
        const skinview3d = await import("skinview3d");
        if (cancelled) return;

        const initialWidth = Math.max(1, Math.round(container.clientWidth));
        const initialHeight = Math.max(1, Math.round(container.clientHeight));
        const settings = settingsRef.current;
        viewer = new skinview3d.SkinViewer({
          canvas,
          enableControls: true,
          height: initialHeight,
          pixelRatio: Math.min(window.devicePixelRatio, 2),
          width: initialWidth,
          zoom: settings.zoom,
        });
        moduleRef.current = skinview3d;
        viewerRef.current = viewer;
        viewer.autoRotate = settings.autoRotate;
        viewer.autoRotateSpeed = 0.8;
        viewer.animation = createAnimation(skinview3d, settings.animation);
        viewer.controls.enablePan = false;
        viewer.controls.enableZoom = false;

        const resize = (width: number, height: number) => {
          if (!viewer || width <= 0 || height <= 0) return;
          viewer.setSize(Math.round(width), Math.round(height));
        };

        resizeObserver = new ResizeObserver(([entry]) => {
          if (entry) {
            resize(entry.contentRect.width, entry.contentRect.height);
          }
        });
        resizeObserver.observe(container);

        await viewer.loadSkin(props.skinUrl, { model: props.model });
        if (cancelled) return;

        if (props.capeUrl) {
          try {
            await viewer.loadCape(props.capeUrl, {
              makeVisible: settingsRef.current.showCape,
            });
          } catch (err) {
            if (!cancelled) {
              props.onCapeError(`Unable to render the Minecraft cape: ${err}`);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          props.onError(`Unable to render the Minecraft skin: ${err}`);
        }
      }
    };

    void setupViewer();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      viewer?.dispose();
      if (viewerRef.current === viewer) {
        viewerRef.current = null;
        moduleRef.current = null;
      }
    };
  }, [
    props.capeUrl,
    props.model,
    props.onCapeError,
    props.onError,
    props.skinUrl,
  ]);

  useEffect(() => {
    if (viewerRef.current) {
      viewerRef.current.autoRotate = props.autoRotate;
    }
  }, [props.autoRotate]);

  useEffect(() => {
    if (viewerRef.current) {
      viewerRef.current.zoom = props.zoom;
    }
  }, [props.zoom]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const skinview3d = moduleRef.current;
    if (viewer && skinview3d) {
      viewer.animation = createAnimation(skinview3d, props.animation);
    }
  }, [props.animation]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (viewer) {
      viewer.playerObject.backEquipment =
        props.showCape && props.capeUrl ? "cape" : null;
    }
  }, [props.capeUrl, props.showCape]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (viewer && props.resetVersion > 0) {
      viewer.zoom = props.zoom;
      viewer.playerWrapper.rotation.set(0, 0, 0);
      viewer.resetCameraPose();
    }
  }, [props.resetVersion, props.zoom]);

  return (
    <canvas
      aria-label="Interactive 3D Minecraft skin preview"
      className="block h-full w-full cursor-grab active:cursor-grabbing"
      ref={canvasRef}
    />
  );
}
