import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, deleteDoc, getDocs, terminate } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp({
  projectId: firebaseConfig.projectId,
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  databaseId: firebaseConfig.firestoreDatabaseId
});

const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function clean() {
  console.log('--- Limpando coleções no Firestore ---');
  const compSnap = await getDocs(collection(db, 'companies'));
  for (const d of compSnap.docs) {
    if (d.id.startsWith('comp-')) {
      console.log(`Deletando empresa antiga demo: ${d.id} (${d.data().name})`);
      await deleteDoc(d.ref);
    }
  }

  const entSnap = await getDocs(collection(db, 'entries'));
  for (const d of entSnap.docs) {
    if (d.id.startsWith('e-')) {
      console.log(`Deletando lançamento demo: ${d.id}`);
      await deleteDoc(d.ref);
    }
  }

  const finalComp = await getDocs(collection(db, 'companies'));
  const finalEnt = await getDocs(collection(db, 'entries'));

  console.log('--- Resultado Atual no Firestore ---');
  console.log(`Empresas cadastradas: ${finalComp.size}`);
  finalComp.docs.forEach(d => console.log(` - [${d.id}] ${d.data().name} | CNPJ: ${d.data().cnpj}`));
  console.log(`Lançamentos cadastrados: ${finalEnt.size}`);

  await terminate(db);
  process.exit(0);
}

clean().catch(err => {
  console.error(err);
  process.exit(1);
});
