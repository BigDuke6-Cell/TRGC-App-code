// FULL CODEBASE: Tiger Roots Green Collective App v10

// FILE: tailwind.config.js
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};

// FILE: next.config.js
const withPWA = require("next-pwa")({ dest: "public", disable: process.env.NODE_ENV === "development" });
module.exports = withPWA({ reactStrictMode: true, images: { domains: ["firebasestorage.googleapis.com"] } });

// FILE: public/manifest.json
{
  "name": "Tiger Roots Green Collective",
  "short_name": "TigerRoots",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#F0FDF4",
  "theme_color": "#059669",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}

// FILE: lib/firebase.ts
import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
const cfg = { apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID };
export const app = getApps().length ? getApps()[0] : initializeApp(cfg);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// FILE: lib/store.ts
import { create } from "zustand";
export const useUI = create((set) => ({ sidebarOpen: false, toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })) }));

// FILE: components/Layout.tsx
'use client';
import { Bars3Icon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUI } from "../lib/store";
import ChannelList from "./ChannelList";
export default function Layout({ children }) {
  const { sidebarOpen, toggleSidebar } = useUI();
  const pathname = usePathname();
  const nav = ["/dashboard","/map","/gallery","/profile","/stats/trees"];
  return (<div className="flex h-screen overflow-hidden">
    <aside className={`${sidebarOpen?'translate-x-0':'-translate-x-full'} fixed z-20 h-full w-64 bg-white p-4 shadow transition-transform md:static md:translate-x-0`}>
      <h2 className="mb-4 text-xl font-bold">Tiger Roots</h2><ChannelList/></aside>
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-4 bg-emerald-600 p-2 text-white md:hidden">
        <button onClick={toggleSidebar}><Bars3Icon className="h-6 w-6"/></button>
        <span className="font-semibold">{nav.find(n=>pathname.startsWith(n))||'Tiger Roots'}</span>
      </header>
      <main className="flex-1 overflow-y-auto bg-gray-50 p-4">{children}</main>
      <nav className="flex justify-around bg-white p-2 shadow md:hidden">
        {nav.map(n=><Link key={n} href={n} className={`${pathname.startsWith(n)?'text-emerald-600':'text-gray-500'} text-sm`}>{n.replace('/','')}</Link>)}
      </nav>
    </div>
  </div>);
}

// FILE: components/ChannelList.tsx
'use client';
import Link from "next/link";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useEffect, useState } from "react";
export default function ChannelList() {
  const [channels, setChannels] = useState([]);
  useEffect(()=>{const q=query(collection(db,'channels'),orderBy('created'));return onSnapshot(q,s=>setChannels(s.docs.map(d=>d.data())));},[]);
  return (<div className="space-y-2 text-sm">{channels.map((c,i)=> <Link key={i} href={`/chat/${c.name}`} className="block rounded px-2 py-1 hover:bg-gray-100">{c.type==='announce'?'📣': '#'}{c.name}</Link>)}</div>);
}

// FILE: components/ChatRoom.tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { addDoc, collection, orderBy, onSnapshot, query, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
export default function ChatRoom({ channel }) {
  const [user] = useAuthState(auth); const [messages,set]=useState([]); const [text,setText]=useState(''); const bottom=useRef(null);
  useEffect(()=>{const q=query(collection(db,'channels',channel,'messages'),orderBy('timestamp'));return onSnapshot(q,s=>{set(s.docs.map(d=>d.data()));bottom.current?.scrollIntoView({behavior:'smooth'});});},[channel]);
  async function send(){if(!text)return;await addDoc(collection(db,'channels',channel,'messages'),{uid:user.uid,displayName:user.displayName||user.email,content:text,timestamp:serverTimestamp()});setText('');}
  function renderMessage(c){return c.split(/(@[\w]+)/g).map((p,i)=>p.startsWith('@')?<span key={i} className="text-emerald-700 font-semibold">{p}</span>:<span key={i}>{p}</span>);}
  return (<div className="flex h-screen flex-col"><div className="flex-1 overflow-y-auto p-4">{messages.map((m,i)=><p key={i} className="mb-1 text-sm"><span className="font-bold">{m.displayName}:</span> {renderMessage(m.content)}</p>)}<div ref={bottom}/></div><div className="flex p-2"><input value={text} onChange={e=>setText(e.target.value)} className="flex-1 rounded border p-2" placeholder="Message…"/><button onClick={send} className="ml-2 rounded bg-emerald-600 px-4 py-2 font-bold text-white">Send</button></div></div>);
}

