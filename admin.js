import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, getDocs, query, where, updateDoc, doc, deleteDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const requestsList = document.getElementById('requestsList');

// Проверка авторизации
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

// Вход
window.login = async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        document.getElementById('loginError').style.display = 'block';
        console.error(error);
    }
};

// Выход
window.logout = () => signOut(auth);

// Загрузка заявок (статус: pending)
async function loadRequests() {
    requestsList.innerHTML = '<p>Загрузка...</p>';
    // Ищем в коллекции 'submissions' где status == 'pending'
    const q = query(collection(db, "submissions"), where("status", "==", "pending"));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
        requestsList.innerHTML = '<p>Нет новых заявок. Все чисто! ✅</p>';
        return;
    }

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
            <p><strong>Звание:</strong> ${data.rank || 'Не указано'}</p>
            <p><strong>История:</strong><br>${data.story}</p>
            <p><strong>Контакты заявителя:</strong> ${data.contact || 'Не указано'}</p>
            <div class="btn-group">
                <button class="btn-approve" onclick="approveHero('${id}', '${data.name}')">✅ Одобрить и Опубликовать</button>
                <button class="btn-reject" onclick="rejectHero('${id}')">❌ Отклонить</button>
            </div>
        `;
        requestsList.appendChild(card);
    });
}

// Одобрение: Копируем в коллекцию 'heroes' со статусом published
window.approveHero = async (id, name) => {
    if(!confirm(`Одобрить героя ${name}? Он появится у всех пользователей.`)) return;

    const docRef = doc(db, "submissions", id);
    const dataSnap = await getDocs(query(collection(db, "submissions"), where("__name__", "==", id))); // Упрощено для примера
    
    // Получаем данные текущей заявки
    const reqDoc = await getDocs(query(collection(db, "submissions"))); 
    let targetData = null;
    reqDoc.forEach(d => { if(d.id === id) targetData = d.data(); });

    if(targetData) {
        // Добавляем в основную базу героев
        await addDoc(collection(db, "heroes"), {
            ...targetData,
            status: 'published',
            approvedAt: new Date(),
            approvedBy: auth.currentUser.email
        });

        // Удаляем из заявок или меняем статус
        await updateDoc(docRef, { status: 'approved' });
        alert('Герой опубликован!');
        loadRequests(); // Обновить список
    }
};

// Отклонение
window.rejectHero = async (id) => {
    if(!confirm('Отклонить эту заявку?')) return;
    await deleteDoc(doc(db, "submissions", id));
    alert('Заявка удалена.');
    loadRequests();
};
