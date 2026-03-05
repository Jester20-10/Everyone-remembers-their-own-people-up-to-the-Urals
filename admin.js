import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, addDoc, getDocs, getDoc, query, where, 
    updateDoc, doc, deleteDoc, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentTab = 'pending';

const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const requestsList = document.getElementById('requestsList');

// --- АВТОРИЗАЦИЯ ---
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
    try { 
        await signInWithEmailAndPassword(auth, email, pass); 
        document.getElementById('loginError').style.display = 'none';
    } catch (error) { 
        const errBox = document.getElementById('loginError');
        errBox.textContent = "Ошибка: " + error.message;
        errBox.style.display = 'block'; 
    }
};

window.logout = () => signOut(auth);

// --- ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ---
window.switchTab = (tab) => {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    loadContent();
};

// --- ЗАГРУЗКА КОНТЕНТА ---
async function loadContent() {
    requestsList.innerHTML = '<p style="text-align:center; padding:20px;">Загрузка данных...</p>';
    
    try {
        if (currentTab === 'pending') {
            // Загружаем заявки на модерацию (новые и изменения)
            await loadPendingRequests();
        } else {
            // Загружаем опубликованных героев напрямую из базы heroes
            await loadPublishedHeroes();
        }
    } catch (error) {
        console.error("Ошибка загрузки:", error);
        requestsList.innerHTML = `<p style="color:red; text-align:center;">Ошибка: ${error.message}</p>`;
    }
}

// 1. Загрузка заявок (Pending & Pending_Update)
async function loadPendingRequests() {
    const q = query(collection(db, "submissions"), where("status", "in", ["pending", "pending_update"]));
    const snapshot = await getDocs(q);
    
    let count = 0;
    requestsList.innerHTML = '';
    
    if (snapshot.empty) {
        requestsList.innerHTML = '<div style="text-align:center; padding:40px; color:#4caf50;"><h3>🎉 Нет заявок на модерацию</h3><p>Все истории проверены!</p></div>';
        document.getElementById('countPending').textContent = '0';
        return;
    }

    const items = [];
    snapshot.forEach(docSnap => items.push({ id: docSnap.id, ...docSnap.data() }));
    // Сортировка: новые сверху
    items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    items.forEach(data => {
        count++;
        const id = data.id;
        const isUpdate = data.status === 'pending_update';
        const badgeText = isUpdate ? '✏️ Изменение' : '➕ Новый герой';
        const statusColor = isUpdate ? '#ff9800' : '#2196f3';
        
        const card = document.createElement('div');
        card.className = 'request-card';
        card.style.borderLeftColor = statusColor;
        
        let actionButtons = '';
        if (isUpdate) {
            actionButtons = `
                <button class="btn-approve" onclick="approveUpdate('${id}', '${data.originalHeroId}')">✅ Применить изменения</button>
                <button class="btn-reject" onclick="rejectHero('${id}')">❌ Отклонить</button>
            `;
        } else {
            actionButtons = `
                <button class="btn-approve" onclick="approveHero('${id}')">✅ Одобрить и Опубликовать</button>
                <button class="btn-reject" onclick="rejectHero('${id}')">❌ Отклонить</button>
            `;
        }

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="status-badge" style="background:${statusColor}; color:white;">${badgeText}</span>
                <small style="color:#999">${data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : ''}</small>
            </div>
            
            <h3 style="margin:10px 0 5px; color:#8B0000;">${data.name || 'Без имени'}</h3>
            
            <div style="background:#f9f9f9; padding:10px; border-radius:8px; margin-bottom:10px; font-size:0.9rem;">
                <p><strong>Район:</strong> ${data.district || '-'}</p>
                <p><strong>Статус:</strong> ${data.type === 'frontovik' ? 'Фронтовик' : 'Труженик тыла'}</p>
                ${data.birthDate ? `<p><strong>Даты:</strong> ${new Date(data.birthDate).toLocaleDateString()} — ${data.deathDate ? new Date(data.deathDate).toLocaleDateString() : '?'}</p>` : ''}
            </div>

            <p><strong>📜 Биография:</strong><br><span style="white-space: pre-wrap; font-size:0.9rem;">${data.story || 'Нет биографии'}</span></p>
            
            ${data.battlePath ? `<p><strong>📍 Боевой путь:</strong><br><span style="font-size:0.9rem;">${data.battlePath}</span></p>` : ''}

            <div style="margin-top:10px; font-size:0.9rem; display:grid; gap:5px;">
                ${data.image && !data.image.includes('placeholder') ? 
                  `<p><strong>📷 Фото:</strong> <a href="${data.image}" target="_blank" style="color:#2196f3;">Открыть ссылку</a></p>` : 
                  '<p><strong>📷 Фото:</strong> Не загружено</p>'}
                
                ${data.video ? 
                  `<p><strong>🎬 Видео:</strong> <a href="${data.video}" target="_blank" style="color:#2196f3;">Открыть ссылку</a></p>` : 
                  ''}
            </div>

            <p style="font-size:0.85rem; color:#666; margin-top:10px; border-top:1px solid #eee; paddingTop:5px;">
                <strong>Контакты заявителя:</strong> ${data.contact || 'Не указаны'}
            </p>

            <div class="btn-group">
                ${actionButtons}
            </div>
        `;
        requestsList.appendChild(card);
    });

    document.getElementById('countPending').textContent = count;
}

// 2. Загрузка опубликованных героев (Прямой запрос к базе heroes)
async function loadPublishedHeroes() {
    const q = query(collection(db, "heroes"), where("status", "==", "published"));
    const snapshot = await getDocs(q);
    
    let count = 0;
    requestsList.innerHTML = '';
    
    if (snapshot.empty) {
        requestsList.innerHTML = '<div style="text-align:center; padding:40px; color:#666;"><p>Список опубликованных героев пуст.</p></div>';
        document.getElementById('countPublished').textContent = '0';
        return;
    }

    const items = [];
    snapshot.forEach(docSnap => items.push({ id: docSnap.id, ...docSnap.data() }));
    // Сортировка по имени
    items.sort((a, b) => a.name.localeCompare(b.name));

    items.forEach(data => {
        count++;
        const id = data.id;
        
        const card = document.createElement('div');
        card.className = 'request-card published';
        
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between;">
                <span class="status-badge" style="background:#4caf50; color:white;">✅ Опубликован</span>
                <small style="color:#999">ID: ${id.substr(0,8)}...</small>
            </div>
            
            <h3 style="margin:10px 0 5px; color:#8B0000;">${data.name || 'Без имени'}</h3>
            <p><strong>Район:</strong> ${data.district || '-'}</p>
            <p><strong>Добавил:</strong> ${data.addedBy ? 'Пользователь' : 'Админ'}</p>
            
            <div class="btn-group">
                <button class="btn-delete" onclick="deletePublishedHero('${id}', '${data.name.replace(/'/g, "\\'")}')">🗑️ Удалить из базы</button>
            </div>
        `;
        requestsList.appendChild(card);
    });

    document.getElementById('countPublished').textContent = count;
}

