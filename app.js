import { db, auth } from './firebase-config.js';
import { collection, getDocs, query, where, addDoc, updateDoc, doc, orderBy, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ✅ ВАШ КЛЮЧ IMGBB
const IMGBB_API_KEY = '5ecc8ac91b5b2b810d189851ed7ff416'; 

let heroesData = [];
let map = null;
let currentUser = null;
let isLoginMode = true;

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        updateUIForUser();
        if (user) loadMyHeroes();
    });

    loadHeroesFromDB();
    loadQuests();
    loadMedia();
    initMap();

    window.switchTab = (tabName) => {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
        document.getElementById(`tab-${tabName}`).classList.add('active');
        event.currentTarget.classList.add('active');
        if (tabName === 'map' && map) setTimeout(() => map.invalidateSize(), 300);
    };

    document.getElementById('profileBtn')?.addEventListener('click', () => toggleAuthModal(true));
    
    document.getElementById('authForm')?.addEventListener('submit', handleAuth);
    document.getElementById('authToggleLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        document.getElementById('authTitle').textContent = isLoginMode ? 'Вход' : 'Регистрация';
        document.getElementById('authSubmitBtn').textContent = isLoginMode ? 'Войти' : 'Зарегистрироваться';
        document.getElementById('authToggleText').textContent = isLoginMode ? 'Нет аккаунта?' : 'Есть аккаунт?';
        document.getElementById('authToggleLink').textContent = isLoginMode ? 'Зарегистрироваться' : 'Войти';
    });
    
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await signOut(auth);
        toggleAuthModal(false);
        // alert('Вы вышли из аккаунта'); // Можно убрать алерт, чтобы не мешал
    });

    document.getElementById('openAddModalBtn')?.addEventListener('click', openAddForm);
    document.querySelectorAll('.close-btn, .close-btn-add').forEach(btn => 
        btn.addEventListener('click', () => { 
            document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); 
            document.body.style.overflow = 'auto'; 
        })
    );
    
    document.getElementById('addStoryForm')?.addEventListener('submit', handleFormSubmit);
    document.getElementById('shareBtn')?.addEventListener('click', shareHero);
    document.getElementById('editOwnHeroBtn')?.addEventListener('click', editOwnHero);
    document.getElementById('searchInput')?.addEventListener('input', filterHeroes);
});

function toggleAuthModal(show) {
    const modal = document.getElementById('authModal');
    const form = document.getElementById('authForm');
    const dashboard = document.getElementById('userDashboard');
    
    modal.style.display = show ? 'flex' : 'none';
    
    if (show && currentUser) {
        form.style.display = 'none';
        dashboard.style.display = 'block';
        document.getElementById('userInfo').textContent = currentUser.email;
        document.getElementById('authTitle').textContent = 'Личный кабинет';
        document.getElementById('authToggleText').parentElement.style.display = 'none';
        loadMyHeroes();
    } else if (show) {
        form.style.display = 'block';
        dashboard.style.display = 'none';
        document.getElementById('authToggleText').parentElement.style.display = 'block';
        document.getElementById('authTitle').textContent = isLoginMode ? 'Вход' : 'Регистрация';
    }
}

function updateUIForUser() {
    const btn = document.getElementById('profileBtn');
    btn.textContent = currentUser ? '✅' : '👤';
}

async function loadMyHeroes() {
    if (!currentUser) return;
    const list = document.getElementById('myHeroesList');
    list.innerHTML = '<p style="font-size:0.8rem;">Загрузка...</p>';
    
    try {
        const q = query(collection(db, "submissions"), where("addedBy", "==", currentUser.uid));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            list.innerHTML = '<p style="font-size:0.8rem; color:#777;">Вы пока ничего не добавляли.</p>';
            return;
        }
        
        list.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const div = document.createElement('div');
            div.className = 'my-hero-item';
            let statusText = data.status === 'published' ? '✅' : (data.status === 'pending_update' ? '⏳ Изм.' : '⏳ Нов.');
            div.innerHTML = `<span>${statusText} ${data.name}</span><button onclick="openAddFormById('${doc.id}')">✏️</button>`;
            list.appendChild(div);
        });
    } catch (e) {
        console.error(e);
        list.innerHTML = '<p style="color:red">Ошибка</p>';
    }
}

window.openAddFormById = async (id) => {
    const d = await getDoc(doc(db, "submissions", id));
    if (d.exists()) openAddForm({id: d.id, ...d.data()});
};

