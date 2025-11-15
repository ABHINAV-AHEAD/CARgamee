// main.js - Open World Car Game (Pro)
// Requires three.min.js included before this script (index.html)


if (typeof THREE === 'undefined') {
document.body.innerHTML = '<div style="color:#fff;padding:20px">Three.js failed to load. Please check your internet connection or CDN.</div>';
throw new Error('Three.js not loaded');
}


const STATE = {
scene: null, camera: null, renderer: null, clock: new THREE.Clock(), player: null, npcs: [], roadGroup: null, keys: {}, cameraMode: 'chase'
};


const SETTINGS = {
WORLD_SIZE: 1600,
CAR: { maxSpeedKmh: 180, accelKmh: 60, brakeKmh: 140, reverseKmh: 40, friction: 0.986, steerAngle: Math.PI/4 },
NPC_COUNT: 22, ROAD_WIDTH: 8
};


function kmhToMs(v){return v/3.6;} function msToKmh(v){return Math.round(v*3.6);} function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function lerp(a,b,t){return a+(b-a)*t;}


function init(){
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x87ceeb); STATE.scene=scene;
const renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setSize(window.innerWidth,window.innerHeight); renderer.setPixelRatio(window.devicePixelRatio?Math.min(2,window.devicePixelRatio):1); renderer.shadowMap.enabled=true; document.body.appendChild(renderer.domElement); STATE.renderer=renderer;
const camera=new THREE.PerspectiveCamera(70,window.innerWidth/window.innerHeight,0.1,10000); camera.position.set(0,6,-12); STATE.camera=camera;


const hemi=new THREE.HemisphereLight(0xffffff,0x444444,0.9); hemi.position.set(0,200,0); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,0.95); sun.position.set(-300,350,-120); sun.castShadow=true; scene.add(sun);


createGround(); createRoadNetwork(); createCityBlocks(); createPlayerCar(); for(let i=0;i<SETTINGS.NPC_COUNT;i++) createNPC(i);
setupInput(); createMobileUI(); window.addEventListener('resize', onWindowResize);
animate();
}


function onWindowResize(){ const w=window.innerWidth,h=window.innerHeight; STATE.camera.aspect=w/h; STATE.camera.updateProjectionMatrix(); STATE.renderer.setSize(w,h); }


function createGround(){
const size=SETTINGS.WORLD_SIZE; const geo=new THREE.PlaneGeometry(size*2,size*2,200,200); const mat=new THREE.MeshStandardMaterial({color:0x7fb86b, roughness:1}); const ground=new THREE.Mesh(geo,mat); ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; STATE.scene.add(ground);
const pos=geo.attributes.position.array; for(let i=0;i<pos.length;i+=3){const x=pos[i],z=pos[i+2],d=Math.sqrt(x*x+z*z); const height=Math.sin(x*0.002)*12 + Math.cos(z*0.002)*12 - d*0.002; pos[i+1]=height * (Math.random()*0.5+0.6);} geo.attributes.position.needsUpdate=true; geo.computeVertexNormals();
}


function createRoadNetwork(){
const rg=new THREE.Group(); STATE.roadGroup=rg; STATE.scene.add(rg);
function makeRoad(pts,width){const positions=[]; for(let i=0;i<pts.length;i++){const p=pts[i]; const next=pts[Math.min(pts.length-1,i+1)]; const dirx=next.x-p.x, dirz=next.z-p.z; const len=Math.sqrt(dirx*dirx+dirz*dirz)||1; const nx=-dirz/len, nz=dirx/len; const half=width/2; const lx=p.x+nx*half, lz=p.z+nz*half, rx=p.x-nx*half, rz=p.z-nz*half; positions.push(lx,p.y+0.02,lz, rx,p.y+0.02,rz);} const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(positions),3)); const idx=[]; for(let i=0;i<pts.length-1;i++){const a=i*2,b=a+1,c=a+2,d=a+3; idx.push(a,c,b); idx.push(b,c,d);} geo.setIndex(idx); geo.computeVertexNormals(); const mat=new THREE.MeshStandardMaterial({color:0x222222}); const mesh=new THREE.Mesh(geo,mat); mesh.receiveShadow=true; return mesh; }


[120,320,720].forEach(radius=>{ const pts=[]; const segments=180; for(let i=0;i<=segments;i++){const a=(i/segments)*Math.PI*2; pts.push({x:Math.cos(a)*radius + (Math.random()-0.5)*6,y:0,z:Math.sin(a)*radius + (Math.random()-0.5)*6});} rg.add(makeRoad(pts,SETTINGS.ROAD_WIDTH)); });
for(let s=0;s<16;s++){ const a=(s/16)*Math.PI*2; const pts=[]; for(let r=0;r<=4;r++){const rad=lerp(40,900,r/4); pts.push({x:Math.cos(a)*rad + (Math.random()-0.5)*8,y:0,z:Math.sin(a)*rad + (Math.random()-0.5)*8}); } rg.add(makeRoad(pts,SETTINGS.ROAD_WIDTH)); }
}


