import { db } from './firebase-config.js';
import { collection, getDocs, query, where, addDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ⚠️ ВСТАВЬ СЮДА СВОЙ КЛЮЧ ОТ IMGBB (получить на imgbb.com/api)
const IMGBB_API_KEY = '5ecc8ac91b5b2b810d189851ed7ff416'; 

let heroesData = [];
let map = null;

document.addEventListener('DOMContentLoaded', () => {
    loadHeroesFromDB();
    loadQuests();
    loadMedia();
    initMap();

    // Навигация
    window.switchTab = (tabName) => {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
        document.getElementById(`tab-${tabName}`).classList.add('active');
        event.currentTarget.classList.add('active');
        if (tabName === 'map' && map) setTimeout(() => map.invalidateSize(), 300);
    };

    // Кнопки модальных окон
    document.getElementById('openAddModalBtn')?.addEventListener('click', () => toggleModal('modalAdd', true));
    document.querySelectorAll('.close-btn, .close-btn-add').forEach(btn => 
        btn.addEventListener('click', () => { toggleModal('modalAdd', false); toggleModal('modalDetails', false); })
    );
    
    document.getElementById('addStoryForm')?.addEventListener('submit', handleFormSubmit);
    document.getElementById('shareBtn')?.addEventListener('click', shareHero);
    document.getElementById('searchInput')?.addEventListener('input', filterHeroes);
});

function toggleModal(id, show) {
    const el = document.getElementById(id);
    if (el) {
        el.style.display = show ? 'flex' : 'none';
        document.body.style.overflow = show ? 'hidden' : 'auto';
    }
}

// --- ГЕРОИ И ЗАГРУЗКА ФОТО ---
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
    document.getElementById('modalStory').textContent = hero.story || '';
    document.getElementById('modalRank').textContent = hero.rank || '';
    document.getElementById('modalType').textContent = hero.type === 'frontovik' ? 'Фронтовик' : 'Тыл';
    document.getElementById('modalLocation').textContent = hero.location || 'Не указано';
    
    const bDate = hero.birthDate ? new Date(hero.birthDate).toLocaleDateString() : '?';
    const dDate = hero.deathDate ? new Date(hero.deathDate).toLocaleDateString() : '?';
    document.getElementById('modalDates').textContent = `${bDate} — ${dDate}`;

    // Боевой путь
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

    // Видео плеер
    const videoContainer = document.getElementById('videoPlayerContainer');
    videoContainer.innerHTML = '';
    if (hero.video) {
        // Простая проверка на YouTube для iframe, иначе video tag
        if (hero.video.includes('youtube.com') || hero.video.includes('youtu.be')) {
            const videoId = hero.video.split('v=')[1]?.split('&')[0] || hero.video.split('/').pop();
            videoContainer.innerHTML = `
                <h3>🎬 Видео-история</h3>
                <div class="video-wrapper">
                    <iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>
                </div>`;
        } else if (hero.video.includes('vk.com')) {
             videoContainer.innerHTML = `
                <h3>🎬 Видео-история</h3>
                <div class="video-wrapper">
                    <iframe src="${hero.video}" frameborder="0" allowfullscreen></iframe>
                </div>`;
        } else {
            videoContainer.innerHTML = `
                <h3>🎬 Видео-история</h3>
                <div class="video-wrapper">
                    <video controls><source src="${hero.video}" type="video/mp4"></video>
                </div>`;
        }
    }

    toggleModal('modalDetails', true);
}

function filterHeroes() {
    const text = document.getElementById('searchInput').value.toLowerCase();
    const filtered = heroesData.filter(h => h.name.toLowerCase().includes(text) || h.district.toLowerCase().includes(text));
    renderHeroes(filtered);
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const originalText = btn.textContent;
    
    btn.disabled = true;
    btn.textContent = '⏳ Загрузка фото...';

    try {
        let photoURL = 'https://via.placeholder.com/400?text=Нет+фото';
        let videoURL = document.getElementById('inpVideoLink').value.trim();

        // 1. ЗАГРУЗКА ФОТО НА IMGBB
        const photoFile = document.getElementById('inpFilePhoto').files[0];
        if (photoFile) {
            const formData = new FormData();
            formData.append('image', photoFile);
            formData.append('key', IMGBB_API_KEY);

            const response = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData });
            const result = await response.json();
            
            if (result.success) {
                photoURL = result.data.url;
            } else {
                throw new Error('Ошибка загрузки фото: ' + (result.error?.message || 'Неизвестная ошибка'));
            }
        }

        // 2. СОХРАНЕНИЕ В БАЗУ
        btn.textContent = '💾 Сохранение...';
        
        await addDoc(collection(db, "submissions"), {
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
            image: photoURL,
            video: videoURL || null,
            status: 'pending',
            createdAt: new Date()
        });

        alert('✅ Отправлено на модерацию!');
        document.getElementById('addStoryForm').reset();
        toggleModal('modalAdd', false);

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

// --- КАРТА ---
function initMap() {
    if (map) return;
    map = L.map('memoryMap').setView([57.0, 60.0], 7); 
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);

    // Пример точек (можно грузить из БД)
    const memorials = [
        { name: "Мемориал 'Черный Тюльпан'", coords: [56.83, 60.60], desc: "Екатеринбург" },
        { name: "Площадь 1905 года", coords: [56.84, 60.61], desc: "Вечный огонь" },
        { name: "Памятник труженикам тыла", coords: [57.05, 59.90], desc: "Верхняя Пышма" }
    ];
    memorials.forEach(m => L.marker(m.coords).addTo(map).bindPopup(`<b>${m.name}</b><br>${m.desc}`));
}

// --- МЕДИА ---
function loadMedia() {
    const vCont = document.getElementById('videoContainer');
    vCont.innerHTML = '<p style="padding:15px">Загрузка...</p>';
    
    // В реальной версии здесь нужно фильтровать heroesData по наличию video
    // Для демо покажем заглушку или пустоту, если данных нет
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
    aCont.innerHTML = '<div class="archive-card archive-item"><span class="archive-icon">📄</span><div>Пример архивного документа (PDF)</div></div>';
}

// --- КВЕСТЫ ---
function loadQuests() {
    const quests = [
        { id: 1, text: "Найти информацию о герое своего района", done: false },
        { id: 2, text: "Посетить мемориал и сделать фото", done: false },
        { id: 3, text: "Записать рассказ родственника", done: false }
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
