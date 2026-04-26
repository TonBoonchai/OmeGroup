import { useState, useEffect } from "react";

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

export function useIsPortrait() {
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  useEffect(() => {
    const handler = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isPortrait;
}