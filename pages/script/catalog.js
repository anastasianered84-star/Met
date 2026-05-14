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

// ========== ПЕРЕХОД НА СТРАНИЦУ БРОНИРОВАНИЯ ==========
function openBookingModal(roomName, maxParticipants, roomId, pricePerHour) {
    if (!isAuthenticated()) {
        showNotification('Необходимо войти в систему для бронирования', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
        return;
    }
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
        showNotification('Ошибка загрузки комнат', 'error');
    }
}

function displayRooms(rooms) {
    const container = document.getElementById('roomsContainer');
    if (!container) return;
    
    if (rooms.length === 0) {
        container.innerHTML = `
            <div class="no-results">
                <i class="fa-solid fa-search"></i>
                <h3>Комнаты не найдены</h3>
                <p>Попробуйте изменить параметры фильтрации</p>
            </div>
        `;
        return;
    }
    
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
            window.open(data.paymentUrl, '_blank');
            alert('✅ Бронирование создано! Оплатите в открывшемся окне.\nПосле оплаты вернитесь в личный кабинет.');
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

// ========== ФИЛЬТРАЦИЯ ==========
function filterRooms() {
    let filteredRooms = [...allRooms];
    const priceRange = document.getElementById('priceRange');
    if (priceRange) {
        const maxPrice = parseInt(priceRange.value);
        filteredRooms = filteredRooms.filter(room => room.price_per_hour <= maxPrice);
    }
    const activeCapacity = document.querySelector('.capacity-option.active');
    if (activeCapacity) {
        const capacityText = activeCapacity.textContent;
        if (capacityText.includes('до 4')) {
            filteredRooms = filteredRooms.filter(room => room.max_capacity <= 4);
        } else if (capacityText.includes('5-10')) {
            filteredRooms = filteredRooms.filter(room => room.max_capacity >= 5 && room.max_capacity <= 10);
        } else if (capacityText.includes('10+')) {
            filteredRooms = filteredRooms.filter(room => room.max_capacity > 10);
        }
    }
    const searchInput = document.querySelector('.search-box input');
    if (searchInput && searchInput.value) {
        const searchTerm = searchInput.value.toLowerCase().trim();
        filteredRooms = filteredRooms.filter(room => 
            room.title.toLowerCase().includes(searchTerm) || 
            (room.description && room.description.toLowerCase().includes(searchTerm))
        );
    }   
    displayRooms(filteredRooms);
    updateResultsCount(filteredRooms.length);
}



function resetFilters() {
    // Сброс цены
    const priceRange = document.getElementById('priceRange');
    if (priceRange) {
        priceRange.value = 1000;
        document.getElementById('priceValue').textContent = '1000₽';
    }
    
    // Сброс вместимости
    document.querySelectorAll('.capacity-option').forEach(option => {
        if (option.textContent.includes('5-10')) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
    
    // Сброс поиска
    const searchInput = document.querySelector('.search-box input');
    if (searchInput) {
        searchInput.value = '';
    }
    
    displayRooms(allRooms);
    updateResultsCount(allRooms.length);
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', function() {
    loadRooms();
    
    // Фильтр по цене
    const priceRange = document.getElementById('priceRange');
    if (priceRange) {
        const priceValue = document.getElementById('priceValue');
        priceRange.addEventListener('input', function() {
            priceValue.textContent = this.value + '₽';
            filterRooms();
        });
    }
    
    // Фильтр по вместимости
    const capacityOptions = document.querySelectorAll('.capacity-option');
    capacityOptions.forEach(option => {
        option.addEventListener('click', function() {
            capacityOptions.forEach(o => o.classList.remove('active'));
            this.classList.add('active');
            filterRooms();
        });
    });
    
    // Кнопка сброса фильтров
    const filterReset = document.querySelector('.filter-reset');
    if (filterReset) {
        filterReset.addEventListener('click', resetFilters);
    }
    
    // ========== ПОИСК ==========
    const searchInput = document.querySelector('.search-box input');
    const searchButton = document.querySelector('.search-box button');
    
    if (searchInput) {
        searchInput.addEventListener('keyup', function(e) {
            filterRooms(); // фильтруем при каждом вводе
        });
    }
    
    if (searchButton) {
        searchButton.addEventListener('click', function() {
            filterRooms();
        });
    }
    // ==========================
    
    // Переключение вида (сетка/список)
    const gridViewBtn = document.getElementById('gridView');
    const listViewBtn = document.getElementById('listView');
    const roomsContainer = document.getElementById('roomsContainer');
    
    if (gridViewBtn && listViewBtn && roomsContainer) {
        gridViewBtn.addEventListener('click', function() {
            roomsContainer.classList.remove('list-view');
            gridViewBtn.classList.add('active');
            listViewBtn.classList.remove('active');
        });
        
        listViewBtn.addEventListener('click', function() {
            roomsContainer.classList.add('list-view');
            listViewBtn.classList.add('active');
            gridViewBtn.classList.remove('active');
        });
    }
});