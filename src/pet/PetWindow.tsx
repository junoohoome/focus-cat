import { useState, useEffect, useCallback, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen, emit } from "@tauri-apps/api/event";
import CatIdle from "./components/CatIdle";
import CatRunning from "./components/CatRunning";
import CatPaused from "./components/CatPaused";
import CatBreak from "./components/CatBreak";
import "./styles.css";

type PetState = "idle" | "running" | "paused" | "break";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function PetWindow() {
  const [state, setState] = useState<PetState>("idle");
  const [remaining, setRemaining] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Listen for timer events from main window
  useEffect(() => {
    const unlistenState = listen<{ state: PetState }>("timer-state", (event) => {
      setState(event.payload.state);
    });

    const unlistenTick = listen<{ remaining: number }>("timer-tick", (event) => {
      setRemaining(event.payload.remaining);
    });

    return () => {
      unlistenState.then((fn) => fn());
      unlistenTick.then((fn) => fn());
    };
  }, []);

  // Click-through: ignore cursor events when mouse is outside the cat area
  const handleMouseEnter = useCallback(async () => {
    await getCurrentWindow().setIgnoreCursorEvents(false);
  }, []);

  const handleMouseLeave = useCallback(async () => {
    await getCurrentWindow().setIgnoreCursorEvents(true);
  }, []);

  // Click cat → focus main window
  const handleClick = useCallback(async () => {
    await emit("pet-clicked");
  }, []);

  // Drag: start dragging on mousedown, save position on mouseup
  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    if (e.button === 0) {
      await getCurrentWindow().startDragging();
    }
  }, []);

  const handleMouseUp = useCallback(async () => {
    try {
      const position = await getCurrentWindow().innerPosition();
      await emit("pet-dragged", { x: position.x, y: position.y });
    } catch {
      // Ignore errors if window position can't be read
    }
  }, []);

  // Render correct cat component
  const renderCat = () => {
    switch (state) {
      case "running":
        return <CatRunning />;
      case "paused":
        return <CatPaused />;
      case "break":
        return <CatBreak />;
      default:
        return <CatIdle />;
    }
  };

  const showTimer = state !== "idle";

  return (
    <div
      ref={containerRef}
      className="pet-container"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
    >
      {renderCat()}
      {showTimer && <span className="pet-timer">{formatTime(remaining)}</span>}
    </div>
  );
}
