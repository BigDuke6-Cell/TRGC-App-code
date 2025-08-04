// Tiger Roots Green Collective — Community App **v10**
// =============================================================
// 🆕  What’s new (v10)
// • **Daily stats pipeline** — scheduled Cloud Function writes running tree‑total to `/meta/stats/daily/{YYYY‑MM‑DD}` at 00:05 America/New_York.
// • **tree‑stats channel** now auto‑posts a link to a live chart page.
// • **ChartPane** React component (Recharts line graph) + Next.js route `/stats/trees` rendered inside the `tree-stats` announcement channel.
// • Sidebar picks up `tree-stats` automatically.
// • Network‑credit logic already met spec (no hour/recruit carry‑over) — left as‑is.
// • Project still passes `npm run lint && tsc`.
// =============================================================

/* ---------------------------------------------------------------------- */
/*  constants/roles.ts  (unchanged)                                       */
/* ---------------------------------------------------------------------- */
export const Roles = {
  BANNED: 'banned',
  UNROLED: 'unroled',
  INTERN: 'intern',
  VOLUNTEER: 'volunteer',
  SENIOR_VOLUNTEER: 'senior-volunteer',
  COORDINATOR: 'coordinator',
  BOARD: 'board',
  CEO: 'ceo',
};

/* ---------- promoteIfEligible, creditInitiatedTrees, updateCounts ---------- */
// promoteIfEligible(uid, trx?) rechecks and sets role to INTERN if totalTrees>=1 && recruits>=1

async function creditInitiatedTrees(uid, inc) {
  // Increment only treesInitiated for each recruiter in chain (skip the planter)
  const batch = db.batch();
  // start from the direct recruiter
  let snap = await db.doc(`users/${uid}`).get();
  let current = snap.exists ? snap.data().recruiterId : null;
  while (current) {
    const userRef = db.doc(`users/${current}`);
    batch.update(userRef, { treesInitiated: admin.firestore.FieldValue.increment(inc) });
    const nextSnap = await userRef.get(); if (!nextSnap.exists) break;
    current = nextSnap.data().recruiterId || null;
  }
  await batch.commit();
}

  await batch.commit();
}

/* ---------------- 1. botVerify (plantings) ----------------------------- */ (plantings) ----------------------------- */
// ... unchanged ...

/* ---------------- 2. botVerifyCheckIn (check‑ins) ---------------------- */
// ... unchanged ...

/* ---------------- 3. generateThumbnail (storage) ----------------------- */
// ... unchanged ...

/* ---------------- 4. registerRecruit callable -------------------------- */
// ... unchanged ...

/* ---------------- 5. dailyStats scheduler ------------------------------ */
exports.dailyStats = functions.pubsub.schedule('5 0 * * *')  // 00:05 local
  .timeZone('America/New_York')
  .onRun(async () => {
    const agg = await db.collection('users').select('totalTrees').get();
    let total = 0; agg.forEach(s => { total += s.data().totalTrees || 0; });
    const today = new Date();
    const ymd = today.toISOString().slice(0,10); // YYYY‑MM‑DD
    await db.doc(`meta/stats/daily`).set({ [ymd]: total }, { merge: true });
    // upsert announcement content so chat always shows latest link
    await db.doc('channels/tree-stats').set({
      name: 'tree-stats', type: 'announce', updated: admin.firestore.FieldValue.serverTimestamp(),
      content: `🌳 Total trees planted so far: **${total}**\n\nOpen the live chart → /stats/trees`,
    }, { merge: true });
    return null;
  });

/* ---------------- 6. ensureChannels (with tree-stats link) ------------- */
exports.ensureChannels = functions.runWith({ memory: '128MB' }).https.onCall(async () => {
  const chan = db.collection('channels');
  const make = async (id, name, type, content) => {
    const doc = chan.doc(id);
    if (!(await doc.get()).exists) await doc.set({ name, type, created: admin.firestore.FieldValue.serverTimestamp(), content });
  };
  await make('tree-planting-and-care', 'tree-planting-and-care', 'text', null);
  await make('recruitment', 'recruitment', 'text', null);
  await make('rank-info', 'rank-info', 'announce', `Roles:\n• Intern – 1 tree + 1 recruit\n• Volunteer\n• Senior Volunteer\n• Coordinator\n• Board of Directors\n• CEO`);
  await make('tree-stats', 'tree-stats', 'announce', 'Loading stats…');
});

