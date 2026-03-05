import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, getDocs, query, where, updateDoc, doc, deleteDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const requestsList = document.getElementById('requestsList');

// --- АВТОРИЗАЦИЯ ---
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
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        const errBox = document.getElementById('loginError');
        errBox.textContent = "Ошибка: " + error.message;
        errBox.style.display = 'block';
        console.error(error);
    }
};

window.logout = () => signOut(auth);

// --- ЗАГРУЗКА ЗАЯВОК ---
async function loadRequests() {
    requestsList.innerHTML = '<p style="text-align:center; padding:20px;">Загрузка заявок...</p>';
    
    try {
        // Ищем заявки со статусом pending
        const q = query(collection(db, "submissions"), where("status", "==", "pending"));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            requestsList.innerHTML = '<div style="text-align:center; padding:40px; color:#4caf50;"><h3>🎉 Нет новых заявок</h3><p>Все истории проверены!</p></div>';
            return;
        }

        requestsList.innerHTML = '';
        
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            // Форматирование дат для отображения
            const bDate = data.birthDate ? new Date(data.birthDate).toLocaleDateString() : '?';
            const dDate = data.deathDate ? new Date(data.deathDate).toLocaleDateString() : '?';
            const typeLabel = data.type === 'frontovik' ? 'Фронтовик' : 'Труженик тыла';
            
            // Обработка боевого пути для красивого вывода
            let pathHtml = '';
            if (data.battlePath) {
                const points = data.battlePath.split(';');
                pathHtml = '<ul style="padding-left:20px; font-size:0.9rem; color:#555; margin:5px 0;">';
                points.forEach(p => {
                    if(p.trim()) pathHtml += `<li>${p.trim()}</li>`;
                });
                pathHtml += '</ul>';
            } else {
                pathHtml = '<span style="color:#999; font-style:italic;">Не указан</span>';
            }

            const card = document.createElement('div');
            card.className = 'request-card';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <span class="status-badge">Новая заявка</span>
                    <small style="color:#999">${new Date(data.createdAt?.seconds * 1000).toLocaleDateString()}</small>
                </div>
                
                <h3 style="margin:10px 0 5px; color:#8B0000;">${data.name || 'Без имени'}</h3>
                
                <div style="background:#f9f9f9; padding:10px; border-radius:8px; margin-bottom:10px; font-size:0.9rem;">
                    <p><strong>Звание:</strong> ${data.rank || '-'}</p>
                    <p><strong>Статус:</strong> ${typeLabel}</p>
                    <p><strong>Даты жизни:</strong> ${bDate} — ${dDate}</p>
                    <p><strong>Район:</strong> ${data.district || '-'}</p>
                </div>

                <p><strong>📜 Биография:</strong><br><span style="white-space: pre-wrap;">${data.story || 'Нет описания'}</span></p>
                
                <p><strong>📍 Боевой путь:</strong></p>
                ${pathHtml}

                <div style="margin-top:10px; font-size:0.9rem;">
                    ${data.image && !data.image.includes('placeholder') ? 
                      `<p><strong>📷 Фото:</strong> <a href="${data.image}" target="_blank" style="color:#1565c0;">Открыть фото (ImgBB)</a></p>` : 
                      '<p><strong>📷 Фото:</strong> Не загружено</p>'}
                    
                    ${data.video ? 
                      `<p><strong>🎬 Видео:</strong> <a href="${data.video}" target="_blank" style="color:#1565c0;">Открыть ссылку</a></p>` : 
                      ''}
                </div>

                <p style="font-size:0.85rem; color:#666; margin-top:10px;">
                    <strong>Контакты заявителя:</strong> ${data.contact || 'Не указаны'}
                </p>

                <div class="btn-group">
                    <button class="btn-approve" onclick="approveHero('${id}', '${data.name.replace(/'/g, "\\'")}')">✅ Одобрить и Опубликовать</button>
                    <button class="btn-reject" onclick="rejectHero('${id}')">❌ Отклонить</button>
                </div>
            `;
            requestsList.appendChild(card);
        });
    } catch (error) {
        console.error("Ошибка загрузки заявок:", error);
        requestsList.innerHTML = `<p style="color:red; text-align:center;">Ошибка: ${error.message}</p>`;
    }
}

// --- ОДОБРЕНИЕ ГЕРОЯ ---
window.approveHero = async (id, name) => {
    if(!confirm(`Вы уверены, что хотите опубликовать историю героя "${name}"?\n\nПроверьте фото и данные перед подтверждением.`)) return;

    const docRef = doc(db, "submissions", id);
    
    try {
        // 1. Находим полные данные заявки
        // (Так как у нас нет прямого доступа к документу по ID без запроса, делаем быстрый гет)
        // Примечание: В предыдущем коде мы уже имели data из snapshot, но здесь функция вызывается из HTML onclick,
        // поэтому нам нужно снова достать данные или передать их. 
        // Для надежности сделаем повторный fetch данных этого документа.
        
        const docSnap = await getDocs(query(collection(db, "submissions"), where("__name__", "==", id))); 
        // Примечание: Фильтр по __name__ работает не во всех версиях SDK напрямую так. 
        // Лучше использовать getDoc, но у нас импорт только collection/getDocs.
        // Хак: Получим все pending (мы их уже грузили выше, но в рамках функции их нет).
        // Самый надежный способ без getDoc (если не импортирован):
        const allSubs = await getDocs(collection(db, "submissions"));
        let targetData = null;
        
        allSubs.forEach(d => {
            if (d.id === id) targetData = d.data();
        });

        if (!targetData) throw new Error("Данные заявки не найдены");

        // 2. Формируем объект для публикации
        const heroData = {
            ...targetData,
            status: 'published',
            approvedAt: new Date(),
            approvedBy: auth.currentUser.email,
            // Убеждаемся, что критические поля существуют
            birthDate: targetData.birthDate || "",
            deathDate: targetData.deathDate || "",
            battlePath: targetData.battlePath || "",
            video: targetData.video || null,
            image: targetData.image || "https://via.placeholder.com/400?text=Нет+фото"
        };

        // 3. Добавляем в основную коллекцию heroes
        await addDoc(collection(db, "heroes"), heroData);

        // 4. Меняем статус заявки на approved (чтобы исчезла из списка pending)
        await updateDoc(docRef, { status: 'approved' });

        alert(`✅ Герой "${name}" успешно опубликован!\nТеперь он виден всем пользователям в приложении.`);
        
        // 5. Обновляем список
        loadRequests();

    } catch (error) {
        console.error("Ошибка при одобрении:", error);
        alert("❌ Ошибка публикации: " + error.message);
    }
};

// --- ОТКЛОНЕНИЕ ЗАЯВКИ ---
window.rejectHero = async (id) => {
    if(!confirm('Отклонить эту заявку? Данные будут удалены безвозвратно.')) return;
    
    try {
        await deleteDoc(doc(db, "submissions", id));
        alert('Заявка отклонена и удалена.');
        loadRequests();
    } catch (error) {
        console.error(error);
        alert("Ошибка удаления: " + error.message);
    }
};
