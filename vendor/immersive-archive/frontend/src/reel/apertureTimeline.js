export const INTRO_TIMING = Object.freeze({ first: 3.25, return: 1.35, reduced: 0.12 });
export const clamp01 = (value) => Math.max(0, Math.min(1, value));
export function smooth01(value) {
  const t = clamp01(value);
  return t*t*t*(t*(t*6-15)+10);
}
export function introDuration({returning=false,reduced=false}={}) {
  return reduced ? INTRO_TIMING.reduced : returning ? INTRO_TIMING.return : INTRO_TIMING.first;
}
/** The final pose is exactly the explorer's resting 19-unit home camera. */
export function introPose(progress, pointerX=0, pointerY=0) {
  const p=clamp01(progress), arrival=smooth01(p);
  const influence=(1-smooth01(p/.85))*.028;
  return {
    distance:19+21*(1-arrival),
    yaw:.6+Math.max(-1,Math.min(1,pointerX))*influence,
    pitch:.72+Math.max(-1,Math.min(1,pointerY))*influence*.7,
    iris:p>=1 ? 0 : Math.max(0,(1-smooth01((p-.68)/.32))*smooth01(p/.18)),
  };
}
export function artworkReveal(progress,variation=0) {
  return smooth01((clamp01(progress)-.24-clamp01(variation)*.13)/.58);
}
