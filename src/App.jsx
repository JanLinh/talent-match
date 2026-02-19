import React, { useState, useEffect, useRef } from 'react';
import { User, CheckCircle, Brain, Activity, ChevronRight, BarChart2, Users, Play, Sparkles, Plus, X, ShieldAlert, Info, Clock, Wifi, Monitor, Briefcase, Tag, Megaphone, ShoppingBag, Link as LinkIcon, Copy, LogOut, Send, Clock3, Lock, Trash2, Calculator, Globe, FileText, Download, Edit3 } from 'lucide-react';

// --- FIREBASE SETUP ---
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCji-kM2w14LSBB1ndfoo8yN_8gsvh7OhM",
  authDomain: "hr-platform-103f5.firebaseapp.com",
  projectId: "hr-platform-103f5",
  storageBucket: "hr-platform-103f5.firebasestorage.app",
  messagingSenderId: "37825828566",
  appId: "1:37825828566:web:c8436abf48076477c21b77"
};

// Bezpečná inicializace – zabraňuje chybě při hot-reloadu
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

// --- GEMINI API ---
const GEMINI_API_KEY = "AIzaSyDcUtAzaJfhPxogZTzL1urDJ4EFVEKVoKM";

async function callGemini(prompt, systemInstruction = "", isJson = false) {
  try {
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: isJson ? { responseMimeType: "application/json" } : {},
    };
    if (systemInstruction) {
      payload.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    const maxRetries = 3;
    let delay = 1000;
    for (let i = 0; i < maxRetries; i++) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      );
      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return null;
        return isJson ? JSON.parse(text) : text;
      }
      if (i < maxRetries - 1) { await new Promise(resolve => setTimeout(resolve, delay)); delay *= 2; }
      else { throw new Error(`API Error: ${response.status}`); }
    }
  } catch (error) { console.error("Gemini API Error:", error); return null; }
}

// --- CONFIGURATION ---
const INITIAL_BENCHMARKS = [];

const BASE_ROLES = [
  { id: 'general', label: 'Obecná pozice', icon: Globe, noSpecific: true }
];

