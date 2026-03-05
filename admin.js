import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, getDocs, getDoc, query, where, updateDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentTab = 'pending';

const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const requestsList = document.getElementById('requestsList');

onAuthStateChanged(auth, (user) => {
    if (user) {
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        loadContent();
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

window.switchTab = (tab) => {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    loadContent();
};

async function loadContent() {
    requestsList.innerHTML = '<p style="text-align:center; padding:20px;">Загрузка...</p>';
    try {
        let q;
        if (currentTab === 'pending') {
            q = query(collection(db, "submissions"), where("status", "in", ['pending', 'pending_update']));
        } else {
            // Для опубликованных ищем статус published
            q = query(collection(db, "submissions"), where("status", "==", 'published'));
        }
        
        const snapshot = await getDocs(q);
        let count = 0;
        requestsList.innerHTML = '';
        
        if (snapshot.empty) {
            requestsList.innerHTML = `<div style="text-align:center; padding:40px; color:#666;">${currentTab === 'pending' ? 'Нет заявок' : 'Нет опубликованных записей в черновиках'}</div>`;
            // Примечание: Опубликованные герои хранятся в коллекции heroes, но мы показываем здесь связь с submissions
            // Если вы хотите видеть ВСЕХ героев из коллекции heroes, логику нужно чуть изменить.
            // Сейчас этот код показывает те, что имеют статус published в submissions.
            // Для полного списка героев лучше делать запрос к коллекции heroes.
            if (currentTab === 'published') {
                 await loadPublishedHeroesDirectly();
                 return;
            }
            return;
        }

        const items = [];
        snapshot.forEach(docSnap => items.push({ id: docSnap.id, ...docSnap.data() }));
        items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        items.forEach(data => {
            count++;
            const id = data.id;
            const isUpdate = data.status === 'pending_update';
            const badgeText = isUpdate ? '✏️ Изменение' : '➕ Новый';
            
            const card = document.createElement('div');
            card.className = 'request-card';
            
            let actionButtons = '';
            if (currentTab === 'pending') {
                if (isUpdate) {
                    actionButtons = `
                        <button class="btn-approve" onclick="approveUpdate('${id}', '${data.originalHeroId}')">✅ Применить</button>
                        <button class="btn-reject" onclick="rejectHero('${id}')">❌ Отклонить</button>
                    `;
                } else {
                    actionButtons = `
                        <button class="btn-approve" onclick="approveHero('${id}')">✅ Одобрить</button>
                        <button class="btn-reject" onclick="rejectHero('${id}')">❌ Отклонить</button>
                    `;
                }
            } else {
                actionButtons = `
                    <button class="btn-delete" onclick="deleteHero('${id}', '${data.name.replace(/'/g, "\\'")}')">🗑️ Удалить</button>
                `;
            }

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between;"><span class="status-badge">${badgeText}</span></div>
                <h3 style="color:#8B0000;">${data.name}</h3>
                <p><strong>Район:</strong> ${data.district}</p>
                <p><strong>Статус:</strong> ${data.status}</p>
                <div class="btn-group">${actionButtons}</div>
            `;
            requestsList.appendChild(card);
        });
        
        document.getElementById('countPending').textContent = currentTab === 'pending' ? count : '-';
        document.getElementById('countPublished').textContent = currentTab === 'published' ? count : '-';

    } catch (error) { console.error(error); }
}

// Отдельная функция для загрузки всех героев из основной коллекции
async function loadPublishedHeroesDirectly() {
    const q = query(collection(db, "heroes"), where("status", "==", "published"));
    const snapshot = await getDocs(q);
    let count = 0;
    const list = document.getElementById('requestsList');
    list.innerHTML = '';
    
    if(snapshot.empty) {
        list.innerHTML = '<div style="text-align:center">Список пуст</div>';
        return;
    }

    snapshot.forEach(docSnap => {
        count++;
        const data = docSnap.data();
        const id = docSnap.id;
        const card = document.createElement('div');
        card.className = 'request-card published';
        card.innerHTML = `
            <h3 style="color:#8B0000;">${data.name}</h3>
            <p><strong>Район:</strong> ${data.district}</p>
            <div class="btn-group">
                <button class="btn-delete" onclick="deletePublishedHero('${id}', '${data.name.replace(/'/g, "\\'")}')">🗑️ Удалить из базы</button>
            </div>
        `;
        list.appendChild(card);
    });
    document.getElementById('countPublished').textContent = count;
}

window.approveHero = async (id) => {
    try {
        const subDoc = await getDoc(doc(db, "submissions", id));
        if(!subDoc.exists()) return;
        const data = subDoc.data();
        
        await addDoc(collection(db, "heroes"), { ...data, status: 'published', approvedAt: new Date() });
        await updateDoc(doc(db, "submissions", id), { status: 'approved' });
        alert('Опубликовано!');
        loadContent();
    } catch (e) { alert(e.message); }
};

window.approveUpdate = async (id, originalId) => {
    if(!confirm('Применить изменения?')) return;
    try {
        const subDoc = await getDoc(doc(db, "submissions", id));
        if(!subDoc.exists()) return;
        const newData = subDoc.data();

        // Находим героя в heroes
        const heroesQ = query(collection(db, "heroes"), where("status", "==", "published"));
        const heroesSnap = await getDocs(heroesQ);
        let heroDocId = null;
        
        heroesSnap.forEach(d => {
            if (d.id === originalId || (d.data().name === newData.name && d.data().district === newData.district)) {
                heroDocId = d.id;
            }
        });

        if (heroDocId) {
            await updateDoc(doc(db, "heroes", heroDocId), newData);
            await updateDoc(doc(db, "submissions", id), { status: 'approved' });
            alert('Изменения применены!');
        } else {
            alert('Ошибка: Оригинал не найден');
        }
        loadContent();
    } catch (e) { alert(e.message); }
};

window.rejectHero = async (id) => {
    if(!confirm('Отклонить?')) return;
    await deleteDoc(doc(db, "submissions", id));
    loadContent();
};

// Удаление заявки из submissions (для вкладки pending)
window.deleteHero = async (id, name) => {
    if (!confirm(`Удалить заявку "${name}"?`)) return;
    await deleteDoc(doc(db, "submissions", id));
    loadContent();
};

// Удаление героя из основной коллекции heroes (для вкладки published)
window.deletePublishedHero = async (id, name) => {
    if (!confirm(`⚠️ ВЫ УВЕРЕНЫ?\nУдалить героя "${name}" из базы?\nЭто действие необратимо!`)) return;
    try {
        await deleteDoc(doc(db, "heroes", id));
        alert(`✅ Герой "${name}" удален.`);
        loadContent();
    } catch (error) {
        alert("Ошибка: " + error.message);
    }
};