function openAddForm(heroToEdit = null) {
    if (!currentUser && !heroToEdit) {
        alert('⚠️ Пожалуйста, войдите в аккаунт.');
        toggleAuthModal(true);
        return;
    }
    const modal = document.getElementById('modalAdd');
    const form = document.getElementById('addStoryForm');
    const title = document.getElementById('formTitle');
    const submitBtn = document.getElementById('submitBtn');
    const editIdInput = document.getElementById('editHeroId');
    const currentPhotoInfo = document.getElementById('currentPhotoInfo');
    const fileInput = document.getElementById('inpFilePhoto');

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    form.reset();
    editIdInput.value = ''; // Сбрасываем ID редактирования
    currentPhotoInfo.style.display = 'none';
    fileInput.required = true; // Для нового героя фото обязательно

    if (heroToEdit) {
        // РЕЖИМ РЕДАКТИРОВАНИЯ
        title.textContent = 'Редактирование (на модерацию)';
        submitBtn.textContent = 'Отправить изменения';
        editIdInput.value = heroToEdit.id;
        
        document.getElementById('inpName').value = heroToEdit.name || '';
        document.getElementById('inpBirth').value = heroToEdit.birthDate || '';
        document.getElementById('inpDeath').value = heroToEdit.deathDate || '';
        document.getElementById('inpRank').value = heroToEdit.rank || '';
        document.getElementById('inpType').value = heroToEdit.type || 'tyl';
        document.getElementById('inpStory').value = heroToEdit.story || '';
        document.getElementById('inpPath').value = heroToEdit.battlePath || '';
        document.getElementById('inpDistrict').value = heroToEdit.district || '';
        document.getElementById('inpLocation').value = heroToEdit.location || '';
        document.getElementById('inpVideoLink').value = heroToEdit.video || '';
        
        currentPhotoInfo.style.display = 'block';
        fileInput.required = false; // При редактировании фото не обязательно
    } else {
        // РЕЖИМ НОВОГО ГЕРОЯ
        title.textContent = 'Добавить героя';
        submitBtn.textContent = 'Отправить на модерацию';
    }
}

async function loadHeroesFromDB() {
    const container = document.getElementById('heroesContainer');
    if (!container) return;
    container.innerHTML = '<div style="padding:20px; text-align:center">Загрузка...</div>';
    try {
        const q = query(collection(db, "heroes"), where("status", "==", "published"));
        const snapshot = await getDocs(q);
        heroesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        document.getElementById('statsDisplay').textContent = `Найдено: ${heroesData.length}`;
        renderHeroes(heroesData);
    } catch (e) {
        console.error(e);
        container.innerHTML = 'Ошибка загрузки.';
    }
}

function renderHeroes(list) {
    const container = document.getElementById('heroesContainer');
    container.innerHTML = '';
    if (list.length === 0) {
        container.innerHTML = '<p style="padding:20px; text-align:center">Ничего не найдено</p>';
        return;
    }
    list.forEach(hero => {
        const card = document.createElement('div');
        card.className = 'hero-card';
        card.innerHTML = `
            <img src="${hero.image || 'https://via.placeholder.com/400?text=Нет+фото'}" class="hero-img">
            <div class="hero-info">
                <div class="hero-name">${hero.name}</div>
                <div class="hero-district">📍 ${hero.district}</div>
                <div class="hero-rank">${hero.rank || ''}</div>
            </div>`;
        card.onclick = () => openHeroDetails(hero);
        container.appendChild(card);
    });
}