const QUESTIONS = {
  iq: [
    { id: 1, type: 'iq', question: 'Které číslo logicky následuje v řadě: 2, 5, 11, 23, ...?', options: ['44', '45', '47', '46'], correct: 2 },
    { id: 2, type: 'iq', question: 'Kniha se má ke čtení jako vidlička k:', options: ['Krájení', 'Jídlu', 'Vaření', 'Držení'], correct: 1 },
    { id: 3, type: 'iq', question: 'Jestliže platí, že „všichni psi jsou zvířata" a „některá zvířata jsou kočky", vyplývá z toho nutně závěr, že „někteří psi jsou kočky"?', options: ['Ano, vyplývá', 'Ne, nevyplývá', 'Nelze určit'], correct: 1 },
    { id: 4, type: 'iq', question: 'Které slovo nepatří mezi ostatní?', options: ['Paříž', 'Londýn', 'Madrid', 'Evropa'], correct: 3 },
    { id: 5, type: 'iq', question: 'Cena zboží byla zvýšena o 20% a poté snížena o 20%. Jaká je nová cena oproti původní?', options: ['Stejná', 'Vyšší o 4%', 'Nižší o 4%', 'Nižší o 10%'], correct: 2 },
    { id: 6, type: 'iq', question: 'Voda : Led :: Mléko : ?', options: ['Sýr', 'Kráva', 'Bílá', 'Tekutina'], correct: 0 },
    { id: 7, type: 'iq', question: 'Které číslo doplní řadu: 1, 1, 2, 3, 5, 8, ...?', options: ['11', '12', '13', '15'], correct: 2 },
    { id: 8, type: 'iq', question: 'Pokud otočíte levou rukavici naruby, dostanete:', options: ['Levou rukavici', 'Pravou rukavici', 'Nic', 'Čepici'], correct: 1 },
    { id: 9, type: 'iq', question: 'Které číslo je polovinou čtvrtiny z jedné desetiny čísla 800?', options: ['2', '5', '8', '10'], correct: 3 },
    { id: 10, type: 'iq', question: 'Který tvar logicky doplňuje mřížku? (Abstraktní vizuální vzor)', visual: 'matrix', options: ['Tvar A (Plný kruh)', 'Tvar B (Čtverec)', 'Tvar C (Trojúhelník)', 'Tvar D (Hvězda)'], correct: 0 },
    { id: 11, type: 'iq', question: 'Co je opakem slova "Implicitní"?', options: ['Explicitní', 'Komplikovaný', 'Vnitřní', 'Neznámý'], correct: 0 },
    { id: 12, type: 'iq', question: '3, 6, 18, 72, ?', options: ['144', '216', '360', '288'], correct: 2 },
    { id: 13, type: 'iq', question: 'Který den byl včera, pokud pozítří bude čtvrtek?', options: ['Neděle', 'Pondělí', 'Úterý', 'Středa'], correct: 1 },
    { id: 14, type: 'iq', question: 'Všechny A jsou B. Žádné B není C. Platí, že žádné A není C?', options: ['Ano', 'Ne', 'Nelze určit'], correct: 0 },
    { id: 15, type: 'iq', question: 'Auto ujede 60 km za hodinu. Jak dlouho mu trvá ujet 150 km?', options: ['2h', '2h 15m', '2h 30m', '3h'], correct: 2 },
    { id: 16, type: 'iq', question: 'Které písmeno následuje: A, C, E, G, ...?', options: ['H', 'I', 'J', 'K'], correct: 1 },
    { id: 17, type: 'iq', question: 'Kolikrát se ručičky hodin překryjí mezi 12:00 a 12:00 dalšího dne?', options: ['24x', '22x', '23x', '12x'], correct: 1 },
    { id: 18, type: 'iq', question: 'Otec je 4x starší než syn. Za 20 let bude jen 2x starší. Kolik je otci?', options: ['30', '36', '40', '44'], correct: 2 },
    { id: 19, type: 'iq', question: 'Najděte vetřelce: Jablko, Hruška, Mrkev, Pomeranč.', options: ['Jablko', 'Hruška', 'Mrkev', 'Pomeranč'], correct: 2 },
    { id: 20, type: 'iq', question: 'Pokud "KOLO" kódujeme jako "LPM P", jak zakódujeme "LES"?', options: ['MFT', 'MET', 'KDR', 'MFU'], correct: 0 }
  ],
  personality: [
    { id: 1, type: 'big5', trait: 'extraversion', question: 'Cítím se dobře ve středu pozornosti.' },
    { id: 2, type: 'big5', trait: 'conscientiousness', question: 'Vždy dokončím práci včas a podle plánu.' },
    { id: 3, type: 'big5', trait: 'neuroticism', question: 'Často se cítím ve stresu nebo smutný.' },
    { id: 4, type: 'big5', trait: 'openness', question: 'Mám rád abstraktní myšlenky a filozofické debaty.' },
    { id: 5, type: 'big5', trait: 'agreeableness', question: 'Snažím se vyjít vstříc každému.' },
    { id: 6, type: 'big5', trait: 'extraversion', question: 'Mluvím s mnoha různými lidmi na večírcích.' },
    { id: 7, type: 'big5', trait: 'conscientiousness', question: 'Mám rád pořádek na svém pracovním stole.' },
    { id: 8, type: 'big5', trait: 'neuroticism', question: 'Snadno mě rozhodí maličkosti.' },
    { id: 9, type: 'big5', trait: 'openness', question: 'Rád zkouším nová jídla a aktivity.' },
    { id: 10, type: 'big5', trait: 'agreeableness', question: 'Zajímám se o pocity druhých.' },
    { id: 11, type: 'big5', trait: 'conscientiousness', question: 'Plním sliby, které dám.' },
    { id: 12, type: 'big5', trait: 'extraversion', question: 'Jsem raději v pozadí než v čele.' },
    { id: 13, type: 'big5', trait: 'openness', question: 'Mám bujnou fantazii.' },
    { id: 14, type: 'big5', trait: 'neuroticism', question: 'Často mám obavy z budoucnosti.' },
    { id: 15, type: 'big5', trait: 'agreeableness', question: 'Věřím, že lidé jsou v jádru dobří.' },
    { id: 16, type: 'big5', trait: 'extraversion', question: 'Snadno navazuji přátelství.' },
    { id: 17, type: 'big5', trait: 'conscientiousness', question: 'Jsem vždy připraven.' },
    { id: 18, type: 'big5', trait: 'neuroticism', question: 'Mám časté výkyvy nálad.' },
    { id: 19, type: 'big5', trait: 'openness', question: 'Rád přemýšlím o teoriích.' },
    { id: 20, type: 'big5', trait: 'agreeableness', question: 'Mám měkké srdce.' },
    { id: 21, type: 'big5', trait: 'conscientiousness', question: 'Věnuji pozornost detailům.' },
    { id: 22, type: 'big5', trait: 'extraversion', question: 'Nerada mluvím o sobě.' },
    { id: 23, type: 'big5', trait: 'neuroticism', question: 'Cítím se často provinile.' },
    { id: 24, type: 'big5', trait: 'openness', question: 'Rozumím věcem rychle.' },
    { id: 25, type: 'big5', trait: 'agreeableness', question: 'Respektuji ostatní.' },
    { id: 26, type: 'big5', trait: 'conscientiousness', question: 'Práci nechávám na poslední chvíli.' },
    { id: 27, type: 'big5', trait: 'extraversion', question: 'Mám rád rušná místa.' },
    { id: 28, type: 'big5', trait: 'neuroticism', question: 'Zůstávám v klidu pod tlakem.' },
    { id: 29, type: 'big5', trait: 'openness', question: 'Mám bohatou slovní zásobu.' },
    { id: 30, type: 'big5', trait: 'agreeableness', question: 'Rád pomáhám ostatním s jejich problémy.' }
  ],
  psycho: [
    { id: 1, type: 'integrity', question: 'Kolega si přivlastnil zásluhy za vaši práci. Reakce?', options: [{ text: 'Konfrontuji ho.', score: 40 }, { text: 'Promluvím si v soukromí.', score: 100 }, { text: 'Nechám to být.', score: 20 }, { text: 'Řeknu to šéfovi.', score: 60 }] },
    { id: 2, type: 'integrity', question: 'Najdete chybu v reportu hodinu před odevzdáním.', options: [{ text: 'Odevzdám s chybou.', score: 0 }, { text: 'Upravím čísla na oko.', score: 10 }, { text: 'Oznámím zpoždění a opravím.', score: 100 }, { text: 'Požádám kolegu.', score: 30 }] },
    { id: 3, type: 'integrity', question: 'Kolega krade kancelářské potřeby.', options: [{ text: 'Nahlásím to.', score: 80 }, { text: 'Ignoruji to.', score: 20 }, { text: 'Zeptám se na povolení.', score: 90 }, { text: 'Vezmu si taky.', score: 0 }] },
    { id: 4, type: 'integrity', question: 'Zákazník omylem zaplatil víc.', options: [{ text: 'Nechám si to.', score: 0 }, { text: 'Vrátím to.', score: 100 }, { text: 'Dám do kasy jako přebytek.', score: 80 }, { text: 'Koupím svačinu týmu.', score: 40 }] },
    { id: 5, type: 'integrity', question: 'Šéf chce porušit pravidla.', options: [{ text: 'Udělám to.', score: 20 }, { text: 'Odmítnu.', score: 100 }, { text: 'Udělám a nahlásím.', score: 50 }, { text: 'Změním pravidla.', score: 0 }] },
    { id: 6, type: 'integrity', question: 'Kolega nestíhá termíny.', options: [{ text: 'Udělám to za něj.', score: 30 }, { text: 'Nabídnu pomoc s organizací.', score: 100 }, { text: 'Ignoruji.', score: 0 }, { text: 'Stěžuji si.', score: 20 }] },
    { id: 7, type: 'integrity', question: 'Víte o propouštění, kolega se ptá.', options: [{ text: 'Řeknu vše.', score: 0 }, { text: 'Zapřu to.', score: 60 }, { text: 'Odkážu na důvěrnost.', score: 100 }, { text: 'Naznačím.', score: 40 }] },
    { id: 8, type: 'integrity', question: 'Peněženka na chodbě.', options: [{ text: 'Recepce.', score: 100 }, { text: 'Nechat tam.', score: 20 }, { text: 'Hledat majitele sám.', score: 90 }, { text: 'Vzít hotovost.', score: 0 }] },
    { id: 9, type: 'integrity', question: 'Nedodělaná práce v pátek.', options: [{ text: 'Jdu domů, počká to.', score: 20 }, { text: 'Zůstanu déle.', score: 100 }, { text: 'Vezmu si domů.', score: 80 }, { text: 'Hodím na kolegu.', score: 0 }] },
    { id: 10, type: 'integrity', question: 'Kolega pomlouvá firmu na sociálních sítích.', options: [{ text: 'Přidám se.', score: 0 }, { text: 'Upozorním ho na riziko.', score: 100 }, { text: 'Nahlásím HR.', score: 60 }, { text: 'Ignoruji.', score: 40 }] },
    { id: 11, type: 'integrity', question: 'Zákazník je hrubý.', options: [{ text: 'Jsem taky hrubý.', score: 0 }, { text: 'Zachovám klid.', score: 100 }, { text: 'Rozbrečím se.', score: 10 }, { text: 'Ignoruji ho.', score: 30 }] },
    { id: 12, type: 'integrity', question: 'Nestíháte projekt.', options: [{ text: 'Zamlčím to.', score: 0 }, { text: 'Řeknu to včas šéfovi.', score: 100 }, { text: 'Pracuji tajně v noci.', score: 60 }, { text: 'Obviním kolegy.', score: 0 }] },
    { id: 13, type: 'integrity', question: 'Kolega smrdí alkoholem.', options: [{ text: 'Zeptám se ho soukromě.', score: 100 }, { text: 'Nahlásím okamžitě.', score: 60 }, { text: 'Pomlouvám ho.', score: 0 }, { text: 'Ignoruji.', score: 20 }] },
    { id: 14, type: 'integrity', question: 'Máte možnost si přilepšit na úkor klienta.', options: [{ text: 'Nikdy.', score: 100 }, { text: 'Jen když to nepozná.', score: 0 }, { text: 'Jen málo.', score: 10 }, { text: 'Pokud to dělají všichni.', score: 20 }] },
    { id: 15, type: 'integrity', question: 'Nuda v práci.', options: [{ text: 'Hraju hry.', score: 0 }, { text: 'Hledám si práci navíc.', score: 100 }, { text: 'Jdu dřív domů.', score: 10 }, { text: 'Spím.', score: 0 }] },
    { id: 16, type: 'integrity', question: 'Konkurence volá a chce info.', options: [{ text: 'Dám info za peníze.', score: 0 }, { text: 'Odmítnu.', score: 100 }, { text: 'Dám falešné info.', score: 40 }, { text: 'Zavěsím.', score: 80 }] },
    { id: 17, type: 'integrity', question: 'Rozbité firemní auto.', options: [{ text: 'Zatajím to.', score: 0 }, { text: 'Přiznám se.', score: 100 }, { text: 'Svedu na neznámého pachatele.', score: 10 }, { text: 'Opravím tajně.', score: 50 }] },
    { id: 18, type: 'integrity', question: 'Sexuální narážky kolegy.', options: [{ text: 'Směju se.', score: 20 }, { text: 'Jasně vymezím hranice.', score: 100 }, { text: 'Oplatím to.', score: 10 }, { text: 'Trpím mlčky.', score: 0 }] },
    { id: 19, type: 'integrity', question: 'Dárek od dodavatele.', options: [{ text: 'Vezmu si domů.', score: 10 }, { text: 'Odmítnu/Nahlásím dle pravidel.', score: 100 }, { text: 'Rozdám v týmu.', score: 50 }, { text: 'Vyhodím.', score: 30 }] },
    { id: 20, type: 'integrity', question: 'Vidíte šikanu na pracovišti.', options: [{ text: 'Zasáhnu/Nahlásím.', score: 100 }, { text: 'Nedívám se.', score: 0 }, { text: 'Natáčím si to.', score: 0 }, { text: 'Fandím.', score: 0 }] }
  ],
  specific: {
    sales: [
      { id: 1, question: 'Klient namítá cenu. Reakce?', options: ['Sleva.', 'Hodnota.', 'Pomluva.', 'Konec.'], correct: 1 },
      { id: 2, question: 'Co je B2B?', options: ['Back to Business', 'Business to Business', 'Buyer', 'Burger'], correct: 1 },
      { id: 3, question: 'Kdy uzavřít obchod?', options: ['Hned.', 'Při signálech.', 'Nikdy.', 'Po týdnu.'], correct: 1 },
      { id: 4, question: 'Upselling je?', options: ['Dražší verze.', 'Nový klient.', 'Sleva.', 'Reklamace.'], correct: 0 },
      { id: 5, question: 'Lead vs Prospect?', options: ['Stejné.', 'Nekvalifikovaný vs Kvalifikovaný.', 'Email vs Tel.', 'Nic.'], correct: 1 },
      { id: 6, question: 'SPIN metoda?', options: ['Sport.', 'Situation, Problem, Implication, Need.', 'Sales Profit.', 'Speed.'], correct: 1 },
      { id: 7, question: '"Musím si to rozmyslet".', options: ['Zavěsit.', 'Zjistit důvod.', 'Sleva.', 'OK.'], correct: 1 },
      { id: 8, question: 'CRM?', options: ['Customer Relationship Mgmt.', 'Car Rental.', 'Cost Rate.', 'Cry.'], correct: 0 },
      { id: 9, question: 'Cross-selling?', options: ['Doplňkový prodej.', 'Prodej konkurence.', 'Výměna.', 'Křížovka.'], correct: 0 },
      { id: 10, question: 'Cold calling?', options: ['Volání v zimě.', 'Volání neznámým.', 'Volání rodině.', 'Volání na policii.'], correct: 1 },
      { id: 11, question: 'Co je gatekeeper?', options: ['Vrátný.', 'Asistentka blokující přístup k rozhodci.', 'Brankář.', 'Software.'], correct: 1 },
      { id: 12, question: 'USP znamená?', options: ['Unique Selling Proposition.', 'Universal Sales Price.', 'Under Sales Pressure.', 'USA Post.'], correct: 0 },
      { id: 13, question: 'Hunter vs Farmer?', options: ['Lov vs Pole.', 'Akvizice vs Péče o stávající.', 'Maso vs Zelenina.', 'Rychlost vs Kvalita.'], correct: 1 },
      { id: 14, question: 'Pipeline?', options: ['Ropovod.', 'Trychtýř příležitostí.', 'Kanalizace.', 'Seznam dlužníků.'], correct: 1 },
      { id: 15, question: 'Co je KPI?', options: ['Key Performance Indicator.', 'Key Person.', 'Kilo Price.', 'Know People.'], correct: 0 },
      { id: 16, question: 'AIDA model?', options: ['Opera.', 'Attention, Interest, Desire, Action.', 'AI Data.', 'Association.'], correct: 1 },
      { id: 17, question: 'Nejčastější důvod ztráty zákazníka?', options: ['Cena.', 'Nezájem/Špatný servis.', 'Kvalita.', 'Počasí.'], correct: 1 },
      { id: 18, question: 'Elevator Pitch?', options: ['Výtah.', 'Krátké představení (30s).', 'Oprava výtahu.', 'Zvyšování hlasu.'], correct: 1 },
      { id: 19, question: 'Co dělat po podpisu?', options: ['Zmizet.', 'Onboarding a péče.', 'Oslava.', 'Dovolena.'], correct: 1 },
      { id: 20, question: 'Social Selling?', options: ['Prodej na večírku.', 'Využití sociálních sítí (LinkedIn).', 'Prodej kamarádům.', 'Charita.'], correct: 1 }
    ],
    retail: [
      { id: 1, question: 'Kdy oslovit?', options: ['Hned.', 'Po rozkoukání.', 'Nikdy.', 'Až odejde.'], correct: 1 },
      { id: 2, question: 'Reklamace?', options: ['Hádat se.', 'Vyslechnout.', 'Vyhodit.', 'Plakat.'], correct: 1 },
      { id: 3, question: 'FIFO?', options: ['First In First Out.', 'Fit.', 'Fast.', 'Free.'], correct: 0 },
      { id: 4, question: 'Pokladna prodej?', options: ['Zdržovat.', 'Doplňky.', 'Nic.', 'Vtipy.'], correct: 1 },
      { id: 5, question: 'Zloděj?', options: ['Bít.', 'Sledovat/Ostraha.', 'Křičet.', 'Pomoc.'], correct: 1 },
      { id: 6, question: 'Vlastnost?', options: ['Síla.', 'Ochota.', 'Rychlost.', 'Krása.'], correct: 1 },
      { id: 7, question: 'Inventura?', options: ['Úklid.', 'Počítání.', 'Sleva.', 'Párty.'], correct: 1 },
      { id: 8, question: 'Nemáme zboží.', options: ['Smůla.', 'Alternativa.', 'Jděte jinam.', 'Nevím.'], correct: 1 },
      { id: 9, question: 'Mystery Shopping?', options: ['Záhada.', 'Falešný zákazník (kontrola).', 'Krádež.', 'Dárek.'], correct: 1 },
      { id: 10, question: 'Facing?', options: ['Obličej.', 'Srovnání zboží do čela regálu.', 'Facebook.', 'Čelem vzad.'], correct: 1 },
      { id: 11, question: 'POS materiál?', options: ['Point of Sale (reklama).', 'Pokladna.', 'Posudek.', 'Pošta.'], correct: 0 },
      { id: 12, question: 'Zóna dekomprese?', options: ['Vstupní prostor.', 'Sklad.', 'Toaleta.', 'Pokladna.'], correct: 0 },
      { id: 13, question: 'Konverzní poměr v retailu?', options: ['Kurz eura.', 'Počet nakupujících / Počet návštěvníků.', 'Velikost slevy.', 'Délka účtenky.'], correct: 1 },
      { id: 14, question: 'Cross-merchandising?', options: ['Křížovka.', 'Vystavení souvisejícího zboží u sebe (pivo+chipsy).', 'Záměna cen.', 'Výprodej.'], correct: 1 },
      { id: 15, question: 'Bestseller?', options: ['Kniha.', 'Nejprodávanější zboží.', 'Nejlepší prodejce.', 'Výprodej.'], correct: 1 },
      { id: 16, question: 'Ležák?', options: ['Pivo.', 'Neprodejné zboží.', 'Líný prodavač.', 'Postel.'], correct: 1 },
      { id: 17, question: 'Reklamační lhůta?', options: ['Rok.', '24 měsíců (zákon).', 'Týden.', 'Žádná.'], correct: 1 },
      { id: 18, question: 'Jak jednat s nerozhodným?', options: ['Tlačit.', 'Klást otázky a radit.', 'Ignorovat.', 'Vybrat nejdražší.'], correct: 1 },
      { id: 19, question: 'Dress code?', options: ['Kód dveří.', 'Pravidla oblékání.', 'Čárový kód.', 'Adresa.'], correct: 1 },
      { id: 20, question: 'EAN?', options: ['Jméno.', 'Čárový kód.', 'Evropská unie.', 'Cenovka.'], correct: 1 }
    ],
    marketing: [
      { id: 1, question: 'SEO?', options: ['Search Engine Optimization.', 'Sales.', 'Social.', 'Site.'], correct: 0 },
      { id: 2, question: 'Email metrika?', options: ['Počet.', 'Open Rate.', 'Slova.', 'Příloha.'], correct: 1 },
      { id: 3, question: 'A/B test?', options: ['Dvě verze.', 'Abeceda.', 'Skupiny.', 'Verze A.'], correct: 0 },
      { id: 4, question: 'Persona?', options: ['Boss.', 'Profil zákazníka.', 'Já.', 'Konkurence.'], correct: 1 },
      { id: 5, question: 'PPC?', options: ['Pay Per Click.', 'Price.', 'Paper.', 'Public.'], correct: 0 },
      { id: 6, question: 'Konverze?', options: ['Návštěva.', 'Splnění cíle.', 'Odchod.', 'Diskuse.'], correct: 1 },
      { id: 7, question: 'Virál?', options: ['Lék.', 'Samošíření obsahu.', 'TV.', 'Spam.'], correct: 1 },
      { id: 8, question: 'Analytics?', options: ['FB.', 'Měření webu.', 'Noviny.', 'Excel.'], correct: 1 },
      { id: 9, question: 'CTA?', options: ['Call To Action.', 'Car Auto.', 'Center.', 'Cat.'], correct: 0 },
      { id: 10, question: '4P?', options: ['Product, Price, Place, Promotion.', 'People, Profit.', 'Paper.', 'Phone.'], correct: 0 },
      { id: 11, question: 'B2C?', options: ['Business to Customer.', 'Back to City.', 'Business Cart.', 'Big Company.'], correct: 0 },
      { id: 12, question: 'Content marketing?', options: ['Tvorba hodnotného obsahu.', 'Reklama.', 'Spam.', 'Prodej.'], correct: 0 },
      { id: 13, question: 'Influencer?', options: ['Vlivný uživatel.', 'Nemocný.', 'Manažer.', 'Programátor.'], correct: 0 },
      { id: 14, question: 'Retargeting?', options: ['Znovu oslovení návštěvníka.', 'Nová cílovka.', 'Smazání.', 'Sleva.'], correct: 0 },
      { id: 15, question: 'USP?', options: ['Unikátní prodejní argument.', 'USB.', 'USA.', 'Ups.'], correct: 0 },
      { id: 16, question: 'Brand?', options: ['Značka/brand.', 'Oheň.', 'Koňak.', 'Jméno.'], correct: 0 },
      { id: 17, question: 'Imprese?', options: ['Zobrazení reklamy.', 'Kliknutí.', 'Nákup.', 'Tisk.'], correct: 0 },
      { id: 18, question: 'Lead Magnet?', options: ['Magnet.', 'Obsah zdarma výměnou za kontakt.', 'Olovo.', 'Vůdce.'], correct: 1 },
      { id: 19, question: 'Bounce Rate?', options: ['Míra okamžitého opuštění.', 'Skákání.', 'Bonus.', 'Sleva.'], correct: 0 },
      { id: 20, question: 'Copywriting?', options: ['Kopírování.', 'Psaní textů pro marketing.', 'Právo.', 'Tisk.'], correct: 1 }
    ],
    procurement: [
      { id: 1, question: 'Zdražení?', options: ['Ano.', 'Jednat o podmínkách.', 'Konec.', 'Zdražit.'], correct: 1 },
      { id: 2, question: 'RFP?', options: ['Request for Proposal (poptávka).', 'Platba.', 'Zisk.', 'Rychlost.'], correct: 0 },
      { id: 3, question: 'JIT?', options: ['Just In Time.', 'Late.', 'Pay.', 'Fast.'], correct: 0 },
      { id: 4, question: 'Hodnocení?', options: ['Jen cena.', 'TCO (celkové náklady).', 'Web.', 'Km.'], correct: 1 },
      { id: 5, question: 'Incoterms?', options: ['Mezinárodní dodací podmínky.', 'Slang.', 'Ceník.', 'Kontejner.'], correct: 0 },
      { id: 6, question: 'Lead Time?', options: ['Porada.', 'Doba dodání.', 'Oběd.', 'Kabel.'], correct: 1 },
      { id: 7, question: 'Zásoby?', options: ['Vyhodit.', 'Optimalizovat.', 'Větší sklad.', 'Stop.'], correct: 1 },
      { id: 8, question: 'Rámcovka?', options: ['Rám.', 'Dlouhodobá smlouva.', 'Jednoráz.', 'Slib.'], correct: 1 },
      { id: 9, question: 'SLA?', options: ['Service Level Agreement.', 'Slow.', 'Sale.', 'Slap.'], correct: 0 },
      { id: 10, question: 'Tender?', options: ['Měkký.', 'Výběrové řízení.', 'Bar.', 'Maso.'], correct: 1 },
      { id: 11, question: 'Splatnost?', options: ['Doba úhrady faktury.', 'Dluh.', 'Plat.', 'Sleva.'], correct: 0 },
      { id: 12, question: 'Marže vs Přirážka?', options: ['Stejné.', 'Marže z prodejní ceny, Přirážka z nákupní.', 'Opak.', 'Nevím.'], correct: 1 },
      { id: 13, question: 'Paretovo pravidlo (ABC)?', options: ['80/20.', '50/50.', '100/0.', 'ABC.'], correct: 0 },
      { id: 14, question: 'Single sourcing?', options: ['Jeden dodavatel záměrně.', 'Svobodný.', 'Jeden zdroj náhodou.', 'Jednoduché.'], correct: 0 },
      { id: 15, question: 'KPI v nákupu?', options: ['Úspory, kvalita, termíny.', 'Počet emailů.', 'Káva.', 'Kroky.'], correct: 0 },
      { id: 16, question: 'VŘ?', options: ['Výběrové řízení.', 'Velká řeka.', 'Vrátný.', 'Veřejné.'], correct: 0 },
      { id: 17, question: 'Cena EXW?', options: ['Ze závodu (kupující hradí dopravu).', 'Extra.', 'Exit.', 'Expensive.'], correct: 0 },
      { id: 18, question: 'Faktura?', options: ['Daňový doklad.', 'Papír.', 'Objednávka.', 'Nabídka.'], correct: 0 },
      { id: 19, question: 'Reklamace dodávky?', options: ['Vyhodit.', 'Sepsat reklamační protokol.', 'Mlčet.', 'Zaplatit.'], correct: 1 },
      { id: 20, question: 'Etický kodex?', options: ['Pravidla chování.', 'Kód zámku.', 'Program.', 'Nic.'], correct: 0 }
    ],
    accountant: [
      { id: 1, question: 'Co je rozvaha?', options: ['Výkaz aktiv a pasiv.', 'Výkaz zisků.', 'Daňové přiznání.', 'Výpis z účtu.'], correct: 0 },
      { id: 2, question: 'DPH zkratka?', options: ['Daň z přidané hodnoty.', 'Daňový pohyb hodnot.', 'Doklad pohybu hotovosti.', 'Daň pro hospodářství.'], correct: 0 },
      { id: 3, question: 'Co je účetní odpis?', options: ['Ztráta peněz.', 'Rozložení ceny majetku v čase.', 'Platba dluhu.', 'Bankovní poplatek.'], correct: 1 },
      { id: 4, question: 'LIFO vs FIFO?', options: ['Stejné metody.', 'Metody oceňování zásob.', 'Typy faktur.', 'Způsoby platby.'], correct: 1 },
      { id: 5, question: 'Co je cash flow?', options: ['Hotovost v pokladně.', 'Tok peněz (příjmy a výdaje).', 'Zisk firmy.', 'Bankovní úvěr.'], correct: 1 },
      { id: 6, question: 'Saldo účtu je?', options: ['Úrok.', 'Rozdíl mezi debitem a kreditem.', 'Poplatek bance.', 'Celkový obrat.'], correct: 1 },
      { id: 7, question: 'Co znamená MD v účetnictví?', options: ['Má dáti (debet).', 'Měsíční daň.', 'Mzdový doklad.', 'Materiálový doklad.'], correct: 0 },
      { id: 8, question: 'Výsledovka zobrazuje?', options: ['Majetek firmy.', 'Náklady a výnosy za období.', 'Pohledávky.', 'Zásoby.'], correct: 1 },
      { id: 9, question: 'Co je pohledávka?', options: ['Dluh firmy.', 'Nárok firmy na příjem peněz.', 'Zásoby na skladě.', 'Bankovní půjčka.'], correct: 1 },
      { id: 10, question: 'Zákonná sazba DPH v ČR (základní)?', options: ['15 %', '19 %', '21 %', '25 %'], correct: 2 },
      { id: 11, question: 'Co je závazek?', options: ['Pohledávka.', 'Povinnost zaplatit dodavateli.', 'Zisk.', 'Majetek.'], correct: 1 },
      { id: 12, question: 'Dohadná položka je?', options: ['Odhad výše nákladu/výnosu.', 'Chyba v účetnictví.', 'Sleva od dodavatele.', 'Daňový odpočet.'], correct: 0 },
      { id: 13, question: 'Co je interní audit?', options: ['Kontrola finančního úřadu.', 'Nezávislá kontrola uvnitř firmy.', 'Bankovní kontrola.', 'Roční inventura.'], correct: 1 },
      { id: 14, question: 'Účetní uzávěrka se dělá?', options: ['Každý měsíc.', 'Jednou ročně (k 31.12).', 'Každý kvartál.', 'Dle potřeby.'], correct: 1 },
      { id: 15, question: 'Co je leasingová smlouva?', options: ['Kupní smlouva.', 'Smlouva o pronájmu s opcí koupě.', 'Pojistná smlouva.', 'Pracovní smlouva.'], correct: 1 },
      { id: 16, question: 'EBITDA znamená?', options: ['Čistý zisk.', 'Zisk před úroky, daněmi a odpisy.', 'Tržby celkem.', 'Provozní náklady.'], correct: 1 },
      { id: 17, question: 'Co je faktura proforma?', options: ['Platný daňový doklad.', 'Zálohová/informační faktura.', 'Dobropis.', 'Storno faktura.'], correct: 1 },
      { id: 18, question: 'Inventarizace majetku slouží k?', options: ['Výpočtu daní.', 'Ověření skutečného stavu vs. účetní evidence.', 'Stanovení ceny majetku.', 'Odpisu majetku.'], correct: 1 },
      { id: 19, question: 'Co je dobropis?', options: ['Faktura za přeplatek/oprava faktury.', 'Potvrzení o platbě.', 'Objednávka.', 'Smlouva.'], correct: 0 },
      { id: 20, question: 'Účetní jednotka musí archivovat účetní záznamy?', options: ['1 rok.', '5 let.', '10 let.', '3 roky.'], correct: 2 }
    ],
    general: []
  }
};

