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
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        const errBox = document.getElementById('loginError');
        errBox.textContent = "Ошибка: " + error.message;
        errBox.style.display = 'block';
    }
};

window.logout = () => signOut(auth);

async function loadRequests() {
    requestsList.innerHTML = '<p style="text-align:center; padding:20px;">Загрузка...</p>';
    try {
        const q = query(collection(db, "submissions"), where("status", "==", "pending"));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            requestsList.innerHTML = '<div style="text-align:center; padding:40px; color:#4caf50;"><h3>🎉 Нет новых заявок</h3></div>';
            return;
        }

        requestsList.innerHTML = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id;
            const bDate = data.birthDate ? new Date(data.birthDate).toLocaleDateString() : '?';
            const dDate = data.deathDate ? new Date(data.deathDate).toLocaleDateString() : '?';
            const typeLabel = data.type === 'frontovik' ? 'Фронтовик' : 'Труженик тыла';
            
            let pathHtml = '';
            if (data.battlePath) {
                pathHtml = '<ul style="padding-left:20px; font-size:0.9rem; color:#555; margin:5px 0;">';
                data.battlePath.split(';').forEach(p => { if(p.trim()) pathHtml += `<li>${p.trim()}</li>`; });
                pathHtml += '</ul>';
            }

            const card = document.createElement('div');
            card.className = 'request-card';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between;"><span class="status-badge">Новая заявка</span></div>
                <h3 style="margin:10px 0 5px; color:#8B0000;">${data.name || 'Без имени'}</h3>
                <div style="background:#f9f9f9; padding:10px; border-radius:8px; margin-bottom:10px; font-size:0.9rem;">
                    <p><strong>Звание:</strong> ${data.rank || '-'}</p>
                    <p><strong>Статус:</strong> ${typeLabel}</p>
                    <p><strong>Даты:</strong> ${bDate} — ${dDate}</p>
                    <p><strong>Район:</strong> ${data.district || '-'}</p>
                </div>
                <p><strong>📜 Биография:</strong><br>${data.story || ''}</p>
                <p><strong>📍 Боевой путь:</strong></p>${pathHtml || '<span style="color:#999">Не указан</span>'}
                <div style="margin-top:10px; font-size:0.9rem;">
                    ${data.image && !data.image.includes('placeholder') ? `<p><strong>📷 Фото:</strong> <a href="${data.image}" target="_blank">Открыть</a></p>` : ''}
                    ${data.video ? `<p><strong>🎬 Видео:</strong> <a href="${data.video}" target="_blank">Открыть</a></p>` : ''}
                </div>
                <p style="font-size:0.85rem; color:#666;"><strong>Контакты:</strong> ${data.contact || '-'}</p>
                <div class="btn-group">
                    <button class="btn-approve" onclick="approveHero('${id}', '${data.name.replace(/'/g, "\\'")}')">✅ Одобрить</button>
                    <button class="btn-reject" onclick="rejectHero('${id}')">❌ Отклонить</button>
                </div>
            `;
            requestsList.appendChild(card);
        });
    } catch (error) {
        console.error(error);
        requestsList.innerHTML = `<p style="color:red">Ошибка: ${error.message}</p>`;
    }
}

window.approveHero = async (id, name) => {
    if(!confirm(`Одобрить героя "${name}"?`)) return;
    try {
        const allSubs = await getDocs(collection(db, "submissions"));
        let targetData = null;
        allSubs.forEach(d => { if (d.id === id) targetData = d.data(); });

        if (!targetData) throw new Error("Данные не найдены");

        await addDoc(collection(db, "heroes"), {
            ...targetData,
            status: 'published',
            approvedAt: new Date(),
            approvedBy: auth.currentUser.email,
            birthDate: targetData.birthDate || "",
            deathDate: targetData.deathDate || "",
            battlePath: targetData.battlePath || "",
            video: targetData.video || null,
            image: targetData.image || "https://via.placeholder.com/400?text=Нет+фото"
        });

        await updateDoc(doc(db, "submissions", id), { status: 'approved' });
        alert('✅ Опубликован!');
        loadRequests();
    } catch (error) {
        alert("Ошибка: " + error.message);
    }
};

window.rejectHero = async (id) => {
    if(!confirm('Отклонить?')) return;
    await deleteDoc(doc(db, "submissions", id));
    alert('Удалено.');
    loadRequests();
};
