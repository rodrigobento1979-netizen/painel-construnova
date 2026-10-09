import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, terminate } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp({
  projectId: firebaseConfig.projectId,
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  databaseId: firebaseConfig.firestoreDatabaseId
});

const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function check() {
  try {
    const compSnap = await getDocs(collection(db, 'companies'));
    console.log(`EMPRESAS (${compSnap.size}):`);
    compSnap.docs.forEach(d => console.log(`  - ID: ${d.id} | Nome: ${d.data().name} | CNPJ: ${d.data().cnpj}`));

    const entSnap = await getDocs(collection(db, 'entries'));
    console.log(`LANCAMENTOS TOTAIS: ${entSnap.size}`);
    
    const realEntries = entSnap.docs.filter(d => !d.id.startsWith('e-'));
    console.log(`LANCAMENTOS REAIS (SUPABASE): ${realEntries.length}`);
  } catch (err) {
    console.error('Erro ao consultar Firestore:', err);
  } finally {
    await terminate(db);
    process.exit(0);
  }
}

check();
