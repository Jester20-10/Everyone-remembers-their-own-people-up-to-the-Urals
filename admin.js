import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, getDocs, query, where, updateDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const requestsList = document.getElementById('requestsList');

onAuthStateChanged(auth, (user) => {
    if (user) {
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        loadRequests();
    } else {
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
    }
});

window.login = async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    try { await signInWithEmailAndPassword(auth, email, pass); } 
    catch (error) { document.getElementById('loginError').style.display = 'block'; }
};

window.logout = () => signOut(auth);

async function loadRequests() {
    requestsList.innerHTML = '<p>Загрузка...</p>';
    const q = query(collection(db, "submissions"), where("status", "==", "pending"));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) { requestsList.innerHTML = '<p>Нет новых заявок. ✅</p>'; return; }

    requestsList.innerHTML = '';
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const id = docSnap.id;
        const card = document.createElement('div');
        card.className = 'request-card';
        card.innerHTML = `
            <span class="status-badge">Новая заявка</span>
            <h3>${data.name}</h3>
            <p><strong>Район:</strong> ${data.district}</p>
            <p><strong>История:</strong><br>${data.story}</p>
            <p><strong>Контакты:</strong> ${data.contact || 'Нет'}</p>
            <div class="btn-group">
                <button class="btn-approve" onclick="approveHero('${id}', '${data.name}')">✅ Одобрить</button>
                <button class="btn-reject" onclick="rejectHero('${id}')">❌ Отклонить</button>
            </div>`;
        requestsList.appendChild(card);
    });
}

window.approveHero = async (id, name) => {
    if(!confirm(`Одобрить ${name}?`)) return;
    const docRef = doc(db, "submissions", id);
    const snap = await getDocs(query(collection(db, "submissions")));
    let targetData = null;
    snap.forEach(d => { if(d.id === id) targetData = d.data(); });

    if(targetData) {
        await addDoc(collection(db, "heroes"), { ...targetData, status: 'published', approvedAt: new Date() });
        await updateDoc(docRef, { status: 'approved' });
        alert('Опубликовано!');
        loadRequests();
    }
};

window.rejectHero = async (id) => {
    if(!confirm('Отклонить?')) return;
    await deleteDoc(doc(db, "submissions", id));
    alert('Удалено.');
    loadRequests();
};