function openHeroDetails(hero) {
    document.getElementById('modalImg').src = hero.image || '';
    document.getElementById('modalName').textContent = hero.name;
    document.getElementById('modalStory').textContent = hero.story || 'Биография не указана';
    document.getElementById('modalRank').textContent = hero.rank || '';
    document.getElementById('modalType').textContent = hero.type === 'frontovik' ? 'Фронтовик' : 'Труженик тыла';
    document.getElementById('modalLocation').textContent = hero.location || 'Не указано';
    
    const bDate = hero.birthDate ? new Date(hero.birthDate).toLocaleDateString() : '?';
    const dDate = hero.deathDate ? new Date(hero.deathDate).toLocaleDateString() : '?';
    document.getElementById('modalDates').textContent = `${bDate} — ${dDate}`;

    const pathList = document.getElementById('battlePathList');
    pathList.innerHTML = '';
    if (hero.battlePath) {
        hero.battlePath.split(';').forEach(p => {
            if (p.trim()) {
                const li = document.createElement('li');
                li.textContent = p.trim();
                pathList.appendChild(li);
            }
        });
    } else {
        pathList.innerHTML = '<li>Информация отсутствует</li>';
    }

    const videoContainer = document.getElementById('videoPlayerContainer');
    videoContainer.innerHTML = '';
    if (hero.video) {
        if (hero.video.includes('youtube.com') || hero.video.includes('youtu.be')) {
            const videoId = hero.video.split('v=')[1]?.split('&')[0] || hero.video.split('/').pop();
            videoContainer.innerHTML = `<h3>🎬 Видео</h3><div class="video-wrapper"><iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0"></iframe></div>`;
        } else if (hero.video.includes('vk.com')) {
             videoContainer.innerHTML = `<h3>🎬 Видео</h3><div class="video-wrapper"><iframe src="${hero.video}" frameborder="0"></iframe></div>`;
        } else {
            videoContainer.innerHTML = `<h3>🎬 Видео</h3><div class="video-wrapper"><video controls><source src="${hero.video}"></video></div>`;
        }
    }

    const editBtn = document.getElementById('editOwnHeroBtn');
    if (currentUser && hero.addedBy === currentUser.uid) {
        editBtn.style.display = 'block';
        editBtn.onclick = () => openAddForm(hero);
    } else {
        editBtn.style.display = 'none';
    }

    document.getElementById('modalDetails').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function editOwnHero() {}

function filterHeroes() {
    const text = document.getElementById('searchInput').value.toLowerCase();
    const filtered = heroesData.filter(h => h.name.toLowerCase().includes(text) || h.district.toLowerCase().includes(text));
    renderHeroes(filtered);
}

async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPass').value;
    try {
        if (isLoginMode) await signInWithEmailAndPassword(auth, email, pass);
        else await createUserWithEmailAndPassword(auth, email, pass);
        toggleAuthModal(false);
        alert(isLoginMode ? 'С возвращением!' : 'Аккаунт создан!');
    } catch (error) { alert('Ошибка: ' + error.message); }
}