// --- ДЕЙСТВИЯ ---

// Одобрение нового героя
window.approveHero = async (id) => {
    if(!confirm('Одобрить этого героя? Он появится в приложении у всех пользователей.')) return;
    
    try {
        const subDoc = await getDoc(doc(db, "submissions", id));
        if (!subDoc.exists()) throw new Error("Заявка не найдена");
        const data = subDoc.data();
        
        // Копируем в базу heroes
        await addDoc(collection(db, "heroes"), { 
            ...data, 
            status: 'published', 
            approvedAt: new Date(),
            approvedBy: auth.currentUser.email 
        });
        
        // Меняем статус заявки
        await updateDoc(doc(db, "submissions", id), { status: 'approved' });
        
        alert('✅ Герой успешно опубликован!');
        loadContent();
    } catch (e) { 
        alert("Ошибка публикации: " + e.message); 
    }
};

// Применение изменений (Update)
window.approveUpdate = async (id, originalHeroId) => {
    if(!confirm('Применить изменения к герою? Старая версия будет заменена.')) return;
    
    try {
        const subDoc = await getDoc(doc(db, "submissions", id));
        if (!subDoc.exists()) throw new Error("Заявка не найдена");
        const newData = subDoc.data();
        
        let targetHeroId = originalHeroId;
        
        // Если ID оригинала не передан или не найден, ищем по имени и району
        if (!targetHeroId) {
            const heroesQ = query(collection(db, "heroes"), where("status", "==", "published"));
            const heroesSnap = await getDocs(heroesQ);
            
            heroesSnap.forEach(d => {
                const hData = d.data();
                if (hData.name === newData.name && hData.district === newData.district) {
                    targetHeroId = d.id;
                }
            });
        }
        
        if (!targetHeroId) throw new Error("Не удалось найти оригинальную запись героя в базе для обновления.");
        
        // Обновляем запись в heroes
        await updateDoc(doc(db, "heroes", targetHeroId), {
            ...newData,
            status: 'published', // На всякий случай
            updatedAt: new Date(),
            updatedBy: auth.currentUser.email
        });
        
        // Помечаем заявку как выполненную
        await updateDoc(doc(db, "submissions", id), { status: 'approved' });
        
        alert('✅ Изменения успешно применены!');
        loadContent();
    } catch (e) { 
        alert("Ошибка обновления: " + e.message); 
    }
};

// Отклонение заявки (удаление из submissions)
window.rejectHero = async (id) => {
    if(!confirm('Отклонить эту заявку? Данные будут удалены безвозвратно.')) return;
    try {
        await deleteDoc(doc(db, "submissions", id));
        alert('Заявка отклонена.');
        loadContent();
    } catch (e) { alert("Ошибка: " + e.message); }
};

// Удаление опубликованного героя (из базы heroes)
window.deletePublishedHero = async (id, name) => {
    if (!confirm(`⚠️ ВЫ УВЕРЕНЫ?\nВы собираетесь УДАЛИТЬ героя "${name}" из базы данных.\nЭто действие нельзя отменить!`)) return;
    
    try {
        await deleteDoc(doc(db, "heroes", id));
        alert(`✅ Герой "${name}" удален из приложения.`);
        loadContent();
    } catch (error) {
        console.error(error);
        alert("Ошибка удаления: " + error.message);
    }
};