// --- STYLING CONSTANTS ---
const S_MAGENTA = "bg-[#E30074]";
const S_MAGENTA_TEXT = "text-[#E30074]";
const S_MAGENTA_HOVER = "hover:bg-[#c40064]";
const S_BG = "bg-[#F5F5F5]";

// --- HELPER ---
const formatTime = (seconds) => {
  if (!seconds && seconds !== 0) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s < 10 ? '0' : ''}${s}s`;
};

const calculateMatch = (results, benchmarkMetrics) => {
  if (!results || !benchmarkMetrics) return 0;
  let totalDiff = 0; let count = 0;
  Object.keys(benchmarkMetrics).forEach(key => {
    if (results[key] !== undefined) { totalDiff += Math.abs(results[key] - benchmarkMetrics[key]); count++; }
  });
  if (count === 0) return 0;
  return Math.round(Math.max(0, 100 - (totalDiff / count)));
};

// --- COMPONENTS ---
const ButtonPrimary = ({ children, onClick, disabled, className = "", icon: Icon, colorClass }) => (
  <button onClick={onClick} disabled={disabled} className={`${colorClass || S_MAGENTA} ${!colorClass && S_MAGENTA_HOVER} text-white font-bold py-3 px-6 rounded-md shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full ${className}`}>
    {Icon && <Icon size={20} strokeWidth={2.5} />}
    <span className="uppercase tracking-wide text-sm md:text-base">{children}</span>
  </button>
);

const Badge = ({ children, color = "bg-[#E30074]" }) => (
  <span className={`${color} text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider inline-block mb-2`}>
    {children}
  </span>
);

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h3 className="font-bold text-lg text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

const MatrixPuzzle = () => (
  <div className="flex justify-center my-8">
    <div className="grid grid-cols-2 gap-4 bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-inner">
      <div className="w-28 h-28 bg-white flex items-center justify-center rounded-lg shadow-sm border border-gray-100"><div className="w-14 h-14 border-4 border-[#E30074]"></div></div>
      <div className="w-28 h-28 bg-white flex items-center justify-center rounded-lg shadow-sm border border-gray-100"><div className="w-14 h-14 bg-[#E30074]"></div></div>
      <div className="w-28 h-28 bg-white flex items-center justify-center rounded-lg shadow-sm border border-gray-100"><div className="w-14 h-14 border-4 border-[#39C21B] rounded-full"></div></div>
      <div className="w-28 h-28 bg-gray-100 flex items-center justify-center rounded-lg shadow-inner border border-gray-200 border-dashed"><span className="text-5xl font-bold text-gray-300">?</span></div>
    </div>
  </div>
);

// --- TEST RUNNER ---
const TestRunner = ({ roleId, onComplete, isNoSpecificRole }) => {
  const TEST_DURATION_SECONDS = 45 * 60;
  const [timeLeft, setTimeLeft] = useState(TEST_DURATION_SECONDS);
  const [currentSection, setCurrentSection] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({ iq: {}, personality: {}, psycho: {}, specific: {} });
  const answersRef = React.useRef(answers);
  answersRef.current = answers;

  useEffect(() => {
    if (timeLeft <= 0) { calculateAndComplete(answersRef.current); return; }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const isNoSpecific = isNoSpecificRole || false;
  const sectionCount = isNoSpecific ? 3 : 4;

  const handleAnswer = (value) => {
    const sectionKeys = ['iq', 'personality', 'psycho', 'specific'];
    const currentKey = sectionKeys[currentSection];
    const newAnswers = { ...answers, [currentKey]: { ...answers[currentKey], [questionIndex]: value } };
    setAnswers(newAnswers);

    const currentQuestions = currentKey === 'specific' ? QUESTIONS.specific[roleId] : QUESTIONS[currentKey];
    if (questionIndex < currentQuestions.length - 1) {
      setQuestionIndex(prev => prev + 1);
    } else {
      if (currentSection < sectionCount - 1) { setCurrentSection(prev => prev + 1); setQuestionIndex(0); }
      else { calculateAndComplete(newAnswers); }
    }
  };

  const calculateAndComplete = (finalAnswers) => {
    const timeTaken = TEST_DURATION_SECONDS - timeLeft;

    // IQ skóre
    let iqCorrect = 0;
    QUESTIONS.iq.forEach((q, idx) => { if (finalAnswers.iq[idx] === q.correct) iqCorrect++; });
    const iqScore = Math.round((iqCorrect / QUESTIONS.iq.length) * 100);

    // Personality – správné mapování podle trait property každé otázky
    const traitTotals = { openness: 0, conscientiousness: 0, extraversion: 0, agreeableness: 0, neuroticism: 0 };
    const traitCounts = { openness: 0, conscientiousness: 0, extraversion: 0, agreeableness: 0, neuroticism: 0 };
    // Reverzní otázky (kde nižší hodnota = vyšší trait)
    const reversedIds = [3, 8, 12, 14, 18, 22, 23, 26]; // neuroticism+extraversion reversed
    QUESTIONS.personality.forEach((q, idx) => {
      let val = finalAnswers.personality[idx] || 3;
      if (reversedIds.includes(q.id)) val = 6 - val;
      traitTotals[q.trait] += val;
      traitCounts[q.trait]++;
    });
    const traits = {};
    Object.keys(traitTotals).forEach(t => {
      traits[t] = Math.round((traitTotals[t] / (traitCounts[t] * 5)) * 100);
    });

    // Integrita
    let integritySum = 0;
    QUESTIONS.psycho.forEach((q, idx) => { integritySum += (finalAnswers.psycho[idx] || 0); });
    const integrityScore = Math.round(integritySum / QUESTIONS.psycho.length);

    // Odbornost
    let specificCorrect = 0;
    const specificQs = QUESTIONS.specific[roleId];
    specificQs.forEach((q, idx) => { if (finalAnswers.specific[idx] === q.correct) specificCorrect++; });
    const specificScore = Math.round((specificCorrect / specificQs.length) * 100);

    const results = { iq: iqScore, ...traits, integrity: integrityScore, specific: isNoSpecific ? null : specificScore };
    onComplete(results, timeTaken, finalAnswers);
  };

  const sectionKey = ['iq', 'personality', 'psycho', 'specific'][currentSection];
  const questions = sectionKey === 'specific' ? QUESTIONS.specific[roleId] : QUESTIONS[sectionKey];
  const currentQ = questions[questionIndex];
  const specificLen = isNoSpecific ? 0 : (QUESTIONS.specific[roleId]?.length || 0);
  const totalQs = QUESTIONS.iq.length + QUESTIONS.personality.length + QUESTIONS.psycho.length + specificLen;
  let currentGlobalIndex = questionIndex;
  if (currentSection > 0) currentGlobalIndex += QUESTIONS.iq.length;
  if (currentSection > 1) currentGlobalIndex += QUESTIONS.personality.length;
  if (currentSection > 2) currentGlobalIndex += QUESTIONS.psycho.length;

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-8 md:p-12 max-w-3xl mx-auto relative">
      <div className={`absolute top-4 right-6 flex items-center gap-2 font-mono font-bold text-xl ${timeLeft < 300 ? 'text-red-600 animate-pulse' : 'text-gray-700'}`}>
        <Clock size={20} />
        {Math.floor(timeLeft / 60)}:{timeLeft % 60 < 10 ? '0' : ''}{timeLeft % 60}
      </div>
      <div className="mb-8 mt-4">
        <div className="flex justify-between items-end mb-2">
          <span className={`text-xs font-bold ${S_MAGENTA_TEXT} uppercase tracking-widest`}>Otázka {currentGlobalIndex + 1} / {totalQs}</span>
          <span className="text-gray-400 text-sm">Sekce {currentSection + 1}/{sectionCount}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
          <div className={`${S_MAGENTA} h-2 rounded-full transition-all duration-500 ease-out`} style={{ width: `${((currentGlobalIndex + 1) / totalQs) * 100}%` }}></div>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mt-6 leading-snug">{currentQ.question}</h2>
      </div>
      {currentQ.visual === 'matrix' && <MatrixPuzzle />}
      <div className="space-y-3 mt-8">
        {currentSection === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentQ.options.map((opt, idx) => (
              <button key={idx} onClick={() => handleAnswer(idx)} className="p-4 border border-gray-300 rounded hover:border-[#E30074] hover:bg-pink-50 transition-all text-left font-medium text-gray-700">{opt}</button>
            ))}
          </div>
        )}
        {currentSection === 1 && (
          <div className="space-y-4">
            <div className="flex justify-between text-sm font-bold text-gray-400 px-1 uppercase"><span>Nesouhlasím</span><span>Souhlasím</span></div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((val) => (
                <button key={val} onClick={() => handleAnswer(val)} className={`flex-1 h-14 rounded border transition-all font-bold ${answers.personality[questionIndex] === val ? S_MAGENTA + ' text-white border-transparent' : 'bg-white border-gray-300 hover:border-[#E30074]'}`}>{val}</button>
              ))}
            </div>
          </div>
        )}
        {(currentSection === 2 || currentSection === 3) && currentQ && (
          <div className="space-y-3">
            {currentQ.options.map((opt, idx) => (
              <button key={idx} onClick={() => handleAnswer(currentSection === 3 ? idx : opt.score)} className="w-full p-4 border border-gray-300 rounded hover:border-[#E30074] hover:bg-pink-50 transition-all text-left text-sm text-gray-700">
                {typeof opt === 'string' ? opt : opt.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- ANSWER DETAIL VIEW ---
const AnswerDetailView = ({ candidate }) => {
  const [openSection, setOpenSection] = useState(null);
  if (!candidate.rawAnswers) return <div className="text-gray-400 italic">Detailní data odpovědí nejsou k dispozici.</div>;
  const toggle = (sec) => setOpenSection(openSection === sec ? null : sec);

  const renderSection = (key, title, questions) => {
    const sectionAnswers = candidate.rawAnswers[key] || {};
    const isOpen = openSection === key;
    return (
      <div className="border border-gray-200 rounded-lg mb-3 overflow-hidden">
        <button onClick={() => toggle(key)} className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
          <span className="font-bold text-gray-700">{title}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{questions.length} otázek</span>
            <ChevronRight size={16} className={`transform transition-transform ${isOpen ? 'rotate-90' : ''}`} />
          </div>
        </button>
        {isOpen && (
          <div className="p-4 bg-white space-y-4 text-sm">
            {questions.map((q, idx) => {
              const userAns = sectionAnswers[idx];
              let statusIcon = null;
              if (key === 'personality') {
                statusIcon = <span className="font-bold text-blue-600">Hodnota: {userAns ?? '-'}</span>;
              } else if (key === 'psycho') {
                const maxScore = Math.max(...q.options.map(o => o.score));
                const color = userAns === maxScore ? 'text-green-600' : userAns > 0 ? 'text-yellow-600' : 'text-red-600';
                statusIcon = <span className={`font-bold ${color}`}>Skóre: {userAns ?? '-'}</span>;
              } else {
                const isCorrect = userAns === q.correct;
                statusIcon = isCorrect
                  ? <CheckCircle size={16} className="text-green-600" />
                  : <X size={16} className="text-red-600" />;
              }
              return (
                <div key={q.id} className="border-b border-gray-100 pb-3 last:border-0">
                  <div className="font-medium text-gray-800 mb-1">{idx + 1}. {q.question}</div>
                  {q.visual && <div className="text-xs text-gray-400 mb-2 italic">[Vizuální úloha]</div>}
                  <div className="flex justify-between items-start">
                    <div className="text-gray-500 italic">
                      {key === 'psycho'
                        ? `Vybráno: "${q.options.find(o => o.score === userAns)?.text ?? 'bez odpovědi'}"`
                        : key === 'personality'
                          ? '(Škála 1-5)'
                          : `Odpověď: ${userAns !== undefined ? q.options[userAns] : 'bez odpovědi'}`}
                    </div>
                    <div className="flex items-center gap-1 whitespace-nowrap">{statusIcon}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mt-6">
      <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <BarChart2 size={18} className="text-[#E30074]" /> Detailní analýza odpovědí
      </h4>
      {renderSection('iq', 'Logické myšlení (IQ)', QUESTIONS.iq)}
      {renderSection('personality', 'Osobnostní profil', QUESTIONS.personality)}
      {renderSection('psycho', 'Integrita & Situace', QUESTIONS.psycho)}
      {!(candidate.roleId === 'general') && QUESTIONS.specific[candidate.roleId]?.length > 0 && renderSection('specific', `Odbornost: ${candidate.roleId}`, QUESTIONS.specific[candidate.roleId] || [])}
    </div>
  );
};

// --- VIEWS ---
const LandingView = ({ setAppMode }) => (
  <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
      <div className="mb-8 flex justify-center">
        <img src="https://www.smarty.cz/img/logo-smartycz-inversed.svg" alt="Smarty.cz" className="h-12" />
      </div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">TalentMatch Portál</h1>
      <p className="text-gray-500 mb-8">Vyberte prostředí pro vstup do aplikace</p>
      <button onClick={() => setAppMode('login')} className="w-full p-4 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center gap-4 transition-all group text-left">
        <div className="bg-white p-3 rounded-lg shadow-sm text-gray-700 group-hover:text-[#E30074]"><Monitor /></div>
        <div><div className="font-bold text-gray-900">HR Admin</div><div className="text-xs text-gray-500">Vstup pro náboráře</div></div>
        <ChevronRight className="ml-auto text-gray-400" />
      </button>
    </div>
  </div>
);

const LoginScreen = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const handleSubmit = () => {
    if (username === 'admin' && password === 'smarty2025') { onLogin('admin'); }
    else { setError('Neplatné přihlašovací údaje.'); }
  };
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl">
        <div className="mb-8 flex justify-center"><img src="https://www.smarty.cz/img/logo-smartycz-inversed.svg" alt="Smarty.cz" className="h-10" /></div>
        <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Přihlášení do Administrace</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Uživatelské jméno</label>
            <div className="relative"><User className="absolute left-3 top-2.5 text-gray-400" size={18} /><input type="text" className="w-full border border-gray-300 rounded pl-10 p-2 text-sm focus:border-[#E30074] outline-none" value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} /></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Heslo</label>
            <div className="relative"><Lock className="absolute left-3 top-2.5 text-gray-400" size={18} /><input type="password" className="w-full border border-gray-300 rounded pl-10 p-2 text-sm focus:border-[#E30074] outline-none" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} /></div>
          </div>
          {error && <div className="text-red-500 text-xs text-center">{error}</div>}
          <ButtonPrimary onClick={handleSubmit} className="w-full mt-2">Přihlásit se</ButtonPrimary>
          <button onClick={() => onLogin('cancel')} className="w-full text-center text-gray-400 text-xs hover:text-gray-600 mt-2">Zpět na úvod</button>
        </div>
      </div>
    </div>
  );
};

// --- CUSTOM ROLE MODAL ---
const CustomRoleModal = ({ isOpen, onClose, onSave }) => {
  const [roleName, setRoleName] = useState('');
  const [questions, setQuestions] = useState(
    Array.from({ length: 20 }, (_, i) => ({ id: i + 1, question: '', options: ['', '', '', ''], correct: 0 }))
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeQ, setActiveQ] = useState(0);

  const handleGenerate = async () => {
    if (!roleName) return;
    setIsGenerating(true);
    const data = await callGemini(
      `Jsi HR expert. Vygeneruj 20 odborných testových otázek pro pozici "${roleName}". 
      Každá otázka musí mít 4 možnosti odpovědi a jednu správnou.
      Vrať POUZE JSON pole: [{"id":1,"question":"text","options":["A","B","C","D"],"correct":0},...] 
      kde "correct" je index správné odpovědi (0-3). Otázky musí být v češtině a relevantní pro danou pozici.`,
      "", true
    );
    if (data && Array.isArray(data)) {
      setQuestions(data.map((q, i) => ({ ...q, id: i + 1 })));
    } else {
      alert('Nepodařilo se vygenerovat otázky. Zkuste to znovu.');
    }
    setIsGenerating(false);
  };

  const handleSave = () => {
    if (!roleName) { alert('Zadejte název pozice.'); return; }
    const filled = questions.filter(q => q.question.trim());
    if (filled.length < 5) { alert('Vyplňte alespoň 5 otázek.'); return; }
    onSave({ id: `custom_${Date.now()}`, label: roleName, icon: Briefcase, questions: filled });
    setRoleName('');
    setQuestions(Array.from({ length: 20 }, (_, i) => ({ id: i + 1, question: '', options: ['', '', '', ''], correct: 0 })));
    setActiveQ(0);
    onClose();
  };

  const updateQ = (field, value) => {
    setQuestions(prev => prev.map((q, i) => i === activeQ ? { ...q, [field]: value } : q));
  };
  const updateOption = (optIdx, value) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== activeQ) return q;
      const newOpts = [...q.options]; newOpts[optIdx] = value; return { ...q, options: newOpts };
    }));
  };

  if (!isOpen) return null;
  const currentQ = questions[activeQ];
  const filledCount = questions.filter(q => q.question.trim()).length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50">
          <div>
            <h3 className="font-bold text-lg text-gray-800">Přidat vlastní pozici</h3>
            <p className="text-xs text-gray-500 mt-0.5">Definujte název a 20 odborných otázek pro 4. část testu</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
        </div>
        <div className="flex flex-col md:flex-row overflow-hidden flex-1">
          {/* Left - role name + question list */}
          <div className="md:w-64 border-r border-gray-100 p-4 overflow-y-auto flex-shrink-0 bg-gray-50">
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Název pozice</label>
              <input type="text" className="w-full border border-gray-300 rounded p-2 text-sm focus:border-[#E30074] outline-none" placeholder="Např. IT Projektový manažer" value={roleName} onChange={e => setRoleName(e.target.value)} />
            </div>
            <button onClick={handleGenerate} disabled={!roleName || isGenerating} className="w-full mb-4 py-2 text-xs font-bold text-white bg-[#E30074] rounded hover:bg-[#c40064] transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
              <Sparkles size={13}/>{isGenerating ? 'Generuji AI...' : 'Generovat AI otázky'}
            </button>
            <div className="space-y-1">
              {questions.map((q, i) => (
                <button key={i} onClick={() => setActiveQ(i)} className={`w-full text-left p-2 rounded text-xs transition-all ${activeQ === i ? 'bg-[#E30074] text-white' : q.question.trim() ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-white text-gray-500 hover:bg-gray-100'}`}>
                  <span className="font-bold mr-1">{i + 1}.</span>{q.question.trim() ? q.question.substring(0, 30) + (q.question.length > 30 ? '...' : '') : 'Prázdná otázka'}
                </button>
              ))}
            </div>
          </div>
          {/* Right - question editor */}
          <div className="flex-1 p-5 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-gray-800">Otázka {activeQ + 1} / 20</h4>
              <span className="text-xs text-gray-400">{filledCount} vyplněno</span>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Text otázky</label>
              <textarea className="w-full border border-gray-300 rounded p-3 text-sm focus:border-[#E30074] outline-none h-20 resize-none" placeholder="Napište otázku..." value={currentQ.question} onChange={e => updateQ('question', e.target.value)}/>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-600 mb-2 uppercase">Možnosti odpovědí</label>
              <div className="space-y-2">
                {currentQ.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <button onClick={() => updateQ('correct', oi)} className={`w-6 h-6 rounded-full border-2 flex-shrink-0 transition-all ${currentQ.correct === oi ? 'border-green-500 bg-green-500' : 'border-gray-300 hover:border-green-400'}`}>
                      {currentQ.correct === oi && <CheckCircle size={14} className="text-white m-auto"/>}
                    </button>
                    <input type="text" className="flex-1 border border-gray-200 rounded p-2 text-sm focus:border-[#E30074] outline-none" placeholder={`Možnost ${String.fromCharCode(65 + oi)}`} value={opt} onChange={e => updateOption(oi, e.target.value)}/>
                    {currentQ.correct === oi && <span className="text-[10px] text-green-600 font-bold whitespace-nowrap">SPRÁVNÁ</span>}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              {activeQ > 0 && <button onClick={() => setActiveQ(p => p - 1)} className="flex-1 py-2 text-sm border border-gray-200 rounded hover:bg-gray-50">← Předchozí</button>}
              {activeQ < 19 && <button onClick={() => setActiveQ(p => p + 1)} className="flex-1 py-2 text-sm border border-gray-200 rounded hover:bg-gray-50">Další →</button>}
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50">
          <span className="text-xs text-gray-500">{filledCount} / 20 otázek vyplněno</span>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-100">Zrušit</button>
            <button onClick={handleSave} disabled={!roleName || filledCount < 5} className="px-6 py-2 text-sm font-bold text-white bg-[#E30074] rounded hover:bg-[#c40064] transition-colors disabled:opacity-50">Uložit pozici</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- ADMIN VIEW ---
const AdminView = ({
  candidates, benchmarks, activeCandidateId, setActiveCandidateId,
  handlePromoteToBenchmark, generateAnalysis, aiAnalysis, isAnalysing,
  selectedBenchmarkId, setSelectedBenchmarkId, showBenchmarkModal, setShowBenchmarkModal,
  showInviteModal, setShowInviteModal, inviteForm, setInviteForm, generatedLink, setGeneratedLink,
  handleGenerateInvite, isGeneratingLink, newRoleDescription, setNewRoleDescription,
  generateBenchmark, isGeneratingBenchmark, setAppMode, handleSimulateLinkClick, onDeleteCandidate,
  allRoles, customRoles, onAddCustomRole, onDeleteCustomRole, onExportPdf
}) => {
  const viewCandidate = candidates.find(c => c.id === activeCandidateId);

  const getActiveBenchmark = () => {
    if (selectedBenchmarkId) return benchmarks.find(b => b.id === selectedBenchmarkId) || benchmarks[0];
    if (viewCandidate) {
      const candidateRoleName = allRoles.find(r => r.id === viewCandidate.roleId)?.label?.split(' ')[0]?.toLowerCase() || '';
      return benchmarks.find(b => b.role.toLowerCase().includes(candidateRoleName)) || benchmarks[0];
    }
    return benchmarks[0];
  };
  const activeBenchmark = getActiveBenchmark();

  const METRIC_LABELS = [
    { key: 'iq', label: 'IQ' },
    { key: 'conscientiousness', label: 'Svědomitost' },
    { key: 'integrity', label: 'Integrita' },
    { key: 'specific', label: 'Odbornost' },
    { key: 'openness', label: 'Otevřenost' },
    { key: 'extraversion', label: 'Extraverze' },
    { key: 'agreeableness', label: 'Přívětivost' },
    { key: 'neuroticism', label: 'Neuroticismus' }
  ];

  return (
    <div className={`min-h-screen ${S_BG} font-sans text-gray-900 pb-12`}>
      <header className="bg-gray-700 border-b border-gray-600 sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src="https://www.smarty.cz/img/logo-smartycz-inversed.svg" alt="Smarty.cz" className="h-8" />
            <span className="text-xs text-gray-300 bg-gray-600 px-2 py-1 rounded hidden sm:inline-block">ADMINISTRACE</span>
          </div>
          <button onClick={() => setAppMode('landing')} className="text-sm font-medium text-gray-300 hover:text-white flex items-center gap-2">
            <LogOut size={16} /> Odhlásit
          </button>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 py-8">
        {viewCandidate ? (
          <div>
            <button onClick={() => { setActiveCandidateId(null); setSelectedBenchmarkId(null); }} className="mb-6 flex items-center gap-2 text-gray-500 hover:text-black font-medium">
              <ChevronRight className="rotate-180" size={16} /> Zpět na přehled
            </button>
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="lg:w-2/3">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <Badge>{allRoles.find(r => r.id === viewCandidate.roleId)?.label || viewCandidate.roleId}</Badge>
                      <h1 className="text-3xl font-bold text-gray-900">{viewCandidate.name}</h1>
                      <p className="text-gray-500 mt-1">Test dokončen: {viewCandidate.date}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500 mb-1">Průměrné skóre</div>
                      <div className={`text-5xl font-bold ${S_MAGENTA_TEXT}`}>{viewCandidate.score}/100</div>
                      <div className="text-xs text-gray-400 mt-2 flex justify-end items-center gap-1">
                        <Clock3 size={12} /> Čas: {formatTime(viewCandidate.timeTaken)}
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-5 rounded-lg border border-gray-100 mb-6">
                    <div className="flex justify-between items-center mb-4 border-b border-gray-200 pb-3">
                      <h4 className="font-bold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wide">
                        <BarChart2 size={16} className="text-[#E30074]" /> Porovnání s Benchmarkem
                      </h4>
                      <select className="text-xs border border-gray-300 rounded p-1 bg-white focus:border-[#E30074] outline-none" onChange={(e) => setSelectedBenchmarkId(e.target.value)} value={activeBenchmark?.id || ''}>
                        {benchmarks.map(b => <option key={b.id} value={b.id}>{b.role}</option>)}
                      </select>
                    </div>
                    <div className="space-y-5">
                      {METRIC_LABELS.filter(m => !(m.key === 'specific' && allRoles.find(r => r.id === viewCandidate.roleId)?.noSpecific)).map(m => {
                        const candVal = viewCandidate.results?.[m.key] ?? 0;
                        const benchVal = activeBenchmark?.metrics?.[m.key] ?? 0;
                        const diff = candVal - benchVal;
                        return (
                          <div key={m.key}>
                            <div className="flex justify-between text-xs mb-1.5">
                              <span className="font-bold text-gray-700 w-28">{m.label}</span>
                              <div className="flex-grow mx-3 flex items-center">
                                <div className="w-full bg-gray-200 h-2 rounded-full relative">
                                  <div style={{ width: `${benchVal}%` }} className="absolute top-0 left-0 h-full bg-gray-400 opacity-40 rounded-full"></div>
                                  <div style={{ left: `${benchVal}%` }} className="absolute top-[-4px] bottom-[-4px] w-0.5 bg-gray-600 z-10"></div>
                                  <div style={{ width: `${candVal}%` }} className={`absolute top-0 left-0 h-full rounded-full opacity-90 ${S_MAGENTA}`}></div>
                                </div>
                              </div>
                              <div className="w-24 text-right flex justify-end gap-2">
                                <span className="font-bold text-gray-800">{candVal}</span>
                                <span className="text-gray-400 text-[10px] pt-0.5">vs {benchVal}</span>
                                <span className={`text-[10px] font-bold w-8 text-right ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>{diff > 0 ? '+' : ''}{diff}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <AnswerDetailView candidate={viewCandidate} />
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-4"><Sparkles className="text-[#E30074]" size={20} /><h3 className="font-bold text-gray-900">AI Analýza</h3></div>
                  {!aiAnalysis ? (
                    <div className="text-center py-6 bg-gray-50 rounded border border-dashed border-gray-200">
                      <p className="text-sm text-gray-500 mb-3">Porovnat s: <strong>{activeBenchmark?.role}</strong></p>
                      <button onClick={() => generateAnalysis(viewCandidate, activeBenchmark)} disabled={isAnalysing} className="text-[#E30074] font-bold text-sm hover:underline disabled:opacity-50">
                        {isAnalysing ? 'Analyzuji...' : 'Vygenerovat report'}
                      </button>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line bg-pink-50/50 p-4 rounded">{aiAnalysis}</div>
                  )}
                </div>
              </div>

              <div className="lg:w-1/3">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Detaily Kandidáta</h3>
                  <div className="space-y-4 text-sm">
                    <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">Jméno</span><span className="font-medium">{viewCandidate.name}</span></div>
                    <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">Role</span><span className="font-medium">{allRoles.find(r => r.id === viewCandidate.roleId)?.label || viewCandidate.roleId}</span></div>
                    <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">Shoda s bench.</span><span className="font-bold text-[#E30074]">{calculateMatch(viewCandidate.results, activeBenchmark?.metrics)}%</span></div>
                    <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">Doba trvání</span><span className="font-bold">{formatTime(viewCandidate.timeTaken)}</span></div>
                  </div>
                  <div className="mt-6 pt-6 border-t border-gray-100 space-y-3">
                    <ButtonPrimary onClick={() => handlePromoteToBenchmark(viewCandidate)} icon={BarChart2}>Nastavit jako Benchmark</ButtonPrimary>
                    <ButtonPrimary onClick={() => onExportPdf(viewCandidate, activeBenchmark, aiAnalysis)} icon={Download} colorClass="bg-gray-700 hover:bg-gray-800">Exportovat PDF</ButtonPrimary>
                    <button className="w-full py-3 text-sm font-bold text-red-600 border border-red-200 rounded hover:bg-red-50">Zamítnout kandidáta</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-3">Benchmarky</h3>
                {benchmarks.length === 0 ? (
                  <p className="text-xs text-gray-400 italic mb-3">Zatím žádné benchmarky. Přidejte první.</p>
                ) : (
                  <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 mb-3">
                    {benchmarks.map(b => (
                      <div key={b.id} className="text-sm border-b border-gray-100 pb-2 last:border-0">
                        <div className="font-semibold">{b.role}</div>
                        <div className="text-xs text-gray-500 mt-1">IQ: {b.metrics.iq} | Integrita: {b.metrics.integrity}</div>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => setShowBenchmarkModal(true)} className="w-full py-2 text-xs font-bold text-[#E30074] border border-[#E30074] rounded hover:bg-[#E30074] hover:text-white transition-colors flex items-center justify-center gap-1">
                  <Plus size={14} /> NOVÝ BENCHMARK
                </button>
              </div>

              <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-3">Vlastní pozice</h3>
                <p className="text-xs text-gray-400 mb-3">Pozice s vlastními odbornými otázkami pro 4. část testu.</p>
                {customRoles.length === 0 ? (
                  <p className="text-xs text-gray-400 italic mb-3">Zatím žádné vlastní pozice.</p>
                ) : (
                  <div className="space-y-2 mb-3 max-h-[200px] overflow-y-auto pr-1">
                    {customRoles.map(r => (
                      <div key={r.id} className="flex items-center justify-between text-sm border border-gray-100 rounded p-2 bg-gray-50">
                        <span className="font-medium text-gray-800 truncate">{r.label}</span>
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                          <span className="text-[10px] text-gray-400">{r.questions?.length || 0}q</span>
                          <button onClick={() => onDeleteCustomRole(r.id)} className="text-red-400 hover:text-red-600 ml-1"><X size={13}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => onAddCustomRole()} className="w-full py-2 text-xs font-bold text-[#E30074] border border-[#E30074] rounded hover:bg-[#E30074] hover:text-white transition-colors flex items-center justify-center gap-1">
                  <Plus size={14} /> PŘIDAT POZICI
                </button>
              </div>
            </div>

            <div className="lg:col-span-9">
              <div className="flex justify-between items-end mb-6">
                <div><h1 className="text-3xl font-bold text-gray-900">Kandidáti</h1><p className="text-gray-500 text-sm mt-1">Správa testování a výsledků</p></div>
                <ButtonPrimary onClick={() => setShowInviteModal(true)} icon={Send} className="w-auto">POZVAT KANDIDÁTA</ButtonPrimary>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
                    <tr><th className="p-4">Jméno</th><th className="p-4">Role</th><th className="p-4">Datum / Čas</th><th className="p-4">Status</th><th className="p-4 text-right">Doba</th><th className="p-4 text-right">Skóre</th><th className="p-4"></th></tr>
                  </thead>
                  <tbody className="text-sm">
                    {candidates.length === 0 ? (
                      <tr><td colSpan="7" className="p-8 text-center text-gray-500">Zatím žádní kandidáti v databázi.</td></tr>
                    ) : candidates.map(c => {
                      const roleObj = allRoles.find(r => r.id === c.roleId); const RoleIcon = roleObj?.icon || Globe;
                      return (
                        <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="p-4 font-bold text-gray-900">{c.name}</td>
                          <td className="p-4 text-gray-600"><div className="flex items-center gap-2">{RoleIcon && <RoleIcon size={16} />}{allRoles.find(r => r.id === c.roleId)?.label || c.roleId}</div></td>
                          <td className="p-4 text-gray-500">
                            <div className="text-xs">{c.date}</div>
                            {c.linkGeneratedAt && <div className="text-[10px] text-gray-400">{new Date(c.linkGeneratedAt).toLocaleTimeString('cs-CZ', {hour: '2-digit', minute: '2-digit'})}</div>}
                          </td>
                          <td className="p-4">{c.status === 'completed'
                            ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold flex items-center w-fit gap-1"><CheckCircle size={12} /> Hotovo</span>
                            : <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-bold flex items-center w-fit gap-1"><Activity size={12} /> Čeká se</span>}
                          </td>
                          <td className="p-4 text-right font-mono text-gray-500">{formatTime(c.timeTaken)}</td>
                          <td className="p-4 text-right font-bold text-lg">{c.score ? <span className={c.score > 80 ? 'text-green-600' : 'text-gray-900'}>{c.score}</span> : <span className="text-gray-300">-</span>}</td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-3">
                              {c.status === 'completed' && <button onClick={() => setActiveCandidateId(c.id)} className="text-[#E30074] font-bold hover:underline text-xs">Zobrazit</button>}
                              <button onClick={() => onDeleteCandidate(c.id, c.name)} className="text-red-400 hover:text-red-600 transition-colors" title="Smazat záznam"><Trash2 size={15} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* INVITE MODAL */}
      <Modal isOpen={showInviteModal} onClose={() => { setShowInviteModal(false); setGeneratedLink(null); }} title="Pozvat nového kandidáta">
        {!generatedLink ? (
          <div className="space-y-4">
            <div><label className="block text-sm font-bold text-gray-700 mb-1">Jméno a Příjmení</label><input type="text" className="w-full border border-gray-300 rounded p-3 focus:border-[#E30074] outline-none" placeholder="Např. Petr Nový" value={inviteForm.name} onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })} /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">Pozice / Role</label>
              <div className="grid grid-cols-2 gap-2">
                {allRoles.map(role => { const RIcon = role.icon || Globe; return (<button key={role.id} onClick={() => setInviteForm({ ...inviteForm, role: role.id })} className={`p-3 text-sm rounded border flex flex-col items-center gap-2 transition-all ${inviteForm.role === role.id ? 'border-[#E30074] bg-pink-50 text-[#E30074] font-bold' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}><RIcon size={20} />{role.label}</button>); })}
              </div>
            </div>
            <ButtonPrimary onClick={handleGenerateInvite} disabled={!inviteForm.name || isGeneratingLink}>
              {isGeneratingLink ? 'Generuji...' : 'Generovat Odkaz'}
            </ButtonPrimary>
          </div>
        ) : (
          <div className="text-center space-y-6">
            <div className="bg-green-50 text-green-700 p-4 rounded-lg border border-green-100 flex items-center justify-center gap-2"><CheckCircle size={20} /> Pozvánka vytvořena</div>
            <div><p className="text-gray-500 text-sm mb-2">Unikátní odkaz pro kandidáta:</p><div className="flex items-center gap-2 bg-gray-100 p-3 rounded text-sm text-gray-700 break-all"><LinkIcon size={16} className="flex-shrink-0" />{generatedLink}</div></div>
            <div className="flex gap-2">
              <button onClick={() => { navigator.clipboard.writeText(generatedLink); }} className="flex-1 py-3 border border-gray-300 rounded font-bold text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"><Copy size={16} /> Kopírovat</button>
              <ButtonPrimary onClick={handleSimulateLinkClick} icon={Play} className="flex-1">Simulovat vstup</ButtonPrimary>
            </div>
          </div>
        )}
      </Modal>

      {/* BENCHMARK MODAL */}
      <Modal isOpen={showBenchmarkModal} onClose={() => setShowBenchmarkModal(false)} title="Definovat nový benchmark">
        <div className="space-y-6">
          <p className="text-gray-600 text-sm">Popište ideálního zaměstnance. Gemini AI vytvoří profil.</p>
          <textarea className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:border-[#E30074] h-32 text-sm" placeholder="Např.: Hledám dravého obchoďáka pro B2B prodej technologií..." value={newRoleDescription} onChange={(e) => setNewRoleDescription(e.target.value)} />
          <ButtonPrimary onClick={generateBenchmark} disabled={isGeneratingBenchmark || !newRoleDescription} icon={Sparkles}>
            {isGeneratingBenchmark ? 'Analyzuji...' : 'Vytvořit Benchmark'}
          </ButtonPrimary>
        </div>
      </Modal>
    </div>
  );
};

// --- CANDIDATE VIEW ---
const CandidateView = ({ currentCandidate, setAppMode, onFinish, allRoles }) => {
  const [testStarted, setTestStarted] = useState(false);

  if (currentCandidate.status === 'completed') {
    return (
      <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
        <header className="bg-white border-b border-gray-200 py-4 px-6 flex justify-center items-center relative">
          <img src="https://www.smarty.cz/img/logo-smartycz-inversed.svg" alt="Smarty.cz" className="h-6" />
          <div className="absolute right-6 flex items-center gap-2 text-sm text-gray-500"><User size={16} /><span className="font-semibold text-gray-900">{currentCandidate.name}</span></div>
        </header>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-white rounded-xl shadow-lg p-12 text-center mt-12">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle size={40} /></div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Hotovo! Děkujeme.</h1>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">Vaše odpovědi byly úspěšně odeslány našemu HR týmu. Budeme vás kontaktovat.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!testStarted) {
    return (
      <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
        <header className="bg-white border-b border-gray-200 py-4 px-6 flex justify-center items-center relative">
          <img src="https://www.smarty.cz/img/logo-smartycz-inversed.svg" alt="Smarty.cz" className="h-6" />
          <div className="absolute right-6 flex items-center gap-2 text-sm text-gray-500"><User size={16} /><span className="font-semibold text-gray-900">{currentCandidate.name}</span></div>
        </header>
        <div className="max-w-2xl mx-auto p-6 mt-8">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-gray-900 p-8 text-white text-center">
              <h1 className="text-3xl font-bold mb-2">Vítejte u výběrového řízení</h1>
              <p className="text-gray-400">Pozice: <span className="text-[#E30074] font-bold">{allRoles.find(r => r.id === currentCandidate.roleId)?.label || currentCandidate.roleId}</span></p>
            </div>
            <div className="p-8">
              <h2 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2"><Info className="text-[#E30074]" size={20} /> Co vás čeká?</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-gray-50 p-4 rounded border border-gray-100 flex items-start gap-3"><Brain className="text-gray-400 mt-1" size={20} /><div><div className="font-bold text-gray-800 text-sm">Logické myšlení</div><div className="text-xs text-gray-500">IQ a abstraktní uvažování</div></div></div>
                <div className="bg-gray-50 p-4 rounded border border-gray-100 flex items-start gap-3"><Users className="text-gray-400 mt-1" size={20} /><div><div className="font-bold text-gray-800 text-sm">Osobnostní profil</div><div className="text-xs text-gray-500">Big Five metodika</div></div></div>
                <div className="bg-gray-50 p-4 rounded border border-gray-100 flex items-start gap-3"><ShieldAlert className="text-gray-400 mt-1" size={20} /><div><div className="font-bold text-gray-800 text-sm">Integrita</div><div className="text-xs text-gray-500">Řešení krizových situací</div></div></div>
                <div className="bg-gray-50 p-4 rounded border border-gray-100 flex items-start gap-3"><Briefcase className="text-gray-400 mt-1" size={20} /><div><div className="font-bold text-gray-800 text-sm">Odbornost</div><div className="text-xs text-gray-500">Specifické znalosti pozice</div></div></div>
              </div>
              <ul className="space-y-3 mb-8 text-sm text-gray-600">
                <li className="flex items-center gap-3"><Clock size={16} className="text-gray-400" /><span>Vyhraďte si cca <strong>45 minut</strong> bez přerušení.</span></li>
                <li className="flex items-center gap-3"><Wifi size={16} className="text-gray-400" /><span>Zajistěte si <strong>stabilní připojení</strong> k internetu.</span></li>
                <li className="flex items-center gap-3"><Monitor size={16} className="text-gray-400" /><span>Test nelze v průběhu <strong>přerušit ani uložit</strong>.</span></li>
              </ul>
              <div className="border-t border-gray-100 pt-6">
                <ButtonPrimary onClick={() => setTestStarted(true)} icon={Play}>ROZUMÍM, SPUSTIT TEST</ButtonPrimary>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <header className="bg-white border-b border-gray-200 py-4 px-6 flex justify-center items-center relative">
        <img src="https://www.smarty.cz/img/logo-smartycz-inversed.svg" alt="Smarty.cz" className="h-6" />
        <div className="absolute right-6 flex items-center gap-2 text-sm text-gray-500"><User size={16} /><span className="font-semibold text-gray-900">{currentCandidate.name}</span></div>
      </header>
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Vstupní Assessment</h1>
          <p className="text-gray-500">Role: <span className="font-bold text-black">{allRoles.find(r => r.id === currentCandidate.roleId)?.label || currentCandidate.roleId}</span></p>
        </div>
        <TestRunner roleId={currentCandidate.roleId} onComplete={onFinish} isNoSpecificRole={allRoles.find(r => r.id === currentCandidate.roleId)?.noSpecific || false} />
      </div>
    </div>
  );
};

// --- MAIN APP ---
export default function TalentMatchApp() {
  const [appMode, setAppMode] = useState('landing');
  const [candidates, setCandidates] = useState([]);
  const [activeCandidateId, setActiveCandidateId] = useState(null);
  const [currentCandidate, setCurrentCandidate] = useState(null);
  const [benchmarks, setBenchmarks] = useState(INITIAL_BENCHMARKS);
  const [selectedBenchmarkId, setSelectedBenchmarkId] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showBenchmarkModal, setShowBenchmarkModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', role: 'sales' });
  const [generatedLink, setGeneratedLink] = useState(null);
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [isGeneratingBenchmark, setIsGeneratingBenchmark] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [customRoles, setCustomRoles] = useState([]);
  const [showCustomRoleModal, setShowCustomRoleModal] = useState(false);
  const allRoles = [...BASE_ROLES, ...customRoles];

  // Detekce odkazu pro kandidáta (?test=ID) – jen jednou při načtení
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const testId = params.get('test');
    if (testId) {
      const fetchCandidate = async () => {
        try {
          const docRef = doc(db, "candidates", testId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setCurrentCandidate({ id: docSnap.id, ...docSnap.data() });
            setAppMode('candidate');
          } else {
            alert("Neplatný nebo expirovaný odkaz testu.");
          }
        } catch (e) {
          console.error("Chyba při načítání testu:", e);
          alert("Chyba připojení k databázi. Zkontrolujte Firebase nastavení.");
        }
      };
      fetchCandidate();
    }
  }, []);

  // Realtime sync kandidátů jen v admin módu
  useEffect(() => {
    if (appMode !== 'admin') return;
    const unsub = onSnapshot(collection(db, "candidates"), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setCandidates(data);
    }, (error) => {
      console.error("Firestore error:", error);
    });
    return () => unsub();
  }, [appMode]);

  const handleLogin = (res) => setAppMode(res === 'admin' ? 'admin' : 'landing');

  const handleGenerateInvite = async () => {
    if (!inviteForm.name) return;
    setIsGeneratingLink(true);
    try {
      const now = new Date();
      const newCandidate = {
        name: inviteForm.name,
        roleId: inviteForm.role,
        status: 'pending',
        date: now.toLocaleDateString('cs-CZ'),
        linkGeneratedAt: now.toISOString(),
        createdAt: serverTimestamp(),
        score: null,
        results: null,
        rawAnswers: null,
        timeTaken: null
      };
      const docRef = await addDoc(collection(db, "candidates"), newCandidate);
      setGeneratedLink(`${window.location.origin}${window.location.pathname}?test=${docRef.id}`);
    } catch (error) {
      console.error("Chyba při ukládání:", error);
      alert(`Chyba: ${error.message}`);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  // FIX: handleSimulateLinkClick – odstraněno neexistující setTestStarted
  const handleSimulateLinkClick = async () => {
    if (!generatedLink) return;
    try {
      const fakeUrl = new URL(generatedLink);
      const testId = fakeUrl.searchParams.get('test');
      const docSnap = await getDoc(doc(db, "candidates", testId));
      if (docSnap.exists()) {
        setCurrentCandidate({ id: docSnap.id, ...docSnap.data() });
        setAppMode('candidate');
        setShowInviteModal(false);
        setGeneratedLink(null);
      }
    } catch (e) {
      console.error("Chyba simulace:", e);
      alert("Nepodařilo se načíst test pro simulaci.");
    }
  };

  const handleCandidateFinish = async (results, timeTaken, rawAnswers) => {
    const scoreFields = [results.iq || 0, results.integrity || 0, results.conscientiousness || 0];
    if (results.specific !== null && results.specific !== undefined) scoreFields.push(results.specific);
    const avgScore = Math.round(scoreFields.reduce((a, b) => a + b, 0) / scoreFields.length);
    try {
      const candidateRef = doc(db, "candidates", currentCandidate.id);
      await updateDoc(candidateRef, {
        status: 'completed',
        results,
        score: avgScore,
        timeTaken,
        rawAnswers,
        completedAt: serverTimestamp()
      });
      setCurrentCandidate(prev => ({ ...prev, status: 'completed' }));
    } catch (e) {
      console.error("Chyba při ukládání výsledků:", e);
      alert("Výsledky se nepodařilo uložit. Zkontrolujte připojení.");
    }
  };

  const handleExportPdf = (candidate, benchmark, analysis) => {
    const roleName = allRoles.find(r => r.id === candidate.roleId)?.label || candidate.roleId;
    const matchPct = calculateMatch(candidate.results, benchmark?.metrics);
    const metricRows = [
      { label: 'IQ / Logické myšlení', val: candidate.results?.iq ?? '-' },
      { label: 'Odbornost', val: candidate.results?.specific ?? '-' },
      { label: 'Integrita', val: candidate.results?.integrity ?? '-' },
      { label: 'Svědomitost', val: candidate.results?.conscientiousness ?? '-' },
      { label: 'Otevřenost', val: candidate.results?.openness ?? '-' },
      { label: 'Extraverze', val: candidate.results?.extraversion ?? '-' },
      { label: 'Přívětivost', val: candidate.results?.agreeableness ?? '-' },
      { label: 'Neuroticismus', val: candidate.results?.neuroticism ?? '-' },
    ].filter(m => m.val !== '-' || !allRoles.find(r => r.id === candidate.roleId)?.noSpecific);

    const html = `<!DOCTYPE html><html lang="cs"><head><meta charset="UTF-8"/><title>Report – ${candidate.name}</title>
    <style>
      body{font-family:Arial,sans-serif;margin:0;padding:40px;color:#1a1a1a;font-size:13px;}
      h1{color:#E30074;font-size:22px;margin-bottom:4px;}
      h2{font-size:14px;color:#555;font-weight:normal;margin-top:0;}
      .header{border-bottom:3px solid #E30074;padding-bottom:16px;margin-bottom:24px;}
      .logo{font-size:18px;font-weight:bold;color:#E30074;margin-bottom:8px;}
      .score-box{background:#fdf2f8;border:2px solid #E30074;border-radius:8px;padding:16px;text-align:center;margin-bottom:24px;}
      .score-num{font-size:48px;font-weight:bold;color:#E30074;}
      .section{margin-bottom:20px;}
      .section-title{font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:4px;}
      .metric-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f5f5f5;}
      .metric-bar-wrap{flex:1;margin:0 12px;background:#eee;height:8px;border-radius:4px;overflow:hidden;}
      .metric-bar{height:8px;background:#E30074;border-radius:4px;}
      .metric-val{font-weight:bold;width:30px;text-align:right;}
      .metric-label{width:140px;color:#555;}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;}
      .info-item{background:#f9f9f9;border-radius:6px;padding:10px;}
      .info-item label{display:block;font-size:10px;color:#888;text-transform:uppercase;margin-bottom:2px;}
      .info-item span{font-weight:bold;font-size:14px;}
      .analysis{background:#fdf2f8;border-left:4px solid #E30074;padding:14px;border-radius:0 8px 8px 0;white-space:pre-wrap;line-height:1.6;font-size:12px;}
      .footer{margin-top:40px;padding-top:12px;border-top:1px solid #eee;text-align:center;font-size:10px;color:#aaa;}
      @media print{body{padding:20px;}}
    </style></head><body>
    <div class="header">
      <div class="logo">TalentMatch · smarty.cz</div>
      <h1>${candidate.name}</h1>
      <h2>Pozice: ${roleName} &nbsp;|&nbsp; Test dokončen: ${candidate.date}</h2>
    </div>
    <div class="score-box">
      <div style="font-size:12px;color:#888;margin-bottom:4px;">CELKOVÉ SKÓRE</div>
      <div class="score-num">${candidate.score}<span style="font-size:20px;color:#aaa;">/100</span></div>
      ${benchmark ? `<div style="font-size:12px;color:#555;margin-top:8px;">Shoda s benchmarkem „${benchmark.role}": <strong>${matchPct}%</strong></div>` : ''}
    </div>
    <div class="info-grid">
      <div class="info-item"><label>Doba trvání testu</label><span>${formatTime(candidate.timeTaken)}</span></div>
      <div class="info-item"><label>Datum testu</label><span>${candidate.date}</span></div>
    </div>
    <div class="section">
      <div class="section-title">Výsledky dle kategorií</div>
      ${metricRows.map(m => `<div class="metric-row"><span class="metric-label">${m.label}</span><div class="metric-bar-wrap"><div class="metric-bar" style="width:${m.val}%"></div></div><span class="metric-val">${m.val}</span></div>`).join('')}
    </div>
    ${analysis ? `<div class="section"><div class="section-title">AI Analýza</div><div class="analysis">${analysis}</div></div>` : ''}
    <div class="footer">Vygenerováno systémem TalentMatch · ${new Date().toLocaleDateString('cs-CZ')} · smarty.cz</div>
    </body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.print(); };
  };

  const handleDeleteCandidate = async (candidateId, candidateName) => {
    if (!window.confirm(`Opravdu chcete smazat záznam kandidáta "${candidateName}"? Tato akce je nevratná.`)) return;
    try {
      await deleteDoc(doc(db, "candidates", candidateId));
    } catch (e) {
      console.error("Chyba při mazání:", e);
      alert("Nepodařilo se smazat záznam.");
    }
  };

  const handleAddCustomRole = () => setShowCustomRoleModal(true);

  const handleSaveCustomRole = (newRole) => {
    setCustomRoles(prev => [...prev, newRole]);
    // Also add questions to QUESTIONS.specific dynamically
    QUESTIONS.specific[newRole.id] = newRole.questions || [];
  };

  const handleDeleteCustomRole = (roleId) => {
    if (!window.confirm('Smazat tuto vlastní pozici?')) return;
    setCustomRoles(prev => prev.filter(r => r.id !== roleId));
    delete QUESTIONS.specific[roleId];
  };

  const handlePromoteToBenchmark = (candidate) => {
    if (!candidate.results) { alert("Kandidát nemá výsledky."); return; }
    const newBenchmark = { id: `bench_${candidate.id}`, role: `Profil: ${candidate.name}`, metrics: { ...candidate.results } };
    setBenchmarks(prev => [...prev, newBenchmark]);
    alert(`Profil "${candidate.name}" byl přidán jako benchmark.`);
  };

  const generateBenchmark = async () => {
    if (!newRoleDescription) return;
    setIsGeneratingBenchmark(true);
    const data = await callGemini(
      `Jsi expert HR psycholog. Převeď tento popis role na JSON objekt. Popis: "${newRoleDescription}". Vrať POUZE JSON ve formátu: {"role": "název role", "metrics": {"iq": 0-100, "openness": 0-100, "conscientiousness": 0-100, "extraversion": 0-100, "agreeableness": 0-100, "neuroticism": 0-100, "integrity": 0-100, "specific": 0-100}}`,
      "", true
    );
    if (data) {
      setBenchmarks(prev => [...prev, { id: `custom_${Date.now()}`, ...data }]);
      setShowBenchmarkModal(false);
      setNewRoleDescription("");
    } else {
      alert("AI benchmark se nepodařilo vygenerovat. Zkontrolujte API klíč.");
    }
    setIsGeneratingBenchmark(false);
  };

  const generateAnalysis = async (candidate, benchmark) => {
    setIsAnalysing(true);
    setAiAnalysis(null);
    const matchPct = calculateMatch(candidate.results, benchmark.metrics);
    const prompt = `Jsi senior HR konzultant. Analyzuj kandidáta "${candidate.name}" pro roli "${benchmark.role}".
Celková shoda s benchmarkem: ${matchPct}%.
Výsledky kandidáta: ${JSON.stringify(candidate.results)}.
Benchmark profil: ${JSON.stringify(benchmark.metrics)}.
Čas dokončení: ${formatTime(candidate.timeTaken)}.

Napiš strukturovaný report v češtině:
1. Celkové hodnocení (2-3 věty)
2. Silné stránky (2-3 body)
3. Oblasti ke zlepšení (2 body)
4. Doporučení pro HR (1-2 věty)`;

    const text = await callGemini(prompt);
    if (text) { setAiAnalysis(text); }
    else { setAiAnalysis("AI analýzu se nepodařilo vygenerovat. Zkontrolujte API klíč."); }
    setIsAnalysing(false);
  };

  return (
    <>
      {appMode === 'landing' && <LandingView setAppMode={setAppMode} />}
      {appMode === 'login' && <LoginScreen onLogin={handleLogin} />}
      {appMode === 'admin' && (
        <>
        <AdminView
          candidates={candidates}
          activeCandidateId={activeCandidateId}
          setActiveCandidateId={(id) => { setActiveCandidateId(id); setAiAnalysis(null); }}
          benchmarks={benchmarks}
          selectedBenchmarkId={selectedBenchmarkId}
          setSelectedBenchmarkId={setSelectedBenchmarkId}
          handlePromoteToBenchmark={handlePromoteToBenchmark}
          generateAnalysis={generateAnalysis}
          aiAnalysis={aiAnalysis}
          isAnalysing={isAnalysing}
          showInviteModal={showInviteModal}
          setShowInviteModal={setShowInviteModal}
          inviteForm={inviteForm}
          setInviteForm={setInviteForm}
          handleGenerateInvite={handleGenerateInvite}
          generatedLink={generatedLink}
          setGeneratedLink={setGeneratedLink}
          handleSimulateLinkClick={handleSimulateLinkClick}
          isGeneratingLink={isGeneratingLink}
          onDeleteCandidate={handleDeleteCandidate}
          showBenchmarkModal={showBenchmarkModal}
          setShowBenchmarkModal={setShowBenchmarkModal}
          newRoleDescription={newRoleDescription}
          setNewRoleDescription={setNewRoleDescription}
          generateBenchmark={generateBenchmark}
          isGeneratingBenchmark={isGeneratingBenchmark}
          setAppMode={setAppMode}
          allRoles={allRoles}
          customRoles={customRoles}
          onAddCustomRole={handleAddCustomRole}
          onDeleteCustomRole={handleDeleteCustomRole}
          onExportPdf={handleExportPdf}
        />
        <CustomRoleModal isOpen={showCustomRoleModal} onClose={() => setShowCustomRoleModal(false)} onSave={handleSaveCustomRole} />
        </>
      )}
      {appMode === 'candidate' && currentCandidate && (
        <CandidateView
          currentCandidate={currentCandidate}
          setAppMode={setAppMode}
          onFinish={handleCandidateFinish}
          allRoles={allRoles}
        />
      )}
    </>
  );
}