// --- ГЛАВНАЯ ФУНКЦИЯ ОТПРАВКИ (ИСПРАВЛЕНА) ---
async function handleFormSubmit(e) {
    e.preventDefault();
    if (!currentUser) return alert('Ошибка авторизации');
    
    const btn = document.getElementById('submitBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ Обработка...';

    try {
        let photoURL = null;
        const editId = document.getElementById('editHeroId').value.trim(); // Получаем ID редактирования
        const fileInput = document.getElementById('inpFilePhoto');
        
        // 1. Загрузка фото (если выбрано)
        if (fileInput.files[0]) {
            btn.textContent = '⏳ Загрузка фото...';
            const formData = new FormData();
            formData.append('image', fileInput.files[0]);
            formData.append('key', IMGBB_API_KEY);
            
            const response = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData });
            const result = await response.json();
            
            if (result.success) {
                photoURL = result.data.url;
            } else {
                throw new Error('Ошибка загрузки фото: ' + (result.error?.message || 'Неизвестная ошибка'));
            }
        }

        btn.textContent = '💾 Сохранение...';
        
        // Сбор данных формы
        const formData = {
            name: document.getElementById('inpName').value,
            birthDate: document.getElementById('inpBirth').value,
            deathDate: document.getElementById('inpDeath').value,
            rank: document.getElementById('inpRank').value,
            type: document.getElementById('inpType').value,
            story: document.getElementById('inpStory').value,
            battlePath: document.getElementById('inpPath').value,
            district: document.getElementById('inpDistrict').value,
            location: document.getElementById('inpLocation').value,
            contact: document.getElementById('inpContact').value,
            video: document.getElementById('inpVideoLink').value.trim(),
            addedBy: currentUser.uid,
            updatedAt: new Date()
        };

        if (photoURL) formData.image = photoURL;

        // 2. ЛОГИКА: НОВЫЙ ИЛИ РЕДАКТИРОВАНИЕ?
        if (editId) {
            // === РЕДАКТИРОВАНИЕ СУЩЕСТВУЮЩЕГО ===
            // Если это редактирование, берем старое фото, если новое не загружено
            if (!photoURL) {
                // Ищем оригинал в текущем списке героев или в базе submissions
                const original = heroesData.find(h => h.id === editId);
                if (original && original.image) {
                    formData.image = original.image;
                }
            }
            
            await addDoc(collection(db, "submissions"), {
                ...formData,
                originalHeroId: editId,
                status: 'pending_update', // Статус: ожидает обновления
                changeType: 'update',
                createdAt: new Date()
            });
            alert('✅ Изменения отправлены на модерацию!');
            
        } else {
            // === СОЗДАНИЕ НОВОГО ГЕРОЯ ===
            // Фото обязательно для новых (проверено в openAddForm)
            if (!photoURL && !formData.image) {
                 // Если фото так и не загрузилось и старого нет
                 // Но мы требовали файл в openAddForm, так что photoURL должен быть
            }

            await addDoc(collection(db, "submissions"), {
                ...formData,
                status: 'pending', // Статус: новая заявка
                changeType: 'create',
                createdAt: new Date()
            });
            alert('✅ История отправлена на модерацию!');
        }

        document.getElementById('addStoryForm').reset();
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        document.body.style.overflow = 'auto';
        loadMyHeroes(); // Обновить список в профиле

    } catch (error) {
        console.error(error);
        alert('❌ Ошибка: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

function shareHero() {
    const name = document.getElementById('modalName').textContent;
    if (navigator.share) navigator.share({ title: 'Урал Помнит', text: `Герой: ${name}`, url: location.href });
    else alert('Ссылка скопирована!');
}

function initMap() {
    if (map) return;
    map = L.map('memoryMap').setView([57.0, 60.0], 7); 
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);

    const memorials = [
        { name: "Мемориал 'Черный Тюльпан'", coords: [56.83, 60.60], desc: "Екатеринбург" },
        { name: "Площадь 1905 года", coords: [56.84, 60.61], desc: "Вечный огонь" },
        { name: "Памятник труженикам тыла", coords: [57.05, 59.90], desc: "Верхняя Пышма" },
        { name: "Мемориал воинам-уральцам", coords: [56.85, 60.65], desc: "Парк Чкалова, Екатеринбург" },
        { name: "Памятник Маршалу Жукову", coords: [56.83, 60.62], desc: "Екатеринбург" },
        { name: "Памятник заводчанам", coords: [56.95, 60.15], desc: "Первоуральск" },
        { name: "Мемориал Славы", coords: [56.78, 60.55], desc: "Сысерть" },
        { name: "Стела Героям", coords: [57.20, 61.50], desc: "Талица" },
        { name: "Мемориал павшим", coords: [56.50, 59.80], desc: "Полевской" },
        { name: "Памятник воинам ВОВ", coords: [58.40, 60.80], desc: "Нижний Тагил" },
        { name: "Мемориал 'Катюша'", coords: [56.40, 60.90], desc: "Арамиль" }
    ];
    
    memorials.forEach(m => L.marker(m.coords).addTo(map).bindPopup(`<b>${m.name}</b><br>${m.desc}`));
}

function loadMedia() {
    const vCont = document.getElementById('videoContainer');
    vCont.innerHTML = '<p style="padding:15px">Загрузка...</p>';
    const videos = heroesData.filter(h => h.video);
    if (videos.length === 0) {
        vCont.innerHTML = '<p style="padding:15px">Видео-историй пока нет.</p>';
    } else {
        vCont.innerHTML = videos.map(v => `
            <div class="video-card">
                <div style="padding:10px; font-weight:bold;">${v.name}</div>
                <div class="video-wrapper">
                    ${v.video.includes('youtube') ? 
                      `<iframe src="https://www.youtube.com/embed/${v.video.split('v=')[1]}" frameborder="0"></iframe>` : 
                      `<video controls><source src="${v.video}"></video>`}
                </div>
            </div>
        `).join('');
    }
    const aCont = document.getElementById('archiveContainer');
    aCont.innerHTML = '<div class="archive-card archive-item"><span class="archive-icon">📄</span><div>Архивные документы (скоро)</div></div>';
}

function loadQuests() {
    const quests = [
        { id: 1, text: "Зарегистрироваться в приложении", done: false },
        { id: 2, text: "Добавить историю героя", done: false },
        { id: 3, text: "Посетить мемориал", done: false }
    ];
    const saved = JSON.parse(localStorage.getItem('uralQuests') || '[]');
    quests.forEach(q => { if(saved.includes(q.id)) q.done = true; });
    document.getElementById('questList').innerHTML = quests.map(q => `
        <div class="quest-item ${q.done ? 'completed' : ''}">
            <span>${q.text}</span>
            ${!q.done ? `<button class="quest-btn" onclick="completeQuest(${q.id})">Выполнено</button>` : '✅'}
        </div>
    `).join('');
    const done = quests.filter(q => q.done).length;
    document.getElementById('questBar').style.width = `${(done/quests.length)*100}%`;
    document.getElementById('questScore').textContent = `${done}/${quests.length}`;
}
window.completeQuest = (id) => {
    const saved = JSON.parse(localStorage.getItem('uralQuests') || '[]');
    if (!saved.includes(id)) {
        saved.push(id);
        localStorage.setItem('uralQuests', JSON.stringify(saved));
        alert('🎉 Задание выполнено!');
        loadQuests();
    }
};
