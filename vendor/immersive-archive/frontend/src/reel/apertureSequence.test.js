import {introDuration,introPose,artworkReveal,smooth01,INTRO_TIMING} from "./apertureTimeline";

describe("The Aperture + Archive Awakens",()=>{
  it("uses a full first visit, short repeat visit and reduced-motion setting",()=>{
    expect(introDuration()).toBe(INTRO_TIMING.first);
    expect(introDuration({returning:true})).toBe(INTRO_TIMING.return);
    expect(introDuration({returning:true,reduced:true})).toBe(INTRO_TIMING.reduced);
    expect(INTRO_TIMING.return).toBeLessThan(INTRO_TIMING.first);
  });
  it("lands on precisely the explorer's first camera frame",()=>{
    const first=introPose(0),last=introPose(1,1,-1);
    expect(first.distance).toBeGreaterThan(last.distance);
    expect(last.distance).toBe(19);
    expect(last.yaw).toBeCloseTo(.6,12);
    expect(last.pitch).toBeCloseTo(.72,12);
    expect(last.iris).toBe(0);
    expect(introPose(1,0,0)).toEqual(last);
  });
  it("grows every artwork to its full gallery scale before handoff",()=>{
    expect(artworkReveal(0,0)).toBe(0);
    expect(artworkReveal(.3,1)).toBe(0);
    expect(artworkReveal(1,0)).toBe(1);
    expect(artworkReveal(1,1)).toBe(1);
  });
  it("keeps the native camera motion continuous and bounded",()=>{
    expect(smooth01(-5)).toBe(0);
    expect(smooth01(5)).toBe(1);
    const frames=Array.from({length:101},(_,i)=>introPose(i/100));
    for(let i=1;i<frames.length;i++){
      expect(frames[i].distance).toBeLessThanOrEqual(frames[i-1].distance);
      expect(frames[i].iris).toBeGreaterThanOrEqual(0);
      expect(frames[i].iris).toBeLessThanOrEqual(1);
    }
    expect(frames[100].distance).toBe(frames[99].distance - (frames[99].distance-19));
  });
});
