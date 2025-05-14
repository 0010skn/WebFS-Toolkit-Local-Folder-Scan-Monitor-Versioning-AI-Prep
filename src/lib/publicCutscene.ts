export async function slideInOut(direction = "forward") {
  const outTransform =
    direction === "forward" ? "translateX(-100%)" : "translateX(100%)";
  const inTransformStart =
    direction === "forward" ? "translateX(100%)" : "translateX(-100%)";

  const easing = "cubic-bezier(0.4, 0.0, 0.2, 1)";
  const duration = 250;

  document.documentElement.animate(
    [{ transform: "translateX(0)" }, { transform: outTransform }],
    {
      duration: duration,
      easing: easing,
      fill: "forwards",
      pseudoElement: "::view-transition-old(root)",
    }
  );

  document.documentElement.animate(
    [{ transform: inTransformStart }, { transform: "translateX(0)" }],
    {
      duration: duration,
      easing: easing,
      fill: "forwards",
      pseudoElement: "::view-transition-new(root)",
    }
  );
}