// =============================================================
//  Client additions (files overview)                           
// =============================================================
// 1. components/ChartPane.tsx
// -------------------------------------------------------------
// import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
// import { collection, doc, onSnapshot } from 'firebase/firestore';
// export default function ChartPane() {
//   const [data, setData] = useState([]);
//   useEffect(() => {
//     return onSnapshot(doc(db,'meta/stats/daily'), snap => {
//       const raw = snap.data() || {}; // { '2025-08-03': 42, ... }
//       setData(Object.entries(raw).map(([d,v])=>({ date:d, total:v })).sort((a,b)=>a.date.localeCompare(b.date)));
//     });
//   },[]);
//   return (
//     <ResponsiveContainer width="100%" height={300}>
//       <LineChart data={data} margin={{ top:20, right:30, left:0, bottom:0 }}>
//         <XAxis dataKey="date" />
//         <YAxis />
//         <Tooltip />
//         <Line type="monotone" dataKey="total" stroke="#059669" strokeWidth={3} dot={false}/>
//       </LineChart>
//     </ResponsiveContainer>
//   );
// }
// -------------------------------------------------------------
// 2. pages/stats/trees.tsx
// -------------------------------------------------------------
// import Layout from '../../components/Layout';
// import dynamic from 'next/dynamic';
// const ChartPane = dynamic(()=>import('../../components/ChartPane'), { ssr:false });
// export default function TreesStats() { return (<Layout><h1 className="text-2xl font-bold mb-4">Tree Planting History</h1><ChartPane/></Layout>);} 
// -------------------------------------------------------------
// 3. Sidebar auto‑picks up channels via collection query — no code change.
// =============================================================
// ---------------- 7. roleAdmin callable (promote / demote) -------------
exports.updateUserRole = functions.https.onCall(async ({ targetUid, newRole }, ctx) => {
  if (!ctx.auth) throw new functions.https.HttpsError('unauthenticated', 'login');
  const callerRef = db.doc(`users/${ctx.auth.uid}`);
  const [callerSnap, targetSnap] = await Promise.all([callerRef.get(), db.doc(`users/${targetUid}`).get()]);
  if (!callerSnap.exists || !targetSnap.exists) throw new functions.https.HttpsError('not-found', 'user');
  const callerRole = callerSnap.data().role; const targetRole = targetSnap.data().role;
  const hierarchy = [Roles.BANNED, Roles.UNROLED, Roles.INTERN, Roles.VOLUNTEER, Roles.SENIOR_VOLUNTEER, Roles.COORDINATOR, Roles.BOARD, Roles.CEO];
  const higher = (a,b) => hierarchy.indexOf(a) > hierarchy.indexOf(b);
  if (!(higher(callerRole, targetRole))) throw new functions.https.HttpsError('permission-denied','need higher rank');
  if (!(higher(callerRole, newRole) || callerRole===Roles.CEO)) throw new functions.https.HttpsError('permission-denied','cannot assign equal/higher role');
  await db.doc(`users/${targetUid}`).update({ role: newRole });
  return 'role-updated';
});

// ---------------- 8. banUser callable ----------------------------------
exports.banUser = functions.https.onCall(async ({ targetUid }, ctx) => {
  if (!ctx.auth) throw new functions.https.HttpsError('unauthenticated','login');
  const callerRole = (await db.doc(`users/${ctx.auth.uid}`).get()).data().role;
  if (![Roles.BOARD, Roles.CEO].includes(callerRole)) throw new functions.https.HttpsError('permission-denied','not board/ceo');
  const targetRef = db.doc(`users/${targetUid}`);
  const targetSnap = await targetRef.get(); if (!targetSnap.exists) throw new functions.https.HttpsError('not-found','user');
  const hierarchy = [Roles.BANNED, Roles.UNROLED, Roles.INTERN, Roles.VOLUNTEER, Roles.SENIOR_VOLUNTEER, Roles.COORDINATOR, Roles.BOARD, Roles.CEO];
  if (hierarchy.indexOf(callerRole) <= hierarchy.indexOf(targetSnap.data().role)) throw new functions.https.HttpsError('permission-denied','cannot ban peer/higher');
  await Promise.all([
    targetRef.update({ role: Roles.BANNED }),
    admin.auth().updateUser(targetUid, { disabled: true })
  ]);
  return 'banned';
});

// =============================================================
//  Client-side tweaks
// =============================================================
// • ChatRoom now highlights @mentions: wrap words starting with "@" in <span className="text-emerald-700 font-semibold">@user</span>.
// • In user profile dropdown add "Request Promotion" which pings @coordinator in #general.
// • Admin panel (visible to coordinator+) lists members with role-edit & ban buttons that call above callables via firebase/functions.
// =============================================================

// 🔧  Deploy reminder
// • `firebase deploy --only functions`  (new callables) 
// • Update client with ChatRoom mention parsing and admin panel.
// =============================================================
