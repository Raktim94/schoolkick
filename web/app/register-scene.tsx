'use client';
import { useEffect, useRef, useState } from 'react';

export default function RegisterScene(){
 const host=useRef<HTMLDivElement>(null); const [done,setDone]=useState(false); const [error,setError]=useState(false);
 useEffect(()=>()=>{const renderer=(host.current as any)?.renderer;if(renderer){renderer.dispose();host.current!.replaceChildren();}},[]);
 const reveal=async()=>{setDone(true);if(error||!host.current||(host.current as any).renderer)return;
  try {
   // @ts-ignore -- Three.js runtime is loaded only after the visitor requests the illustration.
   const THREE=await import('three'); const el=host.current; if(!el)return;
   const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'}); (el as any).renderer=renderer; renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));el.prepend(renderer.domElement);
   const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.1,100);camera.position.set(0,0,7);
   const sheet=new THREE.Mesh(new THREE.BoxGeometry(4.4,2.9,.12),new THREE.MeshStandardMaterial({color:'#fbf8f1',roughness:.92}));scene.add(sheet);
   const dot=new THREE.Mesh(new THREE.SphereGeometry(.14,18,16),new THREE.MeshStandardMaterial({color:'#ad5e37'}));dot.position.set(-1.45,-.55,.12);scene.add(dot);
   for(let i=0;i<5;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(3.4,.018,.02),new THREE.MeshBasicMaterial({color:'#d5cec0'}));m.position.set(0,.8-i*.34,.09);scene.add(m);}
   const resize=()=>{const b=el.getBoundingClientRect();if(!b.width)return;renderer.setSize(b.width,b.height,false);camera.aspect=b.width/b.height;camera.updateProjectionMatrix();renderer.render(scene,camera);}; const observer=new ResizeObserver(resize);observer.observe(el);resize();
   if(matchMedia('(prefers-reduced-motion: reduce)').matches){dot.scale.setScalar(1.7);renderer.render(scene,camera);return;}
   const start=performance.now();const tick=(t:number)=>{const f=Math.min(1,(t-start)/500);dot.scale.setScalar(1+.7*Math.sin(Math.PI*f));renderer.render(scene,camera);if(f<1)requestAnimationFrame(tick);};requestAnimationFrame(tick);
  } catch {setError(true);}
 };
 return <><figure className="register-scene" ref={host}><div className="fallback-register"><small>CLASS 5A · NOV 12</small><div><span>Chitra D.</span><b>Present</b></div><div className="changed"><span>Chitra D.</span><b>Late</b></div></div><figcaption>Illustrative register · fictional names</figcaption></figure><button className="btn ghost" onClick={reveal}>Show the correction</button><p className="scene-status" role="status" aria-live="polite">{error?'The illustration could not load. The correction history is shown above.':done?'Correction saved: Present changed to Late. The original entry remains in history.':'Select “Show the correction” to see the saved change.'}</p></>;
}
