"use client";

import {useState,useEffect} from "react";
import {cn} from "@/lib/utils";
import UnicornScene from "unicornstudio-react";

/** Optional cinematic artwork layer supplied by the user.
 * Loaded only on powerful desktops so the 2-second transition never
 * waits for Unicorn Studio network/project availability.
 */
export const useWindowSize=()=>{
  const [windowSize,setWindowSize]=useState({
    width:typeof window!=="undefined"?window.innerWidth:0,
    height:typeof window!=="undefined"?window.innerHeight:0,
  });
  useEffect(()=>{
    const handleResize=()=>setWindowSize({
      width:window.innerWidth,height:window.innerHeight
    });
    window.addEventListener("resize",handleResize,{passive:true});
    handleResize();
    return ()=>window.removeEventListener("resize",handleResize);
  },[]);
  return windowSize;
};

export const Component=()=>{
  const {width,height}=useWindowSize();
  return <div className={cn("flex flex-col items-center","portal-unicorn-host")} aria-hidden="true">
    <UnicornScene production={true} projectId="9tVO0xGS8DIar1DF4Sqc"
      width={width} height={height} scale={.6} dpi={1} fps={30}
      lazyLoad={false} showPlaceholderWhileLoading={false} showPlaceholderOnError={false}
      altText="Camada de luz interactiva do portal" />
  </div>;
};
export default Component;
