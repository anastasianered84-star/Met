const API_BASE_URL = 'https://metabook-production.up.railway.app/api';
const API_HOST = 'https://metabook-production.up.railway.app';

function getImageUrl(path) {
    if (!path || path === 'qwe') return 'https://images.unsplash.com/photo-1593118247619-e2d6f056869e?w=600';
    if (path.startsWith('http')) return path;
    if (path.startsWith('/')) return API_HOST + path;
    return API_HOST + '/' + path;
}

function getCurrentUser() {
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');
    if (!token || !userId) return null;
    return { token, userId: parseInt(userId) };
}

function isAuthenticated() {
    return localStorage.getItem('authToken') !== null && localStorage.getItem('userId') !== null;
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    const colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6' };
    notification.style.cssText = `
        position: fixed; top: 80px; right: 20px; padding: 12px 20px;
        background: ${colors[type] || colors.info}; color: white;
        border-radius: 8px; z-index: 10000; animation: fadeIn 0.3s ease;
    `;
    notification.innerHTML = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// ========== ГЛАВНОЕ — ПЕРЕХОД НА СТРАНИЦУ БРОНИРОВАНИЯ ==========
function openBookingModal(roomName, maxParticipants, roomId, pricePerHour) {
    if (!isAuthenticated()) {
        showNotification('Необходимо войти в систему для бронирования', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
        return;
    }
    // Здесь ВЕСЬ функционал бронирования — на отдельной странице
    window.location.href = `booking-room.html?id=${roomId}`;
}

let allRooms = [];

async function loadRooms() {
    try {
        const response = await fetch(`${API_BASE_URL}/Room/list`);
        const data = await response.json();
        if (data.success && data.rooms) {
            allRooms = data.rooms;
            displayRooms(allRooms);
            updateResultsCount(allRooms.length);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function displayRooms(rooms) {
    const container = document.getElementById('roomsContainer');
    if (!container) return;
    container.innerHTML = rooms.map(room => `
        <div class="room-card" data-room-id="${room.id}">
            <div class="room-image">
                <img src="${getImageUrl(room.base_image_url)}" alt="${room.title}">
                <div class="room-badge">${room.price_per_hour === 0 ? 'Бесплатно' : 'Популярное'}</div>
                <button class="favorite-btn" onclick="toggleFavorite(${room.id})">
                    <i class="fa-regular fa-heart"></i>
                </button>
            </div>
            <div class="room-content">
                <h3 class="room-title">${escapeHtml(room.title)}</h3>
                <p class="room-description">${escapeHtml(room.description || '')}</p>
                <div class="room-meta">
                    <span>до ${room.max_capacity} чел</span>
                    <span>${room.price_per_hour}₽/час</span>
                </div>
                <button class="btn btn-primary" onclick="openBookingModal('${escapeHtml(room.title)}', ${room.max_capacity}, ${room.id}, ${room.price_per_hour})">
                    Забронировать
                </button>
            </div>
        </div>
    `).join('');
    loadFavorites();
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function toggleFavorite(roomId) {
    let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    if (favorites.includes(roomId)) {
        favorites = favorites.filter(id => id !== roomId);
        showNotification('Удалено из избранного', 'info');
    } else {
        favorites.push(roomId);
        showNotification('Добавлено в избранное', 'success');
    }
    localStorage.setItem('favorites', JSON.stringify(favorites));
    loadFavorites();
}

function loadFavorites() {
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        const card = btn.closest('.room-card');
        if (card) {
            const id = parseInt(card.dataset.roomId);
            if (favorites.includes(id)) {
                btn.querySelector('i').classList.add('fa-solid');
                btn.style.color = '#ef4444';
            } else {
                btn.querySelector('i').classList.remove('fa-solid');
                btn.style.color = '';
            }
        }
    });
}
async function processPayment(bookingId, amount, roomName) {
    try {
        const response = await fetch(`${API_BASE_URL}/Payment/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
                bookingId: bookingId,
                amount: amount,
                roomName: roomName
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.paymentUrl) {
            // Открываем оплату в новом окне
            window.open(data.paymentUrl, '_blank');
            
            // Показываем сообщение
            alert('✅ Бронирование создано! Оплатите в открывшемся окне.\nПосле оплаты вернитесь в личный кабинет.');
            
            // Переходим в список бронирований
            window.location.href = 'booking.html';
        } else {
            alert('❌ Ошибка: ' + (data.message || 'Не удалось создать платёж'));
        }
    } catch (error) {
        console.error('Payment error:', error);
        alert('❌ Ошибка при создании платежа');
    }
}
function updateResultsCount(count) {
    const el = document.querySelector('.results-count');
    if (el) el.textContent = `Найдено: ${count} комнат`;
}

document.addEventListener('DOMContentLoaded', loadRooms);