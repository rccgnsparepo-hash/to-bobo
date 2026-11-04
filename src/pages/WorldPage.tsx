import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { WorldEntrance } from "@/components/world/WorldEntrance";
import { triggerLightHaptic, triggerSuccessHaptic } from "@/lib/haptics";

export default function WorldPage() {
  const navigate = useNavigate();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [clipCoords, setClipCoords] = useState<{ x: number; y: number } | null>(null);

  const handleEnter = (coords?: { x: number; y: number }) => {
    void triggerLightHaptic();
    setIsTransitioning(true);
    if (coords) {
      setClipCoords(coords);
    }
    setTimeout(() => {
      void triggerSuccessHaptic();
      navigate("/space");
    }, 1400);
  };

  const handleSkip = () => {
    void triggerLightHaptic();
    navigate("/space");
  };

  return (
    <div className="relative min-h-screen bg-[#0a0a0a]">
      <WorldEntrance
        title="Flick World"
        subtitle="Step into the live universe — audio spaces, real-time broadcasts, and social moments."
        badge="Flick Social Space"
        buttonText="Enter the world"
        onEnter={handleEnter}
        onSkip={handleSkip}
        isTransitioning={isTransitioning}
      />
    </div>
  );
}
