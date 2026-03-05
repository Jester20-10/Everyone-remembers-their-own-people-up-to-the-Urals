import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, getDocs, query, where, updateDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
        // Загружаем и pending, и pending_update
        const q = query(collection(db, "submissions"), where("status", "in", currentTab === 'pending' ? ['pending', 'pending_update'] : ['published']));
        const snapshot = await getDocs(q);
        
        let count = 0;
        requestsList.innerHTML = '';
        
        if (snapshot.empty) {
            requestsList.innerHTML = `<div style="text-align:center; padding:40px; color:#666;">${currentTab === 'pending' ? 'Нет заявок' : 'Пусто'}</div>`;
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
            
            // Формирование карточки (упрощено для краткости, аналогично предыдущей версии)
            const card = document.createElement('div');
            card.className = `request-card ${currentTab === 'published' ? 'published' : ''}`;
            
            let actionButtons = '';
            if (currentTab === 'pending') {
                if (isUpdate) {
                    actionButtons = `
                        <button class="btn-approve" onclick="approveUpdate('${id}', '${data.originalHeroId}')">✅ Применить изменения</button>
                        <button class="btn-reject" onclick="rejectHero('${id}')">❌ Отклонить</button>
                    `;
                } else {
                    actionButtons = `
                        <button class="btn-approve" onclick="approveHero('${id}')">✅ Одобрить</button>
                        <button class="btn-reject" onclick="rejectHero('${id}')">❌ Отклонить</button>
                    `;
                }
                actionButtons += `<button class="btn-edit" onclick="openEditModal('${id}')">✏️ Правка</button>`;
            } else {
                actionButtons = `
                    <button class="btn-edit" onclick="openEditModal('${id}')">✏️ Редактировать</button>
                    <button class="btn-delete" onclick="deleteHero('${id}')">🗑️ Удалить</button>
                `;
            }

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between;"><span class="status-badge">${badgeText}</span></div>
                <h3 style="color:#8B0000;">${data.name}</h3>
                <p><strong>Район:</strong> ${data.district}</p>
                <p><strong>Статус:</strong> ${isUpdate ? 'Запрос на обновление' : 'Новая запись'}</p>
                <p><strong>Биография:</strong> ${data.story?.substring(0, 100)}...</p>
                ${data.image ? `<p><a href="${data.image}" target="_blank">Фото</a></p>` : ''}
                <div class="btn-group">${actionButtons}</div>
            `;
            requestsList.appendChild(card);
        });
        
        if(currentTab === 'pending') document.getElementById('countPending').textContent = count;
        else document.getElementById('countPublished').textContent = count;

    } catch (error) { console.error(error); }
}

// Одобрение нового героя
window.approveHero = async (id) => {
    try {
        const allSubs = await getDocs(collection(db, "submissions"));
        let data = null;
        allSubs.forEach(d => { if(d.id === id) data = d.data(); });
        
        await addDoc(collection(db, "heroes"), {
            ...data, status: 'published', approvedAt: new Date()
        });
        await updateDoc(doc(db, "submissions", id), { status: 'approved' });
        alert('Опубликовано!');
        loadContent();
    } catch (e) { alert(e.message); }
};

// Применение обновления
window.approveUpdate = async (id, originalId) => {
    if(!confirm('Применить изменения к герою?')) return;
    try {
        const allSubs = await getDocs(collection(db, "submissions"));
        let newData = null;
        allSubs.forEach(d => { if(d.id === id) newData = d.data(); });

        // Найти документ в heroes и обновить его
        const heroesQ = query(collection(db, "heroes"), where("status", "==", "published"));
        const heroesSnap = await getDocs(heroesQ);
        let heroDocId = null;
        
        heroesSnap.forEach(d => {
            // Ищем по ID оригинала, если он сохранен, или по имени
            if (d.id === originalId || (newData.name === d.data().name && newData.district === d.data().district)) {
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

window.deleteHero = async (id) => {
    // Логика удаления из published (аналогично предыдущей версии)
    alert('Функция удаления требует доработки поиска документа в heroes по ID submissions.');
};

// Редактирование админом (открывает модалку из admin.html)
window.openEditModal = (id) => {
    alert('Функция редактирования админом открывает модальное окно (код верстки в admin.html).');
    // Здесь должна быть логика заполнения формы и сохранения, аналогичная предыдущей версии
};
