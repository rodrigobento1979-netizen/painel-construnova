import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import https from 'https';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp({
  projectId: firebaseConfig.projectId,
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  databaseId: firebaseConfig.firestoreDatabaseId
});

const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const supabaseUrl = 'https://fksookblinnojgjhocrt.supabase.co/rest/v1/';
const supabaseKey = 'sb_publishable_N6ZOyc3DDZVCwh3mfJdvrw_vq2TDGw0';

function fetchSupabase(table) {
  return new Promise((resolve, reject) => {
    https.get(`${supabaseUrl}${table}?select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function migrate() {
  console.log('--- Iniciando Extração do Supabase ---');
  const supabaseCompanies = await fetchSupabase('companies');
  const supabaseEntries = await fetchSupabase('entries');

  console.log(`Extraído do Supabase: ${supabaseCompanies.length} empresas e ${supabaseEntries.length} lançamentos.`);

  console.log('--- Limpando dados de demonstração anteriores no Firestore ---');
  const currentCompanies = await getDocs(collection(db, 'companies'));
  for (const docSnap of currentCompanies.docs) {
    if (docSnap.id.startsWith('comp-')) {
      console.log(`Removendo empresa demo: ${docSnap.id}`);
      await deleteDoc(docSnap.ref);
    }
  }

  const currentEntries = await getDocs(collection(db, 'entries'));
  for (const docSnap of currentEntries.docs) {
    if (docSnap.id.startsWith('e-')) {
      console.log(`Removendo lançamento demo: ${docSnap.id}`);
      await deleteDoc(docSnap.ref);
    }
  }

  console.log('--- Migrando Empresas para o Firestore ---');
  for (const comp of supabaseCompanies) {
    const firestoreCompany = {
      id: comp.id,
      name: comp.name,
      cnpj: comp.cnpj || '',
      color: comp.color || '#3b82f6',
      createdAt: comp.created_at || new Date().toISOString()
    };
    await setDoc(doc(db, 'companies', comp.id), firestoreCompany);
    console.log(`✔ Empresa migrada: ${comp.name} (${comp.cnpj})`);
  }

  console.log('--- Migrando Lançamentos para o Firestore ---');
  let migratedEntriesCount = 0;
  for (const ent of supabaseEntries) {
    const firestoreEntry = {
      id: ent.id,
      companyId: ent.company_id,
      year: Number(ent.year),
      month: Number(ent.month),
      purchases: Number(ent.purchases || 0),
      sales: Number(ent.sales || 0),
      notesCount: Number(ent.notes_count || 0),
      productsCount: Number(ent.products_count || 0),
      status: (ent.status === 'CONCLUIDO' || ent.status === 'EM ANDAMENTO' || ent.status === 'AGUARDANDO') 
        ? ent.status 
        : 'AGUARDANDO',
      updatedAt: ent.created_at || new Date().toISOString()
    };
    await setDoc(doc(db, 'entries', ent.id), firestoreEntry);
    migratedEntriesCount++;
  }
  console.log(`✔ Total de lançamentos migrados com sucesso: ${migratedEntriesCount}`);

  console.log('--- Verificação Final no Firestore ---');
  const verifyCompanies = await getDocs(collection(db, 'companies'));
  const verifyEntries = await getDocs(collection(db, 'entries'));

  console.log(`Firestore agora contém:`);
  console.log(`- ${verifyCompanies.size} empresas:`, verifyCompanies.docs.map(d => `${d.data().name} (${d.id})`));
  console.log(`- ${verifyEntries.size} lançamentos.`);

  console.log('Migração concluída com sucesso!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Erro durante a migração:', err);
  process.exit(1);
});