// FILE: components/StatCards.tsx
'use client';
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
export function StatCards({ uid }) {
  const [global,setG]=useState(0), [mine,setM]=useState({hours:0,trees:0,recruits:0,initiated:0});
  useEffect(()=>{const u=onSnapshot(doc(db,'users',uid),s=>setM({hours:s.data().serviceHours||0,trees:s.data().totalTrees||0,recruits:s.data().recruits||0,initiated:s.data().treesInitiated||0}));const g=onSnapshot(doc(db,'meta','counters'),s=>setG(s.data()?.totalTrees||0));return()=>{u();g();};},[uid]);
  const card=(t,v)=> <div className="rounded-xl bg-white p-4 text-center shadow"><p className="text-xs uppercase text-gray-500">{t}</p><p className="mt-1 text-2xl font-bold text-emerald-600">{v}</p></div>;
  return (<div className="grid grid-cols-2 gap-4 md:grid-cols-3">{card('Global Trees',global)}{card('My Trees',mine.trees)}{card('My Hours',mine.hours)}{card('My Recruits',mine.recruits)}{card('My Initiated',mine.initiated)}</div>);
}

// FILE: components/ProfileCard.tsx
'use client';
import { useDocument } from 'react-firebase-hooks/firestore';
import { doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
export default function ProfileCard({ uid }) {
  const [snap] = useDocument(doc(db,'users',uid)); const d=snap?.data(); if(!d)return null;
  return (<div className="space-y-2 rounded-xl bg-white p-4 shadow"><h1 className="text-xl font-bold">{d.name}</h1><p className="text-sm text-gray-500">{d.rank} | {d.role}</p><p className="text-sm">Email: {d.email}</p>{d.phone&&<p className="text-sm">Phone: {d.phone}</p>}<p className="pt-2 text-sm">🌱 Trees Planted: <b>{d.totalTrees}</b> | ⏱ Hours: <b>{d.serviceHours}</b></p><p className="text-sm">👥 Recruits: <b>{d.recruits}</b> | 🚀 Initiated: <b>{d.treesInitiated}</b></p></div>);
}

// FILE: functions/index.js
const functions = require('firebase-functions');const admin=require('firebase-admin');const sharp=require('sharp');const path=require('path');const os=require('os');const fs=require('fs');admin.initializeApp();const db=admin.firestore();const Roles={BANNED:'banned',UNROLED:'unroled',INTERN:'intern',VOLUNTEER:'volunteer',SENIOR_VOLUNTEER:'senior-volunteer',COORDINATOR:'coordinator',BOARD:'board',CEO:'ceo'};const hierarchy=Object.values(Roles);
async function promoteIfEligible(uid,trx){const ref=db.doc(`users/${uid}`);const snap=trx?await trx.get(ref):await ref.get();if(!snap.exists)return;const d=snap.data();if(d.role===Roles.UNROLED&&d.totalTrees>=1&&d.recruits>=1){trx?trx.update(ref,{role:Roles.INTERN}):await ref.update({role:Roles.INTERN});}};
async function creditInitiatedTrees(uid,inc){const batch=db.batch();let snap=await db.doc(`users/${uid}`).get();let current=snap.exists?snap.data().recruiterId:null;while(current){const ref=db.doc(`users/${current}`);batch.update(ref,{treesInitiated:admin.firestore.FieldValue.increment(inc)});const next=await ref.get();if(!next.exists)break;current=next.data().recruiterId;}await batch.commit();}
async function updateCounts(uid,incTrees,incHours){await db.runTransaction(async trx=>{const ref=db.doc(`users/${uid}`);const snap=await trx.get(ref);if(!snap.exists)return;trx.update(ref,{totalTrees:admin.firestore.FieldValue.increment(incTrees),serviceHours:admin.firestore.FieldValue.increment(incHours)});await promoteIfEligible(uid,trx);});}
exports.botVerify=functions.firestore.document('plantings/{pid}').onCreate(async snap=>{const d=snap.data();if(d.species&&d.location&&d.photoThumbUrl){await snap.ref.update({approved:true});await updateCounts(d.userId,1,1);await creditInitiatedTrees(d.userId,1);}});
exports.botVerifyCheckIn=functions.firestore.document('plantings/{pid}/checkins/{cid}').onCreate(async snap=>{const d=snap.data();if(d.photoThumbUrl){await snap.ref.update({approved:true});await updateCounts(d.checkerId,0,0.5);}});
exports.generateThumbnail=functions.storage.object().onFinalize(async object=>{const filePath=object.name;if(!filePath)return;const [top]=filePath.split('/');if(!['plantings','checkins'].includes(top))return;if(path.basename(filePath).startsWith('thumb_'))return;const bucket=admin.storage().bucket(object.bucket);const tmp=path.join(os.tmpdir(),path.basename(filePath));const thumbName=`thumb_${path.basename(filePath)}`;const tmpThumb=path.join(os.tmpdir(),thumbName);const dest=path.join(path.dirname(filePath),thumbName);await bucket.file(filePath).download({destination:tmp});await sharp(tmp).resize(400).jpeg({quality:70}).toFile(tmpThumb);await bucket.upload(tmpThumb,{destination:dest,contentType:'image/jpeg'});fs.unlinkSync(tmp);fs.unlinkSync(tmpThumb);const [url]=await bucket.file(dest).getSignedUrl({action:'read',expires:'03-01-2030'});if(top==='plantings'){const [,pid]=filePath.split('/');await db.doc(`plantings/${pid}`).update({photoThumbUrl:url});}else{const [,pid,cid]=filePath.split('/');await db.doc(`plantings/${pid}/checkins/${cid}`).update({photoThumbUrl:url});}});
exports.registerRecruit=functions.https.onCall(async({recruiterId},ctx)=>{if(!ctx.auth)throw new functions.https.HttpsError('unauthenticated','');const newUid=ctx.auth.uid;if(recruiterId===newUid)throw new functions.https.HttpsError('invalid-argument','');await db.runTransaction(async trx=>{const newRef=db.doc(`users/${newUid}`);const s=await trx.get(newRef);if(s.exists&&s.data().recruiterId)throw new functions.https.HttpsError('already-exists','');trx.set(newRef,{recruiterId,role:Roles.UNROLED,recruits:0,treesInitiated:0,serviceHours:0,totalTrees:0},{merge:true});const rref=db.doc(`users/${recruiterId}`);trx.update(rref,{recruits:admin.firestore.FieldValue.increment(1)});});await promoteIfEligible(recruiterId);return'ok';});
exports.dailyStats=functions.pubsub.schedule('5 0 * * *').timeZone('America/New_York').onRun(async()=>{const agg=await db.collection('users').select('totalTrees').get();let total=0;agg.forEach(s=>total+=s.data().totalTrees);const ymd=new Date().toISOString().slice(0,10);await db.doc('meta/stats/daily').set({[ymd]:total},{merge:true});await db.doc('channels/tree-stats').set({name:'tree-stats',type:'announce',updated:admin.firestore.FieldValue.serverTimestamp(),content:`🌳 Total trees planted so far: **${total}**\n\nOpen the live chart → /stats/trees`,},{merge:true});return null;});
exports.ensureChannels=functions.runWith({memory:'128MB'}).https.onCall(async()=>{const c=db.collection('channels');const mk=async(id,n,t,co)=>{const d=c.doc(id);if(!(await d.get()).exists)await d.set({name:n,type:t,created:admin.firestore.FieldValue.serverTimestamp(),content:co});};await mk('tree-planting-and-care','tree-planting-and-care','text',null);await mk('recruitment','recruitment','text',null);await mk('rank-info','rank-info','announce',`Roles:\n• Intern – 1 tree + 1 recruit\n• Volunteer\n• Senior Volunteer\n• Coordinator\n• Board of Directors\n• CEO`);await mk('tree-stats','tree-stats','announce','Loading stats…');});
exports.updateUserRole=functions.https.onCall(async({targetUid,newRole},ctx)=>{if(!ctx.auth)throw new functions.https.HttpsError('unauthenticated','');if(!hierarchy.includes(newRole))throw new functions.https.HttpsError('invalid-argument','');const[cs,ts]=await Promise.all([db.doc(`users/${ctx.auth.uid}`).get(),db.doc(`users/${targetUid}`).get()]);if(!cs.exists||!ts.exists)throw new functions.https.HttpsError('not-found','');const cr=cs.data().role,tr=ts.data().role;const higher=(a,b)=>hierarchy.indexOf(a)>hierarchy.indexOf(b);if(!higher(cr,tr))throw new functions.https.HttpsError('permission-denied','');if(!higher(cr,newRole)&&cr!==Roles.CEO)throw new functions.https.HttpsError('permission-denied','');await db.doc(`users/${targetUid}`).update({role:newRole});return'role-updated';});
exports.banUser=functions.https.onCall(async({targetUid},ctx)=>{if(!ctx.auth)throw new functions.https.HttpsError('unauthenticated','');const cr=(await db.doc(`users/${ctx.auth.uid}`).get()).data().role;if(![Roles.BOARD,Roles.CEO].includes(cr))throw new functions.https.HttpsError('permission-denied','');const tref=db.doc(`users/${targetUid}`);const tsnap=await tref.get();if(!tsnap.exists)throw new functions.https.HttpsError('not-found','');if(hierarchy.indexOf(cr)<=hierarchy.indexOf(tsnap.data().role))throw new functions.https.HttpsError('permission-denied','');await Promise.all([tref.update({role:Roles.BANNED}),admin.auth().updateUser(targetUid,{disabled:true})]);return'banned';});

// FILE: firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /{path=**} {
      allow read, write: if request.auth != null && get(/databases/$(db)/documents/users/$(request.auth.uid)).data.role != 'banned';
    }
    // ... other granular rules omitted for brevity ...
  }
}

// END OF CODEBASE
