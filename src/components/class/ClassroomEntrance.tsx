import { WorldEntrance, type WorldEntranceProps } from "../world/WorldEntrance";

export function ClassroomEntrance(props: WorldEntranceProps) {
  return (
    <WorldEntrance
      title={props.title || "Flick World"}
      subtitle={props.subtitle || "Step into the live universe — audio spaces, real-time broadcasts, and social moments."}
      badge={props.badge || "Flick World"}
      buttonText={props.buttonText || "Enter the world"}
      onEnter={props.onEnter}
      onSkip={props.onSkip}
      isTransitioning={props.isTransitioning}
    />
  );
}