function createCityBlocks(){ const group=new THREE.Group(); for(let i=0;i<140;i++){ const a=(i/140)*Math.PI*2; const rad=260 + Math.random()*600; const x=Math.cos(a)*rad + (Math.random()-0.5)*40; const z=Math.sin(a)*rad + (Math.random()-0.5)*40; const floors=Math.floor(Math.random()*8)+1; const h=floors*4 + Math.random()*6; const geo=new THREE.BoxGeometry(12,h,12); const mat=new THREE.MeshStandardMaterial({color:0x9aa9b0}); const b=new THREE.Mesh(geo,mat); b.position.set(x,h/2,z); b.castShadow=true; group.add(b); } STATE.scene.add(group); }


function createCarMesh(color=0xff3300){ const group=new THREE.Group(); const body=new THREE.BoxGeometry(4,1.4,6); const m=new THREE.MeshStandardMaterial({color,metalness:0.2,roughness:0.5}); const main=new THREE.Mesh(body,m); main.position.set(0,1.1,0); main.castShadow=true; group.add(main); const wheelGeo=new THREE.CylinderGeometry(0.6,0.6,0.5,16); const wheelMat=new THREE.MeshStandardMaterial({color:0x111111}); function mk(x,y,z){const w=new THREE.Mesh(wheelGeo,wheelMat);w.rotation.z=Math.PI/2;w.position.set(x,y,z);w.castShadow=true;return w;} group.add(mk(-1.5,0.45,2.3)); group.add(mk(1.5,0.45,2.3)); group.add(mk(-1.5,0.45,-2.3)); group.add(mk(1.5,0.45,-2.3)); const glass=new THREE.Mesh(new THREE.BoxGeometry(3.2,0.6,2.2), new THREE.MeshStandardMaterial({color:0x55aaff, transparent:true, opacity:0.75})); glass.position.set(0,1.6,0); group.add(glass); return group; }


function createPlayerCar(){ const mesh=createCarMesh(0xff3355); STATE.scene.add(mesh); const phys={ position:new THREE.Vector3(0,0,0), heading:0, speed:0, throttle:0, braking:0, steer:0, handbrake:false }; STATE.player={mesh,phys}; phys.position.set(0,sampleHeightAt(0,0)+0.6,0); mesh.position.copy(phys.position); }


function createNPC(i){ const mesh=createCarMesh(Math.random()*0x666666 + 0x222222); const angle=Math.random()*Math.PI*2; const rad=180 + Math.random()*600; mesh.position.set(Math.cos(angle)*rad,0,Math.sin(angle)*rad); STATE.scene.add(mesh); const npc={ mesh, heading: angle + Math.PI/2, speed: kmhToMs(30 + Math.random()*50), phase: Math.random()*1000 }; npc.mesh.position.y = sampleHeightAt(npc.mesh.position.x, npc.mesh.position.z) + 0.6; STATE.npcs.push(npc); }


function setupInput(){ window.addEventListener('keydown', e=>{ STATE.keys[e.key.toLowerCase()] = true; if(e.key==='c') toggleCamera(); }); window.addEventListener('keyup', e=>{ STATE.keys[e.key.toLowerCase()] = false; }); window.addEventListener('keydown', function(e){ if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].indexOf(e.key) > -1) e.preventDefault(); }, false); }
function createMobileUI(){ const controls=document.getElementById('controls'); const isTouch='ontouchstart' in window || navigator.maxTouchPoints>0; if(!isTouch) return; controls.innerHTML=''; ['←','↑','↓','→'].forEach(txt=>{ const d=document.createElement('div'); d.className='btn'; d.innerText=txt; if(txt==='↑'){ d.addEventListener('touchstart', ()=>STATE.keys['w']=true); d.addEventListener('touchend', ()=>STATE.keys['w']=false); } if(txt==='↓'){ d.addEventListener('touchstart', ()=>STATE.keys['s']=true); d.addEventListener('touchend', ()=>STATE.keys['s']=false); } if(txt==='←'){ d.addEventListener('touchstart', ()=>STATE.keys['a']=true); d.addEventListener('touchend', ()=>STATE.keys['a']=false); } if(txt==='→'){ d.addEventListener('touchstart', ()=>STATE.keys['d']=true); d.addEventListener('touchend', ()=>STATE.keys['d']=false); } controls.appendChi